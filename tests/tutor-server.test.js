'use strict';

// The Tutor service carries the security-sensitive code in this plugin —
// path-traversal guards, an extension allowlist, argv `spawn` with no shell,
// input caps, a loopback bind. `TUTOR.md` says the scaffold copies it "rather
// than any Session writing it: re-deriving that from prose risks silently
// dropping a guard". Nothing until now would have noticed if one had been.
//
// So every claim here is made from outside: the service runs as its own process
// on its own port, and the only things a test touches are a socket, the fixture
// Workspace on disk, and a stub agent binary standing in for `claude`. No
// function in `server.js` is called directly, and no line of it was changed to
// make any of this possible — the seams used here are the ones the service
// already exposes to the browser and to its own environment.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { Workspace } = require('./helpers/workspace.js');
const { TutorService, agentSays, waitFor } = require('./helpers/tutor.js');

const FIRST_LESSON = '<!doctype html>\n<title>0001</title>\n<h1>第一课：fork</h1>\n';
const SECOND_LESSON = '<!doctype html>\n<title>0002</title>\n<h1>第二课：exec</h1>\n';
const NOTES = '# 偏好\n\n不要直接给答案。\n';
const MISSION = '# Mission\n\n读懂进程调用栈。\n';
const TUNING = '# 学科调校\n\nfork/exec 一律用英文原词。\n';

/** A marker that must never come back over the socket. */
const WITHHELD = 'WITHHELD-FROM-HTTP';

const QUESTION_LOG = 'learning-records/questions.jsonl';

/**
 * A Workspace as the learner's is: scaffolded, two Lessons written, the two
 * files the service inlines into every payload, and two files it must refuse to
 * serve. The Lessons are written out of order so that "the first Lesson" means
 * lowest-numbered rather than first-written.
 */
function workspace(t) {
  const ws = Workspace.create(t);
  ws.scaffold();

  ws.write('lessons/0002-exec.html', SECOND_LESSON);
  ws.write('lessons/0001-fork.html', FIRST_LESSON);
  ws.write('NOTES.md', NOTES);
  ws.write('MISSION.md', MISSION);

  ws.write('tutor/TUNING.md', TUNING);

  ws.write('private.txt', WITHHELD);
  ws.write('tutor/.tutor.pid', WITHHELD);

  return ws;
}

/** Every line of the question log, or null while there are none. */
function questionLog(ws) {
  if (!ws.exists(QUESTION_LOG)) return null;
  const lines = ws.read(QUESTION_LOG).split('\n').filter(Boolean);
  return lines.length ? lines : null;
}

// ---------------------------------------------------------------- health

test('the health probe reports what the control script reads off it', async (t) => {
  const ws = workspace(t);
  const service = await TutorService.start(t, ws);

  const res = await service.get('/api/health');

  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /^application\/json/);

  const health = res.json();

  // The field list is the contract: `tutorctl.sh status` prints pid, uptime,
  // idle, the idle timeout, the roles and the workspace, and the in-page drawer
  // treats an answer here as "the service is up". A renamed field breaks one of
  // them silently, so the shape is asserted whole rather than field by field.
  assert.deepEqual(Object.keys(health).sort(), [
    'idleSec',
    'idleTimeoutSec',
    'ok',
    'pid',
    'port',
    'roles',
    'uptimeSec',
    'workspace',
  ]);

  assert.equal(health.ok, true);
  assert.equal(health.workspace, ws.dir, 'the service should name the workspace it is serving');
  assert.equal(health.port, service.port);
  assert.equal(typeof health.pid, 'number');
  assert.ok(health.uptimeSec >= 0);
  assert.ok(health.idleSec >= 0);
  assert.ok(health.idleTimeoutSec > 0);

  // Both roles, from the one map. The page reads this to find out what it may
  // ask for, so a role that is installed and not announced is a role no
  // Assignment page can reach.
  assert.deepEqual(health.roles.sort(), ['grader', 'tutor']);
});

test('the health probe is GET only, and no other /api/ path answers', async (t) => {
  const service = await TutorService.start(t, workspace(t));

  const posted = await service.post('/api/health', {});
  assert.equal(posted.status, 405);
  assert.deepEqual(posted.json(), { error: 'GET only' });

  const unknown = await service.get('/api/grade');
  assert.equal(unknown.status, 404);
  assert.deepEqual(unknown.json(), { error: 'Unknown endpoint' });

  const wrongMethod = await service.request('PUT', '/lessons/0001-fork.html');
  assert.equal(wrongMethod.status, 405);
});

test('polling health does not keep an abandoned service alive', async (t) => {
  const ws = workspace(t);
  const service = await TutorService.start(t, ws, { idleTimeoutMs: 1200 });

  // The service is probed for as long as it takes: if a status probe counted as
  // learner activity, this loop alone would hold it open forever, and this test
  // would fail by timing out rather than by asserting anything subtle.
  await waitFor(
    'the idle service to exit while being polled',
    async () => {
      await service.get('/api/health').catch(() => null);
      return service.exited;
    },
    { timeout: 20_000, interval: 100 },
  );

  assert.match(service.log(), /exiting: no requests for/);
});

