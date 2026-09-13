'use strict';

// The defect this closes, in the words of the ticket: "that Workspace opens
// with a dead stylesheet link, because the Lesson template references shared
// styles the scaffold never installs."
//
// So the rule here is a promise about promises: **naming an `assets/…` path in
// a shipped document or template is a promise that the scaffold installs it.**
// The selection guide in `UNIT.md` now writes a path only for a Component the
// plugin ships, and names every other one by the teaching act it performs — so
// what reaches this check is exactly what the guide promised.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { Workspace, REPO_ROOT } = require('./helpers/workspace.js');
const { agentDocs, SKILL_DIR } = require('./helpers/docs.js');
const { ALL_COMPONENTS, SHARED_STYLES, PAGES, LESSON_HTML, assetRefs } = require('./helpers/unit.js');

// The two halves of the split this plugin is built on. `runtime/` holds what
// does not vary by subject, which a Workspace links at rather than copies;
// `templates/` holds what does, which it copies once and then owns.
const RUNTIME = path.join(SKILL_DIR, 'runtime', 'assets');
const TEMPLATES = path.join(SKILL_DIR, 'templates');

const read = (abs) => fs.readFileSync(abs, 'utf8');

/** Where the plugin keeps its copy of `assets/x`, whichever half owns it. */
function pluginSource(rel) {
  const name = path.basename(rel);
  for (const dir of [RUNTIME, path.join(TEMPLATES, 'assets')]) {
    if (fs.existsSync(path.join(dir, name))) return path.join(dir, name);
  }
  return null;
}

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
  const shipped = [
    ...fs.readdirSync(RUNTIME).sort().map((name) => ({ dir: RUNTIME, from: `runtime/assets/${name}`, name })),
    ...fs
      .readdirSync(path.join(TEMPLATES, 'assets'))
      .sort()
      .map((name) => ({ dir: path.join(TEMPLATES, 'assets'), from: `templates/assets/${name}`, name })),
  ].map(({ dir, from, name }) => ({ from, text: read(path.join(dir, name)) }));

  return [
    ...skillDocs(),
    { from: 'templates/index.html', text: read(path.join(TEMPLATES, 'index.html')) },
    ...PAGES.map((page) => ({ from: page.name, text: page.html })),
    ...shipped,
  ];
}

/** One scaffolded Workspace, shared by the checks that only read it. */
function scaffolded(t) {
  const ws = Workspace.create(t);
  const run = ws.scaffold();
  assert.equal(run.status, 0, run.stderr);
  ws.report = run.stdout;
  return ws;
}

/**
 * What the scaffold said it put under `assets/`, split the way it split it.
 *
 * Read out of the script's own report rather than typed here. `docs/agents/tests.md`
 * bans restating the list the script owns, and this is the same list — naming
 * `lesson-boot.js` and `nav.js` in a test would be a second copy of it, going
 * stale the day a Component is added.
 */
function assetsBy(verb, report) {
  return [...report.matchAll(new RegExp(String.raw`^\s{2}${verb}\s+(assets/\S+)`, 'gm'))].map((m) => m[1]);
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

  for (const component of ALL_COMPONENTS) {
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
  for (const [, name] of read(path.join(RUNTIME, SHARED_STYLES)).matchAll(/^\s*(--[\w-]+):/gm)) {
    definitions.add(name);
  }

  assert.ok(tokens.size >= 10, `expected tokens to check, found ${tokens.size}`);

  const undeclared = [...tokens].filter((name) => !definitions.has(name)).sort();
  assert.deepEqual(undeclared, [], 'these are used as design tokens but nothing defines them');
});

