'use strict';

// The complaint this guards against: "the documents promise things that do not
// exist." A document that points at a missing file sends the agent reading it
// somewhere there is nothing, and nobody finds out until a lesson is being
// written.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { REPO_ROOT } = require('./helpers/workspace.js');
const { agentDocs, pointersIn, resolvePointer, DOC_ROOTS } = require('./helpers/docs.js');
const { anchorsIn } = require('./helpers/markdown.js');

const docs = agentDocs();
const pointers = docs.flatMap(pointersIn);
const show = (p) => `${path.relative(REPO_ROOT, p.doc)}:${p.line}  ${p.raw}`;

test('the documents an agent reads are all in scope', () => {
  const scanned = docs.map((d) => path.relative(REPO_ROOT, d));

  for (const required of ['AGENTS.md', 'README.md', 'skills/explorable-teach/SKILL.md']) {
    assert.ok(scanned.includes(required), `${required} should be scanned`);
  }
  // Every documented root that exists is represented — so a `commands/` that
  // comes back one day comes back under the check rather than beside it.
  for (const root of DOC_ROOTS) {
    if (!fs.existsSync(path.join(REPO_ROOT, root))) continue;
    assert.ok(scanned.some((d) => d.startsWith(root + path.sep)), `${root}/ should be scanned`);
  }
});

test('pointer extraction actually finds pointers', () => {
  // A regex that matched nothing would make the check below pass for free.
  const skill = docs.find((d) => d.endsWith(`explorable-teach${path.sep}SKILL.md`));
  assert.ok(
    pointersIn(skill).length >= 8,
    'SKILL.md should yield its format specs, the scripts it runs, and more',
  );
  assert.ok(pointers.length >= 30, `expected pointers across the documents, found ${pointers.length}`);
});

test('every relative pointer resolves to a file that exists', () => {
  const broken = pointers.filter((p) => resolvePointer(p) === null);

  assert.deepEqual(
    broken.map(show),
    [],
    'these pointers name something that is not in the repo',
  );
});

test('every anchor resolves to a heading that is actually there', () => {
  // The other half of the same promise. A link at a heading that has been
  // renamed or disclosed into another document still resolves as a *file*, so
  // the check above is happy — and the reader lands at the top of a long
  // document and is left to search it. Sections move often here; headings are
  // exactly what a restructuring removes.
  const anchored = pointers.filter((p) => p.fragment);

  // Guard the observer: extraction that dropped fragments would pass for free.
  assert.ok(anchored.length >= 10, `expected anchored pointers, found ${anchored.length}`);

  const offered = new Map();
  const broken = anchored.filter((p) => {
    const file = resolvePointer(p);
    if (file === null || fs.statSync(file).isDirectory()) return false; // the check above owns this
    if (!offered.has(file)) offered.set(file, anchorsIn(fs.readFileSync(file, 'utf8')));
    return !offered.get(file).has(p.fragment);
  });

  assert.deepEqual(
    broken.map(show),
    [],
    'these pointers name a heading that no longer exists where they send their reader',
  );
});

test('the scripts the documents tell an agent to run are executable', () => {
  const scripts = new Set(
    pointers
      .filter((p) => p.target.startsWith('scripts/') && p.target.endsWith('.sh'))
      .map((p) => p.target),
  );

  assert.ok(scripts.size > 0, 'the documents should name at least one script to run');

  for (const script of scripts) {
    const mode = fs.statSync(path.join(REPO_ROOT, script)).mode;
    assert.ok(mode & 0o111, `${script} is named as a command but is not executable`);
  }
});
