'use strict';

// `docs/agents/tests.md` used to say the in-page drawer was under no test, and
// the Tutor suite ended at the socket. That was affordable while the drawer
// only ever assigned text. It stopped being affordable the moment it started
// building nodes out of generated text, so the two paths that do — an answer
// arriving over the stream and an answer read back after being pinned — are
// driven here, in the fixture DOM, against a scaffolded Workspace's `assets/`.
//
// What is still not covered: the service (that is `tutor-server.test.js`), the
// clipboard fallback, and the thread history. The claim this file makes is
// narrow on purpose — a Tutor answer reaches the page as rich text, and the
// markup inside it reaches the page as text.

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { Workspace } = require('./helpers/workspace.js');
const { Page } = require('./helpers/dom.js');
const { LESSON_HTML } = require('./helpers/lesson.js');

/** An answer with every piece of Markdown a Tutor actually writes. */
const ANSWER = [
  '## fork 与 exec',
  '',
  '`fork()` 返回**两次**:',
  '',
  '- 在父进程里返回子进程的 pid',
  '- 在子进程里返回 0',
  '',
  '```c',
  'pid_t pid = fork();',
  'if (pid == 0) exec("/bin/ls");',
  '```',
  '',
  '细节见 [Unit 2](../lessons/0002.html)。',
].join('\n');

/** One server-sent event, spelled the way `server.js` spells it. */
function event(name, data) {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * The answer as the service delivers it: a few deltas, then `done`, cut into
 * three chunks that fall mid-event. The drawer reassembles across chunk
 * boundaries, and a stub that wrote one tidy chunk would leave that untested
 * while every assertion below went on passing — the same reason the service
 * fixture cuts its transcript awkwardly.
 */
function chunksFor(answer) {
  const half = Math.floor(answer.length / 2);
  const stream =
    event('tool', { name: 'Read', target: 'lessons/0003.html' }) +
    event('delta', { text: answer.slice(0, half) }) +
    event('delta', { text: answer.slice(half) }) +
    event('done', { answer, durationMs: 12 });

  const cut = Math.floor(stream.length / 3);
  return [stream.slice(0, cut), stream.slice(cut, cut * 2), stream.slice(cut * 2)];
}

/** Storage the drawer can keep its threads and pinned answers in. */
function storage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
}

/**
 * A Lesson with the drawer mounted in it, served by a stub that answers the
 * health probe and streams `chunks` at `/api/ask`.
 *
 * `withRenderer: false` stages the one failure lesson-boot.js tolerates by
 * design — a component script that did not load — because a learner must still
 * be able to read the answer when that happens. `store` is passed in rather
 * than made here so that a second mount can be given the first one's storage,
 * which is what a reload is.
 */
function mount(assetsDir, { chunks = chunksFor(ANSWER), ends = true, withRenderer = true, store = storage() } = {}) {
  const asked = [];
  const page = Page.load(LESSON_HTML, assetsDir, {
    globals: {
      location: { protocol: 'http:', pathname: '/lessons/0003-fork-exec.html' },
      localStorage: store,
      setTimeout,
      TextDecoder,
      fetch(url, options) {
        if (url === '/api/health') {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
        }
        asked.push(JSON.parse(options.body));

        let next = 0;
        return Promise.resolve({
          ok: true,
          body: {
            getReader: () => ({
              read: () => {
                if (next < chunks.length) {
                  return Promise.resolve({ done: false, value: Buffer.from(chunks[next++], 'utf8') });
                }
                // `ends: false` leaves the answer in flight, which is where a
                // streamed answer spends most of its life.
                return ends ? Promise.resolve({ done: true, value: undefined }) : new Promise(() => {});
              },
            }),
          },
        });
      },
    },
  });

  if (withRenderer) page.script('rich-text.js');
  page.script('tutor.js');

  page.asked = asked;
  page.store = store;
  return page;
}

/** That Lesson, in a Workspace scaffolded the way a learner's is. */
function lesson(t, options) {
  const ws = Workspace.create(t);
  ws.scaffold();
  return mount(ws.path('assets'), options);
}

/** Let the drawer's promise chain run to the end of the stream. */
async function settle(rounds = 12) {
  for (let i = 0; i < rounds; i++) await new Promise((resolve) => setImmediate(resolve));
}

/** Ask a question the way a learner does: open the drawer, type, send. */
async function ask(page, question = '这段什么意思？') {
  await settle(); // the health probe, which is what puts the drawer online
  assert.equal(page.text('.tutor-status'), '在线', 'the drawer should have found the service');

  page.click(page.query('.tutor-fab'));
  page.type(page.query('.tutor-input'), question);
  page.click(page.query('.tutor-send'));
  await settle();

  return page.query('.tutor-msg.tutor .tutor-msg-body');
}

