'use strict';

// `docs/agents/tests.md` used to say the in-page drawer was under no test, and
// the Tutor suite ended at the socket. That was affordable while the drawer
// only ever assigned text. It stopped being affordable the moment it started
// building nodes out of generated text, so the two paths that do — an answer
// arriving over the stream and an answer read back after being pinned — are
// driven here, in the fixture DOM, against a scaffolded Workspace's `assets/`.
//
// What the drawer does around an answer is driven here too, because all of it
// is what a learner meets on a service that is slow, stopped, or having a bad
// day: the three stages of the wait, the stop, the retry, the clipboard
// fallback, and the poll that finds a service started after the page was
// opened.
//
// What is still not covered: the service itself (that is `tutor-server.test.js`),
// the `document.execCommand` end of the clipboard fallback, and the thread
// history.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { REPO_ROOT } = require('./helpers/workspace.js');
const { LESSON_HTML, UNIT, PAGES, FIXTURE_LANG } = require('./helpers/unit.js');
const { say } = require('./helpers/learner-text.js');
const { refusalToken } = require('./helpers/tutor.js');
const {
  ANSWER,
  drawerIn,
  event,
  chunksFor,
  fedStream,
  mount,
  readerFor,
  settle,
} = require('./helpers/drawer.js');

const ASSIGNMENT_HTML = PAGES.find((page) => page.key === 'assignment').html;
const ASSETS = path.join(REPO_ROOT, 'skills/explorable-teach/runtime/assets');
const read = (abs) => fs.readFileSync(abs, 'utf8');

/**
 * What the drawer says, in the language the fixture pages declare.
 *
 * Every assertion below about a word on screen goes through this rather than
 * naming the word. What is under test is that the drawer asked for the right
 * *key* — the split between what the plugin ships and what the Learner reads —
 * and a test that pinned the word instead would have to be rewritten the day a
 * language is added, which is the defect this whole arrangement removes.
 */
const drawerSays = (key, values) => say(FIXTURE_LANG, key, values);

/** That Lesson, in a Workspace scaffolded the way a learner's is. */
function lesson(t, options) {
  return drawerIn(t, LESSON_HTML, options);
}

/** The Assignment page of the same Unit, with its hand-in mounted over the drawer. */
function assignment(t, options) {
  return drawerIn(t, ASSIGNMENT_HTML, {
    at: '/' + UNIT.assignment,
    before: ['assignment.js'],
    ...options,
  });
}

/** Hand in a short answer the way a learner does: write it, press the button. */
async function hand(page, answer = '第二段读的是第一段的 stdout。') {
  await settle(); // the health probe, which is what puts the drawer online
  page.type(page.query('#assignment-1-answer'), answer);
  page.click(page.query('.assignment-send'));
  await settle();
  return page.query('.tutor-msg.tutor .tutor-msg-body');
}


