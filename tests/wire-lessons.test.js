'use strict';

// The skill tells the Teacher never to wire page infrastructure by hand, and
// to run this script after writing a Lesson. Two properties make that advice
// safe to follow blind: the tag lands exactly once, and running the script
// again is free.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { Workspace, REPO_ROOT } = require('./helpers/workspace.js');

const BOOT = /<script src="\.\.\/assets\/lesson-boot\.js"([^>]*)><\/script>/g;

/** Every bootstrap tag on a page, as the attributes trailing the src. */
function bootTags(html) {
  return [...html.matchAll(BOOT)].map((m) => m[1].trim());
}

/** A page wired the old way: nav and tutor pulled in tag by tag. */
const oldStyle = (unit) => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>Lesson</title>
<link rel="stylesheet" href="../assets/nav.css">
<link rel="stylesheet" href="../assets/tutor.css">
</head>
<body>
<h1>fork() and exec()</h1>
<script src="../assets/units.js"></script>
<script src="../assets/nav.js" data-unit="${unit}"></script>
<script src="../assets/tutor.js"></script>
</body>
</html>
`;

test('a page gets exactly one bootstrap tag', (t) => {
  const ws = Workspace.create(t);
  ws.write('lessons/0003-fork-exec.html', oldStyle('0003'));

  const run = ws.wire();
  const html = ws.read('lessons/0003-fork-exec.html');

  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(bootTags(html), ['data-unit="0003"']);
});

test('the old hand-wired tags are removed, and the page is otherwise intact', (t) => {
  const ws = Workspace.create(t);
  ws.write('lessons/0003-fork-exec.html', oldStyle('0003'));

  ws.wire();
  const html = ws.read('lessons/0003-fork-exec.html');

  for (const stale of ['assets/nav.css', 'assets/tutor.css', 'assets/units.js', 'assets/nav.js', 'assets/tutor.js']) {
    assert.ok(!html.includes(stale), `${stale} should no longer be wired by hand`);
  }
  assert.ok(html.includes('<h1>fork() and exec()</h1>'), 'the teaching content should survive');
  assert.ok(html.includes('</body>'), 'the document should still be closed');
  assert.ok(html.indexOf('lesson-boot.js') < html.indexOf('</body>'), 'the tag belongs in <body>');
});

test('running the wiring script a second time changes nothing', (t) => {
  const ws = Workspace.create(t);
  ws.write('lessons/0003-fork-exec.html', oldStyle('0003'));
  ws.wire();

  const before = ws.snapshot();
  const second = ws.wire();

  assert.deepEqual(ws.snapshot(), before, 'the second run modified the workspace');
  assert.match(second.stdout, /1 already fine/);
  assert.match(second.stdout, /^0 wired/m);
});

test('a page with no unit declared takes its unit from its filename', (t) => {
  const ws = Workspace.create(t);
  ws.write('lessons/0007-signals.html', '<html><body><h1>Signals</h1></body></html>');

  ws.wire();

  assert.deepEqual(bootTags(ws.read('lessons/0007-signals.html')), ['data-unit="0007"']);
});

test('a page belonging to no unit is wired without one', (t) => {
  const ws = Workspace.create(t);
  ws.write('lessons/primer.html', '<html><body><h1>Primer</h1></body></html>');

  ws.wire();

  assert.deepEqual(bootTags(ws.read('lessons/primer.html')), ['']);
});

test('assignment pages are wired too', (t) => {
  const ws = Workspace.create(t);
  ws.write('assignments/0002-audit.html', '<html><body><h1>Audit</h1></body></html>');

  ws.wire();

  assert.deepEqual(bootTags(ws.read('assignments/0002-audit.html')), ['data-unit="0002"']);
});

test('a checkpoint is wired to the unit it belongs to', (t) => {
  const ws = Workspace.create(t);
  ws.write('lessons/0004b-checkpoint.html', '<html><body><h1>Checkpoint</h1></body></html>');

  ws.wire();

  assert.deepEqual(bootTags(ws.read('lessons/0004b-checkpoint.html')), ['data-unit="0004"']);
});

test('a page with no closing body tag still gets wired', (t) => {
  const ws = Workspace.create(t);
  ws.write('lessons/0005-fragment.html', '<h1>Fragment</h1>\n');

  ws.wire();
  const html = ws.read('lessons/0005-fragment.html');

  assert.deepEqual(bootTags(html), ['data-unit="0005"']);
  assert.ok(html.includes('<h1>Fragment</h1>'), 'the content should survive');
});

test('files outside lessons/ and assignments/ are left alone', (t) => {
  const ws = Workspace.create(t);
  ws.write('index.html', '<html><body><h1>Dossier</h1></body></html>');
  ws.write('reference/cheatsheet.html', '<html><body><h1>Cheat sheet</h1></body></html>');
  const before = ws.snapshot();

  ws.wire();

  assert.deepEqual(ws.snapshot(), before, 'the dossier and reference sheets are not lessons');
});

test('wiring a workspace with no pages is a no-op, not an error', (t) => {
  const ws = Workspace.create(t);
  ws.scaffold();
  const before = ws.snapshot();

  const run = ws.wire();

  // Also the suite's canary for the one thing the script needs from the host:
  // wire-lessons.sh does its editing in python3.
  assert.equal(run.status, 0, `wire-lessons.sh failed — it needs python3:\n${run.stderr}`);
  assert.deepEqual(ws.snapshot(), before);
});

// The Teacher runs this after writing a Lesson and then hands an address over.
// The in-page Tutor only connects on a page the Tutor service served, so the
// address is printed rather than described: one that is copied carries the port
// the control script would serve it on, and one assembled by hand is where that
// port gets lost.

/** The served addresses in a run's output, in the order it printed them. */
function addresses(stdout) {
  return [...stdout.matchAll(/^\s*(http:\/\/\S+)\s*$/gm)].map((m) => m[1]);
}

/**
 * The port the control script serves on when nobody says otherwise, read out of
 * it rather than written here. The two scripts' defaults disagreeing is an
 * address a Teacher hands over that opens nothing — the same defect as the
 * hard-coded port the Dossier's status probe was fixed for — so this is the
 * check that would see it, and a literal here would be this suite keeping its
 * own copy of a fact `tutorctl.sh` owns.
 */
function defaultPort() {
  const control = fs.readFileSync(
    path.join(REPO_ROOT, 'skills/explorable-teach/runtime/tutor/tutorctl.sh'),
    'utf8',
  );
  const found = control.match(/^PORT=\$\{PORT:-(\d+)\}/m);

  assert.ok(found, 'the control script no longer states a default port, so there is nothing to agree with');
  return found[1];
}

/** Where a Lesson is served, as the wiring script should print it. */
const servedAt = (page, port = defaultPort()) => `http://127.0.0.1:${port}/${page}`;

