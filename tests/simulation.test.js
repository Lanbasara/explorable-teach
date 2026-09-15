'use strict';

// What this holds, and why the checks are shaped the way they are:
// `docs/agents/tests.md`, "The simulation check".
//
// The hazard, in the words of the ticket: a page that "renders cleanly, passes
// every check, and depicts something **false**. No verification pass catches
// it." Nothing else in this suite can. Every other check here asks whether a
// document still says something or whether a Component still works; none of
// them reads what a number in a Lesson *means*, and a wrong orbital period is
// wrong in a page that is otherwise perfect.
//
// So what is checked is that the one procedure which can catch it is still
// written down, still names the four kinds of result that count as a check, and
// still sits where a Teacher about to build a run has to walk past it. The rule
// itself is the kind of thing a Session skips when the page is nearly done,
// which is why its placement is asserted rather than only its presence.

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { REPO_ROOT } = require('./helpers/workspace.js');
const {
  foldedDoc,
  absentFrom,
  carriedTogether,
  oneSection,
  orderedEntries,
  partTitles,
  namedBullets,
  ROOM_FOR_A_REASON,
  SKILL_DIR,
} = require('./helpers/docs.js');
const { anchorsIn } = require('./helpers/markdown.js');

/**
 * The authoring reference, folded, the way every document check here reads one:
 * prose in this repo is hard-wrapped, so a claim about what it *says* is a claim
 * about a sentence rather than about where a line break happened to fall.
 */
const UNIT = foldedDoc(SKILL_DIR, 'UNIT.md');

/** The anchor the rule is reachable at, spelled the way a link to it is. */
const ANCHOR = '#simulate-only-what-can-be-checked-against-a-known-good-result';

/** The section that owns the decision this rule constrains, and the rule itself. */
const derivingSection = () =>
  oneSection(UNIT, 2, /^deriving\b/i, 'deriving an interaction from the material');
const simulating = () => oneSection(UNIT, 3, /^simulate only\b/i, 'what a Lesson may simulate');

/**
 * The four kinds of known-good result that qualify.
 *
 * Named one by one rather than gestured at, for the reason the imagery check
 * names its borrow categories and the anti-pattern check names its forms:
 * "check it against something correct" is an instruction every author believes
 * it has already followed. Each of these is a specific artifact that either
 * exists for this subject or does not.
 */
const KINDS = [
  { what: 'a conserved quantity', re: /conserved quantit/i },
  { what: 'a closed-form solution', re: /closed[- ]form/i },
  { what: 'a published worked example with a stated answer', re: /worked example/i },
  { what: 'a reference implementation to compare against step by step', re: /reference implementation/i },
];

/** The interaction the no-check case is allowed, as the three forms of it. */
const PACING = [
  { what: 'stepping', re: /\bstepping\b/i },
  { what: 'scrubbing', re: /\bscrub/i },
  { what: 'revealing', re: /\brevealing\b/i },
];

test('a page that depicts something real is checked against a known-good result', () => {
  const section = simulating();

  // One logical line, which is one paragraph. The requirement and the moment it
  // happens at are the same claim: a check run after the Lesson is handed over
  // is a check nobody runs, and "verify your simulation" with no *when* on it is
  // the shape this rule exists instead of.
  const REQUIREMENT = [
    { what: 'that this is about a page depicting something real', re: /\breal\b|\breality\b/i },
    { what: 'that it is checked against a known-good result', re: /known-good/i },
    { what: 'and that the check happens while the Lesson is being authored', re: /author/i },
  ];

  assert.ok(
    carriedTogether(section, REQUIREMENT),
    'a requirement with no moment attached is one that happens after the page ships, which is never' +
      `; absent from the section: ${absentFrom(REQUIREMENT, section).join(', ') || 'none'}`,
  );

  // The hazard, stated. Without it the rule reads as belt-and-braces beside a
  // dozen checks that already pass, rather than as the only one of them that
  // can see this defect at all.
  const HAZARD = [
    { what: 'a page that passes every check there is', re: /passe?s?\b[^.]*\bcheck/i },
    { what: 'and depicts something false anyway', re: /\bfalse\b/i },
  ];

  assert.ok(
    carriedTogether(section, HAZARD),
    'the reason this rule is not redundant is that nothing else here can catch what it catches' +
      `; absent from the section: ${absentFrom(HAZARD, section).join(', ') || 'none'}`,
  );

  // And the check leaves a trace. This is the line in this body of work most
  // likely to be skipped quietly, so skipping it has to be visible: an entry
  // that names no known-good result is a run nobody checked.
  assert.match(
    section,
    /TECH-STACK\.md/,
    'a check with nothing written down is indistinguishable from a check nobody ran',
  );
});