/** Ask a question the way a learner does: open the drawer, type, send. */
async function ask(page, question = '这段什么意思？') {
  await settle(); // the health probe, which is what puts the drawer online
  assert.equal(
    page.text('.tutor-status'),
    drawerSays('tutor.status.online'),
    'the drawer should have found the service',
  );

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
  const again = mount(page.assetsDir, { html: LESSON_HTML, store: page.store });

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

test('the wait is reported in three stages, the middle one from the service’s own events', async (t) => {
  const feed = fedStream();
  const page = lesson(t, { feed });

  await settle();
  page.click(page.query('.tutor-fab'));
  page.type(page.query('.tutor-input'), '这段什么意思？');
  page.click(page.query('.tutor-send'));
  await settle();

  const stage = () => page.query('.tutor-progress').getAttribute('data-stage');
  assert.equal(stage(), 'accepted', 'the click has an effect at once');
  assert.equal(page.text('.tutor-stage'), drawerSays('tutor.stage.sending'), 'but claims only what it knows');

  feed.push(event('open', { role: 'tutor' }));
  await settle();
  assert.equal(stage(), 'accepted');
  assert.equal(
    page.text('.tutor-stage'),
    drawerSays('tutor.stage.accepted'),
    'the service saying so is what makes it accepted',
  );

  // Stage two is not invented here: it is the tool event the service has
  // always sent, which the drawer until now drew only as a decorative chip.
  feed.push(event('tool', { name: 'Read', target: '0003-fork-exec.html' }));
  await settle();
  assert.equal(stage(), 'reading');
  assert.match(page.text('.tutor-stage'), /0003-fork-exec\.html/, 'and it says what is being read');
  assert.equal(page.queryAll('.tutor-tool').length, 1, 'the chip is still there too');

  feed.push(event('delta', { text: '先说结论' }));
  await settle();
  assert.equal(stage(), 'answering');

  // The elapsed indication is the whole difference between slow and stuck.
  assert.equal(page.text('.tutor-elapsed'), drawerSays('tutor.elapsed.seconds', { seconds: 0 }));
  page.clock.advance(7000);
  page.tick();
  assert.equal(page.text('.tutor-elapsed'), drawerSays('tutor.elapsed.seconds', { seconds: 7 }));

  feed.push(event('done', { answer: '先说结论。', durationMs: 7000 }));
  feed.end();
  await settle();

  assert.equal(page.queryAll('.tutor-progress').length, 0, 'the row lasts exactly as long as the request');
  assert.equal(page.timers.live.size, 0, 'and takes its clock with it');
});

test('a read that arrives mid-answer is reported as the read it is', async (t) => {
  // The stages are an order a request usually passes through, not one it is
  // held to: the service's own event order, the one `tutor-server.test.js`
  // pins, is open, delta, tool, delta, done. Mid-answer is where this matters
  // most — the text stops growing, and the row is what says it stopped to go
  // and read something rather than stalled.
  const feed = fedStream();
  const page = lesson(t, { feed });

  await settle();
  page.click(page.query('.tutor-fab'));
  page.type(page.query('.tutor-input'), '这段什么意思？');
  page.click(page.query('.tutor-send'));
  await settle();

  const stage = () => page.query('.tutor-progress').getAttribute('data-stage');

  feed.push(event('open', { role: 'tutor' }));
  feed.push(event('delta', { text: '先说结论：' }));
  await settle();
  assert.equal(stage(), 'answering');

  feed.push(event('tool', { name: 'Read', target: '0002.html' }));
  await settle();
  assert.equal(stage(), 'reading', 'the pause in the text has a reason, and the row gives it');
  assert.match(page.text('.tutor-stage'), /0002\.html/);

  feed.push(event('delta', { text: 'fork 返回两次。' }));
  await settle();
  assert.equal(stage(), 'answering', 'and it is back to answering when the text resumes');
  assert.match(page.text('.tutor-msg.tutor .tutor-msg-body'), /先说结论：fork 返回两次。/);
});

test('an in-flight answer can be stopped, and what arrived before the stop is kept', async (t) => {
  const feed = fedStream();
  const page = lesson(t, { feed });

  await settle();
  page.click(page.query('.tutor-fab'));
  page.type(page.query('.tutor-input'), '这段什么意思？');
  page.click(page.query('.tutor-send'));
  await settle();

  feed.push(event('delta', { text: '第一句已经说完了' }));
  await settle();

  page.click(page.query('.tutor-cancel'));
  await settle();

  assert.ok(feed.cancelled, 'letting the stream go is what stops the agent at the other end');
  assert.match(page.text('.tutor-msg.tutor .tutor-msg-body'), /第一句已经说完了/, 'half an answer is still an answer');
  assert.equal(page.queryAll('.tutor-progress').length, 0);
  assert.equal(page.timers.live.size, 0, 'nothing is left ticking');
  assert.equal(page.query('.tutor-send').disabled, false, 'and the composer is free again');
  assert.ok(page.query('.tutor-retry'), 'a stop offers the same way onward a failure does');
  assert.equal(page.store.getItem('tutor-threads::0003-fork-exec.html'), null, 'a stopped answer is not an answer');
});

test('a stop that lands before the service has answered still lets the request go', async (t) => {
  // The window the learner is most likely to stop in is the one before anything
  // has come back at all — and in that window there is no reader yet to let go
  // of, so a stop that only remembered itself would leave the agent running.
  const feed = fedStream();
  let respond;
  const page = lesson(t, { feed, reply: () => new Promise((resolve) => { respond = resolve; }) });

  await settle();
  page.click(page.query('.tutor-fab'));
  page.type(page.query('.tutor-input'), '这段什么意思？');
  page.click(page.query('.tutor-send'));
  await settle();

  page.click(page.query('.tutor-cancel'));
  await settle();
  assert.equal(page.query('.tutor-send').disabled, false, 'the composer is free at once');

  respond({ ok: true, body: { getReader: () => feed.reader() } });
  await settle();

  assert.ok(feed.cancelled, 'and the response is let go when it does arrive');
  assert.equal(page.queryAll('.tutor-progress').length, 0);
  assert.equal(page.timers.live.size, 0);
});

test('a failure offers a retry and the clipboard fallback, not a raw error string', async (t) => {
  const page = lesson(t, {
    reply: (n) =>
      n === 1
        ? Promise.reject(new Error('Failed to fetch'))
        : Promise.resolve({ ok: true, body: { getReader: () => readerFor(chunksFor(ANSWER)) } }),
  });

  await ask(page);

  assert.equal(
    page.text('.tutor-recover-say'),
    drawerSays('tutor.fail.connect'),
    'the learner is told what happened, in words',
  );
  assert.match(page.text('.tutor-recover'), /Failed to fetch/, 'and the detail is kept, just not alone');

  page.click(page.query('.tutor-copyprompt'));
  await settle();
  assert.ok(
    page.clipboard.text.includes(drawerSays('tutor.copy.question', { text: '这段什么意思？' })),
    'the fallback still works with the service down',
  );

  page.click(page.query('.tutor-retry'));
  await settle();

  assert.equal(page.queryAll('.tutor-msg.user').length, 1, 'the learner asked once, so the thread says so once');
  assert.equal(page.queryAll('.tutor-recover').length, 0, 'the failed attempt is gone');
  assert.ok(page.query('.tutor-msg.tutor .tutor-msg-body').querySelector('pre code'), 'and the answer arrived');
  assert.deepEqual(page.asked.map((a) => a.question), ['这段什么意思？', '这段什么意思？']);
});

test('a failure the service names is read out of the table, and one the agent names is not', async (t) => {
  // Two different kinds of why, told apart by who said it. A failure the
  // *service* reports arrives as a code, because the service holds no
  // Learner-facing string — the words come from the table, like every other
  // thing on this page. A failure the *agent* reported arrives as its own text,
  // which is evidence about that run rather than a string anybody chose.
  const failing = (data) => () =>
    Promise.resolve({ ok: true, body: { getReader: () => readerFor([event('error', data)]) } });

  const named = lesson(t, { reply: failing({ code: 'timeout', durationMs: 120_000 }) });
  await ask(named);

  assert.equal(named.text('.tutor-recover-say'), drawerSays('tutor.fail.answer'));
  assert.equal(
    named.text('.tutor-recover-why'),
    drawerSays('tutor.fail.timeout'),
    'a code the service sent should have been looked up',
  );

  const reported = lesson(t, { reply: failing({ message: 'rate limited', durationMs: 12 }) });
  await ask(reported);
  assert.equal(reported.text('.tutor-recover-why'), 'rate limited', 'what the agent said is shown as it said it');

  // A code nothing has an entry for leaves the headline and no detail, which is
  // what a failure with nothing to say about itself already looks like.
  const unknown = lesson(t, { reply: failing({ code: 'something-later', durationMs: 12 }) });
  await ask(unknown);
  assert.equal(unknown.text('.tutor-recover-say'), drawerSays('tutor.fail.answer'));
  assert.equal(unknown.queryAll('.tutor-recover-why').length, 0);

  for (const page of [named, reported, unknown]) {
    assert.ok(page.query('.tutor-retry'), 'every failure still offers the two ways onward');
    assert.ok(page.query('.tutor-copyprompt'));
  }
});

test('an answer can be copied and regenerated, alongside pinning it', async (t) => {
  const SECOND = '换个说法：`fork()` 把当前进程复制了一份。';
  const page = lesson(t, {
    reply: (n) =>
      Promise.resolve({ ok: true, body: { getReader: () => readerFor(chunksFor(n === 1 ? ANSWER : SECOND)) } }),
  });

  await ask(page);

  page.click(page.query('.tutor-copy'));
  await settle();
  assert.equal(page.clipboard.text, ANSWER, 'copied as the Tutor wrote it, not as the page rendered it');

  page.click(page.query('.tutor-regen'));
  await settle();

  assert.equal(page.queryAll('.tutor-msg.tutor').length, 1, 'the answer was replaced, not added to');
  assert.match(page.text('.tutor-msg.tutor .tutor-msg-body'), /换个说法/);
  assert.equal(page.asked.length, 2);
  assert.deepEqual(page.asked[1].history, [], 'the rejected answer is not replayed back at the Tutor');

  const stored = JSON.parse(page.store.getItem('tutor-threads::0003-fork-exec.html'));
  assert.deepEqual(
    stored.threads[0].turns.map((turn) => turn.role),
    ['user', 'assistant'],
    'and the thread holds one pair, not two',
  );
  assert.match(stored.threads[0].turns[1].content, /换个说法/);
});

test('a poll does not stomp what the composer is telling the Learner', async (t) => {
  // Once it is polling, the offline state is re-entered every few seconds. A
  // header rebuilt each time would take the confirmation away mid-read.
  const page = lesson(t, { health: () => false });
  await settle();

  page.click(page.query('.tutor-fab'));
  page.type(page.query('.tutor-input'), '这段什么意思？');
  page.click(page.query('.tutor-send'));
  await settle();

  assert.ok(
    page.clipboard.text.includes(drawerSays('tutor.copy.question', { text: '这段什么意思？' })),
    'the fallback is what send does while offline',
  );
  assert.equal(page.text('.tutor-send'), drawerSays('tutor.act.copied'));

  page.tick(); // four seconds on, still nothing there
  await settle();
  assert.equal(
    page.text('.tutor-send'),
    drawerSays('tutor.act.copied'),
    'and the confirmation is still the Learner’s to read',
  );
});

test('asking again while the service is down costs the Learner nothing', async (t) => {
  // Both buttons replace something. A service that stopped between the answer
  // and the click must not take the thing being replaced with it — the failure
  // box holds the clipboard fallback, and the answer is the answer.
  let up = true;
  const page = lesson(t, {
    health: () => up,
    reply: (n) =>
      n === 1
        ? Promise.resolve({ ok: true, body: { getReader: () => readerFor(chunksFor(ANSWER)) } })
        : Promise.reject(new Error('service is not running')),
  });

  await ask(page);
  const before = page.store.getItem('tutor-threads::0003-fork-exec.html');

  // The service goes away, and the second question is the one that finds out.
  up = false;
  page.type(page.query('.tutor-input'), '再说一遍？');
  page.click(page.query('.tutor-send'));
  await settle();

  assert.equal(
    page.text('.tutor-status'),
    drawerSays('tutor.status.offline'),
    'the failure re-probed, and the probe found nothing',
  );
  assert.ok(page.query('.tutor-retry'), 'the failure still offers both ways onward');

  page.click(page.query('.tutor-retry'));
  await settle();
  assert.ok(page.query('.tutor-retry'), 'a retry that cannot run leaves the offer standing');
  assert.ok(page.query('.tutor-copyprompt'), 'and the fallback with it');
  assert.equal(page.text('.tutor-retry'), drawerSays('tutor.act.offline'), 'saying why nothing happened');

  page.click(page.query('.tutor-regen'));
  await settle();
  assert.match(page.text('.tutor-msg.tutor .tutor-msg-body'), /pid_t pid = fork\(\);/, 'the answer is still there');
  assert.equal(page.store.getItem('tutor-threads::0003-fork-exec.html'), before, 'and so is the thread it came from');
});

test('a Lesson opened from disk says so, rather than sending the Learner after a command', async (t) => {
  // The state the originating report was stuck in. The Learner was told to run
  // the start command, ran it, and nothing changed — because a page the service
  // did not serve can never reach it, whatever is running. So this is a third
  // state rather than the offline one again: it names the cause, and it offers
  // nothing to type.
  const page = lesson(t, { protocol: 'file:' });
  await settle();

  assert.notEqual(
    drawerSays('tutor.status.ondisk'),
    drawerSays('tutor.status.offline'),
    'a third state that read as the second one would be no third state',
  );
  assert.equal(page.text('.tutor-status'), drawerSays('tutor.status.ondisk'));
  assert.equal(page.text('.tutor-hint'), drawerSays('tutor.ondisk.hint'), 'and it says which of the two this is');
  assert.equal(page.query('.tutor-hint code'), null, 'with no command, because no command reaches this page');

  // Distinct to read and distinct to glance at. A service that is down is
  // something the Learner can go and start, and this is not, so the chip stops
  // short of the warning the offline one carries.
  assert.equal(page.query('.tutor-status').className, 'tutor-status unknown');
  assert.match(
    read(path.join(ASSETS, 'tutor.css')),
    /\.tutor-status\.unknown\s*\{/,
    'a chip in a class nothing styles would look like whatever it last was',
  );

  assert.equal(page.text('.tutor-send'), drawerSays('tutor.send.copy'), 'the composer still degrades to the clipboard');
  assert.deepEqual(page.probes, [], 'a request the browser would block is a request not worth making');
  assert.equal(page.timers.live.size, 0, 'and nothing is left polling for a service that cannot arrive');
});

test('the widget finds a service started after the Lesson was opened, without a reload', async (t) => {
  let up = false;
  const page = lesson(t, { health: () => up });
  await settle();

  assert.equal(page.text('.tutor-status'), drawerSays('tutor.status.offline'));
  assert.equal(page.text('.tutor-send'), drawerSays('tutor.send.copy'), 'and the composer degrades to the clipboard');
  // The whole of what it says, so nothing has crept in beside it — telling the
  // Learner to reload was what stood here before the poll existed.
  assert.equal(
    page.text('.tutor-hint'),
    drawerSays('tutor.offline.hint', { command: 'node tutor/server.js' }),
    'it says how to start the service, and nothing else',
  );

  up = true;
  page.tick(); // the poll the drawer set going when it found nothing there
  await settle();

  assert.equal(page.text('.tutor-status'), drawerSays('tutor.status.online'));
  assert.equal(page.text('.tutor-send'), drawerSays('tutor.send'));
  assert.equal(page.text('.tutor-hint'), '', 'the instructions for starting it are gone');
  assert.equal(page.timers.live.size, 0, 'and it stops asking');
});

/* ------------------------------------------------------------- grading */

// The other role the drawer carries. Everything around the answer is the same
// code, which is the point — so what is driven here is the part that is not:
// the request goes out as a grading, the thread stays a grading, and a service
// that is not running degrades the same way it does for a question.

const VERDICT = [
  '**过了。**',
  '',
  '- 你说清楚了每一段的 `stdin` 是上一段的 `stdout`',
  '- 中间那段为什么不落成文件,也答到了',
  '',
  '下次试试三段以上的管道。',
].join('\n');

test('a Submission handed in from the page is graded in the same page', async (t) => {
  const page = assignment(t, { chunks: chunksFor(VERDICT) });

  const body = await hand(page, '第二段读的是第一段的 stdout。');

  assert.equal(page.asked.length, 1, 'pressing the button is what asks');
  const request = page.asked[0];
  assert.equal(request.role, 'grader', 'a Submission is judged by the Grader, never by the Tutor');
  assert.equal(request.lesson, UNIT.assignment, 'and against the Rubric stored on the page it came from');
  assert.equal(request.question, '第二段读的是第一段的 stdout。');
  assert.deepEqual(request.history, [], 'a hand-in opens a line of questioning rather than joining one');

  assert.ok(page.query('.tutor-drawer').classList.contains('open'), 'the verdict arrives where the learner is');
  assert.ok(body.querySelector('strong'), 'and as the rich text it was written as');
  assert.match(body.textContent, /过了/);

  // Labelled as the role that gave it, in the message and in the header: "助教"
  // over a verdict would be the one thing this design exists to rule out, said
  // in the page — and the drawer is the same drawer, so the header is the only
  // thing saying who the composer underneath it now reaches.
  assert.equal(page.text('.tutor-msg.tutor .tutor-msg-role'), drawerSays('tutor.role.grader.reply'));
  assert.ok(page.text('.tutor-title').includes(drawerSays('tutor.role.grader.title')));
  assert.equal(
    page.text('.tutor-suggest'),
    drawerSays('tutor.role.grader.ask.1'),
    'and what to ask next suits a verdict',
  );
  assert.ok(page.query('.assignment').classList.contains('is-sent'));
});

test('a verdict can be questioned, and the follow-up reaches the Grader that gave it', async (t) => {
  const page = assignment(t, {
    reply: (n) =>
      Promise.resolve({
        ok: true,
        body: { getReader: () => readerFor(chunksFor(n === 1 ? VERDICT : '因为你没提中间那一段。')) },
      }),
  });

  await hand(page);

  page.type(page.query('.tutor-input'), '中间那一段为什么算没答？');
  page.click(page.query('.tutor-send'));
  await settle();

  assert.equal(page.asked.length, 2);
  const followUp = page.asked[1];
  assert.equal(followUp.role, 'grader', 'a question about a verdict goes to whoever gave the verdict');
  assert.equal(followUp.lesson, UNIT.assignment);
  assert.equal(followUp.threadId, page.asked[0].threadId, 'and stays in the thread the Submission opened');
  assert.deepEqual(
    followUp.history.map((turn) => turn.role),
    ['user', 'assistant'],
    'with the Submission and the verdict replayed, because that is what it is about',
  );

  const answers = page.queryAll('.tutor-msg.tutor .tutor-msg-body');
  assert.equal(answers.length, 2, 'the verdict stays, and the answer about it lands under it');
  assert.match(answers[1].textContent, /中间那一段/);
});

test('where a verdict was recorded is said in the page that asked for it', async (t) => {
  const recorded = 'learning-records/0004-0003-pipe-audit.md';
  const page = assignment(t, {
    chunks: [event('done', { answer: VERDICT, durationMs: 9, record: recorded })],
  });

  await hand(page);

  assert.match(page.text('.tutor-recorded'), new RegExp(recorded.replace(/[/.]/g, '\\$&')));

  // A lesson question is not a record, so nothing claims one was written.
  const asking = lesson(t);
  await ask(asking);
  assert.equal(asking.queryAll('.tutor-recorded').length, 0);
});

test('with the service stopped, handing in degrades to the same clipboard fallback', async (t) => {
  const page = assignment(t, { health: () => false });

  await hand(page, '第二段读的是第一段的 stdout。');

  assert.equal(page.asked.length, 0, 'there is nothing running to ask');

  const prompt = page.clipboard.text;
  assert.match(prompt, /第二段读的是第一段的 stdout。/, 'the Submission is in the prompt');
  assert.match(prompt, new RegExp(UNIT.assignment), 'and so is the page whose Rubric judges it');
  assert.match(prompt, /\.claude\/agents\/grader\.md/, 'and it is put to the Grader, by name');

  // The one thing this prompt must not do. It is pasted into whichever session
  // the learner has open, and the likeliest one is the Teacher that wrote the
  // Assignment — so an "or just answer as a grader yourself" alternative is how
  // the rule the whole arrangement exists for gets broken by the fallback.
  assert.ok(
    prompt.includes(drawerSays('tutor.role.grader.brief')),
    'the prompt refuses the session it lands in',
  );
  assert.ok(
    !prompt.includes(drawerSays('tutor.role.tutor.brief')),
    'the fallback asks a Grader for a verdict, never whoever happens to be reading',
  );

  // The page must not claim the work was judged when it was copied instead.
  assert.match(page.text('.assignment-say'), /复制/);
  assert.doesNotMatch(page.text('.assignment-say'), /判定会出现/);

  // And the Submission is not lost: it is the first turn of a thread that is
  // still there when the service comes up.
  assert.match(page.text('.tutor-msg.user'), /第二段读的是第一段的 stdout。/);
});

test('a Grader that could not judge reads as prose, not as the token the service watches for', async (t) => {
  // The refusal the Grader is told to write opens with a line meant for the
  // service: it is what keeps a refusal out of `learning-records/`. Read out of
  // the role definition that mandates it rather than written here — there is
  // one authority on what that line is, and a copy in this file would be a
  // second one that could disagree with it in silence.
  //
  // The Learner is owed the sentence under it and nothing else. This is the one
  // place the drawer interprets an answer rather than rendering it, so it is
  // held to being exactly that narrow: one known token off the front, the rest
  // untouched.
  const explanation = '这份作业页里没有存评分标准,请回去找出题的老师补上。';
  const refusal = `${refusalToken()}\n${explanation}`;

  const page = assignment(t, { chunks: chunksFor(refusal) });
  const body = await hand(page);

  assert.equal(body.textContent.trim(), explanation, 'the marker reached the Learner, or the prose did not');
  assert.ok(!page.text('.tutor-msg.tutor').includes(refusalToken()), 'and it is nowhere else in the message');
  assert.equal(page.queryAll('.tutor-recorded').length, 0, 'a refusal is not a record, so nothing says one was written');

  // The role definition quotes the token as an indented block, so a Grader told
  // to reproduce it character for character sends the indentation too. The
  // service still calls that a refusal — it reads the answer trimmed — so a
  // drawer that did not would leave the Learner reading the marker.
  const indented = assignment(t, { chunks: chunksFor(`    ${refusalToken()}\n${explanation}`) });
  const alsoProse = await hand(indented);
  assert.equal(alsoProse.textContent.trim(), explanation, 'an indented token reached the Learner');

  // Guard the observer: an answer that merely mentions the token mid-sentence
  // is prose, and stripping there would eat a Learner's words.
  const mentions = assignment(t, { chunks: chunksFor(`Passed. ${refusalToken()} is what a refusal opens with.`) });
  const kept = await hand(mentions);
  assert.ok(kept.textContent.includes(refusalToken()), 'only the opening is a marker; the same text inside prose is prose');
});

test('a lesson question is still the Tutor\'s, and still names the Lesson it came from', async (t) => {
  const page = lesson(t);
  await ask(page);

  assert.equal(page.asked[0].role, 'tutor');
  assert.equal(page.asked[0].lesson, UNIT.lesson, 'the path is derived from the page, not assumed');
  assert.ok(page.text('.tutor-title').includes(drawerSays('tutor.role.tutor.title')), 'and the drawer says so');
});