// ---------------------------------------------------------------- static

test('a root request resolves to the first Lesson', async (t) => {
  const ws = workspace(t);
  const service = await TutorService.start(t, ws);

  const res = await service.get('/');

  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /^text\/html/);
  assert.equal(res.body, FIRST_LESSON, 'the lowest-numbered Lesson is where "/" should land');
  assert.notEqual(FIRST_LESSON, SECOND_LESSON, 'the two fixture Lessons must be distinguishable');
});

test('a root request falls back to the Dossier when no Lesson is written yet', async (t) => {
  const ws = Workspace.create(t);
  ws.scaffold();
  const service = await TutorService.start(t, ws);

  const res = await service.get('/');

  assert.equal(res.status, 200);
  assert.equal(res.body, ws.read('index.html'), 'with no Lessons, "/" is the Dossier');
});

test('a Lesson and its assets are served with the type the browser needs', async (t) => {
  const ws = workspace(t);
  const service = await TutorService.start(t, ws);

  const lesson = await service.get('/lessons/0002-exec.html');
  assert.equal(lesson.status, 200);
  assert.equal(lesson.body, SECOND_LESSON);
  assert.match(lesson.headers['content-type'], /^text\/html/);

  const styles = await service.get('/assets/style.css');
  assert.equal(styles.status, 200);
  assert.equal(styles.body, ws.read('assets/style.css'));
  assert.match(styles.headers['content-type'], /^text\/css/);

  const script = await service.get('/assets/tutor.js');
  assert.equal(script.status, 200);
  assert.match(script.headers['content-type'], /^text\/javascript/);
});

test('an asset the Workspace cannot answer falls back to the plugin', async (t) => {
  const ws = workspace(t);
  const styles = ws.path('assets/style.css');
  const served = fs.readFileSync(styles, 'utf8');

  // What a Workspace copied to another machine looks like: the link into the
  // plugin is there and points at nothing. Over http it should still render,
  // because the bytes the link was pointing at are the ones this service holds.
  fs.rmSync(styles);
  assert.ok(!fs.existsSync(styles), 'the fixture should have removed the link');

  const service = await TutorService.start(t, ws);
  const res = await service.get('/assets/style.css');

  assert.equal(res.status, 200, 'the plugin has this file, so the Workspace not holding it is not a 404');
  assert.equal(res.body, served);
  assert.match(res.headers['content-type'], /^text\/css/);

  // Only assets/ falls back. The rest of a Workspace is the learner's, and a
  // fallback there would answer for a file this Workspace does not have.
  assert.equal((await service.get('/lessons/0404-absent.html')).status, 404);
});

test('the extension allowlist refuses files that are really there', async (t) => {
  const ws = workspace(t);
  const service = await TutorService.start(t, ws);

  for (const rel of ['private.txt', 'tutor/.tutor.pid']) {
    // Guard: a 404 means nothing unless the file exists to be served.
    assert.ok(ws.exists(rel), `the fixture should have written ${rel}`);

    const res = await service.get('/' + rel);
    assert.equal(res.status, 404, `${rel} is not on the allowlist and must not be served`);
    assert.ok(!res.body.includes(WITHHELD), `${rel} leaked its contents`);
  }

  // A directory is not a file, whatever its name suggests.
  const dir = await service.get('/lessons/');
  assert.equal(dir.status, 404);
});

test('a link out of the Workspace is refused, though the links it holds are followed', async (t) => {
  const ws = workspace(t);

  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'explorable-teach-outside-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  const target = path.join(outside, 'outside.html');
  fs.writeFileSync(target, WITHHELD, 'utf8');

  // A Workspace now deliberately holds links into the plugin, so stat and the
  // read stream follow a link out of it by design. A link the scaffold did not
  // write is the other side of that: its path is inside the Workspace and
  // passes every spelling check, so only where the bytes really live can
  // refuse it.
  fs.symlinkSync(target, ws.path('lessons/0003-leak.html'));

  const service = await TutorService.start(t, ws);

  const leaked = await service.get('/lessons/0003-leak.html');
  assert.equal(leaked.status, 404, 'a link pointing out of the Workspace served what it pointed at');
  assert.ok(!leaked.body.includes(WITHHELD));

  // And the half that has to keep working, or the whole arrangement is broken:
  // the scaffold's own links land in the plugin and are served.
  assert.ok(fs.lstatSync(ws.path('assets/style.css')).isSymbolicLink(), 'the fixture should be a scaffolded Workspace');
  const linked = await service.get('/assets/style.css');
  assert.equal(linked.status, 200);
  assert.equal(linked.body, ws.read('assets/style.css'));
});

