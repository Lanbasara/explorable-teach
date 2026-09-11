#!/usr/bin/env node
/**
 * Local AI tutor server for the teaching workspace.
 *
 * Responsibilities:
 *   1. Serve the workspace statically so lessons run over http:// instead of file://
 *   2. POST /api/ask  -> stream an answer from headless `claude` as SSE
 *   3. Append every Q&A to learning-records/questions.jsonl (curriculum signal)
 *
 * Zero npm dependencies. Run from the workspace root:  node tutor/server.js
 */

'use strict';

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');

const WORKSPACE_ROOT = path.resolve(__dirname, '..');
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

const QUESTION_LOG = path.join(WORKSPACE_ROOT, 'learning-records', 'questions.jsonl');

// ---------------------------------------------------------------- roles

/**
 * Role prompts live in files next to this server, not in this source.
 * The Claude Code subagent at .claude/agents/tutor.md reads the same file,
 * so there is exactly one source of truth for how the tutor behaves.
 */
const ROLES = {
  tutor: {
    roleFile: 'ROLE.md',
    buildPayload({ lesson, selection, question, inlined, history }) {
      const parts = [];
      if (inlined) parts.push(inlined);
      if (lesson) parts.push(`学生正在读这一课：${lesson}`);
      if (selection) parts.push(`他选中了这段原文：\n"""\n${selection}\n"""`);
      const transcript = renderHistory(history);
      if (transcript) parts.push(transcript);
      parts.push(`他的问题：${question}`);
      return parts.join('\n\n');
    },
  },
  // Future: grader: { roleFile: 'GRADER.md', buildPayload(...) { ... } }
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

/** Heading must match what ROLE.md promises the tutor it will receive. */
function renderHistory(history) {
  if (!history || !history.length) return '';
  const lines = history.map((t) => (t.role === 'user' ? '学生：' : '助教：') + t.content);
  return `## 本次对话的前几轮\n\n${lines.join('\n\n')}`;
}

/** Read every role prompt at startup so a missing file fails loudly, not mid-question. */
function loadRolePrompts() {
  for (const [name, spec] of Object.entries(ROLES)) {
    const file = path.join(__dirname, spec.roleFile);
    try {
      spec.systemPrompt = fs.readFileSync(file, 'utf8').trim();
    } catch (err) {
      console.error(`[tutor] FATAL: cannot read role prompt for "${name}"`);
      console.error(`[tutor]        expected at: ${file}`);
      console.error(`[tutor]        ${err.message}`);
      process.exit(1);
    }
    if (!spec.systemPrompt) {
      console.error(`[tutor] FATAL: role prompt for "${name}" is empty: ${file}`);
      process.exit(1);
    }
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

/** Resolve a URL path to a real file inside the workspace, or null if unsafe. */
function resolveStatic(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null;
  }
  if (decoded.endsWith('/')) decoded += 'index.html';
  if (decoded === '/index.html') decoded = firstLessonPath() || decoded;

  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  const full = path.resolve(WORKSPACE_ROOT, '.' + path.sep + normalized);

  // Must stay inside the workspace.
  if (full !== WORKSPACE_ROOT && !full.startsWith(WORKSPACE_ROOT + path.sep)) return null;

  const ext = path.extname(full).toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(MIME, ext)) return null;

  return full;
}

function serveStatic(req, res) {
  const full = resolveStatic(req.url);
  if (!full) return send(res, 404, 'text/plain; charset=utf-8', 'Not found');

  fs.stat(full, (err, stat) => {
    if (err || !stat.isFile()) return send(res, 404, 'text/plain; charset=utf-8', 'Not found');
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(full).toLowerCase()],
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(full).pipe(res);
  });
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
  const payload = spec.buildPayload({ lesson, selection, question, inlined, history });

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

    if (status === 'done') {
      sse(res, 'done', { answer, durationMs });
      logQuestion({
        timestamp: new Date().toISOString(),
        role, threadId, turn, lesson, selection, question, answer, durationMs,
      });
    } else {
      sse(res, 'error', { message: extra || 'tutor failed', durationMs });
    }
    res.end();
    if (!child.killed) child.kill('SIGTERM');
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
