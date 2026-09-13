#!/usr/bin/env node
/**
 * Local AI tutor server for the teaching workspace.
 *
 * Responsibilities:
 *   1. Serve the workspace statically so lessons run over http:// instead of file://
 *   2. POST /api/ask  -> stream an answer from headless `claude` as SSE, in
 *      whichever role the page asked for
 *   3. Append every Q&A to learning-records/questions.jsonl (curriculum signal)
 *   4. Write a graded assignment's verdict into learning-records/ as a record
 *      of its own, because that is evidence about the learner rather than
 *      feedback about a lesson
 *
 * This file lives in the plugin and serves whichever workspace it is pointed
 * at, so a fix here reaches every workspace rather than only the ones
 * scaffolded afterwards. The workspace is named on the command line; a
 * workspace links this file in at tutor/server.js, which is how
 * `node tutor/server.js` still works from a workspace root.
 *
 * Zero npm dependencies.
 *
 *   node server.js [workspace-dir]     # default: current directory
 */


'use strict';

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');

/**
 * The workspace being served. Everything subject-specific is read from here:
 * the lessons, the inlined context, the subject tuning, the question log.
 */
const WORKSPACE_ROOT = resolveWorkspace(process.argv[2] || process.cwd());

/**
 * The plugin's own copy of everything that does not vary by subject. Static
 * requests fall back here, so a workspace whose link into the plugin is missing
 * or stale still gets styles, navigation and the in-page widget.
 */
const RUNTIME_ASSETS = path.resolve(__dirname, '..', 'assets');

function resolveWorkspace(dir) {
  const full = path.resolve(dir);
  let stat;
  try {
    stat = fs.statSync(full);
  } catch (err) {
    console.error(`[tutor] FATAL: cannot read workspace at ${full}`);
    console.error(`[tutor]        ${err.message}`);
    process.exit(1);
  }
  if (!stat.isDirectory()) {
    console.error(`[tutor] FATAL: workspace is not a directory: ${full}`);
    process.exit(1);
  }
  // Resolved, because every containment check below compares against it and a
  // symlinked temp directory would make those comparisons lie.
  return fs.realpathSync(full);
}

const PORT = Number(process.env.PORT) || 4173;
const HOST = '127.0.0.1';

const MAX_QUESTION = 2000;
const MAX_SELECTION = 4000;
// Bounded replay, not a session: prior turns ride along in the request so each
// question is still a fresh `claude -p`. Caps keep that payload from growing.
const MAX_HISTORY_TURNS = 6;
const MAX_HISTORY_CONTENT = 2000;
const MAX_HISTORY_TOTAL = 6000;
const MAX_THREAD_ID = 64;
const MAX_BODY_BYTES = 128 * 1024;
const CLAUDE_TIMEOUT_MS = 120_000;
const IDLE_TIMEOUT_MS = Number(process.env.IDLE_TIMEOUT_MS) || 8 * 60 * 60_000;

const RECORDS_DIR = path.join(WORKSPACE_ROOT, 'learning-records');
const QUESTION_LOG = path.join(RECORDS_DIR, 'questions.jsonl');

// ---------------------------------------------------------------- roles

/**
 * Role prompts live in files, not in this source, and each one is read in two
 * halves: the shared definition that ships beside this server, then whatever
 * the workspace adds for its own subject. The Claude Code subagent at
 * .claude/agents/<role>.md is pointed at the same two files in the same order,
 * so there is exactly one definition of how each role behaves and neither path
 * is a degraded version of the other.
 *
 *   roleFile    next to this server, in the plugin. Required.
 *   tuningFile  relative to the workspace. Optional — a workspace that has not
 *               been tuned yet gets the shared definition alone.
 *   replyLabel  what this role is called when its own turns are replayed back
 *               to it.
 *   records     true when a first turn is teaching signal the next boot
 *               sequence has to see, rather than one more question in the log.
 */