test('path traversal is refused, however it is spelled', async (t) => {
  const ws = workspace(t);
  const service = await TutorService.start(t, ws);

  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'explorable-teach-outside-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));

  const target = path.join(outside, 'outside.html');
  fs.writeFileSync(target, WITHHELD, 'utf8');

  // Guard: the file has to be readable, and readable *as* something the
  // allowlist would otherwise wave through, or every 404 below is a 404 for the
  // wrong reason and this test passes for free.
  assert.equal(fs.readFileSync(target, 'utf8'), WITHHELD);

  const reach = path.relative(ws.dir, target); // ../explorable-teach-outside-xxx/outside.html
  assert.ok(reach.startsWith('..'), 'the target must sit outside the Workspace');

  const spellings = [
    '/' + reach,
    '/lessons/../' + reach,
    '/' + reach.replace(/\.\./g, '%2e%2e'),
    '/' + reach.replace(/\//g, '%2f'),
    '/' + reach.replace(/\.\./g, '%252e%252e'),
    '/' + reach.replace(/\.\./g, '..\\'),
  ];

  for (const spelling of spellings) {
    const res = await service.get(spelling);
    assert.equal(res.status, 404, `${spelling} escaped the Workspace`);
    assert.ok(!res.body.includes(WITHHELD), `${spelling} served a file outside the Workspace`);
  }

  // And the other half of the same claim: a path that only *looks* like an
  // escape still resolves, so this is normalisation rather than a blanket
  // refusal of anything with a dot in it.
  const inside = await service.get('/lessons/../lessons/0001-fork.html');
  assert.equal(inside.status, 200);
  assert.equal(inside.body, FIRST_LESSON);
});

// ---------------------------------------------------------------- control

test('the control script refuses to serve the plugin as though it were a Workspace', (t) => {
  const ws = workspace(t);

  // Run through the plugin's own copy rather than through the Workspace's
  // link, the script resolves the plugin as its Workspace — and would serve it
  // as a course and drop a pidfile and a log inside it. Every document says to
  // run `./tutor/tutorctl.sh` from a Workspace, but `SKILL.md` also teaches
  // naming scripts from the plugin root, so this is a reachable mistake.
  const plugin = fs.realpathSync(ws.path('tutor/tutorctl.sh'));
  const run = ws.run(plugin, ['start']);

  assert.equal(run.status, 2, run.stdout + run.stderr);
  assert.match(run.stderr, /not a teaching workspace/);
  assert.ok(!fs.existsSync(path.join(path.dirname(plugin), '.tutor.pid')), 'it wrote a pidfile into the plugin');
});

// ---------------------------------------------------------------- asking

test('a malformed question is rejected before any agent is spawned', async (t) => {
  const ws = workspace(t);
  const service = await TutorService.start(t, ws);

  const rejected = [
    { what: 'an unknown role', body: { role: 'examiner', question: '为什么？' }, error: /Unknown role: examiner/ },
    { what: 'no question at all', body: {}, error: /question is required/ },
    { what: 'a blank question', body: { question: '   \n  ' }, error: /question is required/ },
    { what: 'an oversized question', body: { question: 'x'.repeat(2001) }, error: /question exceeds 2000/ },
    {
      what: 'an oversized selection',
      body: { question: '为什么？', selection: 'x'.repeat(4001) },
      error: /selection exceeds 4000/,
    },
    { what: 'history that is not a list', body: { question: '为什么？', history: 'oops' }, error: /history must be an array/ },
    { what: 'history that is an object', body: { question: '为什么？', history: { role: 'user' } }, error: /history must be an array/ },
    { what: 'a threadId that is not a string', body: { question: '为什么？', threadId: 7 }, error: /threadId must be a string/ },
    { what: 'a body that is not JSON', body: 'not json at all', error: /Invalid JSON/ },
  ];

  for (const { what, body, error } of rejected) {
    const res = await service.ask(body);
    assert.equal(res.status, 400, `${what} should be rejected`);
    assert.match(res.json().error, error, what);
  }

  assert.equal(service.agentRun(), null, 'nothing rejected above should have reached the agent');

  // Guard: the endpoint is refusing these in particular rather than everything.
  // 2000 characters is the documented cap, so 2000 has to be accepted.
  const accepted = await service.ask({ question: 'x'.repeat(2000) });
  assert.equal(accepted.status, 200);
  assert.match(accepted.headers['content-type'], /^text\/event-stream/);
});

test('an oversized body is refused without taking the service down', async (t) => {
  const ws = workspace(t);
  const service = await TutorService.start(t, ws);

  // Past the 128 KiB cap. The service stops reading and answers 413, but it has
  // also destroyed the request by then, so a reset connection is a legitimate
  // outcome on this side of the socket. What must not happen is the service
  // dying — which is the half this asserts.
  const outcome = await service.ask({ question: 'x'.repeat(200_000) }).catch((err) => err);

  if (outcome instanceof Error) {
    assert.match(outcome.code || outcome.message, /ECONNRESET|EPIPE|ECONNABORTED/);
  } else {
    assert.equal(outcome.status, 413);
  }

  assert.equal((await service.get('/api/health')).status, 200, 'the service should still be up');
});

test('the stream reaching the client carries the answer and nothing else', async (t) => {
  const ws = workspace(t);
  const service = await TutorService.start(t, ws, {
    agent: [
      agentSays.noise('system'),
      agentSays.delta('先说结论：'),
      agentSays.thinking('要不要先解释进程？'),
      agentSays.reads('Read', { file_path: ws.path('lessons/0001-fork.html') }),
      agentSays.delta('fork 复制当前进程。'),
      agentSays.result('先说结论：fork 复制当前进程。'),
    ],
  });

  const res = await service.ask({
    question: 'fork 到底做了什么？',
    lesson: 'lessons/0001-fork.html',
    selection: 'fork() 返回两次',
  });

  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /^text\/event-stream/);
  assert.match(res.headers['cache-control'], /no-cache/);
  assert.equal(res.headers['x-accel-buffering'], 'no');

  assert.deepEqual(res.sequence(), ['open', 'delta', 'tool', 'delta', 'done']);

  const events = res.events();
  assert.deepEqual(events[0].data, { role: 'tutor' });
  assert.deepEqual(events[1].data, { text: '先说结论：' });
  assert.deepEqual(events[2].data, { name: 'Read', target: '0001-fork.html' });
  assert.deepEqual(events[3].data, { text: 'fork 复制当前进程。' });
  assert.equal(events[4].data.answer, '先说结论：fork 复制当前进程。');
  assert.equal(typeof events[4].data.durationMs, 'number');

  // The sequence above already says so, but this is the one that matters: the
  // agent's reasoning rides the same envelope as its answer, and only the
  // answer is the learner's to read.
  assert.ok(!res.body.includes('要不要先解释进程'), 'the agent\'s thinking reached the learner');
});

