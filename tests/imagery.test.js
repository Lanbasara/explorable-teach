'use strict';

// What this holds, and why the checks are shaped the way they are:
// `docs/agents/tests.md`, "The imagery check".
//
// The complaint, in the words of the ticket: Lessons contain almost no images —
// "nothing forbids them, there is simply no guidance" — and this is the
// costliest of the gaps, because an annotated static diagram beside prose is
// the most consistently effective format in the whole instructional literature.
// A rule that is absent is obeyed by nobody, so the fix is a rule, and these
// are checks about whether that rule is still *stated* — the same kind of
// subject `from-disk.test.js` has, and for the same reason: the material is a
// claim rather than a placement.
//
// Two halves of it are load-bearing and are checked as such. The *reason* for
// drawing by default, because a default without one reads as timidity and gets
// overridden by the first Teacher who wants a photograph. And the reason under
// each ban, because a ban whose reason is missing is a rule an agent routes
// around the moment it seems inconvenient.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { REPO_ROOT } = require('./helpers/workspace.js');
const { foldedDoc, SKILL_DIR } = require('./helpers/docs.js');
const { sections } = require('./helpers/markdown.js');

// Every document here is read with its hard wrapping folded back out, through
// the shared reader, because every claim below is about a sentence rather than
// a line — and because folding makes one logical line one line of the string,
// which is what lets a check require several patterns to arrive *together*.
const UNIT = foldedDoc(SKILL_DIR, 'UNIT.md');

/** Every entry of `list` whose pattern is absent from `text`, named. */
const absentFrom = (list, text) => list.filter((e) => !e.re.test(text)).map((e) => e.what);

/** True when one logical line of `text` carries every pattern in `list`. */
const carriedTogether = (text, list) =>
  text.split('\n').some((line) => list.every((e) => e.re.test(line)));

/**
 * The one section that owns imagery, and the part of it before the first
 * subsection — where the rule and its reason are stated.
 */
