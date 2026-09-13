'use strict';

/**
 * A running Tutor service, driven the way the learner's browser drives it.
 *
 *   const service = await TutorService.start(t, ws);   // stopped when the test ends
 *   const health = await service.get('/api/health');
 *   const { events } = await service.ask({ question: '这是什么？' });
 *
 * Two things make this a black box, and both are the point. The service runs as
 * its own process on a port of its own, so nothing here can reach inside it —
 * every claim a test makes is about bytes that crossed a socket. And the agent
 * it spawns is a stub binary placed first on `PATH`, so `claude` is never run
 * for real: the stub records how it was invoked and replays a fixed transcript,
 * which is what makes the streaming shapes and the payload the agent receives
 * observable from outside at all.
 *
 * `Workspace.run()` waits for a command to exit, so it cannot host a server.
 * This is that missing method.
 */

const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

/** The binary the service spawns, by name. The stub is placed under this name. */
const AGENT = 'claude';

const READY_TIMEOUT_MS = 15_000;

/**
 * Stands in for the headless agent. It replays its transcript in three awkward
 * slices, so the service's NDJSON line buffering is exercised rather than
 * assumed. Cuts never land inside a multi-byte character: the service decodes
 * each chunk on its own, and a split character is a defect this stub must not
 * manufacture on its behalf.
 *
 * It records where it cut, because that is the half it can actually promise —
 * whether the reader sees those cuts as separate chunks is the pipe's business,
 * and a reader that stalls long enough gets the lot in one.
 *
 * Its shebang names this interpreter outright, because `PATH` is about to hold
 * nothing but the directory it sits in.
 */
const STUB_AGENT = `#!${process.execPath}
'use strict';

const fs = require('node:fs');

const SLICE_GAP_MS = 15;

const out = fs.readFileSync(process.env.STUB_TRANSCRIPT);

const cuts = [0];
for (let n = 1; n < 3; n++) {
  let at = Math.floor((out.length * n) / 3);
  while (at < out.length && (out[at] & 0xc0) === 0x80) at++;
  cuts.push(at);
}
cuts.push(out.length);

const slices = [];
for (let i = 0; i < cuts.length - 1; i++) {
  if (cuts[i + 1] > cuts[i]) slices.push(out.subarray(cuts[i], cuts[i + 1]));
}

// Where this stub cut is a fact about the stub. Where the reader sees a chunk
// boundary is a fact about the pipe, and not one either side can promise.
fs.writeFileSync(
  process.env.STUB_RUN,
  JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd(), cuts }),
  'utf8'
);

process.exitCode = Number(process.env.STUB_EXIT || 0);

(function next() {
  const slice = slices.shift();
  if (!slice) {
    if (process.env.STUB_STDERR) process.stderr.write(process.env.STUB_STDERR);
    // An agent that never finishes, which is the only way to reach the
    // service's own timeout from outside it. Held open by a timer rather than
    // by a sleep, so the service killing it still ends the process at once.
    if (process.env.STUB_HANG) setInterval(() => {}, 1000);
    return;
  }
  process.stdout.write(slice, () => setTimeout(next, SLICE_GAP_MS));
})();
`;

// ---------------------------------------------------------------- transcript

/** The stream shapes the service documents, as the agent emits them. */
const agentSays = {
  /** Answer text, streamed a piece at a time. */
  delta: (text) => ({
    type: 'stream_event',
    event: { type: 'content_block_delta', delta: { type: 'text_delta', text } },
  }),
  /** Reasoning. Carried on the same envelope as `delta`, and must not reach the learner. */
  thinking: (text) => ({
    type: 'stream_event',
    event: { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: text } },
  }),
  /** A workspace read, which the learner is shown so gathering context is visible. */
  reads: (name, input) => ({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', name, input }] },
  }),
  /** Anything the service is expected to ignore. */
  noise: (type) => ({ type, subtype: 'init', session_id: 'stub' }),
  /** The final answer. */
  result: (text) => ({ type: 'result', result: text, is_error: false }),
  /** The agent itself reporting failure, as opposed to exiting non-zero. */
  failure: (message) => ({ type: 'result', result: message, is_error: true }),
};

