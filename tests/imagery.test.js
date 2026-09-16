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
const { foldedDoc, absentFrom, carriedTogether, oneSection, SKILL_DIR } = require('./helpers/docs.js');
const { mediaTypes } = require('./helpers/tutor.js');

// Every document here is read with its hard wrapping folded back out, through
// the shared reader, because every claim below is about a sentence rather than
// a line — and because folding makes one logical line one line of the string,
// which is what lets a check require several patterns to arrive *together*.
const UNIT = foldedDoc(SKILL_DIR, 'UNIT.md');

/**
 * The one section that owns imagery, and the part of it before the first
 * subsection — where the rule and its reason are stated.
 */
function imagery() {
  const whole = oneSection(UNIT, 2, /draw the diagram/i, 'when to draw and when to borrow');

  return { whole, rule: whole.split(/^###\s+/m)[0] };
}

/** One subsection of it, found in the document the section sits in. */
const part = (re, what) => oneSection(UNIT, 3, re, `imagery ${what}`);

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

/**
 * What a diagram built from elements is worth, and a canvas is not. All four
 * are properties of the thing *after* it is written, which is what makes this a
 * rule rather than a preference: the same picture, built the other way, loses
 * every one of them and nothing is gained back.
 */
const WORTH = [
  { what: 'labelled', re: /labelled/i },
  { what: 'focusable', re: /focus/i },
  { what: 'reachable by keyboard', re: /keyboard/i },
  { what: 'readable by assistive technology', re: /assistive/i },
  { what: 'inspectable by the page pass', re: /inspectab/i },
];

/**
 * The cases a canvas or a renderer is genuinely for. Named, because "when
 * elements cannot express it" is a judgement an author makes in the direction
 * of whatever it already knows how to build.
 */
const WARRANTS_A_CANVAS = [
  { what: 'continuous curves', re: /continuous curve/i },
  { what: 'particles', re: /particle/i },
  { what: 'real three-dimensional geometry', re: /three-dimensional geometry/i },
  { what: 'large data', re: /too large|large data/i },
];

/**
 * What markup and styles draw natively. This list is the difference between a
 * rule and an aspiration: an author told to prefer elements and given no idea
 * what elements can draw reaches for the canvas it already knows.
 */
const NATIVELY = [
  { what: 'gradients, for dials, sweeps and spectra', re: /conic-gradient|linear-gradient/ },
  { what: 'grid, for matrices, layouts and boards', re: /display: grid/ },
  { what: 'transforms, for pseudo-three-dimensional views', re: /perspective|rotate3d/ },
  { what: 'clipping, for cutaways and reveals', re: /clip-path/ },
  { what: 'native disclosure, for progressive reveal with no script', re: /<details>|<summary>/ },
  { what: 'a range bound to a custom property', re: /type="range"/ },
  { what: 'the semantic elements for tables, progress and measured quantities', re: /<meter>|<progress>/ },
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
    // Not redistribution any more. The reason licensing gave was never the one
    // that mattered for teaching: a paper figure establishes its axes, units
    // and conditions in the surrounding text, so the crop cannot be proofed
    // against the claim the Lesson would be making for it.
    because: /cannot be proofed|surrounding text|axes/i,
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

test('the decision point states a finding and a question, and no default', () => {
  const { rule } = imagery();

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

  // This assertion is the inverse of the one it replaced, and the reversal is
  // the finding behind it. `Default to drawing` was stated here for two
  // releases, and across six courses four Lessons shipped with no picture at
  // all: an encouragement at a decision point is still an answer supplied
  // before the question, and this one sat in front of 128 lines of ceiling,
  // mitigation and ban that priced the decision it was encouraging. The
  // literature finding stays — it is not in the material and not reliably in
  // recall — but it is stated as a finding, and what a passage earns is the
  // passage's to say.
  const DEFAULTS = /\bdefault(?:s|ing)? to\b|\bby default\b|\balways (?:draw|borrow)\b|\bprefer (?:drawing|to draw)\b/i;

  assert.ok(DEFAULTS.test('Default to drawing. Write the diagram yourself.'), 'this check cannot see the default it removed');
  assert.ok(!DEFAULTS.test('One question decides who makes it.'), 'this check reads the question as a default');

  assert.deepEqual(
    rule.split('\n').filter((line) => DEFAULTS.test(line)),
    [],
    'the decision is the Teacher\'s; a default here answers it before the passage is read',
  );
});

test('the borrowed image is proofed against a written claim, part by part', () => {
  const proofing = part(/proof/i, 'proofing-a-borrowed-image');

  // The order is the whole procedure. A claim written after the image arrives
  // is a caption for whatever arrived, and captions check nothing — so the
  // document has to say which comes first, not merely that both exist.
  assert.ok(
    carriedTogether(proofing, [{ re: /claim/i }, { re: /first|before/i }, { re: /prose|sentence/i }]),
    'without writing the claim first, proofing is describing whatever turned up',
  );

  // The failure is a right-kind-of-thing that is the wrong one, and it is
  // named concretely because "check the image is correct" is advice an agent
  // satisfies by looking at the image again.
  assert.ok(
    carriedTogether(proofing, [{ re: /wrong|United Kingdom|China/i }, { re: /\bkind\b/i }]),
    'the failure is not the wrong kind of image, it is the right kind and the wrong one',
  );

  assert.match(
    proofing,
    /part by part|noun/i,
    'checking the whole image against the whole claim is the check that passes on a near miss',
  );

  assert.match(
    proofing,
    /weaken the claim|drop the image/i,
    'an image doing most of what the sentence says needs a stated outcome, or it ships',
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

test('a diagram is built from elements before anything is drawn into a canvas', () => {
  const elements = part(/canvas/i, 'elements-before-a-canvas');

  // A rule rather than a preference, and said so. "Prefer elements" is advice,
  // and advice loses to whichever form the author already knows how to write.
  assert.ok(
    carriedTogether(elements, [{ re: /\brule\b/i }, { re: /preference|taste/i }]),
    'stated as a preference this loses every time to the form the author already knows',
  );

  assert.deepEqual(
    absentFrom(WORTH, elements),
    [],
    'these are what the rule buys, and a rule whose payment is unstated is one nobody weighs',
  );

  // What a canvas costs, in the one currency this document keeps accounts in:
  // the page pass supports exactly one check over it — whether anything was
  // drawn at all — and that has to arrive beside the canvas rather than
  // somewhere in the section.
  assert.ok(
    carriedTogether(elements, [{ re: /canvas/i }, { re: /\bonly\b/i }, { re: /drawn at all|anything was drawn/i }]),
    'the cost of a canvas is that one check is all it can ever support; that is the sentence',
  );

  assert.deepEqual(
    absentFrom(WARRANTS_A_CANVAS, elements),
    [],
    'a rule with no escape hatch named is one an author takes without saying so',
  );
});

test('and the list of what markup and styles draw natively is concrete enough to act on', () => {
  const elements = part(/canvas/i, 'elements-before-a-canvas');

  assert.deepEqual(
    absentFrom(NATIVELY, elements),
    [],
    'told to prefer elements and shown none, an author reaches for the canvas it already knows',
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

test('the source line is written into the page beside the image', () => {
  const looked = part(/looked at/i, 'rendered-and-looked-at');

  assert.ok(
    carriedTogether(looked, [
      { re: /source line/i },
      { re: /beside/i },
      { re: /rather than|not into|never into/i },
    ]),
    'the note saying what this image was believed to show cannot get separated from the image',
  );

  // What the line is *for*, because a line written as a courtesy is the first
  // thing dropped and the only thing a later Session has to re-check against.
  assert.ok(
    carriedTogether(looked, [{ re: /re-check|recheck/i }, { re: /later Session|Session/i }]),
    'the source line serves a later re-check; stated as a courtesy it is decoration',
  );

  // Licensing is deliberately not an obligation here: a Workspace is one
  // learner's private directory, and the reference said "read the licence
  // before you download" across twelve mentions that priced borrowing without
  // protecting the one thing that actually goes wrong — an image that is not of
  // what the prose says. Publication is the case that does acquire the
  // obligation, so the document says whose it is rather than going quiet.
  const { whole } = imagery();
  assert.ok(
    carriedTogether(whole, [{ re: /publish/i }, { re: /licen[cs]/i }]),
    'dropping the licensing rule has to say where the obligation went, not merely delete it',
  );
  assert.deepEqual(
    whole.split('\n').filter((line) => /read the licen|permits reproduction|licence you\s+cannot find/i.test(line)),
    [],
    'the licensing obligation is gone from the authoring path; only publication carries it',
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
  // whole suite exists for. The reading is shared with `tutor-server.test.js`,
  // which asks the other end of the same question; it throws rather than
  // handing back an empty table.
  const served = mediaTypes()
    .filter((m) => m.type.startsWith('image/'))
    .map((m) => m.ext);

  // Guard the observer: the reader can find a table and this filter still find
  // no picture in it, and every assertion below would pass by having nothing to
  // require.
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
  const record = oneSection(decisions, 2, /draw the diagram|imagery/i, 'decisions-record entry for imagery');

  const REASONS = [
    { what: 'that drawing is the default', re: /default/i },
    { what: 'the test for when to borrow instead', re: /claim about how reality looks|fabricat/i },
    { what: 'that a drawing risks rendering rather than meaning', re: /verifiab/i },
    { what: 'that no image ships unlooked-at', re: /looked at/i },
    { what: 'that the credit lives in the page', re: /credit/i },
    { what: 'the ceiling, and that the failure past it is geometric', re: /geometric/i },
  ];

  assert.deepEqual(
    absentFrom(REASONS, record),
    [],
    'the record keeps the decision but has dropped what argued for it',
  );
});