function imagery() {
  const found = sections(UNIT, 2).filter((s) => /draw the diagram/i.test(s.title));

  assert.equal(
    found.length,
    1,
    'the authoring reference should say when to draw and when to borrow, in exactly one section',
  );

  return { whole: found[0].body, rule: found[0].body.split(/^###\s+/m)[0] };
}

/**
 * One subsection of it, bounded at the next heading of *any* level.
 *
 * `sections` runs a body to the next heading at the level it was asked for, so
 * the last subsection of a section bleeds into whatever follows the section
 * itself — here, the whole of the Component selection guide down to its first
 * subsection, which is material these checks make no claim about and could
 * match a pattern in by accident.
 */
function part(re, what) {
  const found = sections(UNIT, 3).filter((s) => re.test(s.title));

  assert.equal(found.length, 1, `the imagery section should carry exactly one ${what} subsection`);
  return found[0].body.split(/^#{1,2} /m)[0];
}

/**
 * The borrow test's categories: the cases where a drawing would be a claim
 * about how reality looks, so drawing it is fabricating it. Named rather than
 * gestured at, because "borrow when a drawing would be a fabrication" is a
 * judgement an author makes in the direction of whatever is easiest to find.
 */
const CATEGORIES = [
  { what: 'photographs of real apparatus and instruments', re: /apparatus|instrument/i },
  { what: 'historical documents and artefacts', re: /historical/i },
  { what: 'microscopy and medical imaging', re: /microscop|medical imaging/i },
  { what: 'astronomical and remote-sensing imagery', re: /astronomic|remote[- ]sensing/i },
  { what: 'organisms and mineral specimens', re: /organism|mineral|specimen/i },
  { what: 'works of art under discussion', re: /works? of art/i },
  { what: 'real instances of a phenomenon', re: /real instance|phenomenon/i },
];

/**
 * The reason the default is what it is. Stated because a default whose argument
 * is missing reads as caution about the Teacher's drawing ability, which is not
 * the claim: the claim is about which question a look at the page can answer.
 */
const REASON = [
  { what: 'the Teacher already knows what the diagram has to say', re: /already know/i },
  { what: 'so the only open question left is whether it rendered legibly', re: /legib/i },
  { what: 'while a borrowed image poses the question of whether it depicts what is claimed', re: /depict/i },
  // One spelling, not three. The alternation this started as offered two
  // wordings no document has ever used, which is the "never give a pointer a
  // list of roots to try" mistake made about a pattern: the guard is supposed
  // to track the document, and fail on the day the document stops saying it.
  { what: 'and a look at the page answers that one badly', re: /badly/i },
];

/** The four bans, each beside the reason that makes it more than a preference. */
const BANS = [
  {
    what: 'generated imagery standing in for an explanatory diagram',
    re: /generat\w+ (?:imagery|image|diagram)/i,
    because: /symbolic representation|nothing (?:can|could) check/i,
  },
  {
    what: 'generated decorative art and stock photography',
    re: /stock photograph/i,
    because: /measured negative|seductive/i,
  },
  {
    what: 'figures lifted out of paper repositories',
    re: /paper repositor|arxiv/i,
    because: /redistribut/i,
  },
  {
    what: 'a diagram service that renders server-side',
    re: /server-side|renders? on a server/i,
    because: /third part/i,
  },
];

/**
 * The mitigations that buy back the headroom under the ceiling. Every one of
 * them removes a way for a label to be wider than the author guessed, which is
 * the only failure this class of diagram has.
 */
const MITIGATIONS = [
  { what: 'snap to a coarse grid', re: /coarse grid/i },
  { what: 'draw box sizes from a small fixed set', re: /fixed set/i },
  { what: 'label in a monospace font so character count estimates width', re: /monospace/i },
  { what: 'leave generous padding', re: /padding/i },
  { what: 'cap label length', re: /cap(?:ped)? (?:the )?label|label length/i },
  { what: 'mirror the semantic content into the markup', re: /mirror/i },
];

test('the authoring reference states the draw-by-default rule and the borrow test', () => {
  const { rule } = imagery();

  assert.match(rule, /default to draw/i, 'the default has to be stated as the default');
  assert.match(
    rule,
    /claim about how reality looks/i,
    'the borrow test is one question; without it "borrow when it makes sense" is the rule',
  );

  assert.deepEqual(
    absentFrom(CATEGORIES, rule),
    [],
    'an unnamed category is one the Teacher decides by appetite, which is the failure here',
  );
});

test('and states why the default is what it is, rather than only that it is', () => {
  const { rule } = imagery();

  assert.deepEqual(
    absentFrom(REASON, rule),
    [],
    'a default nobody argued for is a default the next Session overrides without noticing',
  );

  // The conclusion, in one logical line: drawing trades an unverifiable risk
  // for a verifiable one. Both words somewhere in the section would be
  // satisfied by the section merely using them — the sentence is the argument.
  assert.ok(
    carriedTogether(rule, [{ re: /unverifiab\w+/i }, { re: /(?<!un)verifiab\w+/i }]),
    'the two risks have to meet in one sentence; that trade is the whole reason for the default',
  );
});

test('no image ships in a Lesson that has not been rendered and looked at', () => {
  const looked = part(/looked at/i, 'rendered-and-looked-at');

  assert.match(
    looked,
    /rendered and looked at/i,
    'this is the one rule both paths are held to, so it is stated as one rule',
  );
  assert.match(
    looked,
    /#look-at-the-page/,
    'the pass that does the looking already exists; this rule points at it rather than restating it',
  );

  // A borrowed image is in the Workspace *before* it is looked at. Both halves
  // in one sentence: the download is what makes looking possible, and a
  // document that mentions downloading somewhere else has not said that.
  assert.ok(
    carriedTogether(looked, [{ re: /download/i }, { re: /\bfirst\b|\bbefore\b/i }]),
    'an image that was never fetched cannot be looked at, and hotlinking is not reproduction',
  );
});

test('the credit is written into the page beside the image, with the licence as a link', () => {
  const looked = part(/looked at/i, 'rendered-and-looked-at');

  assert.ok(
    carriedTogether(looked, [
      { re: /credit/i },
      { re: /beside/i },
      { re: /rather than|not into|never into/i },
    ]),
    'a credit in a file alongside the page is a credit that gets separated from what it credits',
  );

  // The licence is a link a Learner can follow, which means the document has to
  // show one. A sentence saying "link the licence" is advice; the markup is the
  // thing an author copies.
  assert.ok(
    carriedTogether(looked, [{ re: /licen[cs]e/i }, { re: /<a href="https:/ }]),
    'the licence has to be a real link in the page, so the credit example has to carry one',
  );
});

test('each of the four bans is stated with the reason it is a ban', () => {
  const banned = part(/banned/i, 'banned-outright');

  const stated = BANS.filter((b) => b.re.test(banned)).map((b) => b.what);
  assert.deepEqual(
    BANS.map((b) => b.what).filter((w) => !stated.includes(w)),
    [],
    'these are banned and the document no longer says so',
  );

  // Each reason beside its own ban, not somewhere in the subsection. A reason
  // that has drifted off its ban is a reason nobody reads while deciding.
  const unreasoned = BANS.filter(
    (b) => !carriedTogether(banned, [{ re: b.re }, { re: b.because }]),
  ).map((b) => b.what);

  assert.deepEqual(
    unreasoned,
    [],
    'a ban whose reason is missing is a rule an agent routes around the first time it is inconvenient',
  );
});

test('the hand-drawn ceiling hands over to a layout engine, and says what goes wrong past it', () => {
  const ceiling = part(/hand-drawn/i, 'complexity-ceiling');

  assert.match(ceiling, /ceiling/i, 'the bound has to be nameable to be remembered');
  assert.match(
    ceiling,
    /layout engine|layout library/i,
    'past the ceiling something else places the boxes; a ceiling with nothing beyond it is a ban',
  );

  // The mechanism, in one logical line. It is stated because it is what makes
  // the ceiling memorable — the failure is geometric rather than semantic, so
  // knowing what the diagram must say buys no protection against it at all.
  assert.ok(
    carriedTogether(ceiling, [
      { re: /geometric/i },
      { re: /semantic/i },
      { re: /how wide|width/i },
    ]),
    'the reason a correct diagram still renders wrong is one sentence, and it has to be one sentence',
  );

  assert.deepEqual(
    absentFrom(MITIGATIONS, ceiling),
    [],
    'the ceiling is only bearable because these buy headroom under it',
  );
});

test('a borrowed image is saved in a format the Tutor service will actually serve', () => {
  // Read the formats off the service rather than restating them. A document
  // that names `.webp` sends the Teacher to download one, and the page it lands
  // in answers 404 the moment it is served — which is the class of defect this
  // whole suite exists for.
  const server = fs.readFileSync(
    path.join(SKILL_DIR, 'runtime', 'tutor', 'server.js'),
    'utf8',
  );
  const table = /const MIME = \{([\s\S]*?)\n\};/.exec(server);
  assert.ok(table, "the service's MIME table is no longer where this check reads it");

  const served = [...table[1].matchAll(/'(\.\w+)':\s*'image\//g)].map((m) => m[1]);

  // Guard the observer: a table this stopped parsing would name no format, and
  // every assertion below would pass by having nothing to require.
  assert.ok(served.length >= 3, `expected the image formats the service serves, found ${served.length}`);

  const { whole } = imagery();
  const missing = served.filter((ext) => !whole.includes(ext));

  assert.deepEqual(
    missing,
    [],
    'the service serves these and the document does not offer them, which narrows an author for no reason',
  );

  // And the other direction: nothing offered that the service will not serve.
  //
  // This half has a floor, and it is worth knowing rather than discovering: the
  // formats it can recognise are a fixed list, so a document offering a format
  // nobody has named here yet passes. There is no registry of image formats to
  // read instead, which is why the list is written out — and why
  // `docs/agents/tests.md` records the gap in "what is deliberately not
  // tested" rather than leaving a green suite to imply more than it checked.
  const IMAGE_FORMATS = /\.(?:png|jpe?g|svg|webp|avif|gif|bmp|tiff?|heic)\b/gi;
  const offered = [...whole.matchAll(IMAGE_FORMATS)].map((m) => m[0].toLowerCase());
  const unserved = [...new Set(offered.filter((ext) => !served.includes(ext)))];

  assert.deepEqual(
    unserved,
    [],
    'an image in one of these renders from disk and 404s the moment the page is served',
  );
});

test('the directory a borrowed image is downloaded into is one the scaffold creates', () => {
  // The document names a destination, which makes it a promise about a
  // Workspace — the same shape as an `assets/…` path, which `assets.test.js`
  // holds against a scaffolded Workspace. This one is cheaper to hold from the
  // other end: read the destination out of the document and the directory list
  // out of the scaffold, so neither side is restated here.
  const { whole } = imagery();
  const named = [...new Set([...whole.matchAll(/`\.\/(\w+)\/`/g)].map((m) => m[1]))];

  // Guard the observer: a document that named no destination, or a pattern that
  // stopped finding one, would leave this check with nothing to require.
  assert.ok(named.length >= 1, 'the section should say where a borrowed image is downloaded to');

  const script = fs.readFileSync(path.join(REPO_ROOT, 'scripts', 'init-workspace.sh'), 'utf8');
  const list = /for d in ([^;]+); do/.exec(script);
  assert.ok(list, 'the scaffold no longer creates its directories where this check reads them');

  const created = list[1].trim().split(/\s+/);
  assert.ok(created.length >= 5, `expected the Workspace's directories, found ${created.length}`);

  assert.deepEqual(
    named.filter((dir) => !created.includes(dir)),
    [],
    'the Teacher is told to put an image somewhere the scaffold never made',
  );
});

test('the reasoning behind the rule is in the decisions record', () => {
  // The rule is what the Teacher reads; the argument for it is a maintainer's,
  // and an argument that leaves without being recorded is one a later
  // maintainer re-derives or reverses without knowing it.
  const decisions = foldedDoc(REPO_ROOT, 'docs', 'DECISIONS.md');
  const found = sections(decisions).filter((s) => /draw the diagram|imagery/i.test(s.title));

  // Exactly one, the way the section lookups above are exactly one. A `find`
  // here would quietly redirect the check at whichever entry matched first on
  // the day a later decision's title also mentions drawing.
  assert.equal(found.length, 1, 'the decisions record should carry the imagery decision, once');
  const record = found[0];

  const REASONS = [
    { what: 'that drawing is the default', re: /default/i },
    { what: 'the test for when to borrow instead', re: /claim about how reality looks|fabricat/i },
    { what: 'that a drawing risks rendering rather than meaning', re: /verifiab/i },
    { what: 'that no image ships unlooked-at', re: /looked at/i },
    { what: 'that the credit lives in the page', re: /credit/i },
    { what: 'the ceiling, and that the failure past it is geometric', re: /geometric/i },
  ];

  assert.deepEqual(
    absentFrom(REASONS, record.body),
    [],
    'the record keeps the decision but has dropped what argued for it',
  );
});