test('the served address of each Lesson is printed, with the precondition', (t) => {
  const ws = Workspace.create(t);
  ws.write('lessons/0001-intro.html', '<html><body><h1>Intro</h1></body></html>');
  ws.write('lessons/0002-loops.html', '<html><body><h1>Loops</h1></body></html>');
  ws.write('assignments/0002-audit.html', '<html><body><h1>Audit</h1></body></html>');

  const run = ws.wire();

  assert.deepEqual(addresses(run.stdout), [
    servedAt('lessons/0001-intro.html'),
    servedAt('lessons/0002-loops.html'),
  ], 'a Lesson is what gets handed over; an Assignment page is reached from one');

  // The precondition travels with the addresses, because an address that only
  // works once something has been started is not self-explanatory.
  assert.match(run.stdout, /tutorctl\.sh start/, 'the addresses arrive without the step that makes them work');
});

test('the addresses are printed even when the run wired nothing', (t) => {
  // Nothing here starts the Tutor service, so this is also the "service down"
  // case: the script asks nothing about it, and a run that found every page
  // already fine is exactly when the Teacher is handing an address over.
  const ws = Workspace.create(t);
  ws.write('lessons/0001-intro.html', '<html><body><h1>Intro</h1></body></html>');
  ws.wire();

  const second = ws.wire();

  assert.match(second.stdout, /^0 wired/m);
  assert.deepEqual(addresses(second.stdout), [servedAt('lessons/0001-intro.html')]);
});

test('the printed addresses follow an overridden port', (t) => {
  // The hard-coded port is the defect the Dossier's status probe was fixed for;
  // an address printed on the default port after `PORT=5000 ./tutor/tutorctl.sh
  // start` is the same wrong answer in a different place.
  const ws = Workspace.create(t);
  ws.write('lessons/0001-intro.html', '<html><body><h1>Intro</h1></body></html>');

  const before = process.env.PORT;
  t.after(() => {
    if (before === undefined) delete process.env.PORT;
    else process.env.PORT = before;
  });
  process.env.PORT = '5000';

  assert.deepEqual(addresses(ws.wire().stdout), [servedAt('lessons/0001-intro.html', '5000')]);
});

test('a workspace with no Lesson prints no address block', (t) => {
  const ws = Workspace.create(t);
  ws.write('assignments/0002-audit.html', '<html><body><h1>Audit</h1></body></html>');

  const run = ws.wire();

  assert.deepEqual(addresses(run.stdout), []);
  assert.ok(!/tutorctl/.test(run.stdout), 'there is nothing to hand over, so there is nothing to precondition');
});
