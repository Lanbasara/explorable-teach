'use strict';

// What this holds, and why the checks are shaped the way they are:
// `docs/agents/tests.md`, "The theme check".
//
// The complaint is a measurement. Across six courses built with this plugin,
// not one changed a single design token — every one of them rendered in the
// same cold white, the same blue accent, the same 760px column, whatever it was
// about. `UNIT.md` said re-theming was possible in a sentence nobody acted on,
// which is the shape of a capability that exists and is never reached: it cost
// a Session hours of arithmetic and taste with no teaching in it, so the
// Session reached for the default and moved on.
//
// So the theme is delegated rather than encouraged, and these checks are about
// the three things that make delegation work rather than about taste. That the
// file is *always linked*, so filling it in later is one edit and not an edit
// plus remembering every page. That a role exists to write it and is bounded to
// that one file. And that the one part of it which is arithmetic rather than
// judgement has a checker, because the one Workspace that ever tried measured
// against the wrong surface and shipped a value that still failed.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { Workspace, REPO_ROOT } = require('./helpers/workspace.js');
const { foldedDoc, SKILL_DIR } = require('./helpers/docs.js');

const TEMPLATES = path.join(SKILL_DIR, 'templates');
const CONTRAST = path.join(REPO_ROOT, 'scripts', 'contrast.js');

const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');

/** A `--token: #value` declaration, which is the only thing a theme may write. */
const DECLARES = /^\s*(--[\w-]+)\s*:\s*[^;]+;/gm;

/**
 * The tokens a theme is told it may set. Read off `theme.css`'s own head
 * comment rather than listed here, because a second copy of the token list is
 * a list that goes stale against `style.css` silently and in the direction of
 * looking fine.
 */
function tokensOfferedByTheSeed() {
  const seed = read(TEMPLATES, 'assets', 'theme.css');

  // The indented table, not the whole file, and this narrowing is the check
  // twice caught being wrong about its own subject. Read file-wide, it took a
  // comment rule of `------` for a token; narrowed only by requiring a letter
  // after the dashes, it then took the sentence saying `--serif` is *not*
  // available as an offer of `--serif`. An offer is a row of the table; a
  // token named in prose is being discussed.
  const table = [...seed.matchAll(/^ {5,}(--[a-z][\w-]*(?:[ \t]+--[a-z][\w-]*)*)[ \t]{2,}\S.*$/gm)]
    .map((m) => m[1])
    .join(' ');

  return [...new Set([...table.matchAll(/(--[a-z][\w-]*)/g)].map((m) => m[1]))];
}

test('the theme seed is a working file that declares nothing', () => {
  const seed = read(TEMPLATES, 'assets', 'theme.css');

  // Guard the observer: an empty file satisfies "declares nothing" by being
  // empty, and would pass this while carrying none of the guidance either.
  assert.ok(seed.length > 400, `expected the seed to carry its rules, found ${seed.length} bytes`);

  assert.deepEqual(
    [...seed.matchAll(DECLARES)].map((m) => m[1]),
    [],
    'a seed that declares a token has already chosen, and an unthemed course inherits that choice',
  );

  // The rule that keeps the Component contract intact. Every Component reads
  // `style.css`'s tokens and declares no colour of its own; a *new* token here
  // is a colour only the page that named it knows about.
  assert.match(seed, /[Dd]efine none|declares? none|not.*define/, 'the seed should forbid new tokens');
  assert.match(seed, /contrast\.js/, 'the seed should name the checker, not describe the arithmetic');

  // Both schemes or neither: a theme setting one leaves half the course on the
  // plugin's palette, which reads as a defect rather than as a choice.
  assert.match(seed, /prefers-color-scheme/, 'the seed should say where the light scheme goes');

  const offered = tokensOfferedByTheSeed();
  assert.ok(offered.length >= 8, `expected the seed to name the tokens worth setting, found ${offered.length}`);

  // And every token it offers has to be one `style.css` actually declares — a
  // token offered here and absent there is a line a themer writes that changes
  // nothing on the page.
  const base = read(SKILL_DIR, 'runtime', 'assets', 'style.css');
  assert.deepEqual(
    offered.filter((t) => !new RegExp(`${t}\\s*:`).test(base)),
    [],
    'the seed offers a token style.css does not define, so setting it would do nothing',
  );
});

