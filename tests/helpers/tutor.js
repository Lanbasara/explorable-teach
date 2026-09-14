'use strict';

/**
 * A running Tutor service, driven the way the learner's browser drives it —
 * and, at the end, the one thing in `runtime/tutor/` the rest of the suite has
 * to read rather than run: the token `GRADER.md` mandates a refusal opens with.
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
 * It starts the service in either of the two ways a Workspace's owner can.
 * Directly is what most of the suite wants. `{ control: true }` starts it
 * through `tutor/tutorctl.sh` — the one way every document tells the Learner to
 * start it, and for a long time the one way nothing here ran.
 *
 * `Workspace.run()` waits for a command to exit, so it cannot host a server.
 * This is that missing method.
 */

const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const { REPO_ROOT } = require('./workspace.js');

/** The binary the service spawns, by name. The stub is placed under this name. */
const AGENT = 'claude';

const READY_TIMEOUT_MS = 15_000;

/** The two files a Workspace's owner runs and reads, by the paths they live at. */
const CONTROL = 'tutor/tutorctl.sh';
const SERVER_LOG = 'tutor/server.log';

/**
 * Where the control script's own tools live. It is a shell script and reaches
 * for `dirname`, `curl` and `python3` before it reaches for anything of this
 * plugin's, where the server reaches for nothing at all.
 */
const SYSTEM_PATH = ['/usr/bin', '/bin', '/usr/sbin', '/sbin'];

/** The plugin's Grader role definition — the one file that decides how a refusal opens. */
const GRADER_ROLE = path.join(REPO_ROOT, 'skills/explorable-teach/runtime/tutor/GRADER.md');

/**
 * The line a refusal has to open with, read out of the definition that mandates
 * it rather than written down here.
 *
 * Three files hold that string and only one of them decides it: `GRADER.md`
 * tells the Grader to write it, `server.js` recognises it to keep a refusal out
 * of `learning-records/`, and the drawer strips it so the Learner reads the
 * prose under it and not the marker. Restated here, this helper would be the
 * fourth copy and the first to drift — which is the whole failure the token
 * exists to have removed.
 *
 * `GRADER.md` sets the token off as the one indented block in the document,
 * because it is the one line in it a Grader has to reproduce byte for byte.
 * A second such line means the document grew one since, and picking between
 * them would be this reader deciding a contract it does not own. It throws
 * instead — `text` is a parameter so that `tutor-helper.test.js` can hold it to
 * that, the way it holds the SSE reader to refusing a body that is not one.
 */