test('a streamed answer arrives as rich text, not as one run of characters', async (t) => {
  const page = lesson(t);
  const body = await ask(page);

  assert.ok(body, 'the answer should be in the thread');
  assert.equal(body.querySelectorAll('h2').length, 1, 'a heading is a heading');
  assert.equal(body.querySelectorAll('li').length, 2, 'both bullets are bullets');
  assert.equal(body.querySelectorAll('strong').length, 1);

  const code = body.querySelector('pre code');
  assert.ok(code, 'the code block is the point of all this');
  assert.match(code.textContent, /pid_t pid = fork\(\);/);
  assert.equal(code.getAttribute('class'), 'language-c');

  const link = body.querySelector('a');
  assert.equal(link.getAttribute('href'), '../lessons/0002.html');

  // And the drawer is otherwise unchanged: the turn was recorded and the
  // caret that marked the answer as in-flight is gone.
  assert.equal(page.queryAll('.tutor-caret').length, 0);
  assert.equal(page.asked.length, 1);
  assert.equal(page.asked[0].question, '这段什么意思？');
});

test('an answer still streaming is already readable', async (t) => {
  // The stream arrives mid-fence for most of its life. Re-rendering each delta
  // is only safe if a half-written answer renders as something.
  const partial = ANSWER.slice(0, ANSWER.indexOf('pid_t') + 10);
  const page = lesson(t, { chunks: [event('delta', { text: partial })], ends: false });
  const body = await ask(page);

  assert.ok(body.querySelector('pre code'), 'an unclosed fence is still code');
  assert.match(body.textContent, /fork/);

  const caret = page.query('.tutor-caret');
  assert.ok(caret, 'and it is still marked as in flight');

  // Inside the last paragraph rather than after it: blocks stack, so a caret
  // appended to the body would blink on a line of its own under the answer.
  const trailing = lesson(t, { chunks: [event('delta', { text: '先说结论' })], ends: false });
  const live = await ask(trailing);
  assert.equal(live.querySelector('.tutor-caret').parentNode.localName, 'p');
});

test('a pinned answer renders the same way the live one did', async (t) => {
  const page = lesson(t);
  const body = await ask(page);

  page.click(page.query('.tutor-pin'));

  const pinned = page.query('#tutor-notes .tutor-note-a');
  assert.ok(pinned, 'pinning puts the answer in the Lesson');
  assert.equal(pinned.querySelectorAll('li').length, body.querySelectorAll('li').length);
  assert.match(pinned.querySelector('pre code').textContent, /pid_t pid = fork\(\);/);
  assert.equal(pinned.querySelector('a').getAttribute('href'), '../lessons/0002.html');
});

test('a pinned answer survives the reload that only the store outlives', async (t) => {
  const page = lesson(t);
  await ask(page);
  page.click(page.query('.tutor-pin'));

  // Same storage, a second mount: what a learner gets by reopening the Lesson.
  const again = mount(page.assetsDir, { store: page.store });

  const restored = again.query('#tutor-notes .tutor-note-a');
  assert.ok(restored, 'the pinned answer should come back');
  assert.match(restored.querySelector('pre code').textContent, /pid_t pid = fork\(\);/);

  const thread = again.query('.tutor-msg.tutor .tutor-msg-body');
  assert.ok(thread.querySelector('pre code'), 'and so should the thread it came from');
});

test('markup inside an answer reaches the Lesson as text a learner reads', async (t) => {
  const hostile = 'Careful: <script>alert(1)</script> and <img src=x onerror="alert(2)"> and [x](javascript:alert(3)).';
  const page = lesson(t, { chunks: [event('done', { answer: hostile })] });
  const body = await ask(page);

  page.click(page.query('.tutor-pin'));

  for (const where of [body, page.query('#tutor-notes .tutor-note-a')]) {
    assert.equal(where.querySelectorAll('script').length, 0, 'nothing was parsed as markup');
    assert.equal(where.querySelectorAll('img').length, 0);
    assert.equal(where.querySelectorAll('a').length, 0, 'the scripted destination did not become a link');
    assert.match(where.textContent, /alert\(1\)/, 'the learner sees what the Tutor wrote');
    assert.match(where.textContent, /onerror/);
  }
});

test('an answer is readable even when the renderer did not load', async (t) => {
  // lesson-boot.js carries on past a script that fails to load, on purpose. A
  // Lesson that becomes unreadable when one does would make that a lie.
  const page = lesson(t, { withRenderer: false });
  const body = await ask(page);

  assert.equal(body.querySelectorAll('pre').length, 0, 'nothing rendered it');
  assert.match(body.textContent, /pid_t pid = fork\(\);/, 'but the answer is all there');
});