test('every Component declares its dependencies at its head', () => {
  const files = [SHARED_STYLES, ...ALL_COMPONENTS.flatMap((c) => [c.js, c.css])];

  for (const file of files) {
    const head = read(path.join(RUNTIME, file)).split('\n').slice(0, 20).join('\n');
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

  for (const component of ALL_COMPONENTS) {
    for (const file of [component.js, component.css]) {
      const text = read(path.join(RUNTIME, file));
      assert.ok(text.length > 0, `${file} is empty`);

      for (const [pattern, why] of forbidden) {
        assert.ok(!pattern.test(text), `${file} reaches for ${why}`);
      }
    }
  }
});

/**
 * Every selector in `css` that takes something off the page.
 *
 * The last `{` before the declarations, not the first: a rule inside an at-rule
 * — `@media print { .x.is-live .y { display: none } }` — has two, and reading
 * the first one reports the at-rule as the selector and never sees the rule
 * that actually hides. That is the wrong answer in the safe direction, which is
 * why it went unnoticed until a Component had a print rule at all.
 */
function hidingSelectors(css) {
  const found = [];
  for (const block of css.split('}')) {
    const brace = block.lastIndexOf('{');
    if (brace < 0) continue;

    const body = block.slice(brace + 1);
    if (!/display:\s*none|visibility:\s*hidden/.test(body)) continue;

    found.push(
      block
        .slice(0, brace)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^[\s\S]*\{/, '') // whatever at-rule this sits inside
        .trim(),
    );
  }
  return found;
}

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

  // Guard the observer, on both sides and inside an at-rule, which is where it
  // was blind: a reader that saw no hiding rule would pass every stylesheet
  // below for free, and one that read the at-rule as the selector would fail
  // every scoped rule written inside one.
  assert.deepEqual(hidingSelectors('.steps-stage { color: red; }'), []);
  assert.deepEqual(hidingSelectors('.predict-answer { display: none; }'), ['.predict-answer']);
  assert.deepEqual(
    hidingSelectors('@media print {\n  .steps.is-live .steps-nav { display: none; }\n}'),
    ['.steps.is-live .steps-nav'],
  );

  for (const css of [read(path.join(RUNTIME, SHARED_STYLES))].concat(
    ALL_COMPONENTS.map((c) => read(path.join(RUNTIME, c.css))),
  )) {
    for (const selector of hidingSelectors(css)) {
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
  // that neither half of the plugin's asset directories owns.
  //
  // This is not the file list the scaffold owns — `docs/agents/tests.md` bans
  // restating that, and nothing here names a file. It is the structural rule
  // the list has to obey, and it checks the direction the scaffold's own report
  // cannot: a file the report never mentioned.
  for (const rel of installed) {
    const source = pluginSource(rel);
    assert.ok(source, `${rel} is installed but the plugin ships no ${path.relative(REPO_ROOT, path.join('…', rel))}`);
  }
});

test('an invariant asset is a link into the plugin, and a subject one is the Workspace\'s own', (t) => {
  const ws = scaffolded(t);

  // The whole point of the split, as a property of the tree. Which files fall
  // on which side is the scaffold's to say, so both lists are read back out of
  // its report rather than named here.
  const linked = assetsBy('link', ws.report);
  const placed = assetsBy('create', ws.report);

  assert.ok(linked.length >= 10, `expected linked assets to check, found ${linked.length}`);
  assert.ok(placed.length >= 1, `expected a copied asset to check, found ${placed.length}`);

  // A file the plugin owns has one home, and a Workspace holds a pointer at it.
  // That is what makes fixing it once fix it everywhere.
  for (const rel of linked) {
    assert.ok(fs.lstatSync(ws.path(rel)).isSymbolicLink(), `${rel} does not vary by subject, so it is not a copy`);
    assert.equal(
      fs.realpathSync(ws.path(rel)),
      fs.realpathSync(path.join(RUNTIME, path.basename(rel))),
      `${rel} should point at the plugin's copy`,
    );
  }

  // And the other side of it. A copied asset is this course's, so editing it
  // must not reach into the plugin and change every other Workspace.
  for (const rel of placed) {
    const source = path.join(TEMPLATES, rel);
    assert.ok(fs.lstatSync(ws.path(rel)).isFile(), `${rel} varies by subject, so it is copied`);

    const before = read(source);
    fs.writeFileSync(ws.path(rel), '/* this course only */\n', 'utf8');
    assert.equal(read(source), before, `editing ${rel} wrote through to the plugin`);
  }
});

test('a Workspace follows the plugin when its link goes stale', (t) => {
  const ws = scaffolded(t);
  const link = ws.path(`assets/${SHARED_STYLES}`);

  // What an upgrade looks like from the Workspace's side: the link still
  // resolves, but to a copy of the plugin that is no longer the current one.
  const stale = ws.write('stale-style.css', '/* an older plugin */\n');
  fs.rmSync(link);
  fs.symlinkSync(stale, link);
  assert.equal(read(link), '/* an older plugin */\n');

  ws.scaffold();

  assert.equal(fs.realpathSync(link), fs.realpathSync(path.join(RUNTIME, SHARED_STYLES)));
});
