'use strict';

// What this holds, and why the checks are shaped the way they are:
// `docs/agents/tests.md`, "The course-stylesheet check".
//
// The complaint is a measurement. Across six courses built with this plugin,
// not one changed a single design token — every one of them rendered in the
// same cold white, the same blue accent, the same 760px column, whatever it was
// about. `UNIT.md` said re-theming was possible in a sentence nobody acted on,
// which is the shape of a capability that exists and is never reached: it cost
// a Session hours of arithmetic and taste with no teaching in it, so the
// Session reached for the default and moved on.
//
// So the design is delegated rather than encouraged, and these checks are about
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
const { foldedDoc, carriedTogether, SKILL_DIR } = require('./helpers/docs.js');

const TEMPLATES = path.join(SKILL_DIR, 'templates');
const CONTRAST = path.join(REPO_ROOT, 'scripts', 'contrast.js');

const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');

/**
 * A document's paragraphs, one per line, with comment leaders stripped.
 *
 * `carriedTogether` requires its patterns on one line, which is what makes it a
 * check about a *claim* rather than about a file using two words somewhere. The
 * shared reader folds Markdown; this folds a CSS or Markdown comment block, so
 * the same assertion works on a stylesheet's head comment — where several of
 * the claims below are actually written.
 */
function paragraphs(text) {
  return text
    .split(/\n\s*(?:\*\s*)?\n/)
    .map((block) =>
      block
        .split('\n')
        .map((line) => line.replace(/^\s*(?:\/\*+|\*+\/?|\/\/)?\s?/, '').trim())
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
    .join('\n');
}


/** A `--token: #value` declaration, which a seed must not carry. */
const DECLARES = /^\s*(--[\w-]+)\s*:\s*[^;]+;/gm;

/**
 * The tokens a course is told it may set. Read off `course.css`'s own head
 * comment rather than listed here, because a second copy of the token list is
 * a list that goes stale against `style.css` silently and in the direction of
 * looking fine.
 */
function tokensOfferedByTheSeed() {
  const seed = read(TEMPLATES, 'assets', 'course.css');

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

test('the course stylesheet arrives as a working file that declares nothing', () => {
  const seed = read(TEMPLATES, 'assets', 'course.css');

  // Guard the observer: an empty file satisfies "declares nothing" by being
  // empty, and would pass this while carrying none of the guidance either.
  assert.ok(seed.length > 400, `expected the seed to carry its rules, found ${seed.length} bytes`);

  assert.deepEqual(
    [...seed.matchAll(DECLARES)].map((m) => m[1]),
    [],
    'a seed that declares a token has already chosen, and an unstyled course inherits that choice',
  );

  // The rule that keeps the Component contract intact. Every Component reads
  // `style.css`'s tokens and declares no colour of its own; a *new* token here
  // is a colour only the page that named it knows about.
  assert.match(seed, /[Dd]efine none|declares? none|not.*define/, 'the seed should forbid new tokens');
  assert.match(seed, /contrast\.js/, 'the seed should name the checker, not describe the arithmetic');

  // Both schemes or neither: a course setting one leaves half of itself on the
  // plugin's palette, which reads as a defect rather than as a choice.
  assert.match(seed, /prefers-color-scheme/, 'the seed should say where the light scheme goes');

  const offered = tokensOfferedByTheSeed();
  assert.ok(offered.length >= 8, `expected the seed to name the tokens worth setting, found ${offered.length}`);

  // And every token it offers has to be one `style.css` actually declares — a
  // token offered here and absent there is a line a designer writes that changes
  // nothing on the page.
  const base = read(SKILL_DIR, 'runtime', 'assets', 'style.css');
  assert.deepEqual(
    offered.filter((t) => !new RegExp(`${t}\\s*:`).test(base)),
    [],
    'the seed offers a token style.css does not define, so setting it would do nothing',
  );
});

test('the designer exists, and is bounded to the one file it writes', () => {
  const designer = read(TEMPLATES, 'agents', 'designer.md');

  assert.match(designer, /^name:\s*designer\b/m, 'the subagent needs its name in frontmatter');
  assert.match(designer, /^tools:.*\bWrite\b/m, 'it writes a file, so it needs to be able to');

  // The bound that matters, and the reason it matters: `style.css` is a symlink
  // to the plugin, shared byte-for-byte with every other Workspace, so editing
  // it in place edits every other learner's course.
  assert.match(designer, /style\.css/, 'the designer has to be told what not to edit');
  assert.match(
    designer,
    /every other (?:learner|course|workspace)|byte-for-byte/i,
    'a prohibition without its reason is one an agent routes around when inconvenient',
  );

  // It must run the checker rather than reason about contrast, and it must know
  // which surface binds — that is the defect this role exists downstream of.
  assert.match(designer, /contrast\.js/, 'the designer should be sent to the checker');
  assert.match(designer, /--bg-card|--bg-soft/, 'the designer should know which surface binds');

  // And it is not the Teacher's job, stated in the document that would
  // otherwise hand it back: the first run delegates it.
  const firstRun = foldedDoc(SKILL_DIR, 'FIRST-RUN.md');
  assert.match(firstRun, /designer/, 'the first run should be where the design is handed over');
  assert.match(
    firstRun,
    /\.claude\/agents\/designer\.md|dispatch|delegate/i,
    'the first run should say how to reach it, not merely that it exists',
  );
});

test('every page template links the course stylesheet immediately after the base styles', () => {
  // Order is the whole requirement: a stylesheet that loses the cascade and one
  // a page forgot look the same to a learner — some of the course in the wrong
  // colours — so both halves are one check.
  const after = (text, base, own) => {
    const b = text.indexOf(base);
    const t = text.indexOf(own);
    return b !== -1 && t !== -1 && t > b;
  };

  const dossier = read(TEMPLATES, 'index.html');
  assert.ok(
    after(dossier, 'assets/style.css', 'assets/course.css'),
    'the Dossier links it after the base styles, or it does not apply to the cover',
  );

  // The Lesson skeleton is prose in the authoring reference rather than a file,
  // which is why it is read here: an author copies what that block shows.
  const unit = read(SKILL_DIR, 'UNIT.md');
  const skeleton = unit.slice(unit.indexOf('<!DOCTYPE'), unit.indexOf('</html>'));
  assert.ok(skeleton.length > 200, 'expected the page skeleton in the authoring reference');
  assert.ok(
    after(skeleton, '../assets/style.css', '../assets/course.css'),
    'the page skeleton is what an author copies, so the pair has to be in it',
  );
});

test('the scaffold installs the course stylesheet and the role that writes it', (t) => {
  const ws = Workspace.create(t);
  ws.scaffold();

  assert.ok(ws.exists('assets/course.css'), 'a stylesheet nobody placed is one no page can link');
  assert.ok(ws.exists('.claude/agents/designer.md'), 'the role has to be reachable in the Workspace');

  // Placed, not linked. It is the Workspace's own from the moment it is
  // placed — a link would make one course's palette every course's.
  assert.ok(
    !fs.lstatSync(path.join(ws.dir, 'assets', 'course.css')).isSymbolicLink(),
    'it is this course\'s own, so it is copied rather than pointed at',
  );
});

test('the wiring script adds the course stylesheet to a page that left it out, once', (t) => {
  const ws = Workspace.create(t);
  ws.scaffold();
  ws.write(
    'lessons/0001-bare.html',
    '<html lang="en"><head>\n  <link rel="stylesheet" href="../assets/style.css">\n</head><body><h1>x</h1></body></html>',
  );

  ws.wire();
  const once = ws.read('lessons/0001-bare.html');
  assert.match(once, /assets\/course\.css/, 'the safety net should catch a page that forgot it');
  assert.match(
    once,
    /style\.css[\s\S]*?course\.css/,
    'and add it after the base styles, which is the half that cannot be got wrong silently',
  );

  ws.wire();
  assert.equal(
    (ws.read('lessons/0001-bare.html').match(/assets\/course\.css/g) || []).length,
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
  ws.write('assets/course.css', ':root { --fg-faint: #6b7280; }\n');
  const fail = ws.run(CONTRAST, [ws.dir]);

  assert.notEqual(fail.status, 0, 'a checker that cannot fail is not measuring anything');
  assert.match(fail.stdout, /FAIL/, 'the failing pairs should be named');
  assert.match(fail.stdout, /--fg-faint/, 'and the token that failed should be one of them');

  // The point of the over-approximation: the pair reported has to include the
  // surface a hand check would have skipped.
  assert.match(fail.stdout, /--bg-card/, '--bg-card is the surface the hand check missed');
  assert.ok(base.includes('--fg-faint'), 'guard: the base stylesheet should declare the token under test');
});

test('the course stylesheet is palette and blocks together, not a skin', () => {
  const seed = read(TEMPLATES, 'assets', 'course.css');
  const designer = read(TEMPLATES, 'agents', 'designer.md');

  // The split this file exists to refuse. Palette in one place and layout in
  // another is how a warm guitar course ends up as a reference manual in warm
  // colours — which is the failure the first attempt at this shipped, as a
  // tokens-only `theme.css` beside an undocumented `course.css` two courses had
  // invented for their own blocks.
  for (const [what, text] of [['the seed', paragraphs(seed)], ['the designer', paragraphs(designer)]]) {
    assert.ok(
      carriedTogether(text, [{ re: /palette|colour|token/i }, { re: /block|structur|built from/i }]),
      `${what} should say palette and blocks are one decision, not two files`,
    );
  }

  // The eight class names every course starts with, named rather than gestured
  // at: "not enough vocabulary" is a claim a reader cannot act on, and the
  // count is what makes the gap visible.
  const SHIPPED = ['.lesson-header', '.callout', '.t-btn'];
  assert.deepEqual(
    SHIPPED.filter((c) => !seed.includes(c)),
    [],
    'the seed should name what ships, so a course can see what it is adding to',
  );

  // Restyling what ships is permitted, and said so. Left unstated, a course
  // adds beside the shipped blocks and never touches them, which is how every
  // page keeps the same composition in different colours.
  assert.match(
    seed,
    /[Rr]estyle|neither is sacred|not sacred/,
    'a course that may not restyle the shipped blocks can only ever be a reskin',
  );

  // And the blocks are not Components. A Component is an interaction, and most
  // of what a page is built from does not interact — conflating them would put
  // a keyboard path and a stand-in sentence on a bordered box.
  assert.ok(
    carriedTogether(paragraphs(seed), [{ re: /Component/ }, { re: /interact/i }]),
    'the seed should say why a block is not a Component, or the terms merge',
  );
});

test('a block added to the course stylesheet is documented, and the Teacher is sent to read it', () => {
  const seed = read(TEMPLATES, 'assets', 'course.css');
  const designer = read(TEMPLATES, 'agents', 'designer.md');
  const unit = foldedDoc(SKILL_DIR, 'UNIT.md');

  // Documentation is the whole of the handover. Two courses invented their own
  // blocks — `.qmap`, `.bridge`, `.next-step` — and documented none of them, so
  // the vocabulary a Session invented was lost to the next one.
  for (const [what, text] of [['the seed', paragraphs(seed)], ['the designer', paragraphs(designer)]]) {
    assert.ok(
      carriedTogether(text, [{ re: /markup/i }, { re: /comment/i }]),
      `${what} should require the markup an author writes to be documented beside the rules`,
    );
  }

  // The read-first rule, which is the Component rule applied to the same
  // failure. Without it the documentation exists and nobody opens it.
  assert.ok(
    carriedTogether(unit, [{ re: /course\.css/ }, { re: /[Rr]ead/ }, { re: /before you write|before writing/i }]),
    'the authoring reference should send a Session to read this course\'s blocks first',
  );

  // And say where a new one goes, because the alternative an author reaches for
  // is a style inlined into the one page that needed it.
  assert.ok(
    carriedTogether(unit, [{ re: /not into the page|inlined|inline/i }, { re: /add it there|course\.css/ }]),
    'a Lesson needing a block it does not have needs somewhere to put it',
  );
});