// ---------------------------------------------------------------- responses

class Response {
  constructor(status, headers, bytes) {
    this.status = status;
    this.headers = headers;
    this.bytes = bytes;
    this.body = bytes.toString('utf8');
  }

  json() {
    return JSON.parse(this.body);
  }

  /**
   * The response read as the event stream it claims to be. Every frame must
   * parse: a body that is not SSE throws here rather than yielding an empty
   * list a test would then assert nothing about.
   */
  events() {
    const events = [];
    for (const block of this.body.split('\n\n')) {
      const frame = block.trim();
      if (!frame) continue;
      const parsed = /^event: (.+)\ndata: (.*)$/.exec(frame);
      if (!parsed) throw new Error(`not an SSE frame: ${JSON.stringify(frame.slice(0, 120))}`);
      events.push({ event: parsed[1], data: JSON.parse(parsed[2]) });
    }
    return events;
  }

  /** Just the event names, which is usually the assertion worth reading. */
  sequence() {
    return this.events().map((e) => e.event);
  }
}

// ---------------------------------------------------------------- the service

class TutorService {
  /**
   * Start the service installed in `ws`, on a port of its own, with a stub
   * agent first on `PATH`. Bound to the test's lifetime: killed when it ends,
   * pass or fail.
   *
   * Options:
   *   agent   transcript for the stub to replay, as NDJSON objects.
   *           `null` installs no stub at all, leaving `claude` unfindable.
   *   exit    exit code for the stub (default 0)
   *   stderr  what the stub writes to stderr before exiting
   *   hangs   the stub never exits, so the service's own answer timeout is the
   *           only thing that can end the request
   *   idleTimeoutMs  how long the service tolerates having no requests
   *   answerTimeoutMs  how long the service waits for an answer
   */
  static async start(
    t,
    ws,
    { agent = [], exit = 0, stderr = '', hangs = false, idleTimeoutMs, answerTimeoutMs } = {},
  ) {
    if (!ws.exists('tutor/server.js')) {
      throw new Error('TutorService.start: nothing installed at tutor/server.js — scaffold the Workspace first');
    }

    const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'explorable-teach-agent-'));
    t.after(() => fs.rmSync(bin, { recursive: true, force: true }));

    const runFile = path.join(bin, 'run.json');
    const transcriptFile = path.join(bin, 'transcript.ndjson');

    if (agent) {
      fs.writeFileSync(transcriptFile, agent.map((event) => JSON.stringify(event) + '\n').join(''), 'utf8');
      fs.writeFileSync(path.join(bin, AGENT), STUB_AGENT, { mode: 0o755 });
    }

    const env = {
      ...process.env,
      // First and alone: the real `claude` must not be reachable from here even
      // if the machine running the suite has one installed.
      PATH: bin,
      STUB_RUN: runFile,
      STUB_TRANSCRIPT: transcriptFile,
      STUB_EXIT: String(exit),
      STUB_STDERR: stderr,
      STUB_HANG: hangs ? '1' : '',
    };
    if (idleTimeoutMs != null) env.IDLE_TIMEOUT_MS = String(idleTimeoutMs);
    if (answerTimeoutMs != null) env.ANSWER_TIMEOUT_MS = String(answerTimeoutMs);

    // A port is free until something else takes it, so losing the race is a
    // possibility rather than a defect. Try again on a different one.
    let last;
    for (let attempt = 0; attempt < 5; attempt++) {
      const port = await freePort();
      const service = new TutorService(ws, port, spawn(process.execPath, [ws.path('tutor/server.js')], {
        cwd: ws.dir,
        env: { ...env, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe'],
      }), runFile);

      t.after(() => service.stop());

      try {
        await service.ready();
        return service;
      } catch (err) {
        await service.stop();
        last = err;
        if (!/EADDRINUSE/.test(service.log()) && !/is held by pid/.test(err.message)) throw err;
      }
    }
    throw last;
  }

  constructor(ws, port, child, runFile) {
    this.ws = ws;
    this.port = port;
    this.child = child;
    this.runFile = runFile;
    this.exited = null;
    this.output = '';

    child.stdout.on('data', (c) => { this.output += c.toString('utf8'); });
    child.stderr.on('data', (c) => { this.output += c.toString('utf8'); });
    // 'close' rather than 'exit': 'exit' fires with output still in the pipe,
    // and both callers below read log() the instant this flips.
    child.on('close', (code, signal) => { this.exited = { code, signal }; });
  }

  /** Everything the service has written to stdout and stderr, for diagnostics. */
  log() {
    return this.output;
  }

  /** Resolve once *this* service answers, or throw with whatever it said instead. */
  async ready() {
    const deadline = Date.now() + READY_TIMEOUT_MS;
    let foreign = null;

    for (;;) {
      if (this.exited) throw new Error(`the service exited before answering:\n${this.log()}`);
      try {
        const res = await this.get('/api/health');
        if (res.status === 200) {
          // A port was free a moment ago rather than reserved, so something
          // else can be holding it — another test file's service, most likely.
          // Answering is not enough; it has to be ours, or every claim below
          // would be made about someone else's Workspace.
          const { pid } = res.json();
          if (pid === this.child.pid) return this;
          foreign = pid;
        }
      } catch {
        // Not listening yet.
      }
      if (Date.now() > deadline) {
        throw new Error(
          foreign === null
            ? `the service never answered:\n${this.log()}`
            : `port ${this.port} is held by pid ${foreign}, not by this service:\n${this.log()}`,
        );
      }
      await sleep(25);
    }
  }

  request(method, urlPath, { body = null, headers = {} } = {}) {
    return request(this.port, method, urlPath, { body, headers });
  }

  get(urlPath) {
    return this.request('GET', urlPath);
  }

  post(urlPath, body) {
    return this.request('POST', urlPath, { body });
  }

  /** One question, as the in-page drawer asks it. */
  ask(body) {
    return this.post('/api/ask', body);
  }

  /**
   * How the stub agent was invoked — its argv and its working directory. That
   * argv is the only window onto the payload the service built, so most claims
   * about what the agent was actually asked are made through here. Null until
   * the service has spawned it.
   */
  agentRun() {
    try {
      return JSON.parse(fs.readFileSync(this.runFile, 'utf8'));
    } catch {
      return null;
    }
  }

  agentArgv() {
    const run = this.agentRun();
    return run && run.argv;
  }

  /** The value the service passed for a flag — `-p`, `--append-system-prompt`. */
  agentFlag(flag) {
    const argv = this.agentArgv();
    if (!argv) return null;
    const at = argv.indexOf(flag);
    return at === -1 || at === argv.length - 1 ? null : argv[at + 1];
  }

  /** Wait for the service's process to end on its own — an idle exit, say. */
  async waitForExit(timeout = 10_000) {
    return waitFor('the service to exit', () => this.exited, { timeout });
  }

  stop() {
    if (this.exited) return Promise.resolve();
    this.child.kill('SIGKILL');
    return new Promise((resolve) => this.child.on('close', resolve));
  }
}

// ---------------------------------------------------------------- plumbing

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll until `probe` returns something truthy, then hand it back. Throws naming
 * what it waited for, because a bare timeout tells a maintainer nothing.
 */
async function waitFor(what, probe, { timeout = 5000, interval = 20 } = {}) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const value = await probe();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`timed out after ${timeout}ms waiting for ${what}`);
    await sleep(interval);
  }
}

/** A port nothing was listening on a moment ago. */
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

/**
 * One request, one response, no connection reuse — a kept-alive socket would
 * hold the service open past the shutdown a test is waiting to observe.
 */
function request(port, method, urlPath, { body = null, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const payload =
      body == null ? null : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body), 'utf8');

    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        method,
        path: urlPath,
        agent: false,
        headers: {
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('error', reject);
        res.on('end', () => resolve(new Response(res.statusCode, res.headers, Buffer.concat(chunks))));
      },
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

module.exports = { TutorService, Response, STUB_AGENT, agentSays, waitFor, request, freePort };
