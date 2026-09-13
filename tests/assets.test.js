'use strict';

// The defect this closes, in the words of the ticket: "that Workspace opens
// with a dead stylesheet link, because the Lesson template references shared
// styles the scaffold never installs."
//
// So the rule here is a promise about promises: **naming an `assets/…` path in
// a shipped document or template is a promise that the scaffold installs it.**
// A Component that exists only in the catalog is written as a bare filename;
// one written as a path has to be real.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { Workspace, REPO_ROOT } = require('./helpers/workspace.js');
const { agentDocs, SKILL_DIR } = require('./helpers/docs.js');
const { COMPONENTS, SHARED_STYLES, LESSON_HTML, assetRefs } = require('./helpers/lesson.js');

const TEMPLATES = path.join(SKILL_DIR, 'templates');

const read = (abs) => fs.readFileSync(abs, 'utf8');

/**
 * Every document of the skill, whichever one currently names an asset. Read as
 * a set rather than by name: disclosure moves this material between documents,
 * and a check naming one of them stops seeing the material the day it moves.
 */
function skillDocs() {
  return agentDocs()
    .filter((doc) => doc.startsWith(SKILL_DIR + path.sep))
    .map((doc) => ({ from: path.relative(SKILL_DIR, doc), text: read(doc) }));
}

/** Everything that tells a Lesson author, or a Lesson, which assets exist. */
function sources() {
  const shipped = fs
    .readdirSync(path.join(TEMPLATES, 'assets'))
    .sort()
    .map((name) => ({ from: `templates/assets/${name}`, text: read(path.join(TEMPLATES, 'assets', name)) }));

  return [
    ...skillDocs(),
    { from: 'templates/index.html', text: read(path.join(TEMPLATES, 'index.html')) },
    { from: 'the fixture Lesson', text: LESSON_HTML },
    ...shipped,
  ];
}

/** One scaffolded Workspace, shared by the checks that only read it. */
function scaffolded(t) {
  const ws = Workspace.create(t);
  const run = ws.scaffold();
  assert.equal(run.status, 0, run.stderr);
  return ws;
}

test('every asset a shipped document or template names is installed by the scaffold', (t) => {
  const ws = scaffolded(t);
  const named = sources().flatMap(({ from, text }) => assetRefs(text).map((ref) => ({ from, ref })));

  // Guard the observer: a regex that found nothing would pass this for free.
  const refs = new Set(named.map((n) => n.ref));
  assert.ok(refs.size >= 12, `expected asset references to check, found ${refs.size}`);
  assert.ok(refs.has(`assets/${SHARED_STYLES}`), 'the shared stylesheet should be among them');
  assert.ok(refs.has('assets/lesson-boot.js'), 'the bootstrap should be among them');

  const dead = named.filter(({ ref }) => !ws.exists(ref)).map(({ from, ref }) => `${from} → ${ref}`);
  assert.deepEqual([...new Set(dead)], [], 'these assets are pointed at but never installed');
});

test('the Lesson template links the shared styles from the page head', () => {
  // Found by the template it carries rather than by name, for the reason
  // skillDocs() exists: which document holds it is a disclosure decision.
  const carrying = skillDocs().filter(({ text }) => text.includes('<!DOCTYPE html>'));
  assert.equal(
    carrying.length,
    1,
    `expected one document to carry the Lesson template, found ${carrying.map((d) => d.from)}`,
  );

  // Styling a Lesson must not depend on a script running: the one stylesheet
  // every page needs belongs in <head>, not in lesson-boot.js.
  assert.match(
    carrying[0].text,
    new RegExp(String.raw`<link rel="stylesheet" href="\.\./assets/${SHARED_STYLES}">`),
    `${carrying[0].from}'s Lesson template should link the shared stylesheet`,
  );
  assert.match(LESSON_HTML, new RegExp(String.raw`<head>[\s\S]*assets/${SHARED_STYLES}[\s\S]*</head>`));
});

test('every Component the plugin ships is installed as a pair', (t) => {
  const ws = scaffolded(t);

  for (const component of COMPONENTS) {
    assert.ok(ws.exists(`assets/${component.js}`), `${component.name}: behaviour is not installed`);
    assert.ok(ws.exists(`assets/${component.css}`), `${component.name}: styling is not installed`);
  }
});

