'use strict';

// The fixture Workspace is what every other suite here stands on, so it is
// worth its own guard. In particular: a snapshot() that quietly saw nothing
// would make every idempotence assertion in this suite pass for free.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const { Workspace } = require('./helpers/workspace.js');

test('create gives each test its own directory', (t) => {
  const a = Workspace.create(t);
  const b = Workspace.create(t);

  assert.notEqual(a.dir, b.dir);
  assert.ok(fs.existsSync(a.dir), 'workspace directory should exist');
});

test('the directory is removed when the test that made it finishes', async (t) => {
  let dir;
  await t.test('inner', (inner) => {
    dir = Workspace.create(inner).dir;
    assert.ok(fs.existsSync(dir));
  });
  assert.ok(!fs.existsSync(dir), 'workspace should be cleaned up');
});

test('write creates intermediate directories; read and exists see the result', (t) => {
  const ws = Workspace.create(t);

  assert.equal(ws.exists('lessons/0001-intro.html'), false);
  ws.write('lessons/0001-intro.html', '<h1>hi</h1>');

  assert.equal(ws.exists('lessons/0001-intro.html'), true);
  assert.equal(ws.read('lessons/0001-intro.html'), '<h1>hi</h1>');
});

test('snapshot notices a changed file', (t) => {
  const ws = Workspace.create(t);
  ws.write('NOTES.md', 'before');

  const before = ws.snapshot();
  ws.write('NOTES.md', 'after');

  assert.notDeepEqual(ws.snapshot(), before);
});

test('snapshot notices an added file, an added directory, and a removal', (t) => {
  const ws = Workspace.create(t);
  ws.write('NOTES.md', 'stable');
  const before = ws.snapshot();

  ws.write('lessons/0001-intro.html', '<h1>hi</h1>');
  assert.notDeepEqual(ws.snapshot(), before, 'added file should show up');

  fs.rmSync(ws.path('lessons'), { recursive: true });
  assert.deepEqual(ws.snapshot(), before, 'removing it again should restore the snapshot');

  fs.mkdirSync(ws.path('assignments'));
  assert.notDeepEqual(ws.snapshot(), before, 'an empty directory is still a change');
});

test('snapshot notices a mode change', (t) => {
  const ws = Workspace.create(t);
  ws.write('tutorctl.sh', '#!/bin/sh\n');
  const before = ws.snapshot();

  fs.chmodSync(ws.path('tutorctl.sh'), 0o755);

  assert.notDeepEqual(ws.snapshot(), before);
});

test('snapshot ignores mtime, so re-writing identical content is not a change', (t) => {
  const ws = Workspace.create(t);
  ws.write('NOTES.md', 'same');
  const before = ws.snapshot();

  fs.utimesSync(ws.path('NOTES.md'), new Date(0), new Date(0));
  ws.write('NOTES.md', 'same');

  assert.deepEqual(ws.snapshot(), before);
});

test('run executes a repo script in the workspace and reports its output', (t) => {
  const ws = Workspace.create(t);

  const result = ws.run('scripts/init-workspace.sh');

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Scaffolding teaching workspace/);
});

test('run reports a non-zero exit rather than throwing', (t) => {
  const ws = Workspace.create(t);
  ws.write('fail.sh', '#!/bin/sh\necho "nope" >&2\nexit 3\n');
  fs.chmodSync(ws.path('fail.sh'), 0o755);

  const result = ws.run(ws.path('fail.sh'));

  assert.equal(result.status, 3);
  assert.match(result.stderr, /nope/);
});
