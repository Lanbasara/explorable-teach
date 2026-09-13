'use strict';

// The scaffold is documented as "never overwrites, so it is also the repair
// tool for a workspace that lost a file." That promise is what makes it safe
// for the scaffold to be run against a Workspace already holding a
// learner's work. These tests hold it to that.
//
// It installs in two ways, and the difference is the plugin's central split: a
// file that varies by subject is *placed* — copied once and then the learner's
// — and a file that does not is *linked* at the plugin's own copy, re-pointed
// on every run so a Workspace follows the plugin across an upgrade. Both halves
// have to be idempotent, for different reasons.
//
// Note what is deliberately absent: a list of the files the scaffold installs.
// The script owns that list. A test restating it would be one more document
// caching a fact it does not own — so the expectations here are read back out
// of the script's own report instead.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const { Workspace } = require('./helpers/workspace.js');

/** What the script said it did, read back out of its own report. */
function report(stdout) {
  const pick = (verb) =>
    [...stdout.matchAll(new RegExp(String.raw`^\s{2}${verb}\s+(\S+)`, 'gm'))]
      .map((m) => m[1])
      .sort();

  return {
    stdout,
    created: pick('create'),
    skipped: pick('skip'),
    linked: pick('link'),
    kept: pick('keep'),
    directories: pick('mkdir'),
  };
}

test('scaffolding a bare directory installs files and reports them', (t) => {
  const ws = Workspace.create(t);

  const run = ws.scaffold();
  const { created, linked, directories } = report(run.stdout);

  assert.equal(run.status, 0, run.stderr);
  assert.ok(created.length > 0, 'the scaffold should copy in the files a Workspace owns');
  assert.ok(linked.length > 0, 'the scaffold should point the Workspace at the files the plugin owns');
  assert.ok(directories.length > 0, 'the scaffold should create the workspace directories');

  for (const rel of created) {
    assert.ok(fs.lstatSync(ws.path(rel)).isFile(), `reported creating ${rel}, but it is not a file there`);
  }
  for (const rel of linked) {
    const at = ws.path(rel);
    assert.ok(fs.lstatSync(at).isSymbolicLink(), `reported linking ${rel}, but it is not a link`);
    assert.ok(fs.existsSync(at), `${rel} is a link at nothing`);
  }
  for (const dir of directories) {
    assert.ok(fs.statSync(ws.path(dir)).isDirectory(), `${dir} should be a directory`);
  }

  // The report is this suite's oracle, so it has to be complete: a file written
  // without being announced would be invisible to every test below.
  const files = Object.keys(ws.snapshot()).filter((rel) => !rel.endsWith('/'));
  assert.deepEqual(files.sort(), [...created, ...linked].sort(), 'the scaffold installed something it did not report');
  assert.deepEqual(report(run.stdout).kept, [], 'a bare directory has nothing to override');

  // The closing tally is prose rather than a verb line, so the checks above
  // cannot see it — and a shell expansion that reads `0` as "something to
  // mention" is exactly the kind of defect that hides there.
  assert.match(run.stdout, new RegExp(`^${created.length} created, 0 left alone, ${linked.length} pointed at`, 'm'));
  assert.ok(!/overridden here/.test(run.stdout), 'nothing was overridden, so the tally should not mention it');
});

test('running the scaffold twice produces no change', (t) => {
  const ws = Workspace.create(t);
  const first = report(ws.scaffold().stdout);

  const before = ws.snapshot();
  const second = report(ws.scaffold().stdout);

  assert.deepEqual(ws.snapshot(), before, 'the second run modified the workspace');
  assert.deepEqual(second.created, [], 'the second run should copy nothing in again');
  assert.deepEqual(
    second.skipped,
    first.created,
    'the second run should leave alone exactly what the first run copied in',
  );
  // Links are re-pointed every run by design — that is how a Workspace follows
  // the plugin across an upgrade — so re-pointing must be what changes nothing.
  assert.deepEqual(second.linked, first.linked, 'the second run should re-point the same links');
});

test('the scaffold leaves the learner\'s own work untouched', (t) => {
  const ws = Workspace.create(t);
  ws.scaffold();

  // One file the scaffold never writes, and one it does — tuned by hand, the
  // way the skill tells the Teacher to tune it.
  ws.write('MISSION.md', '# Mission: shells\n');
  ws.write('tutor/TUNING.md', 'tuned for this subject\n');
  ws.write('lessons/0001-intro.html', '<h1>hand-written</h1>');

  const before = ws.snapshot();
  ws.scaffold();

  assert.deepEqual(ws.snapshot(), before);
  assert.equal(ws.read('tutor/TUNING.md'), 'tuned for this subject\n');
});