test('one answered question appends exactly one line to the question log', async (t) => {
  const ws = workspace(t);
  const service = await TutorService.start(t, ws, { agent: [agentSays.result('因为它复制了整个进程。')] });

  assert.equal(questionLog(ws), null, 'the log should not exist before the first question');

  const res = await service.ask({
    question: '为什么 fork 返回两次？',
    lesson: 'lessons/0001-fork.html',
    selection: 'fork() 返回两次',
    threadId: 'thread/9',
  });
  assert.deepEqual(res.sequence(), ['open', 'done']);

  // Logging is fired off as the response ends rather than awaited before it, so
  // the client can legitimately be here first.
  const lines = await waitFor('the question log to be appended', () => questionLog(ws));

  assert.equal(lines.length, 1, 'one question, one line');

  const entry = JSON.parse(lines[0]);
  assert.deepEqual(Object.keys(entry).sort(), [
    'answer',
    'durationMs',
    'lesson',
    'question',
    'role',
    'selection',
    'threadId',
    'timestamp',
    'turn',
  ]);

  assert.equal(entry.role, 'tutor');
  assert.equal(entry.question, '为什么 fork 返回两次？');
  assert.equal(entry.answer, '因为它复制了整个进程。');
  assert.equal(entry.lesson, 'lessons/0001-fork.html');
  assert.equal(entry.selection, 'fork() 返回两次');
  assert.equal(entry.turn, 1, 'the first question of a thread is turn 1');
  assert.match(entry.timestamp, /^\d{4}-\d{2}-\d{2}T/);

  // The threadId arrives from the page and is written to a file, so it is
  // stripped of anything that is not a plain identifier.
  assert.equal(entry.threadId, 'thread9');
});

test('an agent that reports failure is surfaced as an error and not logged', async (t) => {
  const ws = workspace(t);
  const service = await TutorService.start(t, ws, { agent: [agentSays.failure('rate limited')] });

  const res = await service.ask({ question: '这是什么？' });

  assert.equal(res.status, 200, 'the stream opened before the failure, so the status is already sent');
  assert.deepEqual(res.sequence(), ['open', 'error']);
  assert.match(res.events()[1].data.message, /rate limited/);

  // A question with no answer is not curriculum signal, so nothing is written.
  // Asserting the absence means waiting for it and being disappointed.
  await assert.rejects(
    waitFor('a log line that should never arrive', () => questionLog(ws), { timeout: 500 }),
    /timed out/,
  );
});

test('a missing agent binary is reported rather than hung on', async (t) => {
  const service = await TutorService.start(t, workspace(t), { agent: null });

  const res = await service.ask({ question: '这是什么？' });

  assert.deepEqual(res.sequence(), ['open', 'error']);
  assert.match(res.events()[1].data.message, /claude/);
});

