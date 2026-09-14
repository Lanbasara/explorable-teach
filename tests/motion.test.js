'use strict';

// What this holds, and why the checks are shaped the way they are:
// `docs/agents/tests.md`, "The motion check".
//
// The complaint, in the words of the ticket: the evidence against decoration is
// about *content* — mascots, jokes, tangent anecdotes, ornamental art — and a
// Teacher reading that material with no distinction drawn "will not dare add a
// reasonable transition, which is the state the plugin is in today". So the fix
// is not permission in general. It is a sort: motion that *is* the explanation,
// motion that is interface feedback, and motion competing with the content are
// three different things with three different verdicts, and one rule covering
// all three gets the middle one wrong in whichever direction it was written.
//
// Most of these are checks about whether the sort is still *stated*, which is
// the kind of subject `imagery.test.js` has. One of them is not. The preference
// a Learner set is **required rather than suggested**, and a requirement the
// plugin's own stylesheets do not meet is advice with a strong adverb in front
// of it — so that one is held against the code, in both directions.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { REPO_ROOT } = require('./helpers/workspace.js');
const { foldedDoc, absentFrom, carriedTogether, oneSection, SKILL_DIR } = require('./helpers/docs.js');

// Folded, the way every document check here reads a document: prose in this
// repo is hard-wrapped, so a claim about what it *says* is a claim about a
// sentence rather than about where a line break happened to fall — and folding
// is also what lets a check require several patterns to arrive *together*.
const UNIT = foldedDoc(SKILL_DIR, 'UNIT.md');

/** Where the plugin keeps the stylesheets every Workspace links at. */
const RUNTIME = path.join(SKILL_DIR, 'runtime', 'assets');

/** The one section that owns motion. */
const motion = () => oneSection(UNIT, 2, /^motion\b/i, 'sorting motion into kinds');

/**
 * The three kinds, each with the verdict that makes naming it worth anything.
 *
 * A kind named without its verdict is a taxonomy, and a taxonomy is what a
 * Teacher reads and then decides by appetite anyway. The verdict has to arrive
 * on the same logical line as the kind, for the reason each ban in the imagery
 * check sits on one line with its reason: a verdict that has drifted off its
 * kind is one nobody reads while deciding.
 */
const KINDS = [
  {
    what: 'motion that is the explanation',
    re: /motion that is the explanation/i,
    verdict: /permitted/i,
  },
  {
    what: 'motion that is interface feedback',
    re: /interface feedback/i,
    verdict: /permitted/i,
  },
  {
    what: 'motion competing with the content for attention',
    re: /competing with the content/i,
    verdict: /removed/i,
  },
];

/**
 * What makes the middle kind worth calling out by name. The evidence against
 * decoration is about content, and a panel that opens is not content — so the
 * examples the evidence is really about are named, rather than the distinction
 * being asserted and left for the reader to trust.
 */
const CONTENT_NOT_AFFORDANCE = [
  { what: 'mascots', re: /mascot/i },
  { what: 'jokes', re: /joke/i },
  { what: 'tangent anecdotes', re: /anecdote/i },
  { what: 'ornamental art', re: /ornament/i },
];

/**
 * The constraints on interface feedback. They arrive together on purpose:
 * "short" with no number is a word every author believes it is already obeying,
 * and either of the other two alone leaves the Learner waiting on an animation
 * before the page will hear them.
 */
const TASTE = [
  { what: 'short', re: /\bshort\b/i },
  { what: 'with a number on it', re: /\d+\s*(?:ms|millisecond)/i },
  { what: 'interruptible', re: /interrupt/i },
  { what: 'honouring the reduced-motion preference', re: /reduced[- ]motion/i },
];

/**
 * Hedges. A preference stated beside one of these is a preference the next
 * Session skips, whatever the sentence around it claims — which is the whole
 * difference between *required* and *suggested*, and the thing this rule exists
 * to be.
 *
 * `suggest` is deliberately not here: the rule states itself as *required, not
 * suggested*, and a guard that could not tell those apart would forbid the
 * document from saying what it is.
 */
const HEDGES = [
  /\bconsider\b/i,
  /where possible/i,
  /if you can\b/i,
  /nice to have/i,
  /\btry to\b/i,
  /\boptional\b/i,
  /if you have time/i,
];

