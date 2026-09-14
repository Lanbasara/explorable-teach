'use strict';

// What this holds, and why the checks are shaped the way they are:
// `docs/agents/tests.md`, "The derivation check".
//
// The complaint, in the words of the ticket: deciding what a passage needs was
// "a lookup: a table of eleven teaching acts, each routed to what to reach
// for". Indexing by teaching act rather than by library was the right
// direction, but it was still a closed list read *before* writing, so it
// decided the answer — the author scanned the rows and fitted the material into
// one, instead of asking what this material needed. A closed list also cannot
// express the two commonest outcomes: that a passage needs nothing, and that it
// needs something nobody has built.
//
// So these are checks about the *shape of a decision procedure* rather than
// about where material sits. What they hold in place is the direction it runs
// in: gates first, then questions asked of the passage, then — and only then —
// a look at what already exists. A check that only asked whether the words were
// present would pass on the table rewritten as prose, which is why the order of
// the parts and the absence of a table are both asserted.

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  foldedDoc,
  absentFrom,
  carriedTogether,
  oneSection,
  orderedEntries,
  namedBullets,
  ROOM_FOR_A_REASON,
  SKILL_DIR,
} = require('./helpers/docs.js');
const { headings } = require('./helpers/markdown.js');

/**
 * The authoring reference with its hard wrapping folded back out, so one
 * logical line is one line of this string. Every claim below is about a
 * sentence rather than about where a line break happened to fall.
 */
const UNIT = foldedDoc(SKILL_DIR, 'UNIT.md');

/**
 * One part of it, as its logical lines — `UNIT` is already folded, so one line
 * of any slice of it is one logical line.
 *
 * No line numbers, deliberately: these are offsets into a *section*, and a
 * failure printing one beside a filename would read as a document line and send
 * a reader to the wrong place. The offending text is what identifies it.
 */
const linesOf = (text) => text.split('\n');

/**
 * Markup rather than prose, by the tag brackets alone. The page skeleton and
 * the from-disk tables show an author what to type, which is instruction and
 * not a list of what a Workspace has.
 */
const isMarkup = (text) => /[<>]/.test(text);

/**
 * The two tables this ticket removed, as their rows were actually written.
 *
 * Kept here rather than in a document, for the reason `from-disk.test.js` keeps
 * the ban it forbids: the document they came from no longer has them, so a
 * pattern with nothing to see would be a check that cannot fail.
 */
const AS_TABULATED = [
  { what: 'the teaching-act table', re: /^\|.*\|\s*Predict-reveal\s*\|/im },
  { what: 'the shipped-Components table', re: /^\|\s*\*\*Predict-Reveal\*\*/im },
];

const AS_WRITTEN = [
  '| What you are trying to do | Reach for | Where it comes from |',
  '| Confront an intuition before explaining it | Predict-reveal | Shipped |',
  '| Component | Files | Use it for |',
  '| **Predict-Reveal** | `assets/predict-reveal.js` | Confronting a wrong answer |',
].join('\n');

/**
 * The section that owns the decision, and the parts of it the checks below are
 * each about.
 *
 * Bounded at the next heading of *any* level, which `sections` does not do:
 * asked for level three it runs a body to the next level-three heading, so the
 * last part of this section would swallow whatever follows it. That is the
 * bound `from-disk.test.js` arrived at the hard way; applied here in advance,
 * because every check below reads a part rather than the whole.
 */
