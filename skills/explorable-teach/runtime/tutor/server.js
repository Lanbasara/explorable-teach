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
// How long an answer may take before the request is failed. Overridable for the
// same reason the idle timeout is — a machine, or a suite, that needs a
// different number should not have to edit this file to get one.
const ANSWER_TIMEOUT_MS = Number(process.env.ANSWER_TIMEOUT_MS) || 120_000;
const IDLE_TIMEOUT_MS = Number(process.env.IDLE_TIMEOUT_MS) || 8 * 60 * 60_000;

const RECORDS_DIR = path.join(WORKSPACE_ROOT, 'learning-records');
const QUESTION_LOG = path.join(RECORDS_DIR, 'questions.jsonl');

// ---------------------------------------------------------------- language

/**
 * The one thing about a request the page decides, and the only Learner-facing
 * consequence this file has.
 *
 * Everything else here is server-authoritative on purpose — a Rubric riding the
 * request would change what a verdict *is*, which is why it does not. A
 * language changes only which words the answer comes back in, so a page that
 * lied about it would mistranslate its own screen and corrupt nothing. Decision
 * 30 in docs/DECISIONS.md argues that difference. The page is also the only
 * thing that knows: `<html lang>` is the single authority every label on it is
 * looked up against, and nothing on this side of the socket can see it.
 *
 * Absent or malformed, English — the same floor the page's own lookup falls to.
 */
const DEFAULT_LANG = 'en';
const MAX_LANG = 35;

/**
 * A BCP-47 tag, as narrowly as this file needs to read one: subtags of letters
 * and digits, joined by hyphens. It is bounded rather than merely trimmed
 * because it is interpolated into a prompt — anything a tag may not hold is a
 * sentence somebody else wrote reaching the agent as an instruction.
 */