const ROLES = {
  tutor: {
    roleFile: 'ROLE.md',
    tuningFile: path.join('tutor', 'TUNING.md'),
    replyLabel: '助教：',
    buildPayload({ page, selection, question, inlined, history }) {
      const parts = [];
      if (inlined) parts.push(inlined);
      if (page) parts.push(`学生正在读这一课：${page}`);
      if (selection) parts.push(`他选中了这段原文：\n"""\n${selection}\n"""`);
      const transcript = renderHistory(history, this.replyLabel);
      if (transcript) parts.push(transcript);
      parts.push(`他的问题：${question}`);
      return parts.join('\n\n');
    },
  },

  /**
   * The same transport, the same stream, the same log — and a different role
   * file, which is the whole of the difference. Grading is never the session
   * that wrote the assignment: the criteria come from the rubric stored in the
   * assignment page, which this payload does no more than point at. The rubric
   * itself never rides the request, so what the grader judges is what is on
   * disk rather than what a page chose to send.
   */
  grader: {
    roleFile: 'GRADER.md',
    tuningFile: path.join('tutor', 'GRADER-TUNING.md'),
    replyLabel: '评分：',
    records: true,
    buildPayload({ page, selection, question, inlined, history }) {
      const parts = [];
      if (inlined) parts.push(inlined);
      if (page) {
        parts.push(
          `这份作业的页面是：${page}\n` +
            '先把它读掉。里面有一段不渲染的 <script type="application/x-rubric"> 块，那就是这次要用的' +
            '评分标准；页面上看不到它，学生也没见过。',
        );
      }
      if (selection) parts.push(`他指着作业里的这一段：\n"""\n${selection}\n"""`);
      const transcript = renderHistory(history, this.replyLabel);
      if (transcript) parts.push(transcript);

      // A thread's first turn is the submission; everything after it is the
      // learner arguing with a verdict that is already on the record.
      if (history && history.length) parts.push(`他对你刚才的判定还有话问：${question}`);
      else {
        parts.push(
          `这是他交上来的作业：\n"""\n${question}\n"""\n\n` +
            '按页面里存着的 Rubric 判，别凭印象。提交里提到工作区里的文件或目录，自己去读——' +
            '大件的成果通常在 submissions/ 底下。',
        );
      }
      return parts.join('\n\n');
    },
  },
};

/**
 * Keep only well-formed turns, newest-biased, within the caps. Malformed entries
 * are dropped rather than failing the whole request — one bad turn shouldn't
 * cost the learner their answer.
 */