test('the scaffold repairs a workspace that lost a file', (t) => {
  const ws = Workspace.create(t);
  const first = report(ws.scaffold().stdout);
  const complete = ws.snapshot();

  const casualty = first.created.find((rel) => rel.includes('units.js'));
  assert.ok(casualty, 'expected the course manifest among the copied files');
  fs.rmSync(ws.path(casualty));
  assert.notDeepEqual(ws.snapshot(), complete, 'the file should be gone');

  const repair = report(ws.scaffold().stdout);

  assert.deepEqual(repair.created, [casualty], 'only the missing file should be restored');
  assert.deepEqual(ws.snapshot(), complete, 'the workspace should be whole again');
});

test('a lost link is restored rather than left dangling', (t) => {
  const ws = Workspace.create(t);
  const first = report(ws.scaffold().stdout);
  const complete = ws.snapshot();

  const casualty = first.linked.find((rel) => rel.includes('tutor/server.js'));
  assert.ok(casualty, 'expected the tutor server among the linked files');
  fs.rmSync(ws.path(casualty));
  assert.notDeepEqual(ws.snapshot(), complete, 'the link should be gone');

  ws.scaffold();

  assert.deepEqual(ws.snapshot(), complete, 'the workspace should be whole again');
});

test('a real file where a link belongs is treated as a deliberate override', (t) => {
  const ws = Workspace.create(t);
  const linked = report(ws.scaffold().stdout).linked;

  const overridden = linked.find((rel) => rel.includes('style.css'));
  assert.ok(overridden, 'expected the shared stylesheet among the linked files');

  // Replacing a link with a real file is how someone says "not this one". The
  // scaffold re-points links on every run, so without this it would be the
  // thing that deletes their work — the one outcome it must never produce.
  ws.write(overridden, '/* this course only */\n');
  const before = ws.snapshot();

  const second = report(ws.scaffold().stdout);

  assert.deepEqual(ws.snapshot(), before, 'the override was overwritten');
  assert.deepEqual(second.kept, [overridden], 'and the scaffold should say it left it alone');
  assert.ok(!second.linked.includes(overridden), 'a kept file is not also reported as linked');
  assert.match(second.stdout, /, 1 overridden here\./, 'the tally should count it too');
});

test('the tutor control script is reachable as a command the learner runs', (t) => {
  const ws = Workspace.create(t);
  ws.scaffold();

  // Through the link, because that is how the learner invokes it:
  // `./tutor/tutorctl.sh start` from the Workspace root.
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

test('a Workspace has somewhere to put work the page cannot hold', (t) => {
  const ws = Workspace.create(t);
  const { directories, created } = report(ws.scaffold().stdout);

  assert.ok(directories.includes('submissions/'), 'a Submission has nowhere to go');
  assert.ok(directories.includes('assignments/'), 'and an Assignment has nowhere to be written');

  // Placed rather than only mkdir'd. An empty directory is a directory git
  // never records, so the one place a learner is told to put evidence would not
  // exist in the history that evidence is supposed to survive in.
  const placed = created.filter((rel) => rel.startsWith('submissions/'));
  assert.equal(placed.length, 1, `expected the submissions directory to hold something, found ${placed}`);
  assert.match(ws.read(placed[0]), /submissions/, 'and to say what belongs there');
});

test('nothing this plugin ships excludes a Submission from version control', (t) => {
  const ws = Workspace.create(t);
  ws.scaffold();
  ws.write('submissions/0003-pipes/notes.md', '# 我拆的那条管道\n');
  ws.write('submissions/0003-pipes/run.log', 'ls | wc -l\n');

  const git = (...args) => spawnSync('git', ['-C', ws.dir, ...args], { encoding: 'utf8' });

  const available = git('--version');
  assert.equal(available.status, 0, 'git is how this claim is checkable at all');
  assert.equal(git('init', '-q').status, 0);

  // `check-ignore` exits 1 when nothing excludes the path. Asked about each
  // file rather than the directory, because a rule can catch an extension —
  // `*.log` would quietly swallow half of what a Submission is made of.
  const ignored = ['submissions', 'submissions/0003-pipes/notes.md', 'submissions/0003-pipes/run.log'].filter(
    (rel) => git('check-ignore', '-q', '--', rel).status === 0,
  );
  assert.deepEqual(
    ignored,
    [],
    'a Submission is the evidence a verdict was reached on; excluded, nobody can look back at it',
  );

  // Guard the observer: a `check-ignore` that answered "not ignored" to
  // everything — a git too old for these flags, say — would pass the above
  // without checking anything.
  ws.write('.gitignore', 'submissions/\n');
  assert.equal(
    git('check-ignore', '-q', '--', 'submissions/0003-pipes/notes.md').status,
    0,
    'this check cannot see an exclusion even when there is one',
  );
});