const LANG_TAG = /^[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*$/;

function languageOf(raw) {
  const tag = typeof raw === 'string' ? raw.trim() : '';
  return tag.length <= MAX_LANG && LANG_TAG.test(tag) ? tag : DEFAULT_LANG;
}

/**
 * The single directive that names the language an answer must be in.
 *
 * It says so explicitly rather than letting the prompt's own language imply it,
 * because everything around it is English and is going to stay English: what
 * makes an answer the Learner's is an instruction the agent is given, not the
 * language the scaffolding around it happens to be written in.
 */
function answerIn(lang) {
  return (
    `Answer in the language tagged ${lang} (BCP-47). That is the language the learner reads; `
    + 'the language of this prompt says nothing about which one to answer in.'
  );
}

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
    replyLabel: 'Tutor: ',
    buildPayload({ page, selection, question, inlined, history }) {
      const parts = [];
      if (inlined) parts.push(inlined);
      if (page) parts.push(`The learner is reading this lesson: ${page}`);
      if (selection) parts.push(`They selected this passage:\n"""\n${selection}\n"""`);
      const transcript = renderHistory(history, this.replyLabel);
      if (transcript) parts.push(transcript);
      parts.push(`Their question: ${question}`);
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
    replyLabel: 'Grader: ',
    records: true,
    buildPayload({ page, selection, question, inlined, history }) {
      const parts = [];
      if (inlined) parts.push(inlined);
      if (page) {
        parts.push(
          `The page this assignment is on: ${page}\n` +
            'Read it first. It holds a <script type="application/x-rubric"> block, which is not ' +
            'rendered: that block is the rubric to grade against. It is not on the page, and the ' +
            'learner has never seen it.',
        );
      }
      if (selection) parts.push(`They are pointing at this part of the assignment:\n"""\n${selection}\n"""`);
      const transcript = renderHistory(history, this.replyLabel);
      if (transcript) parts.push(transcript);

      // A thread's first turn is the submission; everything after it is the
      // learner arguing with a verdict that is already on the record.
      if (history && history.length) parts.push(`They have a question about the verdict you just gave: ${question}`);
      else {
        parts.push(
          `This is what they handed in:\n"""\n${question}\n"""\n\n` +
            'Judge it against the rubric stored in the page, not against an impression. If the ' +
            'submission names a file or a directory in the workspace, go and read it — anything ' +
            'too large for the box is usually under submissions/.',
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

/**
 * The replayed turns, under the heading the role definitions promise the agent
 * it will receive them under. A short contract between two of the plugin's own
 * files — this one and the role definition beside it — the same shape as the
 * opening a refusal has to use.
 *
 * Both are English now, so the two say the same words rather than the same
 * thing in two languages. The heading stays English whatever language the
 * answer comes back in: it is scaffolding the agent reads, not something the
 * Learner ever sees.
 */
function renderHistory(history, replyLabel) {
  if (!history || !history.length) return '';
  const lines = history.map((t) => (t.role === 'user' ? 'Learner: ' : replyLabel) + t.content);
  return `## Earlier turns in this conversation\n\n${lines.join('\n\n')}`;
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
  { file: 'NOTES.md', heading: 'What the learner prefers, and what is off limits (NOTES.md, read for you)' },
  { file: 'MISSION.md', heading: 'Why they are learning this (MISSION.md, read for you)' },
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
      text = text.slice(0, MAX_INLINE_CHARS) + '\n... (truncated — read the file itself for the whole of it)';
    }
    blocks.push(`## ${heading}\n\n${text}`);
  }
  return blocks.join('\n\n');
}

// ---------------------------------------------------------------- static

/**
 * What a Lesson may serve, and what a browser is handed back for it.
 *
 * This is an allowlist and stays one: an extension that is not a key here is
 * refused before any path is resolved, which is why a workspace's own
 * `private.txt` or `.tutor.pid` cannot be asked for over the socket. Widening
 * it widens *what is served*, and nothing else — the containment check, the
 * symlink check and the loopback bind all sit downstream of it and are
 * unchanged.
 *
 * It is long because a Lesson holds its own content. A Lesson that pulls a
 * renderer from a CDN needs the model it renders; one that teaches a sound
 * needs the sound. A type missing from here is a 404 on a file that is really
 * there, which is a defect an author only meets after handing the page over.
 */
const MIME = {
  // The pages themselves, and the code, styling and data on them. `.mjs` and
  // `.wasm` because a module or an in-page runtime may be the Lesson's own
  // rather than a CDN's, and over http it may fetch either.
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',

  // Pictures, drawn and borrowed.
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',

  // Typefaces. A subject with its own notation — phonetics, mathematics, a
  // script the learner is learning to read — travels in the file with it.
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',

  // Sound and moving pictures, with the captions that make them readable.
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.vtt': 'text/vtt',

  // Geometry.
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.obj': 'model/obj',
  '.stl': 'model/stl',
};

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
 *
 * A directory is its `index.html` and nothing else. The root of the service is
 * therefore the Dossier, which is what the Dossier is for — see decision 32.
 */
function resolveStatic(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return [];
  }
  if (decoded.endsWith('/')) decoded += 'index.html';

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
 *
 * An ASCII token rather than a sentence, and this file is the consumer of it:
 * GRADER.md is where it is decided, because that is the file a grader is told
 * to reproduce it from. Everything after it is the learner's language; the
 * token is the same in every workspace, so a workspace in a third language does
 * not need a third pattern here. `language.test.js` reads the token out of
 * GRADER.md and holds this against it, so the two cannot drift apart in
 * silence — which they would, refusals landing as verdicts with nothing
 * erroring.
 *
 * Whitespace before it counts as opening with it. GRADER.md sets the token off
 * as an indented block, so a grader taking "character for character" at its
 * word sends the indentation too, and a refusal not recognised as one is filed
 * as a verdict — the single failure this exists to prevent. The answer this
 * runs against is already trimmed, so here that slack is belt and braces; in
 * the drawer, which reads a stream as it accumulates, it is load-bearing. The
 * two are written the same way on purpose: one rule, stated identically, is
 * what lets one check hold both to it.
 */
const CANNOT_GRADE = /^\s*CANNOT-GRADE:/;

/**
 * `assignments/0003-pipe-audit.html` -> `0003-pipe-audit`.
 *
 * Any letter and any digit, in any script — `\p{L}\p{N}` rather than a range
 * with two alphabets written into it. The range was the same defect a hardcoded
 * string is, without being a string: a Cyrillic, Arabic or Devanagari name lost
 * every character it had, so the slug collapsed to the fallback below and every
 * verdict in such a workspace contended for one filename, with nothing erroring.
 *
 * Combining marks are kept with the letters they belong to. In Devanagari,
 * Arabic or Thai a vowel sign is not decoration — dropping it rewrites the word
 * and can make two different names into one slug, which is the same collision
 * one rung quieter.
 */
function slugOf(page) {
  const base = path.basename(String(page || '')).replace(/\.[^.]*$/, '');
  const slug = base.toLowerCase().replace(/[^\p{L}\p{N}\p{M}-]+/gu, '-').replace(/^-+|-+$/g, '');
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
      ? question.slice(0, MAX_RECORD_EXCERPT) + '... (truncated)'
      : question;

    // The shape formats/learning-record.md documents, with ASCII field keys:
    // this file is read by the next boot sequence and by whoever writes a record
    // by hand, not by the learner. The one thing in it that is theirs is the
    // verdict, which the grader wrote in their language and which nothing here
    // touches.
    //
    // Evidence is provenance, not a claim about what was applied. It says only
    // where the verdict came from, so a record never asserts a rubric was used
    // on the strength of the grader having answered.
    const body =
      `# Assignment verdict: ${slug}\n\n` +
      `${answer}\n\n` +
      '## Evidence\n\n' +
      `- Assignment: ${page || '(the hand-in did not say which one)'}\n` +
      `- Submission:\n\n${excerpt.split('\n').map((line) => `  > ${line}`).join('\n')}\n\n` +
      `- Verdict: reached by the Grader, ${new Date().toISOString()}\n`;

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

  const lang = languageOf(body.lang);
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
  //
  // The language closes the payload rather than being woven through it: one
  // directive, in one place, whichever role built everything above it.
  const payload = [
    spec.buildPayload({ page: lesson, selection, question, inlined, history }),
    answerIn(lang),
  ].join('\n\n');

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

  const finish = (status, failure) => {
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
      sse(res, 'error', { ...(failure || {}), durationMs });
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

  /**
   * How a stream fails, from here: a `code` the page turns into words, or the
   * agent's own text as `message`.
   *
   * A code because this file holds no learner-facing string — a sentence here
   * would be in one language, and the page already has a table for every other
   * thing a learner reads. The two codes are the two failures that are the
   * *service's* to name: the agent never started, and it never finished.
   *
   * What the agent says when it fails is different in kind. It is evidence
   * about that run rather than a string anybody chose, so it rides as `message`
   * and the page shows it under the headline it looked up. When the agent says
   * nothing at all there is nothing to show: the detail is the server's log,
   * which is where a maintainer reads, and the learner is told the same thing
   * either way.
   *
   * tests/language.test.js reads these codes out of this file and holds the
   * page to having an entry for each, so a code added here without one is red.
   */
  const timer = setTimeout(() => finish('error', { code: 'timeout' }), ANSWER_TIMEOUT_MS);

  /**
   * A failure the agent reported, as the failure the page is sent.
   *
   * Its own words when it said any — bounded, because they are put in front of
   * the learner — and nothing at all when it said none. `silence` is what goes
   * in the server's log in that case: this file has no sentence of its own to
   * offer, and inventing one would be writing a Learner-facing string here.
   */
  const whatTheAgentSaid = (text, silence) => {
    const said = (typeof text === 'string' ? text : '').trim().slice(0, 400);
    if (!said) console.error(`[tutor] ${silence}`);
    return said ? { message: said } : {};
  };

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
          finish('error', whatTheAgentSaid(obj.result, 'claude reported an error and said nothing about it'));
          return;
        }
        if (typeof obj.result === 'string') finalText = obj.result;
      }
    }
  });

  child.stderr.on('data', (c) => { stderrBuf += c.toString('utf8'); });

  child.on('error', (err) => {
    if (err.code === 'ENOENT') return finish('error', { code: 'agent-missing' });
    // Nothing the agent said: it never ran. The reason belongs to the platform,
    // so it goes to the log, and the page is told only that no answer came.
    console.error(`[tutor] could not run claude: ${err.message}`);
    finish('error', {});
  });

  child.on('close', (code) => {
    if (code === 0) return finish('done');
    finish('error', whatTheAgentSaid(stderrBuf, `claude exited with code ${code} and wrote nothing to stderr`));
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
