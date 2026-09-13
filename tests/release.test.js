'use strict';

// What this holds, and why the check is shaped the way it is:
// `docs/agents/tests.md`, "The release check".

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { REPO_ROOT } = require('./helpers/workspace.js');
const { headings } = require('./helpers/markdown.js');

const MANIFEST = path.join(REPO_ROOT, '.claude-plugin', 'plugin.json');
const CHANGELOG = path.join(REPO_ROOT, 'CHANGELOG.md');

const changelog = fs.readFileSync(CHANGELOG, 'utf8');
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

/**
 * A released version, as the changelog spells one: a level-two heading whose
 * whole text is a semantic version. `## Unreleased` is deliberately not one —
 * it is where entries wait, and the day it is mistaken for a release is the day
 * this check stops being able to see an unbumped version.
 */
const VERSION_HEADING = /^(\d+)\.(\d+)\.(\d+)$/;

function releases(markdown) {
  const lines = markdown.split('\n');
  const all = headings(markdown);
  const found = [];

  all.forEach(({ level, text, line }, index) => {
    if (level !== 2) return;
    const m = text.match(VERSION_HEADING);
    if (!m) return;

    const next = all.slice(index + 1).find((h) => h.level <= 2);
    found.push({
      version: text,
      parts: [Number(m[1]), Number(m[2]), Number(m[3])],
      line,
      body: lines.slice(line, next ? next.line - 1 : undefined),
    });
  });

  return found;
}

/**
 * The releases this repo has shipped, with the observer guarded.
 *
 * Every assertion below is over a list, and an empty list satisfies all of them
 * — no duplicate versions, no version out of order, no empty release section.
 * So the guard belongs in each test rather than once beside them: a reader that
 * silently stopped recognising a version heading would otherwise leave three of
 * these four tests passing for free, which is the failure `docs/agents/tests.md`
 * names under "Guard the observer".
 */
function shipped() {
  const found = releases(changelog);

  assert.ok(
    found.length > 0,
    'the reader found no version heading in CHANGELOG.md, so this assertion would pass on an empty list',
  );

  return found;
}

/** Compare two `[major, minor, patch]` triples: positive when `a` is newer. */
function compare(a, b) {
  for (let i = 0; i < 3; i += 1) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

test('the check can see a release, and does not read a waiting-room as one', () => {
  const sample = ['# Changelog', '', '## Unreleased', '', '- pending', '', '## 1.2.0', '', '- shipped', ''].join('\n');

  assert.deepEqual(
    releases(sample).map((r) => r.version),
    ['1.2.0'],
    'a version heading must be read as a release, and `Unreleased` must not be',
  );

  // The body is what "a release says what shipped in it" reads, so the reader
  // has to stop at the next heading rather than run to the end of the file.
  assert.deepEqual(releases(sample)[0].body, ['', '- shipped', '']);

  shipped();
});

test('the plugin declares the version the changelog most recently shipped', () => {
  const newest = shipped()[0];

  assert.equal(
    manifest.version,
    newest.version,
    `plugin.json says ${manifest.version} and the changelog's newest release is ${newest.version} — ` +
      'a release the changelog records and the manifest does not is a version nobody can install',
  );
});

test('every release is newer than the one below it, and appears once', () => {
  const found = shipped();

  const duplicates = found
    .map((r) => r.version)
    .filter((v, i, all) => all.indexOf(v) !== i);
  assert.deepEqual(duplicates, [], 'a version heading written twice splits one release across two places');

  for (let i = 1; i < found.length; i += 1) {
    assert.ok(
      compare(found[i - 1].parts, found[i].parts) > 0,
      `${found[i - 1].version} is written above ${found[i].version}, so the changelog does not read newest-first`,
    );
  }
});

test('a release says what shipped in it', () => {
  const empty = shipped().filter((r) => !r.body.some((line) => line.trim()));

  assert.deepEqual(
    empty.map((r) => `${r.version} (line ${r.line})`),
    [],
    'a version heading with nothing under it records that something shipped without recording what',
  );
});