/** Every stylesheet the plugin ships, as `{ name, text }`. */
function stylesheets() {
  return fs
    .readdirSync(RUNTIME)
    .filter((name) => name.endsWith('.css'))
    .sort()
    .map((name) => ({ name, text: fs.readFileSync(path.join(RUNTIME, name), 'utf8') }));
}

/** A reduced-motion block, and one rule inside a stylesheet. */
const GUARD = /@media[^{]*prefers-reduced-motion[^{]*\{[\s\S]*?\n\}/g;
const RULE = /([^{}]+)\{([^{}]*)\}/g;

/**
 * A declaration that starts something moving, as opposed to one taking it off.
 *
 * The whitespace after the colon belongs *inside* the lookahead. Written the
 * other way round — `:\s*(?!none\b)` — the `\s*` backtracks to nothing and the
 * lookahead then reads the space rather than the word, so `transition: none`
 * matches as motion and every guard in the repo reads as a rule that moves.
 */
const MOVES = /(?:^|;)\s*(?:transition|animation)\s*:(?!\s*none\b)/;

/**
 * One rule's selectors, tidied: comments dropped, wrapping folded out, so the
 * text of a selector is comparable with the text of the same selector written
 * inside a guard. An at-rule is not a selector and is dropped.
 */
function selectorsOf(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(',')
    .map((s) => s.split('\n').map((l) => l.trim()).filter(Boolean).join(' ').trim())
    .filter((s) => s && !s.startsWith('@'));
}

/**
 * Every selector in a stylesheet that moves something **of its own accord**,
 * and every selector one of its reduced-motion blocks addresses — read as two
 * sets, so the check can ask whether the first is covered by the second rather
 * than whether the words appear in the same file.
 *
 * What a guard *says* about a selector is not read. Addressing it under the
 * preference is the whole claim: a block may take the motion off, or shorten it
 * to nothing, and both are the author having answered for that selector.
 *
 * Two things this has to get right, and the first version of it got neither.
 * Guards are written as `transition: none`, so a reader that counted
 * declarations without cutting the guards out first would report a file as
 * animating **because** it had already been fixed. And a rule written on one
 * line — `.x { transition: all .2s; }`, which this repo writes — is invisible to
 * a pattern anchored at the start of a line, so a stylesheet's *other* guard
 * would have carried it.
 *
 * Selectors are matched as text, which is deliberately strict: a guard written
 * more loosely than the rule it means to cover does not count as covering it.
 * The alternative is a check that decides CSS specificity, and a wrong answer
 * there passes a page that still moves.
 */
function motionOf(text) {
  const addressed = (source, keep) => {
    const found = new Set();
    for (const [, selectors, body] of source.matchAll(RULE)) {
      if (!keep(body)) continue;
      for (const selector of selectorsOf(selectors)) found.add(selector);
    }
    return found;
  };

  return {
    moving: [...addressed(text.replace(GUARD, ''), (body) => MOVES.test(body))],
    guarded: addressed([...text.matchAll(GUARD)].join('\n'), () => true),
  };
}

test('the authoring reference sorts motion into three kinds, each with its verdict', () => {
  const section = motion();

  const undecided = KINDS.filter((k) => !carriedTogether(section, [{ re: k.re }, { re: k.verdict }]))
    .map((k) => k.what);

  assert.deepEqual(
    undecided,
    [],
    'a kind of motion named without its verdict is a taxonomy, and a taxonomy decides nothing',
  );
});

test('the middle kind is permitted by name, and the reason it needs naming is stated', () => {
  const section = motion();

  // The distinction, in one logical line: the case against decoration is about
  // content, and an interface affordance is not content. Both halves somewhere
  // in the section would be satisfied by a section that merely used the words.
  assert.ok(
    carriedTogether(section, [
      { re: /decoration|coherence/i },
      { re: /\bcontent\b/i },
      { re: /affordance|interface/i },
    ]),
    'without that sentence the permission reads as an exception being smuggled past the rule',
  );

  assert.deepEqual(
    absentFrom(CONTENT_NOT_AFFORDANCE, section),
    [],
    'the evidence is about these, and naming them is what stops a transition being read as one',
  );
});

test('and it carries its constraints, together, in the breath that permits it', () => {
  const section = motion();

  assert.ok(
    carriedTogether(section, TASTE),
    'permission and its constraints in separate paragraphs is permission with a footnote' +
      `; absent from the section: ${absentFrom(TASTE, section).join(', ') || 'none'}`,
  );
});

test('the reduced-motion preference is required rather than suggested', () => {
  const section = motion();

  // The media query itself, because a sentence saying "honour the preference"
  // is advice and the query is the thing an author copies.
  assert.match(
    section,
    /@media \(prefers-reduced-motion: reduce\)/,
    'the rule has to arrive as the thing an author types, not as a paraphrase of it',
  );

  assert.ok(
    carriedTogether(section, [{ re: /reduced[- ]motion/i }, { re: /\brequired\b|\bmust\b|\bevery\b/i }]),
    'a preference with no requirement word on it is one the next Session reads as a nicety',
  );

  // And the exemption, stated rather than left to be inferred: the one kind
  // where removing the motion removes the teaching does not simply vanish. A
  // rule with no answer for that case is one an author breaks silently.
  assert.ok(
    carriedTogether(section, [{ re: /reduced[- ]motion/i }, { re: /\bsteps?\b/i }]),
    'the explanatory kind needs a reduced-motion path, or the rule has no answer for it',
  );

  const hedged = section
    .split('\n')
    .filter((line) => /reduced[- ]motion/i.test(line) && HEDGES.some((re) => re.test(line)));

  assert.deepEqual(
    hedged,
    [],
    'a requirement written beside a hedge is a suggestion, whatever the adjective in front of it says',
  );
});

test('motion that competes gets Decoration’s verdict, not a taste argument', () => {
  const section = motion();

  assert.ok(
    carriedTogether(section, [
      { re: /decoration/i },
      { re: /delete/i },
      { re: /reread|argument still stands/i },
    ]),
    'this kind is the second gate reaching motion; stated as taste it is arguable, and gets argued',
  );
});

test('every shipped stylesheet that moves something honours the preference', () => {
  // The half of this rule that is not about a document. The reference says the
  // shipped Components already carry the block, which is a claim about these
  // files — and a Teacher writing a Component models it on one of them, so a
  // stylesheet that animates without a guard teaches the opposite of the rule.
  const moving = stylesheets()
    .map((sheet) => ({ name: sheet.name, ...motionOf(sheet.text) }))
    .filter((sheet) => sheet.moving.length);

  // Guard the observer, and guard it by *selector* rather than by file: a
  // reader that stopped recognising a one-line rule would still find most of
  // these files, so a floor counting files alone would go on passing while the
  // half that matters had stopped being read.
  const selectors = moving.reduce((n, sheet) => n + sheet.moving.length, 0);
  assert.ok(
    moving.length >= 5 && selectors >= 10,
    `expected the stylesheets that animate, found ${selectors} selectors across ${moving.length}`,
  );

  const unguarded = moving.flatMap((sheet) =>
    sheet.moving.filter((selector) => !sheet.guarded.has(selector)).map((s) => `${sheet.name}  ${s}`),
  );

  assert.deepEqual(
    unguarded,
    [],
    'these move a Learner who asked not to be moved, and are the files a new Component is modelled on',
  );
});

test('the reasoning behind both rules is in the decisions record', () => {
  // The rules are what the Teacher reads; the argument for them is a
  // maintainer's, and an argument that leaves without being recorded is one a
  // later maintainer re-derives or reverses without knowing it.
  const decisions = foldedDoc(REPO_ROOT, 'docs', 'DECISIONS.md');
  const record = oneSection(
    decisions,
    2,
    /before a canvas|motion in three kinds/i,
    'decisions-record entry for these two rules',
  );

  const REASONS = [
    { what: 'that elements come before a canvas', re: /elements?\b[^.]*\bcanvas\b/i },
    { what: 'that a diagram of elements is readable by assistive technology', re: /assistive/i },
    { what: 'that it is inspectable, and a canvas supports one check', re: /inspectab/i },
    { what: 'the cases that still warrant a canvas', re: /particle|continuous curve|three-dimensional/i },
    { what: 'that motion sorts into three kinds', re: /three kinds/i },
    { what: 'that interface feedback is permitted by name', re: /interface feedback/i },
    { what: 'and that the reduced-motion preference is required', re: /reduced[- ]motion/i },
  ];

  assert.deepEqual(
    absentFrom(REASONS, record),
    [],
    'the record keeps the decision but has dropped what argued for it',
  );
});