function deriving() {
  const whole = oneSection(UNIT, 2, /^deriving\b/i, 'deriving an interaction from the material');

  // Read within the section rather than across the document: unlike the imagery
  // subsections, these titles are general enough that another section's could
  // match one.
  const part = (re, what) => oneSection(whole, 3, re, `${what} part of the derivation section`);

  return {
    whole,
    opening: whole.split(/^###\s+/m)[0],
    gates: part(/gates/i, 'gates'),
    derivations: part(/^the derivations$/i, 'derivations'),
    match: part(/reuse, build/i, 'matching'),
    antipatterns: part(/teach nothing/i, 'anti-pattern'),
  };
}

/**
 * What each derivation has to carry. The first three are a description of one;
 * the fourth is what makes the whole set resist the pull this ticket exists to
 * resist, so it is load-bearing rather than a nicety: a static strip of frames
 * often beats a slider, because the comparison is then simultaneous rather than
 * remembered.
 */
const CARRIES = [
  { what: 'the question it asks of the passage', re: /\*Ask:\*/ },
  { what: 'the form it outputs', re: /\*It produces:\*/ },
  { what: 'whether that output is plumbing or content', re: /\*Plumbing or content:\*/ },
  { what: 'the cheapest version that still does the teaching', re: /\*Cheapest that still teaches:\*/ },
];

/**
 * The three outcomes of matching a description against what the Workspace has.
 * All three are normal, and the third is the one a list of Components cannot
 * say: the description was worth deriving and is not worth building.
 */
const OUTCOMES = [
  { what: 'reuse', re: /\*\*Reuse\.?\*\*/i },
  { what: 'build', re: /\*\*Build\.?\*\*/i },
  { what: 'nothing', re: /\*\*Nothing\.?\*\*/i },
];

/**
 * The forms that look impressive and teach nothing. Named one by one rather
 * than gestured at, for the reason the imagery check names its borrow
 * categories: "do not add decoration" is a rule every author believes it is
 * already obeying, and each of these is a specific thing a Session reaches for
 * because it is pleasant to build.
 */
const ANTIPATTERNS = [
  { what: 'a rotatable scene with no variable that changes the claim', re: /rotat/i },
  { what: "a control whose consequence is off-screen", re: /off-screen|off screen/i },
  { what: 'an open sandbox before the Learner has a question', re: /sandbox/i },
  { what: 'a prediction with no nameable prior', re: /\bprior\b/i },
  { what: 'scroll that only advances time', re: /scroll/i },
  { what: 'an abstraction with no way back down to a concrete case', re: /abstraction/i },
  { what: 'simulating a three-step process', re: /three-step|three step/i },
];

test('an interaction is derived from the material rather than selected from a list', () => {
  const { opening } = deriving();

  // The direction the whole section runs in, stated where a Teacher meets it
  // first. A list read before writing decides the answer: the author scans it,
  // finds the row this material most nearly fits, and builds that.
  const DIRECTION = [
    { what: 'that an interaction is derived from the passage', re: /\bderive/i },
    { what: 'and not selected off a list', re: /\blist\b/i },
  ];

  assert.ok(
    carriedTogether(opening, DIRECTION),
    'without this the parts below read as a lookup with extra steps' +
      `; absent from the opening: ${absentFrom(DIRECTION, opening).join(', ') || 'none'}`,
  );
});

test('both tables are gone from the authoring reference', () => {
  // Guard the observer on the rows as they were written: patterns that matched
  // nothing would report the tables removed however they came back.
  const seen = AS_TABULATED.filter((t) => t.re.test(AS_WRITTEN)).map((t) => t.what);
  assert.equal(seen.length, AS_TABULATED.length, 'this check can no longer see the tables it forbids');

  assert.deepEqual(
    AS_TABULATED.filter((t) => t.re.test(UNIT)).map((t) => t.what),
    [],
    'a table of what to reach for is read before writing, so it decides the answer',
  );
});

test('the derivations are not a table wearing another shape', () => {
  // The removal is about the shape of the decision, not about two particular
  // tables. Four columns of trigger, output, mark and cheapest version is the
  // closed list back again, scanned from the left exactly as before.
  const { whole } = deriving();
  const isRow = (line) => line.trim().startsWith('|');

  // Guard the recogniser, on a row written the way this document writes them:
  // one that stopped seeing a table row would report the section table-free
  // however the table came back.
  assert.ok(isRow('| What you are trying to do | Reach for | Where it comes from |'), 'this check sees a row');
  assert.ok(!isRow('- *Ask:* is there a number here the claim depends on?'), 'and leaves a derivation alone');

  const rows = whole.split('\n').filter(isRow);

  assert.deepEqual(rows, [], 'a row is something an author places itself in rather than asks');
});

test('the two gates are stated first, and both are meant to stop a passage', () => {
  const { whole, gates } = deriving();

  // Order is the claim here. The gates exist to stop most passages before a
  // derivation is read, so a document that states them after the derivations
  // has the Teacher deciding what to build and then asking whether to build
  // anything — which is the decision it would defend rather than make.
  const parts = headings(whole)
    .filter((h) => h.level === 3)
    .map((h) => h.text);

  assert.ok(parts.length >= 4, `expected the section's parts, found ${parts.length}`);
  assert.match(parts[0], /gates/i, 'the gates run before anything is derived');

  const at = (re) => parts.findIndex((title) => re.test(title));
  assert.ok(at(/^the derivations$/i) > 0, 'the derivations should follow the gates');
  assert.ok(
    at(/reuse, build/i) > at(/^the derivations$/i),
    'a description is matched against what exists after it is derived, never before',
  );
  assert.ok(at(/teach nothing/i) > at(/^the derivations$/i), 'the anti-patterns accompany the derivations');

  const GATES = [
    {
      what: 'the belief the Learner must leave with, in one sentence',
      re: /\bbeliev|\bbelief\b/i,
    },
    { what: 'that prose or a static picture ends it there', re: /\bprose\b/i },
    { what: 'that the answer is to stop', re: /\bstop\b/i },
    { what: 'drafting the interaction and deleting it again', re: /\bdelet/i },
    { what: 'rereading the passage without it', re: /\brereads?\b|\breread\b/i },
    { what: 'and that what survived nothing was decoration', re: /decorat/i },
  ];

  assert.deepEqual(
    absentFrom(GATES, gates),
    [],
    'a gate with a step missing is one a Session walks through without stopping',
  );
});

test('"this passage needs nothing" is a result rather than an omission', () => {
  const { gates } = deriving();

  // One logical line, which is one paragraph. Both halves are needed and
  // neither is enough: that most passages stop here is a measurement, and that
  // stopping is a legitimate place to stop is the permission an author needs in
  // order to act on it. Said in different paragraphs, the second reads as
  // consolation.
  const FIRST_CLASS = [
    { what: 'that nothing is what the gates commonly produce', re: /\bnothing\b/i },
    { what: 'that it is the common case', re: /\bcommon(?:est)?\b|\bmost\b/i },
    { what: 'and that it is a result rather than a failure to find one', re: /\bresult\b|\boutcome\b/i },
  ];

  assert.ok(
    carriedTogether(gates, FIRST_CLASS),
    'without this an author reads an empty derivation as not having looked hard enough' +
      `; absent from the gates: ${absentFrom(FIRST_CLASS, gates).join(', ') || 'none'}`,
  );
});

test('a derivation produces a description, and names no Component', () => {
  const { derivations: part } = deriving();

  const PRODUCES = [
    { what: 'that what comes out is a description of an interaction', re: /\bdescription\b/i },
    { what: 'and that it is not a Component name', re: /\bno Component\b|never a Component\b/i },
  ];

  assert.deepEqual(
    absentFrom(PRODUCES, part),
    [],
    'a derivation whose output is a Component name is the lookup again, one step further in',
  );

  // And the set says it is open. A closed list cannot express the outcome this
  // subject most often has — a passage needing something nobody has built —
  // and an author reading a list of ten as the whole world builds the nearest
  // of the ten instead.
  assert.match(
    part,
    /\bopen\b/i,
    'a passage whose need none of these questions asks is not a passage with no need',
  );
});

test('each derivation carries its question, its output, its mark and its cheapest version', () => {
  const { derivations: part } = deriving();
  const found = orderedEntries(part);

  // Guard the observer: a reader that recognised no entry would find nothing
  // missing from any of them and pass this for free.
  assert.ok(found.length >= 6, `expected the ordered set of derivations, found ${found.length}`);

  const incomplete = found.flatMap((d) =>
    absentFrom(CARRIES, d.text).map((what) => `derivation ${d.n} does not state ${what}`),
  );
  assert.deepEqual(incomplete, [], 'a derivation missing one of the four is not one');

  // The trigger is a question asked of the material. A derivation whose trigger
  // is a statement is a row describing a thing to build, which is what the
  // tables were.
  const notAsked = found
    .filter((d) => !/\*Ask:\*[^\n]*\?/.test(d.text))
    .map((d) => `derivation ${d.n}`);
  assert.deepEqual(notAsked, [], 'these state a trigger instead of asking one');

  // Every entry has to place its output on the plumbing-or-content axis, which
  // means answering rather than restating the label: what is reusable here
  // decides whether it belongs to the Workspace or to this one Lesson.
  const unplaced = found
    .filter((d) => !/\*Plumbing or content:\*[^\n]*\b(?:plumbing|content|neither)\b/i.test(d.text))
    .map((d) => `derivation ${d.n}`);
  assert.deepEqual(unplaced, [], 'these carry the axis without placing themselves on it');
});

test('the match against what exists happens afterwards, with three named outcomes', () => {
  const { match } = deriving();

  assert.deepEqual(
    absentFrom(OUTCOMES, match),
    [],
    'an outcome the document does not name is one the Teacher reads as a failure of the other two',
  );

  const NORMAL = [
    { what: 'that all three are ordinary results', re: /\bnormal\b|\bordinary\b/i },
    { what: 'and the third of them', re: /\bNothing\b/ },
  ];
  assert.ok(
    carriedTogether(match, NORMAL),
    'three outcomes with one of them marked as the failure is a two-outcome decision',
  );
});

test('the reference sends the Teacher to the assets and to each head comment', () => {
  const { match } = deriving();

  const READS = [
    { what: "the Workspace's own assets directory", re: /assets\// },
    { what: "each Component's head comment", re: /head comment/i },
    { what: 'that the comment is the copy that cannot drift from the code', re: /drift|cannot be wrong|only list/i },
  ];

  assert.deepEqual(
    absentFrom(READS, match),
    [],
    'a Teacher that does not read the directory is deciding against a list of what shipped once',
  );
});

test('no line pairs a Component with its files, which is what the removed column was', () => {
  const { whole } = deriving();

  // The shipped-Components table carried a `Files` column — a Component's
  // script and its stylesheet, side by side, in one row. That is the second
  // copy the ticket removed: the head comment beside the code is the first, and
  // it is the one that cannot drift. So the shape is forbidden rather than the
  // table it sat in.
  //
  // Read against this section rather than the document, and that bound is the
  // honest one. Elsewhere a paragraph naming both files of a Component is an
  // author being told what to type — the Checkpoint page links two stylesheets
  // and loads two scripts — which is instruction rather than a catalog. What
  // the bound costs is recorded under "What is deliberately not tested".
  //
  // Markup is exempt for the same reason, and the page skeleton is markup. It
  // is recognised by the tag brackets alone — the same shape `skill-spine.js`
  // reads an offer with — and an `assets/…` path may not be part of that test
  // here, because the pairs this check is looking for are made of those paths.
  const bothFilesOf = (text) => {
    const named = [...text.matchAll(/assets\/([\w-]+)\.(js|css)/g)].map(([, name, ext]) => ({ name, ext }));
    return named
      .filter(({ name, ext }) => ext === 'js' && named.some((o) => o.name === name && o.ext === 'css'))
      .map(({ name }) => name);
  };

  // Guard the observer on the row as it was written, which is the one shape
  // this is about: a reader that saw no pair would report none anywhere.
  assert.deepEqual(
    bothFilesOf('| **Exercise** | `assets/exercise.js` + `assets/exercise.css` | Checking a concept |'),
    ['exercise'],
    'this check cannot see the column it exists to forbid',
  );

  const pairs = linesOf(whole)
    .filter((text) => !isMarkup(text))
    .filter((text) => bothFilesOf(text).length > 0)
    .map((text) => text.trim());

  assert.deepEqual(pairs, [], 'a Component and its files listed together is the catalog coming back');
});

test('the anti-pattern list is present, and names each form it rules out', () => {
  const { antipatterns } = deriving();

  assert.deepEqual(
    absentFrom(ANTIPATTERNS, antipatterns),
    [],
    'these are the forms this genre is known for; a list that omits one recommends it by silence',
  );

  // Each with its reason. A banned shape whose reason is missing is one a
  // Session routes around the first time it is inconvenient — the same argument
  // the imagery bans are written under.
  const items = namedBullets(antipatterns);

  assert.ok(items.length >= ANTIPATTERNS.length, `expected one item per form, found ${items.length}`);

  // Length is the proxy, and the floor lives beside the reader that finds these
  // — the simulation check asks the same question of its own named list, and a
  // threshold kept in two places is one the two can disagree about.
  const unargued = items.filter((text) => text.length < ROOM_FOR_A_REASON);
  assert.deepEqual(unargued, [], 'each of these names a form with no room for a reason after it');
});

test('the derivations replaced the five moves rather than restating them', () => {
  // The moves were a list of shapes to aim at — interaction before explanation,
  // predict then reveal, show the process, sandbox at the end, progressive
  // disclosure — with nothing attached saying when a passage earns one. Where a
  // move survives it survives as a derivation, with a trigger question in front
  // of it, and every ordered entry in that part is held to all four fields
  // above. What is left is the header they arrived under.
  const MOVES = [
    { what: 'the count', re: /\bfive moves\b/i },
    { what: 'the sandbox move', re: /\*\*Sandbox at the end\.\*\*/ },
    { what: 'the disclosure move', re: /\*\*Progressive disclosure\.\*\*/ },
  ];

  // Guard the observer on the list as it was written, for the reason the two
  // tables above are guarded: these patterns match nothing in the document now,
  // so without a control a typo in one of them passes for ever.
  const AS_LISTED = [
    'Five moves, inspired by Bret Victor, Nicky Case, and Bartosz Ciechanowski:',
    '4. **Sandbox at the end.** Leave a space for free exploration.',
    '5. **Progressive disclosure.** One concept at a time; each interaction adds one layer.',
  ].join('\n');

  assert.equal(
    MOVES.filter((m) => m.re.test(AS_LISTED)).length,
    MOVES.length,
    'this check can no longer see the list of moves it exists to forbid',
  );

  assert.deepEqual(
    MOVES.filter((m) => m.re.test(UNIT)).map((m) => m.what),
    [],
    'a move with no trigger question is a shape to aim at, which is what the gates exist to stop',
  );
});