function sanitizeHistory(raw) {
  if (!Array.isArray(raw)) return [];
  let turns = raw
    .filter((t) => t && (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string')
    .map((t) => ({ role: t.role, content: t.content.trim().slice(0, MAX_HISTORY_CONTENT) }))
    .filter((t) => t.content);

  if (turns.length > MAX_HISTORY_TURNS) turns = turns.slice(-MAX_HISTORY_TURNS);

  // Drop oldest first until the transcript fits.
  let total = turns.reduce((n, t) => n + t.content.length, 0);
  while (turns.length && total > MAX_HISTORY_TOTAL) {
    total -= turns[0].content.length;
    turns.shift();
  }
  return turns;
}

/** Heading must match what the role definitions promise they will receive. */
function renderHistory(history, replyLabel) {
  if (!history || !history.length) return '';
  const lines = history.map((t) => (t.role === 'user' ? '学生：' : replyLabel) + t.content);
  return `## 本次对话的前几轮\n\n${lines.join('\n\n')}`;
}

/** Read every role prompt at startup so a missing file fails loudly, not mid-question. */
function loadRolePrompts() {
  for (const [name, spec] of Object.entries(ROLES)) {
    const file = path.join(__dirname, spec.roleFile);
    let shared;
    try {
      shared = fs.readFileSync(file, 'utf8').trim();
    } catch (err) {
      console.error(`[tutor] FATAL: cannot read role prompt for "${name}"`);
      console.error(`[tutor]        expected at: ${file}`);
      console.error(`[tutor]        ${err.message}`);
      process.exit(1);
    }
    if (!shared) {
      console.error(`[tutor] FATAL: role prompt for "${name}" is empty: ${file}`);
      process.exit(1);
    }

    // The subject tuning is the workspace's to write, so its absence is a
    // workspace nobody has tuned yet rather than a broken install.
    let tuning = '';
    if (spec.tuningFile) {
      try {
        tuning = fs.readFileSync(path.join(WORKSPACE_ROOT, spec.tuningFile), 'utf8').trim();
      } catch {
        tuning = '';
      }
    }

    spec.systemPrompt = tuning ? `${shared}\n\n${tuning}` : shared;
  }
}

/**
 * Small files the tutor would otherwise always spend a tool round-trip reading.
 * Inlining them cuts several seconds off every single question.
 */
const ALWAYS_INLINE = [
  { file: 'NOTES.md', heading: '学生偏好与硬性禁忌（NOTES.md，已为你读好）' },
  { file: 'MISSION.md', heading: '他为什么学这个（MISSION.md，已为你读好）' },
];
const MAX_INLINE_CHARS = 4000;

/** Read the always-needed context. Missing files degrade to simply being absent. */
async function buildInlinedContext() {
  const blocks = [];
  for (const { file, heading } of ALWAYS_INLINE) {
    let text;
    try {
      text = await fsp.readFile(path.join(WORKSPACE_ROOT, file), 'utf8');
    } catch {
      continue; // Not every workspace has every file.
    }
    text = text.trim();
    if (!text) continue;
    if (text.length > MAX_INLINE_CHARS) {
      text = text.slice(0, MAX_INLINE_CHARS) + '\n…（已截断，需要完整内容请自行读取该文件）';
    }
    blocks.push(`## ${heading}\n\n${text}`);
  }
  return blocks.join('\n\n');
}

// ---------------------------------------------------------------- static

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.md': 'text/plain; charset=utf-8',
};

/** Lowest-numbered lesson, so "/" lands somewhere useful in any workspace. */
function firstLessonPath() {
  try {
    const names = fs
      .readdirSync(path.join(WORKSPACE_ROOT, 'lessons'))
      .filter((n) => n.toLowerCase().endsWith('.html'))
      .sort();
    return names.length ? `/lessons/${names[0]}` : null;
  } catch {
    return null;
  }
}

/** True when `full` is `root` itself or sits beneath it. */
function within(root, full) {
  return full === root || full.startsWith(root + path.sep);
}

/** Resolve `rel` under `root`, or null if it would escape it. */
function under(root, rel) {
  const full = path.resolve(root, '.' + path.sep + rel);
  return within(root, full) ? full : null;
}

/**
 * The roots a served file is allowed to physically live in.
 *
 * The check in resolveStatic bounds the path; this bounds the bytes, and the
 * two are no longer the same question. A workspace deliberately holds links
 * into the plugin, so `fs.stat` and the read stream follow a link out of it by
 * design — which means a link the scaffold did not write could follow one
 * anywhere. A file is served only if it really sits in the workspace or in the
 * plugin's assets.
 */
const SERVE_ROOTS = [WORKSPACE_ROOT, RUNTIME_ASSETS];

/**
 * Where a URL path may be read from, in the order to try, or an empty list if
 * it is unsafe or not a type we serve.
 *
 * Two roots, because the files that do not vary by subject live in the plugin:
 * the workspace answers first, so its own course manifest and its
 * subject-specific components win, and anything it does not hold falls back to
 * the plugin's copy. The path is normalized once and then bounded against each
 * root separately, so a request that escapes the workspace yields no candidate
 * at all rather than being tried against the plugin instead.
 */
function resolveStatic(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return [];
  }
  if (decoded.endsWith('/')) decoded += 'index.html';
  if (decoded === '/index.html') decoded = firstLessonPath() || decoded;

  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '');

  const ext = path.extname(normalized).toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(MIME, ext)) return [];

  const inWorkspace = under(WORKSPACE_ROOT, normalized);
  if (!inWorkspace) return [];

  const candidates = [inWorkspace];

  // Only assets/ falls back. The rest of a workspace — lessons, records,
  // submissions — is the learner's, and the plugin has nothing to offer there.
  const asset = /^[/\\]assets[/\\](.+)$/.exec(normalized);
  if (asset) {
    const inPlugin = under(RUNTIME_ASSETS, path.sep + asset[1]);
    if (inPlugin) candidates.push(inPlugin);
  }

  return candidates;
}

function serveStatic(req, res) {
  const candidates = resolveStatic(req.url);

  const tryNext = () => {
    const full = candidates.shift();
    if (!full) return send(res, 404, 'text/plain; charset=utf-8', 'Not found');

    fs.stat(full, (err, stat) => {
      if (err || !stat.isFile()) return tryNext();

      fs.realpath(full, (linkErr, real) => {
        if (linkErr || !SERVE_ROOTS.some((root) => within(root, real))) return tryNext();

        res.writeHead(200, {
          // The request's extension, because that is what the allowlist above
          // was applied to. Read from the resolved path, because that is what
          // was just bounded.
          'Content-Type': MIME[path.extname(full).toLowerCase()],
          'Content-Length': stat.size,
          'Cache-Control': 'no-cache',
        });
        fs.createReadStream(real).pipe(res);
      });
    });
  };

  tryNext();
}