function refusalToken(text = fs.readFileSync(GRADER_ROLE, 'utf8')) {
  const quoted = [...text.matchAll(/^ {4}(\S.*?)[ \t]*$/gm)].map((m) => m[1]);
  if (quoted.length !== 1) {
    throw new Error(
      `expected GRADER.md to quote exactly one line, found ${JSON.stringify(quoted)} — ` +
        'the refusal token is read out of that block',
    );
  }
  return quoted[0];
}

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
   *   control  start through `tutor/tutorctl.sh` rather than by spawning the
   *            server here — the way the runbook says to. What comes back is
   *            the same service; what differs is that it is nobody's child.
   */
  static async start(
    t,
    ws,
    { agent = [], exit = 0, stderr = '', hangs = false, idleTimeoutMs, answerTimeoutMs, control = false } = {},
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
      //
      // Started through the control script, only the first half of that is
      // available — a `PATH` holding nothing but the stub is a `PATH` the script
      // cannot find `dirname` on. It gets the system directories and this
      // interpreter's own, behind the stub, which still wins for `claude`.
      PATH: control ? [bin, path.dirname(process.execPath), ...SYSTEM_PATH].join(path.delimiter) : bin,
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
      const launchEnv = { ...env, PORT: String(port) };
      const child = launch(ws, launchEnv, control);
      const service = new TutorService(ws, port, child, runFile, control, launchEnv);

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

  constructor(ws, port, child, runFile, launchedByScript = false, env = process.env) {
    this.ws = ws;
    this.port = port;
    this.child = child;
    this.runFile = runFile;
    this.env = env;
    // Started through the control script, `child` is the launcher rather than
    // the service: it exits, and what it leaves running has a pid of its own.
    this.launchedByScript = launchedByScript;
    this.servicePid = null;
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
    // Started through the control script, what was captured above is the
    // launcher's own report; the service's output went to the file the runbook
    // tells its reader to tail.
    const server = this.launchedByScript && this.ws.exists(SERVER_LOG) ? this.ws.read(SERVER_LOG) : '';
    return this.output + server;
  }

  /** The pid the service reports for itself. Null until it has answered. */
  get pid() {
    return this.servicePid;
  }

  /** Resolve once *this* service answers, or throw with whatever it said instead. */
  async ready() {
    if (this.launchedByScript) {
      // The control script returns once the service is healthy, so its own exit
      // is the readiness signal — and its status is the only place a refusal (a
      // port already held, a directory that is not a Workspace) is reported.
      const exit = await waitFor('the control script to return', () => this.exited, {
        timeout: READY_TIMEOUT_MS,
      });
      if (exit.code !== 0) throw new Error(`the control script did not start the service:\n${this.log()}`);
    }

    const deadline = Date.now() + READY_TIMEOUT_MS;
    let foreign = null;

    for (;;) {
      if (!this.launchedByScript && this.exited) {
        throw new Error(`the service exited before answering:\n${this.log()}`);
      }
      try {
        const res = await this.get('/api/health');
        if (res.status === 200) {
          const health = res.json();
          if (this.isOurs(health)) {
            this.servicePid = health.pid;
            return this;
          }
          foreign = health.pid;
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

  /**
   * Is the service answering on this port the one this test started?
   *
   * A port was free a moment ago rather than reserved, so something else can be
   * holding it — another test file's service, most likely. Answering is not
   * enough; it has to be ours, or every claim made through it would be made
   * about someone else's Workspace.
   *
   * Started directly, the service is this helper's own child and the pid
   * settles it. Started through the control script it is nobody's child, so the
   * claim is made from the pair nothing else on the machine shares: this port,
   * serving this throwaway Workspace.
   */
  isOurs(health) {
    return this.launchedByScript
      ? health.port === this.port && health.workspace === this.ws.dir
      : health.pid === this.child.pid;
  }

  /**
   * Run the control script against this service, the way its documents tell a
   * Workspace's owner to. Under the environment the service was started in,
   * rather than this process's: `PORT` because nothing in the suite runs on the
   * default one, and the rest because a subcommand that starts something —
   * `restart` — must reach the stub agent and not the machine's real `claude`.
   */
  tutorctl(...args) {
    if (!this.launchedByScript) {
      // Refused rather than half-worked: a service started directly has a
      // `PATH` holding the stub agent and nothing else, which is not a `PATH`
      // any shell script can find `dirname` on.
      throw new Error('TutorService.tutorctl: start with { control: true } to run the control script');
    }

    const run = spawnSync(this.ws.path(CONTROL), args, {
      cwd: this.ws.dir,
      encoding: 'utf8',
      timeout: 30_000,
      env: this.env,
    });

    if (run.error) throw run.error;
    return { status: run.status, stdout: run.stdout, stderr: run.stderr };
  }

  /**
   * The process group the service ended up in, read off the machine rather than
   * worked out from how it was started. It throws rather than answering with an
   * empty string when `ps` says nothing: an assertion that two groups differ is
   * exactly the kind that would pass on a reading nobody managed to take.
   */
  processGroup() {
    const ps = spawnSync('ps', ['-o', 'pgid=', '-p', String(this.servicePid)], { encoding: 'utf8' });
    const pgid = Number((ps.stdout || '').trim());

    if (!Number.isInteger(pgid) || pgid <= 0) {
      throw new Error(`could not read the process group of pid ${this.servicePid}: ${JSON.stringify(ps.stdout)}`);
    }
    return pgid;
  }

  /**
   * The process group of the shell that launched the service. The launcher is
   * spawned `detached`, which makes it the leader of a group of its own, so the
   * group's id is its pid — and stays the group's id after it exits, for as long
   * as anything is left in there.
   */
  get launcherGroup() {
    return this.child.pid;
  }

  /**
   * Signal everything still in that group — which is what the end of an agent
   * session does to the shell it ran commands in. With the launcher gone, an
   * `ESRCH` here means the group is empty, and that is the answer this way of
   * starting the service exists to be able to ask for.
   */
  killLauncherGroup(signal) {
    process.kill(-this.child.pid, signal);
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
    return this.launchedByScript ? this.stopDetached() : this.stopChild();
  }

  /** Kill this helper's own child — the service, or the launcher that started it. */
  stopChild() {
    if (this.exited) return Promise.resolve();
    this.child.kill('SIGKILL');
    return new Promise((resolve) => this.child.on('close', resolve));
  }

  /**
   * A service the control script started is nobody's child, so there is no
   * handle to kill and nothing to wait on: it is stopped by the pid it reported
   * and waited for by that same pid. A test that ended without this would leave
   * a server behind holding a port for the eight hours its idle timeout allows.
   */
  async stopDetached() {
    await this.stopChild();
    if (this.servicePid == null) return;

    try {
      process.kill(this.servicePid, 'SIGKILL');
    } catch {
      return; // already gone
    }
    await waitFor(`the service (pid ${this.servicePid}) to go away`, () => !alive(this.servicePid));
  }
}

// ---------------------------------------------------------------- plumbing

/**
 * The process a test starts, in one of the two ways a service gets started.
 *
 * Directly, it *is* the service: `node <ws>/tutor/server.js`, resolved through
 * the Workspace's own link into the plugin, living as long as the test does.
 *
 * Through the control script it is a launcher. `tutorctl.sh start` returns as
 * soon as the service is healthy and leaves a service behind that belongs to
 * nobody. It is spawned `detached`, so the launcher leads a process group of its
 * own — which is what a shell is, and which the suite's own group must not be,
 * since the question being asked is whether the service stayed in it.
 */
function launch(ws, env, control) {
  const [bin, args] = control
    ? [ws.path(CONTROL), ['start']]
    : [process.execPath, [ws.path('tutor/server.js')]];

  return spawn(bin, args, {
    cwd: ws.dir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: control,
  });
}

/** Is there still a process under this pid? */
function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // Somebody else's process, which is somebody else's to end but is alive.
    return err.code === 'EPERM';
  }
}

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

module.exports = {
  TutorService,
  Response,
  STUB_AGENT,
  agentSays,
  refusalToken,
  waitFor,
  request,
  freePort,
};