test('an agent that exits non-zero surfaces what it said on the way out', async (t) => {
  const service = await TutorService.start(t, workspace(t), { exit: 3, stderr: 'not logged in\n' });

  const res = await service.ask({ question: '这是什么？' });

  assert.deepEqual(res.sequence(), ['open', 'error']);
  assert.match(res.events()[1].data.message, /not logged in/);
});

// ---------------------------------------------------------------- the payload

test('the agent is spawned read-only, in the Workspace, with the tuned role prompt', async (t) => {
  const ws = workspace(t);
  const service = await TutorService.start(t, ws, { agent: [agentSays.result('好。')] });

  await service.ask({ question: '这是什么？' });

  const run = service.agentRun();
  assert.ok(run, 'the service never spawned the agent');

  assert.equal(run.cwd, ws.dir, 'the agent reads the Workspace, so that is where it runs');
  assert.ok(run.argv.includes('--restricted'));
  assert.equal(service.agentFlag('--output-format'), 'stream-json');
  assert.ok(run.argv.includes('--include-partial-messages'));

  const tools = run.argv.indexOf('--allowed-tools');
  assert.deepEqual(run.argv.slice(tools + 1, tools + 4), ['Read', 'Glob', 'Grep'], 'read-only tools only');

  // "Never --resume or --continue — a resumed session would drag back exactly
  // the rot this design exists to avoid." The Tutor holds no process state.
  assert.deepEqual(run.argv.filter((a) => a === '--resume' || a === '--continue'), []);

  // One source of truth for how the Tutor behaves, read in two halves: the
  // shared definition the plugin owns, then this Workspace's own tuning. The
  // subagent is pointed at the same two files in the same order, so neither
  // path is a degraded version of the other.
  assert.equal(
    service.agentFlag('--append-system-prompt'),
    `${ws.read('tutor/ROLE.md').trim()}\n\n${ws.read('tutor/TUNING.md').trim()}`,
  );
});

test('the role definition is the plugin\'s, and the Workspace only tunes it', async (t) => {
  const ws = workspace(t);

  // The link is what makes a fix reach every Workspace: the Workspace holds a
  // pointer, and the bytes live once, in the plugin.
  assert.ok(fs.lstatSync(ws.path('tutor/ROLE.md')).isSymbolicLink(), 'the role definition should not be a copy');
  assert.ok(fs.lstatSync(ws.path('tutor/TUNING.md')).isFile(), 'the tuning is this Workspace\'s own');

  ws.write('tutor/TUNING.md', '# 学科调校\n\n本课只讲 POSIX，不要提 Windows。');

  const service = await TutorService.start(t, ws, { agent: [agentSays.result('好。')] });
  await service.ask({ question: '这是什么？' });

  const prompt = service.agentFlag('--append-system-prompt');
  assert.ok(prompt.includes('你**只读不写**'), 'the shared definition should be there');
  assert.ok(prompt.includes('本课只讲 POSIX'), 'and this Workspace\'s tuning after it');
  assert.ok(
    prompt.indexOf('你**只读不写**') < prompt.indexOf('本课只讲 POSIX'),
    'tuning comes after the definition it tunes, so it can override rather than be overridden',
  );

  // The same two documents, named in the same order, are what the subagent is
  // told to read — that is the whole of "one role definition, two paths".
  const subagent = ws.read('.claude/agents/tutor.md');
  assert.ok(subagent.includes('tutor/ROLE.md'), 'the subagent should be pointed at the shared definition');
  assert.ok(subagent.includes('tutor/TUNING.md'), 'and at this Workspace\'s tuning');
  assert.ok(
    subagent.indexOf('tutor/ROLE.md') < subagent.indexOf('tutor/TUNING.md'),
    'in the order the service composes them',
  );
});

test('an untuned Workspace still gets the whole role definition', async (t) => {
  const ws = workspace(t);
  fs.rmSync(ws.path('tutor/TUNING.md'));

  const service = await TutorService.start(t, ws, { agent: [agentSays.result('好。')] });
  await service.ask({ question: '这是什么？' });

  // A Workspace nobody has tuned yet is the normal state on day one, not a
  // broken install — so the Tutor is whole without it.
  assert.equal(service.agentFlag('--append-system-prompt'), ws.read('tutor/ROLE.md').trim());
});

test('the payload carries the context the service promises to inline', async (t) => {
  const ws = workspace(t);
  const service = await TutorService.start(t, ws, { agent: [agentSays.result('好。')] });

  await service.ask({
    question: '这一段是什么意思？',
    lesson: 'lessons/0001-fork.html',
    selection: 'fork() 返回两次',
  });

  const payload = service.agentFlag('-p');
  assert.ok(payload, 'the question is passed as an argument, never interpolated into a command');

  // Inlined so the Tutor does not spend a tool round-trip on them; read from
  // the fixture rather than restated, so tuning either file cannot drift.
  assert.ok(payload.includes(NOTES.trim()), 'NOTES.md should be inlined');
  assert.ok(payload.includes(MISSION.trim()), 'MISSION.md should be inlined');

  assert.ok(payload.includes('lessons/0001-fork.html'), 'the Lesson being read should be named');
  assert.ok(payload.includes('fork() 返回两次'), 'the selected passage should be quoted');
  assert.ok(payload.includes('这一段是什么意思？'), 'the question should be there');
});