function send(res, status, type, body) {
  res.writeHead(status, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

// ---------------------------------------------------------------- body

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Body too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------- ask

function sse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function logQuestion(entry) {
  try {
    await fsp.mkdir(path.dirname(QUESTION_LOG), { recursive: true });
    await fsp.appendFile(QUESTION_LOG, JSON.stringify(entry) + '\n', 'utf8');
  } catch (err) {
    console.error('[tutor] failed to log question:', err.message);
  }
}

// ------------------------------------------------------- learning records

const MAX_RECORD_EXCERPT = 1200;
const RECORD_ATTEMPTS = 20;

/**
 * How a grader says it did not grade — the opening GRADER.md tells it to write
 * when the assignment stores no rubric, or the page cannot be read at all.
 *
 * Same arrangement as renderHistory's heading: a short contract between this
 * file and the role definition beside it, both the plugin's. It exists because
 * a refusal is not evidence about the learner, and a learning record claiming
 * a verdict that was never reached is worse than no record — the next boot
 * sequence plans from these.
 */
const CANNOT_GRADE = /^无法判定[：:]/;

/** `assignments/0003-pipe-audit.html` -> `0003-pipe-audit`. */
function slugOf(page) {
  const base = path.basename(String(page || '')).replace(/\.[^.]*$/, '');
  const slug = base.toLowerCase().replace(/[^a-z0-9一-鿿-]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'assignment';
}

/** The next free number in the records directory, as the format specifies it. */
async function nextRecordNumber() {
  let highest = 0;
  let names = [];
  try {
    names = await fsp.readdir(RECORDS_DIR);
  } catch {
    return 1; // No directory yet, so nothing has been numbered.
  }
  for (const name of names) {
    const m = /^(\d{4})-/.exec(name);
    if (m) highest = Math.max(highest, Number(m[1]));
  }
  return highest + 1;
}

/**
 * A verdict, written where the next boot sequence already looks.
 *
 * The question log is read as feedback about the *lesson*; a learning record is
 * read as evidence about the *learner*, and that is what a graded assignment
 * produces. Written here rather than left to a session because the session that
 * would have written it is the one that ended before the assignment was done.
 *
 * `wx` and a retry, because the number is chosen from a directory listing and
 * two verdicts landing together would otherwise pick the same one. Returns the
 * workspace-relative path, or null if nothing could be written — a verdict the
 * learner can read beats a request failed over a file.
 */
async function writeLearningRecord({ page, question, answer }) {
  try {
    const slug = slugOf(page);
    const excerpt = question.length > MAX_RECORD_EXCERPT
      ? question.slice(0, MAX_RECORD_EXCERPT) + '…（已截断）'
      : question;

    // Provenance, not a claim about what was applied. The verdict itself is the
    // body; this says only where it came from, so a record never asserts a
    // rubric was used on the strength of the grader having answered.
    const body =
      `# 作业判定：${slug}\n\n` +
      `${answer}\n\n` +
      '## Evidence\n\n' +
      `- 作业：${page || '（提交时没有说是哪一份）'}\n` +
      `- 提交：\n\n${excerpt.split('\n').map((line) => `  > ${line}`).join('\n')}\n\n` +
      `- 判定：Grader 给出，${new Date().toISOString()}\n`;

    await fsp.mkdir(RECORDS_DIR, { recursive: true });
    let n = await nextRecordNumber();
    for (let attempt = 0; attempt < RECORD_ATTEMPTS; attempt++, n++) {
      const rel = path.join('learning-records', `${String(n).padStart(4, '0')}-${slug}.md`);
      try {
        await fsp.writeFile(path.join(WORKSPACE_ROOT, rel), body, { encoding: 'utf8', flag: 'wx' });
        return rel;
      } catch (err) {
        if (err.code !== 'EEXIST') throw err;
      }
    }
    throw new Error(`no free number after ${RECORD_ATTEMPTS} tries`);
  } catch (err) {
    console.error('[tutor] failed to write the learning record:', err.message);
    return null;
  }
}

async function handleAsk(req, res) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    return send(res, err.statusCode || 400, 'application/json', JSON.stringify({ error: err.message }));
  }

  const role = typeof body.role === 'string' ? body.role : 'tutor';
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  const selection = typeof body.selection === 'string' ? body.selection.trim() : '';
  const lesson = typeof body.lesson === 'string' ? body.lesson.slice(0, 200) : '';

  if (body.history != null && !Array.isArray(body.history))
    return send(res, 400, 'application/json', JSON.stringify({ error: 'history must be an array' }));
  if (body.threadId != null && typeof body.threadId !== 'string')
    return send(res, 400, 'application/json', JSON.stringify({ error: 'threadId must be a string' }));

  const threadId = (body.threadId || '').slice(0, MAX_THREAD_ID).replace(/[^\w.:-]/g, '');
  const history = sanitizeHistory(body.history);
  // Counted before capping so the turn index stays true deep into a thread.
  const turn = (Array.isArray(body.history) ? body.history.filter((t) => t && t.role === 'user').length : 0) + 1;

  const spec = ROLES[role];
  if (!spec) return send(res, 400, 'application/json', JSON.stringify({ error: `Unknown role: ${role}` }));
  if (!question) return send(res, 400, 'application/json', JSON.stringify({ error: 'question is required' }));
  if (question.length > MAX_QUESTION)
    return send(res, 400, 'application/json', JSON.stringify({ error: `question exceeds ${MAX_QUESTION} chars` }));
  if (selection.length > MAX_SELECTION)
    return send(res, 400, 'application/json', JSON.stringify({ error: `selection exceeds ${MAX_SELECTION} chars` }));

  const inlined = await buildInlinedContext();
  // `lesson` on the wire and in the log, because that is what a tutor request
  // has always called it; `page` to the role, because a grader is handed an
  // assignment rather than a lesson and the field means "what is open".
  const payload = spec.buildPayload({ page: lesson, selection, question, inlined, history });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  sse(res, 'open', { role });

  const started = Date.now();
  console.log(`[tutor] ask (${role}) turn ${turn} :: ${question.slice(0, 70)}`);

  // argv array — never shell:true, never string interpolation into a command.
  const child = spawn(
    'claude',
    [
      '-p', payload,
      '--restricted',
      '--allowed-tools', 'Read', 'Glob', 'Grep',
      '--append-system-prompt', spec.systemPrompt,
      '--output-format', 'stream-json',
      '--include-partial-messages',
      '--verbose',
    ],
    { cwd: WORKSPACE_ROOT, stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let finished = false;
  let streamed = '';
  let finalText = '';
  let stderrBuf = '';

  const finish = (status, extra) => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    const durationMs = Date.now() - started;
    const answer = (finalText || streamed).trim();

    const close = () => {
      res.end();
      if (!child.killed) child.kill('SIGTERM');
    };

    if (status !== 'done') {
      sse(res, 'error', { message: extra || 'tutor failed', durationMs });
      return close();
    }

    // The record is written before the verdict is delivered, so the page can
    // name where it landed and be telling the truth. A record that could not be
    // written costs the learner nothing: the verdict goes out either way.
    //
    // The *sanitized* history, not `turn`. They answer different questions:
    // `turn` is the learner's place in the thread, counted before capping, and
    // this is "did the agent see a verdict of its own above this?". A request
    // whose whole replay was malformed showed the agent nothing, so it produced
    // a first verdict and that verdict is a record.
    const recording =
      spec.records && answer && !history.length && !CANNOT_GRADE.test(answer)
        ? writeLearningRecord({ page: lesson, question, answer })
        : Promise.resolve(null);

    const deliver = (record) => {
      sse(res, 'done', record ? { answer, durationMs, record } : { answer, durationMs });
      logQuestion({
        timestamp: new Date().toISOString(),
        role, threadId, turn, lesson, selection, question, answer, durationMs,
        ...(record ? { record } : {}),
      });
      close();
    };

    recording.then(deliver);
  };

  const timer = setTimeout(() => finish('error', '老师思考超时（120 秒）'), CLAUDE_TIMEOUT_MS);

  // ---- NDJSON parsing. Verified event shapes:
  //   {"type":"stream_event","event":{"type":"content_block_delta",
  //     "delta":{"type":"text_delta","text":"..."}}}
  //   {"type":"result","result":"<full answer>","is_error":false}
  let buf = '';
  child.stdout.on('data', (chunk) => {
    buf += chunk.toString('utf8');
    let nl;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;

      let obj;
      try { obj = JSON.parse(line); } catch { continue; }

      if (obj.type === 'stream_event') {
        const ev = obj.event || {};
        // Only text_delta — this naturally excludes thinking_delta and input_json_delta.
        if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') {
          const t = ev.delta.text || '';
          if (t) { streamed += t; sse(res, 'delta', { text: t }); }
        }
      } else if (obj.type === 'assistant') {
        // Surface workspace reads so the student can see context being gathered.
        const content = (obj.message && obj.message.content) || [];
        for (const block of content) {
          if (block && block.type === 'tool_use') {
            const input = block.input || {};
            const target = input.file_path || input.pattern || input.path || '';
            sse(res, 'tool', {
              name: block.name || 'tool',
              target: typeof target === 'string' ? path.basename(target) : '',
            });
          }
        }
      } else if (obj.type === 'result') {
        if (obj.is_error) {
          finish('error', obj.result || 'claude reported an error');
          return;
        }
        if (typeof obj.result === 'string') finalText = obj.result;
      }
    }
  });

  child.stderr.on('data', (c) => { stderrBuf += c.toString('utf8'); });

  child.on('error', (err) => {
    finish('error', err.code === 'ENOENT' ? '找不到 claude 命令，请确认它在 PATH 中' : err.message);
  });

  child.on('close', (code) => {
    if (code === 0) finish('done');
    else finish('error', stderrBuf.trim().slice(0, 400) || `claude exited with code ${code}`);
  });

  req.on('close', () => {
    if (!finished) { finished = true; clearTimeout(timer); if (!child.killed) child.kill('SIGTERM'); }
  });
}