test('the four kinds that qualify are each named, with what each one buys', () => {
  const section = simulating();

  assert.deepEqual(
    absentFrom(KINDS, section),
    [],
    'a kind the document does not name is one a Teacher concludes its subject does not have',
  );

  const items = namedBullets(section);
  assert.ok(items.length >= KINDS.length, `expected one item per kind, found ${items.length}`);

  // Length is the proxy, and both the reader and the floor are the anti-pattern
  // check's: the question is the same one — a named member with no room after it
  // for what to do with it — so the two ask it the same way or they drift apart.
  // What it catches here is four bare names, which is a taxonomy of things an
  // author cannot tell whether its subject has.
  const unargued = items.filter((text) => text.length < ROOM_FOR_A_REASON);
  assert.deepEqual(unargued, [], 'each of these names a kind with no room to say what checking against it looks like');

  // The fourth is the one the ticket calls most easily overlooked, and it is
  // only a check if the comparison is step by step: two implementations
  // agreeing at the end can disagree about everything in between, and the
  // in-between is what a Lesson about an algorithm teaches.
  assert.ok(
    carriedTogether(section, [{ re: /reference implementation/i }, { re: /step by step|every step/i }]),
    'a reference implementation compared only at its output checks the answer and not the explanation',
  );
  assert.match(section, /overlook/i, 'the kind that covers an algorithm is the one a Teacher does not think of');
});