// ---------------------------------------------------------------- history

test('history is trimmed to its documented caps', async (t) => {
  const ws = workspace(t);
  const service = await TutorService.start(t, ws, { agent: [agentSays.result('好。')] });

  // Nine turns, alternating, oldest first. The cap is six.
  const history = [];
  for (let i = 1; i <= 9; i++) {
    history.push({ role: i % 2 ? 'user' : 'assistant', content: `turn-${i}` });
  }

  await service.ask({ question: '接着说。', history, threadId: 'abc' });

  const payload = service.agentFlag('-p');
  assert.ok(payload, 'the service never spawned the agent');
  assert.ok(payload.includes('本次对话的前几轮'), 'the transcript heading ROLE.md promises');

  for (const dropped of ['turn-1', 'turn-2', 'turn-3']) {
    assert.ok(!payload.includes(dropped), `${dropped} is past the six-turn cap and should be gone`);
  }
  for (const kept of ['turn-4', 'turn-5', 'turn-6', 'turn-7', 'turn-8', 'turn-9']) {
    assert.ok(payload.includes(kept), `${kept} is within the cap and should be replayed`);
  }

  // Trimming the replay must not make the learner's place in the thread lie:
  // the turn index counts what they actually asked, not what survived the cap.
  const lines = await waitFor('the question log to be appended', () => questionLog(ws));
  assert.equal(JSON.parse(lines[0]).turn, 6, 'five earlier questions were asked, so this is the sixth');
});

test('one long turn is truncated, and a long transcript loses its oldest turns', async (t) => {
  const ws = workspace(t);
  const service = await TutorService.start(t, ws, { agent: [agentSays.result('好。')] });

  await service.ask({
    question: '接着说。',
    history: [{ role: 'user', content: 'A'.repeat(2400) + 'TAIL' }],
  });

  const long = service.agentFlag('-p');
  assert.ok(long, 'the service never spawned the agent');
  assert.ok(!long.includes('TAIL'), 'a turn longer than 2000 characters should be cut short');
  assert.ok(long.includes('A'.repeat(2000)), 'and cut at 2000, not dropped');
  assert.ok(!long.includes('A'.repeat(2001)));

  // Six turns of 1500 characters is 9000, against a 6000 total. Dropping the
  // two oldest brings it to exactly the cap. `mark-1` is six characters, so the
  // padding is 1494 — the arithmetic in this comment is the arithmetic below.
  const history = [];
  for (let i = 1; i <= 6; i++) {
    history.push({ role: i % 2 ? 'user' : 'assistant', content: `mark-${i}` + 'x'.repeat(1500 - 6) });
  }

  await service.ask({ question: '接着说。', history });

  const total = service.agentFlag('-p');
  assert.ok(total, 'the service never spawned the agent');
  assert.ok(!total.includes('mark-1'), 'the oldest turn should go first');
  assert.ok(!total.includes('mark-2'));
  for (const kept of ['mark-3', 'mark-4', 'mark-5', 'mark-6']) {
    assert.ok(total.includes(kept), `${kept} fits within the total cap`);
  }
});

test('a malformed turn is dropped rather than costing the learner their answer', async (t) => {
  const ws = workspace(t);
  const service = await TutorService.start(t, ws, { agent: [agentSays.result('好。')] });

  const res = await service.ask({
    question: '接着说。',
    history: [
      null,
      { role: 'narrator', content: 'kept-none' },
      { role: 'user' },
      { role: 'user', content: '   ' },
      { role: 'assistant', content: 42 },
      { role: 'user', content: 'kept-this' },
    ],
  });

  assert.deepEqual(res.sequence(), ['open', 'done']);

  const payload = service.agentFlag('-p');
  assert.ok(payload, 'the service never spawned the agent');
  assert.ok(payload.includes('kept-this'), 'the one well-formed turn should survive');
  assert.ok(!payload.includes('kept-none'), 'a turn with an unknown role should not');
});

// ---------------------------------------------------------------- grading

const ASSIGNMENT = 'assignments/0003-pipe-audit.html';
const RUBRIC = '算做完了：\n- 指出了每一段的 stdin 是谁的 stdout\n';
const GRADER_TUNING = '# 评分调校\n\n这门课不考 Windows 上的等价物。\n';
const SUBMISSION =
  'ls | grep x | wc -l：第二段读的是第一段的 stdout。\n\n' +
  '做出来的东西我放在工作区里了，请自己读：\n- submissions/0003-pipes/notes.md';
const VERDICT = '过了。你说清楚了每一段的 stdin 是谁的 stdout。';