// ---------------------------------------------------------------- server

/**
 * Nobody's conversation owns this process. If the learner walks away, it should
 * not linger for days — so it exits on its own after a spell with no requests.
 */
const STARTED_AT = Date.now();
let lastActivity = Date.now();

function humanMs(ms) {
  const m = Math.round(ms / 60000);
  return m >= 120 ? `${(m / 60).toFixed(1)} h` : `${m} min`;
}

let idleTimer = null;
function touchIdleTimer() {
  lastActivity = Date.now();
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    console.log(`[tutor] exiting: no requests for ${humanMs(IDLE_TIMEOUT_MS)}`);
    server.close(() => process.exit(0));
    // Don't let a hung keep-alive socket block the exit.
    setTimeout(() => process.exit(0), 2000).unref();
  }, IDLE_TIMEOUT_MS);
  idleTimer.unref();
}

const server = http.createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0];

  // Deliberately before touchIdleTimer(): a status probe is not learner activity,
  // so polling health must not keep an abandoned server alive forever.
  if (urlPath === '/api/health') {
    if (req.method !== 'GET') return send(res, 405, 'application/json', JSON.stringify({ error: 'GET only' }));
    return send(res, 200, 'application/json', JSON.stringify({
      ok: true,
      workspace: WORKSPACE_ROOT,
      pid: process.pid,
      port: PORT,
      uptimeSec: Math.round((Date.now() - STARTED_AT) / 1000),
      idleSec: Math.round((Date.now() - lastActivity) / 1000),
      idleTimeoutSec: Math.round(IDLE_TIMEOUT_MS / 1000),
      roles: Object.keys(ROLES),
    }));
  }

  touchIdleTimer();

  if (urlPath === '/api/ask') {
    if (req.method !== 'POST') return send(res, 405, 'application/json', JSON.stringify({ error: 'POST only' }));
    return handleAsk(req, res);
  }

  if (urlPath.startsWith('/api/')) return send(res, 404, 'application/json', JSON.stringify({ error: 'Unknown endpoint' }));

  if (req.method !== 'GET' && req.method !== 'HEAD')
    return send(res, 405, 'text/plain; charset=utf-8', 'Method not allowed');

  serveStatic(req, res);
});

loadRolePrompts();

server.listen(PORT, HOST, () => {
  console.log(`[tutor] workspace : ${WORKSPACE_ROOT}`);
  console.log(`[tutor] listening : http://${HOST}:${PORT}/`);
  console.log(`[tutor] roles     : ${Object.keys(ROLES).join(', ')}`);
  console.log(`[tutor] idle exit : after ${humanMs(IDLE_TIMEOUT_MS)} with no requests`);
  console.log('[tutor] Ctrl-C to stop. Lessons still work without this server.');
  touchIdleTimer();
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`\n[tutor] ${sig} received, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  });
}
