'use strict';

// The skill tells the Teacher never to wire page infrastructure by hand, and
// to run this script after writing a Lesson. Two properties make that advice
// safe to follow blind: the tag lands exactly once, and running the script
// again is free.

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { Workspace } = require('./helpers/workspace.js');

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