/**
 * The fixture Workspace with an Assignment in it. The Rubric sits in the page
 * exactly as the Component stores it — in a block the page never renders — so
 * that what the Grader is pointed at here is what it would be pointed at there.
 */
function graded(t) {
  const ws = workspace(t);
  ws.write(
    ASSIGNMENT,
    '<!doctype html>\n<div class="assignment" data-assignment>\n<p class="assignment-task">拆一条管道。</p>\n' +
      `<script type="application/x-rubric">\n${RUBRIC}</script>\n</div>\n`,
  );
  ws.write('tutor/GRADER-TUNING.md', GRADER_TUNING);
  return ws;
}

/** The Learning Records in the Workspace, in the order their numbers put them. */
function records(ws) {
  return fs.readdirSync(ws.path('learning-records')).filter((name) => name.endsWith('.md')).sort();
}

test('grading is its own role, tuned on its own, and is never the Tutor wearing a hat', async (t) => {
  const ws = graded(t);
  const service = await TutorService.start(t, ws, { agent: [agentSays.result(VERDICT)] });

  await service.ask({ role: 'grader', question: SUBMISSION, lesson: ASSIGNMENT });

  const prompt = service.agentFlag('--append-system-prompt');
  assert.equal(
    prompt,
    `${ws.read('tutor/GRADER.md').trim()}\n\n${GRADER_TUNING.trim()}`,
    'the same two halves in the same order the Tutor gets, out of the Grader\'s own two files',
  );

  // The thing a Grader must not be. Both of the Tutor's halves are in this
  // Workspace, one file away, and composing either of them in would be how
  // "the Session that wrote the Assignment grades it" returns by the side door.
  assert.ok(!prompt.includes(ws.read('tutor/ROLE.md').trim()), 'the Tutor definition reached the Grader');
  assert.ok(!prompt.includes(TUNING.trim()), 'and so did the Tutor tuning');

  // Split the way everything else is: the definition is the plugin's, so a fix
  // reaches every Workspace, and the tuning is this course's own.
  assert.ok(fs.lstatSync(ws.path('tutor/GRADER.md')).isSymbolicLink(), 'the definition should not be a copy');
  assert.ok(fs.lstatSync(ws.path('tutor/GRADER-TUNING.md')).isFile(), 'the tuning is this Workspace\'s own');

  const subagent = ws.read('.claude/agents/grader.md');
  assert.ok(subagent.includes('tutor/GRADER.md'), 'the subagent should be pointed at the shared definition');
  assert.ok(subagent.includes('tutor/GRADER-TUNING.md'), 'and at this Workspace\'s tuning');
  assert.ok(
    subagent.indexOf('tutor/GRADER.md') < subagent.indexOf('tutor/GRADER-TUNING.md'),
    'in the order the service composes them',
  );
});

test('the Grader is sent to the page holding the Rubric, never sent the Rubric', async (t) => {
  const ws = graded(t);
  const service = await TutorService.start(t, ws, { agent: [agentSays.result(VERDICT)] });

  await service.ask({ role: 'grader', question: SUBMISSION, lesson: ASSIGNMENT });

  const payload = service.agentFlag('-p');
  assert.ok(payload, 'the service never spawned the agent');

  assert.ok(payload.includes(ASSIGNMENT), 'the page it has to read');
  assert.ok(payload.includes('x-rubric'), 'and what to look for inside it');
  assert.ok(payload.includes(SUBMISSION), 'the Submission, as the learner wrote it');
  assert.ok(payload.includes('submissions/'), 'and where to look for what the page could not hold');

  // The criteria stay on disk and the Grader goes and gets them. A Rubric
  // riding the request would be whatever the page that sent it decided on,
  // which is the opposite of a judgement reproducible from the Workspace.
  assert.ok(!payload.includes(RUBRIC.trim()), 'the Rubric itself was sent, so it no longer has to be stored');

  // The same context the Tutor is handed, for the same reason: what counts as
  // done for this learner is not separable from why they are here.
  assert.ok(payload.includes(NOTES.trim()), 'NOTES.md should be inlined');
  assert.ok(payload.includes(MISSION.trim()), 'MISSION.md should be inlined');
});