test('every design token a stylesheet uses is defined in the shared styles', () => {
  const tokens = new Set();
  const definitions = new Set();

  for (const { text } of sources()) {
    for (const [, name] of text.matchAll(/var\((--[\w-]+)/g)) tokens.add(name);
  }
  for (const [, name] of read(path.join(TEMPLATES, 'assets', SHARED_STYLES)).matchAll(/^\s*(--[\w-]+):/gm)) {
    definitions.add(name);
  }

  assert.ok(tokens.size >= 10, `expected tokens to check, found ${tokens.size}`);

  const undeclared = [...tokens].filter((name) => !definitions.has(name)).sort();
  assert.deepEqual(undeclared, [], 'these are used as design tokens but nothing defines them');
});

test('every Component declares its dependencies at its head', () => {
  const files = [SHARED_STYLES, ...COMPONENTS.flatMap((c) => [c.js, c.css])];

  for (const file of files) {
    const head = read(path.join(TEMPLATES, 'assets', file)).split('\n').slice(0, 20).join('\n');
    assert.match(head, /^[\s*/]*Deps:/m, `${file}: a reader has to be told what it needs before using it`);
  }
});

test('no Component needs a server or a network to work', () => {
  const forbidden = [
    [/\bfetch\s*\(/, 'fetch — a Lesson opened from file:// has nothing to fetch from'],
    [/XMLHttpRequest/, 'XMLHttpRequest — same reason'],
    [/\bimport\s*[({]/, 'ES module syntax — file:// blocks module scripts'],
    [/https?:\/\//, 'a URL — a Component that needs a CDN stops working on a train'],
  ];

  for (const component of COMPONENTS) {
    for (const file of [component.js, component.css]) {
      const text = read(path.join(TEMPLATES, 'assets', file));
      assert.ok(text.length > 0, `${file} is empty`);

      for (const [pattern, why] of forbidden) {
        assert.ok(!pattern.test(text), `${file} reaches for ${why}`);
      }
    }
  }
});

test('a Component only hides what it has taken over', () => {
  // Progressive enhancement, made checkable. A stylesheet that hides content
  // outright hides it from the learner whose scripting is off too — so every
  // hiding rule has to be scoped to a state only the Component's script sets.
  //
  // The shared stylesheet is in scope too, since a hiding rule added there
  // would reach every Lesson at once. Its one blanket rule, `[hidden]`, is the
  // mechanism the Components hide *with*: an element carries that attribute
  // only because a script put it there, and the authoring document tells
  // authors never to write it by hand.
  for (const css of [read(path.join(TEMPLATES, 'assets', SHARED_STYLES))].concat(
    COMPONENTS.map((c) => read(path.join(TEMPLATES, 'assets', c.css))),
  )) {

    for (const block of css.split('}')) {
      const brace = block.indexOf('{');
      if (brace < 0) continue;

      const selector = block.slice(0, brace).replace(/\/\*[\s\S]*?\*\//g, '').trim();
      const body = block.slice(brace + 1);
      if (!/display:\s*none|visibility:\s*hidden/.test(body)) continue;

      if (selector === '[hidden]') continue;

      assert.match(
        selector,
        /\.is-/,
        `"${selector}" hides content whether or not the Component that owns it ever ran`,
      );
    }
  }
});

test('every asset in a scaffolded Workspace came from the plugin', (t) => {
  const ws = scaffolded(t);
  const installed = Object.keys(ws.snapshot()).filter((rel) => rel.startsWith('assets/') && !rel.endsWith('/'));

  assert.ok(installed.length >= 12, `expected an assets/ directory with content, found ${installed.length}`);

  // The other direction of the same promise: the plugin is the one source of
  // truth for what a Workspace's assets/ holds, so nothing may appear there
  // that `templates/assets/` does not own.
  //
  // This is not the file list the scaffold owns — `docs/agents/tests.md` bans
  // restating that, and nothing here names a file. It is the structural rule
  // the list has to obey, and it checks the direction the scaffold's own report
  // cannot: a file the report never mentioned.
  for (const rel of installed) {
    const source = path.join(TEMPLATES, rel);
    assert.ok(fs.existsSync(source), `${rel} is installed but the plugin has no ${path.relative(REPO_ROOT, source)}`);
  }
});