test('where the subject admits no such check, the answer is not to simulate', () => {
  const section = simulating();

  // One logical line again, and for a sharper reason than usual: the prohibition
  // and what to do instead have to arrive together, because a Teacher who reads
  // only the first half has a passage it has been told not to build and no
  // sanctioned way to teach it — and will build it.
  const NO_CHECK = [
    { what: 'the case where the subject admits no check', re: /admits no|\bno such check\b/i },
    { what: 'that a simulation is not built', re: /(?:do not|don't|never)\s+simulat/i },
    { what: 'that the facts are stated with a citation', re: /citation/i },
    { what: 'that they are drawn', re: /\bdraw/i },
    { what: 'and that the interaction is limited to pacing', re: /pacing/i },
  ];

  assert.ok(
    carriedTogether(section, NO_CHECK),
    'a prohibition with no sanctioned form beside it is a prohibition an author works around' +
      `; absent from the section: ${absentFrom(NO_CHECK, section).join(', ') || 'none'}`,
  );

  assert.deepEqual(
    absentFrom(PACING, section),
    [],
    'pacing with no forms named is a word, and the forms are what an author is allowed to build',
  );

  // The distinction that makes the substitute honest rather than a lesser
  // version of the same thing: the Learner is moved through content that was
  // *asserted* by a source, not through content the page *computed*.
  assert.ok(
    carriedTogether(section, [{ re: /asserted/i }, { re: /computed/i }]),
    'without this the substitute reads as a cheaper simulation rather than a different claim',
  );

  assert.match(
    section,
    /protocol|biological/i,
    'a subject with no invariant needs naming, or the case reads as hypothetical and applies to nothing',
  );
});

test('what an engine does and does not buy is stated, so the rule is not read as a library choice', () => {
  const section = simulating();

  const ENGINE = [
    { what: 'that an engine buys solver stability', re: /stabilit/i },
    { what: 'the failures it rules out', re: /tunnell?ing|integration step/i },
    { what: 'that it does not buy physical truth', re: /physical truth/i },
    { what: "that the mapping to units, scale and timestep stays the author's", re: /timestep/i },
    { what: 'the defect an engine would have caught', re: /\bkart\b|off the track/i },
    { what: 'and the defect it would not', re: /orbital period/i },
    { what: 'that choosing a better library does not answer this', re: /better librar/i },
  ];

  assert.deepEqual(
    absentFrom(ENGINE, section),
    [],
    'stated without this, the rule reads as a problem a well-chosen dependency already solved',
  );

  // Both halves in one breath. Said apart, the first is read as the answer and
  // the second as a caveat — which is the reading this paragraph exists to
  // prevent, since it is the reading the genre's most praised example took.
  assert.ok(
    carriedTogether(section, [{ re: /engine/i }, { re: /stabilit/i }, { re: /truth/i }]),
    'what an engine buys and what it does not have to be the same sentence',
  );
});

test('the cheapest version is tied back to this, in both directions', () => {
  const section = simulating();

  // The derivations each carry the cheapest version that still teaches, and this
  // is the argument that turns it from a concession into the honest choice: a run
  // computed while authoring is a run that *can* be checked, and a recording
  // cannot diverge on hardware the Teacher will never see.
  const CHEAPEST = [
    { what: 'the cheapest version of a run', re: /cheapest/i },
    { what: 'that computing it while authoring is what makes it checkable', re: /while authoring|authoring[- ]time/i },
    { what: 'that it cannot diverge or blow up', re: /diverge|blow up/i },
    { what: "and that where it would have is the Learner's browser", re: /browser/i },
  ];

  assert.ok(
    carriedTogether(section, CHEAPEST),
    'the cheap version read as a concession is the one an author upgrades away from first' +
      `; absent from the section: ${absentFrom(CHEAPEST, section).join(', ') || 'none'}`,
  );

  // Guarded the way the rule's own anchor is, and for the same reason: a link at
  // a heading that is not there lands its reader at the top of the document.
  assert.ok(anchorsIn(UNIT).has('the-derivations'), 'the derivations are not reachable at that anchor');
  assert.ok(
    section.includes('#the-derivations'),
    'the cheapest-version line lives in the derivations, and this argument is about it',
  );
});

test('a Teacher choosing to build a run cannot miss the rule', () => {
  const whole = derivingSection();

  // Guard the links below: an anchor nobody can reach is a pointer that lands
  // its reader at the top of the document and leaves them to search.
  assert.ok(anchorsIn(UNIT).has(ANCHOR.slice(1)), 'the rule is not reachable at the anchor written for it');

  // Placement is the claim. The rule constrains what the derivations are allowed
  // to output, so it follows them — and it is read before the description is
  // priced against what the Workspace has, because a run with no known-good
  // result is not a description to go shopping with.
  const parts = partTitles(whole);

  assert.ok(parts.length >= 5, `expected the section's parts, found ${parts.length}`);

  const at = (re) => parts.findIndex((title) => re.test(title));
  assert.ok(at(/^simulate only\b/i) > at(/^the derivations$/i), 'the rule constrains what the derivations output');
  assert.ok(at(/^simulate only\b/i) < at(/reuse, build/i), 'and is read before a description is priced');

  // Then the two doors into building one. A derivation whose output is something
  // the page **computes** is the first, and it is where the decision is
  // actually taken.
  //
  // Read as *computed* rather than as *a run*, which is wider than it first
  // looks and deliberately so: the derivation that has the Learner set a number
  // and watch the claim change computes that claim every bit as much as a
  // simulation does, and a rule that reached only the two entries saying "run"
  // would leave the commonest live computation in a Lesson outside it. So the
  // three that name a precomputed run, a simulation or a number the claim
  // depends on are the ones held here.
  const derivations = oneSection(whole, 3, /^the derivations$/i, 'derivations');
  const offering = orderedEntries(derivations).filter((e) => /precomputed|simulat|\bnumber\b/i.test(e.text));

  // Guard the observer: a reader that recognised no entry would find nothing
  // unlinked and pass this for free.
  assert.ok(offering.length >= 3, `expected the derivations that compute something, found ${offering.length}`);

  const unlinked = offering.filter((e) => !e.text.includes(ANCHOR)).map((e) => `derivation ${e.n}`);
  assert.deepEqual(
    unlinked,
    [],
    'a derivation offering a run with the rule nowhere beside it is where the rule gets skipped',
  );

  // And the second door: the procedure for building a Component for this
  // subject, which is what a Teacher reads once it has decided to build one.
  const building = oneSection(UNIT, 3, /^building a component/i, 'building a Component for this subject');
  assert.ok(
    building.includes(ANCHOR),
    'a Teacher that arrived here from the match has not necessarily read the rule',
  );
});

test('the file the check is recorded in has a column for it', () => {
  // The recording is what makes a skip conspicuous, and it is recorded into a
  // file the first run writes from a skeleton. A requirement to record
  // something into a template with no place for it is a requirement that
  // becomes a note at the bottom, and then nothing — so the skeleton carries
  // the column, and the table that has it is the one listing Components.
  const firstRun = foldedDoc(SKILL_DIR, 'FIRST-RUN.md');
  const rows = firstRun.split('\n').filter((line) => line.trim().startsWith('|'));

  // Guard the observer on the table as it is written: a reader that saw no row
  // would find no column missing from any of them.
  assert.ok(rows.length >= 3, `expected the skeleton's tables, found ${rows.length} rows`);

  // `Component` as a column of its own, which is the header of the table that
  // lists what the subject settled on. The deferred table beside it names a
  // Component *inside* a cell — "when it would earn a Component" — and it holds
  // things nobody has built, so it has nothing to have checked yet.
  const components = rows.filter((line) => /teaching act/i.test(line) && /\|\s*Component\s*\|/.test(line));
  assert.equal(components.length, 1, 'expected one header row for the Components the subject settled on');
  assert.match(
    components[0],
    /checked against/i,
    'a Component that computes something real has nowhere to name what it was checked against',
  );

  assert.ok(
    firstRun.includes(ANCHOR),
    'the column is only self-explanatory to somebody who has already read the rule',
  );

  // And it points rather than restating. The four kinds live in one document;
  // a second copy of them here is a copy that can drift, and this check would
  // not notice — which is the defect the removed Component table was.
  assert.deepEqual(
    absentFrom(KINDS, firstRun),
    KINDS.map((k) => k.what),
    'the kinds belong to the rule; naming them here is a second copy nothing holds to the first',
  );
});

test('the reasoning behind the rule is in the decisions record', () => {
  // The rule is what the Teacher reads; the argument for it is a maintainer's,
  // and this one will be argued with — it forbids a form that is fun to build
  // and pleasant to demonstrate. An argument that leaves without being recorded
  // is one a later maintainer reverses without knowing what it cost.
  const decisions = foldedDoc(REPO_ROOT, 'docs', 'DECISIONS.md');
  const record = oneSection(decisions, 2, /known-good result/i, 'decisions-record entry for this rule');

  const REASONS = [
    { what: 'the hazard no verification pass catches', re: /verification|nothing else/i },
    { what: 'the four kinds that count as a check', re: /four kinds/i },
    { what: 'what an engine buys and what it does not', re: /solver stability|physical truth/i },
    { what: 'the no-check case and what it gets instead', re: /pacing/i },
    { what: 'the authoring-time argument for the cheap version', re: /while authoring|authoring[- ]time/i },
    { what: 'and that the rule is placed so skipping it is conspicuous', re: /conspicuous|skipped/i },
  ];

  assert.deepEqual(
    absentFrom(REASONS, record),
    [],
    'the record keeps the decision but has dropped what argued for it',
  );
});