test('a graded Submission becomes a Learning Record, on disk before the page is told', async (t) => {
  const ws = graded(t);
  ws.write('learning-records/0001-processes.md', '# 进程\n');

  const service = await TutorService.start(t, ws, { agent: [agentSays.result(VERDICT)] });

  const res = await service.ask({
    role: 'grader',
    question: SUBMISSION,
    lesson: ASSIGNMENT,
    threadId: 'grade/1',
  });
  assert.deepEqual(res.sequence(), ['open', 'done']);

  const written = 'learning-records/0002-0003-pipe-audit.md';
  assert.deepEqual(records(ws), ['0001-processes.md', '0002-0003-pipe-audit.md'], 'numbered after what was there');
  assert.equal(res.events()[1].data.record, written, 'the page is told where it landed, and is right');

  const record = ws.read(written);
  assert.match(record, /^# 作业判定：0003-pipe-audit$/m, 'a record opens on what it is a record of');
  assert.ok(record.includes(VERDICT), 'the verdict is the record');
  assert.ok(record.includes(ASSIGNMENT), 'and it names the page it was reached against');
  assert.ok(
    !/依据.*Rubric/.test(record),
    'a record states where a verdict came from; asserting what it applied is a claim nothing checked',
  );
  assert.ok(record.includes('第二段读的是第一段的 stdout'), 'with the evidence it was reached on');

  // Both, not one or the other: the question log is feedback about the page,
  // and the record is evidence about the learner.
  const lines = await waitFor('the question log to be appended', () => questionLog(ws));
  const entry = JSON.parse(lines[0]);
  assert.equal(entry.role, 'grader');
  assert.equal(entry.lesson, ASSIGNMENT);
  assert.equal(entry.record, written);

  // A second hand-in is a second record rather than an overwrite. What a
  // learner could do last month is what makes the next judgement mean anything.
  await service.ask({ role: 'grader', question: SUBMISSION, lesson: ASSIGNMENT });
  assert.deepEqual(records(ws), [
    '0001-processes.md',
    '0002-0003-pipe-audit.md',
    '0003-0003-pipe-audit.md',
  ]);
});

test('questioning a verdict is a conversation about a record, not a second one', async (t) => {
  const ws = graded(t);
  const service = await TutorService.start(t, ws, { agent: [agentSays.result('因为你没提中间那一段。')] });

  const res = await service.ask({
    role: 'grader',
    question: '中间那一段为什么算没答？',
    lesson: ASSIGNMENT,
    history: [
      { role: 'user', content: SUBMISSION },
      { role: 'assistant', content: VERDICT },
    ],
  });

  assert.deepEqual(res.sequence(), ['open', 'done']);
  assert.equal(res.events()[1].data.record, undefined, 'nothing new was recorded');
  assert.deepEqual(records(ws), [], 'and nothing was written');

  const payload = service.agentFlag('-p');
  assert.ok(payload.includes('本次对话的前几轮'), 'the verdict is replayed, so the answer is about that verdict');
  assert.ok(payload.includes('评分：' + VERDICT), 'labelled as the Grader\'s own turn rather than the Tutor\'s');
  assert.ok(!payload.includes('他交上来的作业'), 'and the follow-up is not framed as a fresh hand-in');
});

test('a Grader that refuses to judge is not recorded as having judged', async (t) => {
  // GRADER.md tells it to refuse when the page stores no Rubric, opening with a
  // fixed line. That line is a contract between two files the plugin owns — the
  // same arrangement as the transcript heading — and it exists because the Boot
  // sequence plans from Learning Records: a record saying a verdict was reached
  // when none was is worse than no record at all.
  const ws = graded(t);
  const refusal = '无法判定：这份作业页里没有存评分标准，请回去找出题的老师补上。';
  const service = await TutorService.start(t, ws, { agent: [agentSays.result(refusal)] });

  const res = await service.ask({ role: 'grader', question: SUBMISSION, lesson: ASSIGNMENT });

  assert.deepEqual(res.sequence(), ['open', 'done'], 'the learner is still told, and told why');
  assert.equal(res.events()[1].data.answer, refusal);
  assert.equal(res.events()[1].data.record, undefined, 'and the page does not claim it was filed');
  assert.deepEqual(records(ws), [], 'nothing about the learner was demonstrated, so nothing is evidence');

  // Guard the observer, against the same fixture: the only difference is what
  // the agent said, so a check that recorded nothing either way would pass this
  // by doing nothing at all.
  const judging = await TutorService.start(t, ws, { agent: [agentSays.result(VERDICT)] });
  await judging.ask({ role: 'grader', question: SUBMISSION, lesson: ASSIGNMENT });
  assert.equal(records(ws).length, 1, 'a verdict in the same Workspace is still recorded');

  // The opening the service watches for is the one the role definition asks
  // for, read out of the file rather than restated here.
  assert.match(ws.read('tutor/GRADER.md'), /无法判定：/, 'the Grader is no longer told to say this');
});

test('a grading that produced no verdict leaves nothing behind', async (t) => {
  const ws = graded(t);
  const service = await TutorService.start(t, ws, { agent: [agentSays.failure('rate limited')] });

  const res = await service.ask({ role: 'grader', question: SUBMISSION, lesson: ASSIGNMENT });

  assert.deepEqual(res.sequence(), ['open', 'error']);
  assert.deepEqual(records(ws), [], 'a verdict nobody gave is not evidence about anybody');

  await assert.rejects(
    waitFor('a log line that should never arrive', () => questionLog(ws), { timeout: 500 }),
    /timed out/,
  );
});