test('the themer exists, and is bounded to the one file it writes', () => {
  const themer = read(TEMPLATES, 'agents', 'themer.md');

  assert.match(themer, /^name:\s*themer\b/m, 'the subagent needs its name in frontmatter');
  assert.match(themer, /^tools:.*\bWrite\b/m, 'it writes a file, so it needs to be able to');

  // The bound that matters, and the reason it matters: `style.css` is a symlink
  // to the plugin, shared byte-for-byte with every other Workspace, so editing
  // it in place edits every other learner's course.
  assert.match(themer, /style\.css/, 'the themer has to be told what not to edit');
  assert.match(
    themer,
    /every other (?:learner|course|workspace)|byte-for-byte/i,
    'a prohibition without its reason is one an agent routes around when inconvenient',
  );

  // It must run the checker rather than reason about contrast, and it must know
  // which surface binds — that is the defect this role exists downstream of.
  assert.match(themer, /contrast\.js/, 'the themer should be sent to the checker');
  assert.match(themer, /--bg-card|--bg-soft/, 'the themer should know which surface binds');

  // And it is not the Teacher's job, stated in the document that would
  // otherwise hand it back: the first run delegates it.
  const firstRun = foldedDoc(SKILL_DIR, 'FIRST-RUN.md');
  assert.match(firstRun, /themer/, 'the first run should be where the theme is handed over');
  assert.match(
    firstRun,
    /\.claude\/agents\/themer\.md|dispatch|delegate/i,
    'the first run should say how to reach it, not merely that it exists',
  );
});

test('every page template links the theme immediately after the base styles', () => {
  // Order is the whole requirement: a theme that loses the cascade and a theme
  // a page forgot look the same to a learner — some of the course in the wrong
  // colours — so both halves are one check.
  const after = (text, base, theme) => {
    const b = text.indexOf(base);
    const t = text.indexOf(theme);
    return b !== -1 && t !== -1 && t > b;
  };

  const dossier = read(TEMPLATES, 'index.html');
  assert.ok(
    after(dossier, 'assets/style.css', 'assets/theme.css'),
    'the Dossier links the theme after the base styles, or it does not apply to the cover',
  );

  // The Lesson skeleton is prose in the authoring reference rather than a file,
  // which is why it is read here: an author copies what that block shows.
  const unit = read(SKILL_DIR, 'UNIT.md');
  const skeleton = unit.slice(unit.indexOf('<!DOCTYPE'), unit.indexOf('</html>'));
  assert.ok(skeleton.length > 200, 'expected the page skeleton in the authoring reference');
  assert.ok(
    after(skeleton, '../assets/style.css', '../assets/theme.css'),
    'the page skeleton is what an author copies, so the pair has to be in it',
  );
});

test('the scaffold installs the theme and the role that writes it', (t) => {
  const ws = Workspace.create(t);
  ws.scaffold();

  assert.ok(ws.exists('assets/theme.css'), 'a theme nobody placed is one no page can link');
  assert.ok(ws.exists('.claude/agents/themer.md'), 'the role has to be reachable in the Workspace');

  // Placed, not linked. A theme is the Workspace's own from the moment it is
  // placed — a link would make one course's palette every course's.
  assert.ok(
    !fs.lstatSync(path.join(ws.dir, 'assets', 'theme.css')).isSymbolicLink(),
    'the theme is this course\'s own, so it is copied rather than pointed at',
  );
});

test('the wiring script adds the theme link to a page that left it out, once', (t) => {
  const ws = Workspace.create(t);
  ws.scaffold();
  ws.write(
    'lessons/0001-bare.html',
    '<html lang="en"><head>\n  <link rel="stylesheet" href="../assets/style.css">\n</head><body><h1>x</h1></body></html>',
  );

  ws.wire();
  const once = ws.read('lessons/0001-bare.html');
  assert.match(once, /assets\/theme\.css/, 'the safety net should catch a page that forgot the theme');
  assert.match(
    once,
    /style\.css[^]*?theme\.css/,
    'and add it after the base styles, which is the half that cannot be got wrong silently',
  );

  ws.wire();
  assert.equal(
    (ws.read('lessons/0001-bare.html').match(/assets\/theme\.css/g) || []).length,
    1,
    're-running the script should not stack a second link',
  );
});

test('the contrast checker passes the shipped palette and fails a broken one', (t) => {
  const ws = Workspace.create(t);
  ws.scaffold();

  const pass = ws.run(CONTRAST, [ws.dir]);
  assert.equal(pass.status, 0, `the shipped palette should clear the floor:\n${pass.stdout}`);
  assert.match(pass.stdout, /at or above/, 'the checker should report what it measured');

  // Guard the observer, which for a checker means proving it can fail. The
  // value here is the one that actually shipped in this plugin's own
  // stylesheet: #6b7280 on --bg-card is 3.42:1, and it was missed by hand
  // twice — once when written, once when a Workspace "fixed" it against the
  // wrong surface.
  const base = ws.read('assets/style.css');
  ws.write('assets/theme.css', ':root { --fg-faint: #6b7280; }\n');
  const fail = ws.run(CONTRAST, [ws.dir]);

  assert.notEqual(fail.status, 0, 'a checker that cannot fail is not measuring anything');
  assert.match(fail.stdout, /FAIL/, 'the failing pairs should be named');
  assert.match(fail.stdout, /--fg-faint/, 'and the token that failed should be one of them');

  // The point of the over-approximation: the pair reported has to include the
  // surface a hand check would have skipped.
  assert.match(fail.stdout, /--bg-card/, '--bg-card is the surface the hand check missed');
  assert.ok(base.includes('--fg-faint'), 'guard: the base stylesheet should declare the token under test');
});
