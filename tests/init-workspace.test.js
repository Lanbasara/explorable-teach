'use strict';

// The scaffold is documented as "never overwrites, so it is also the repair
// tool for a workspace that lost a file." That promise is what makes it safe
// for `/explorable-teach:init` to be run against a Workspace already holding a
// learner's work. These tests hold it to that.
//
// Note what is deliberately absent: a list of the files the scaffold installs.
// The script owns that list. A test restating it would be one more document
// caching a fact it does not own — so the expectations here are read back out
// of the script's own report instead.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const { Workspace } = require('./helpers/workspace.js');

/** What the script said it did, read back out of its own report. */
function report(stdout) {
  const pick = (verb) =>
    [...stdout.matchAll(new RegExp(String.raw`^\s{2}${verb}\s+(\S+)`, 'gm'))]
      .map((m) => m[1])
      .sort();

  return { created: pick('create'), skipped: pick('skip'), directories: pick('mkdir') };
}

test('scaffolding a bare directory installs files and reports them', (t) => {
  const ws = Workspace.create(t);

  const run = ws.scaffold();
  const { created, directories } = report(run.stdout);

  assert.equal(run.status, 0, run.stderr);
  assert.ok(created.length > 0, 'the scaffold should install something');
  assert.ok(directories.length > 0, 'the scaffold should create the workspace directories');

  for (const rel of created) {
    assert.ok(ws.exists(rel), `reported creating ${rel}, but it is not there`);
  }
  for (const dir of directories) {
    assert.ok(fs.statSync(ws.path(dir)).isDirectory(), `${dir} should be a directory`);
  }

  // The report is this suite's oracle, so it has to be complete: a file written
  // without being announced would be invisible to every test below.
  const files = Object.keys(ws.snapshot()).filter((rel) => !rel.endsWith('/'));
  assert.deepEqual(files.sort(), created, 'the scaffold installed something it did not report');
});

test('running the scaffold twice produces no change', (t) => {
  const ws = Workspace.create(t);
  const first = report(ws.scaffold().stdout);

  const before = ws.snapshot();
  const second = report(ws.scaffold().stdout);

  assert.deepEqual(ws.snapshot(), before, 'the second run modified the workspace');
  assert.deepEqual(second.created, [], 'the second run should create nothing');
  assert.deepEqual(
    second.skipped,
    first.created,
    'the second run should leave alone exactly what the first run installed',
  );
});

test('the scaffold leaves the learner\'s own work untouched', (t) => {
  const ws = Workspace.create(t);
  ws.scaffold();

  // One file the scaffold never writes, and one it does — tuned by hand, the
  // way the skill tells the Teacher to tune it.
  ws.write('MISSION.md', '# Mission: shells\n');
  ws.write('tutor/ROLE.md', 'tuned for this subject\n');
  ws.write('lessons/0001-intro.html', '<h1>hand-written</h1>');

  const before = ws.snapshot();
  ws.scaffold();

  assert.deepEqual(ws.snapshot(), before);
  assert.equal(ws.read('tutor/ROLE.md'), 'tuned for this subject\n');
});

test('the scaffold repairs a workspace that lost a file', (t) => {
  const ws = Workspace.create(t);
  const installed = report(ws.scaffold().stdout).created;
  const complete = ws.snapshot();

  const casualty = installed.find((rel) => rel.includes('tutor/server.js'));
  assert.ok(casualty, 'expected the tutor server among the installed files');
  fs.rmSync(ws.path(casualty));
  assert.notDeepEqual(ws.snapshot(), complete, 'the file should be gone');

  const repair = report(ws.scaffold().stdout);

  assert.deepEqual(repair.created, [casualty], 'only the missing file should be restored');
  assert.deepEqual(ws.snapshot(), complete, 'the workspace should be whole again');
});

test('the tutor control script is installed executable', (t) => {
  const ws = Workspace.create(t);
  ws.scaffold();

  const mode = fs.statSync(ws.path('tutor/tutorctl.sh')).mode;
  assert.ok(mode & 0o111, 'tutorctl.sh is documented as a command the learner runs');
});

test('the scaffold creates the target directory when it does not exist', (t) => {
  const ws = Workspace.create(t);
  const target = ws.path('nested/workspace');

  const run = ws.run('scripts/init-workspace.sh', [target]);

  assert.equal(run.status, 0, run.stderr);
  assert.ok(fs.existsSync(target), 'the target directory should have been created');
});
