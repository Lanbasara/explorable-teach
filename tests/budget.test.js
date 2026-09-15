'use strict';

// What this holds, and why the checks are shaped the way they are:
// `docs/agents/tests.md`, "The budget check".
//
// The complaint, in the words of the ticket: a Teacher "will spend the Session
// on the widget and hand over a Unit whose teaching was never written". Every
// rule that landed before this one *widened* what a Session may reach for — a
// library from a CDN, a diagram, a canvas, a run — and none of them said how
// much of it fits in one Session. So what is checked here is a number a Teacher
// can hold a description against before it starts building, the two recorded
// outcomes for a description that does not fit, and the one kind of work that
// may leave the Session at all.
//
// Two of these checks are about a claim arriving *with* something else rather
// than about a claim existing: the ceiling with its evidence, and the
// delegation with its verification. Both halves of each are load-bearing. A
// ceiling stated bare is read as timidity and applied to somebody else, and a
// hand-off with no verification attached is a Unit built by something that read
// none of this.

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

/** The spine, folded the same way — it is what sends a Session to the rule. */
const SKILL = foldedDoc(SKILL_DIR, 'SKILL.md');

/** The anchor the rule is reachable at, spelled the way a link to it is. */
const ANCHOR = '#what-one-session-can-build';

/** The section that owns the decision this rule constrains, and the rule itself. */
const derivingSection = () =>
  oneSection(UNIT, 2, /^deriving\b/i, 'deriving an interaction from the material');
const budget = () => oneSection(UNIT, 3, /^what one Session can build$/i, 'what one Session can build');

/**
 * The ceiling as an **artifact** rather than as a quantity the Session could
 * measure itself against. A token count or a line count is measurable and
 * wrong — it moves with the subject and the library — and the thing being
 * bounded is what the Teacher can actually picture before it starts.
 */
const CEILING = [
  { what: 'that this is the bound on one Session', re: /one Session/ },
  { what: "one screen's worth of interactive scene", re: /one screen'?s worth/i },
  { what: 'or one interaction with a single mechanic in it', re: /single mechanic/i },
  { what: 'and that anything larger is not what one Session produces', re: /larger than that/i },
];

/**
 * The evidence, which ships with the number rather than after it.
 *
 * The artifacts that appear to refute the ceiling are exactly the ones a
 * Teacher has in mind while deciding, so a ceiling stated bare is read as
 * timidity and applied to somebody else. Each of these is a specific,
 * checkable claim about what those artifacts are on inspection.
 */
const EVIDENCE = [
  { what: 'that they are full builds on inspection', re: /full builds?/i },
  { what: 'the commits behind them', re: /\bcommits\b/i },
  { what: 'the authored assets in them', re: /authored assets/i },
  { what: 'that a large share are not web pages at all', re: /not web pages/i },
  // Named, because an unattributed rate is exactly as unfalsifiable as the
  // ceiling it is there to make believable — and the Teacher it has to
  // convince is one that can go and look.
  { what: 'the practitioner the rate belongs to, by name', re: /Ciechanowski/ },
  { what: 'and the rate itself', re: /one to three\b/i },
];

/** The two outcomes for a description that does not fit. Both are legitimate. */
const OUTCOMES = [
  { what: 'taking the cheapest honest version of the form', re: /cheapest honest version/i },
  { what: 'converting the Session into one that builds the tool', re: /convert the Session/i },
];

/** What the written specification handed to a subagent has to contain. */
const SPECIFICATION = [
  { what: 'the teaching act it performs', re: /teaching act/i },
  { what: 'its inputs and outputs', re: /inputs and outputs/i },
  { what: 'its pinned dependency', re: /pinned dependency/i },
  { what: 'the constraints every Component here already carries', re: /constraints every Component/i },
];

test('the ceiling is stated as an artifact, and the evidence arrives with it', () => {
  const section = budget();

  assert.ok(
    carriedTogether(section, CEILING),
    'a ceiling said in pieces is one a Teacher assembles into whichever number suits the build' +
      `; absent from the section: ${absentFrom(CEILING, section).join(', ') || 'none'}`,
  );

  assert.ok(
    carriedTogether(section, EVIDENCE),
    'stated bare, the ceiling reads as timidity and is ignored by the Teacher it is addressed to' +
      `; absent from the section: ${absentFrom(EVIDENCE, section).join(', ') || 'none'}`,
  );

  // And what ignoring it costs, named. "Build something smaller" with no
  // consequence attached is advice; the consequence is that the Unit ships
  // with the part that was the point of it missing.
  assert.match(
    section,
    /teaching (?:was )?never written/i,
    'the failure this bound exists to prevent is a Unit whose teaching never got written',
  );
});

test('the size is judged before the building starts, not on running out of Session', () => {
  const section = budget();

  // One logical line. The judgement and the moment it happens at are the same
  // claim: "keep it small" with no *when* on it is a thing a Session agrees
  // with and then discovers it has overrun.
  const JUDGE = [
    { what: 'that it happens before a line of the thing exists', re: /before (?:a line|the building|you start|it starts)/i },
    { what: 'that the moment is where the match says Build', re: /\*\*Build\*\*/ },
    { what: 'and that the decision is made in the open', re: /in the open/i },
  ];

  assert.ok(
    carriedTogether(section, JUDGE),
    'a size judgement with no moment attached is one taken after the Session has run out' +
      `; absent from the section: ${absentFrom(JUDGE, section).join(', ') || 'none'}`,
  );
});

test('both outcomes are written, and the choice is recorded where the next Session reads it', () => {
  const section = budget();

  // Each as an item of its own, rather than as two halves of a sentence about
  // being pragmatic: what an author reads here is a choice between two things
  // it has to pick one of. So the outcomes are looked for *in the items* — a
  // count of items beside a search of the whole section passes on two unrelated
  // bullets and an outcome mentioned in a paragraph.
  const items = namedBullets(section);
  assert.ok(items.length >= OUTCOMES.length, `expected one item per outcome, found ${items.length}`);

  assert.deepEqual(
    OUTCOMES.filter((o) => !items.some((item) => o.re.test(item))).map((o) => o.what),
    [],
    'one outcome alone is either a rule that loses the tool the course needs, or a Curriculum that stops',
  );

  // Length is the proxy, and the floor is the one the anti-pattern and
  // known-good lists are held to: an outcome named with no room after it for
  // what taking it costs is one a Teacher cannot weigh against the other.
  const unargued = items.filter((text) => text.length < ROOM_FOR_A_REASON);
  assert.deepEqual(unargued, [], 'each of these names an outcome with no room to say what taking it means');

  // The recording is what separates a plan from an overrun. `CURRICULUM.md` is
  // the file, and the reason it is that file is that the next Boot sequence
  // reads it — both halves on one line, or the requirement reads as filing.
  const RECORDED = [
    { what: 'the file the choice is written into', re: /CURRICULUM\.md/ },
    { what: 'that the next Session reads it there', re: /next Session/i },
    { what: 'and that an unwritten choice is an overrun instead', re: /overrun/i },
  ];

  assert.ok(
    carriedTogether(section, RECORDED),
    'a decision recorded nowhere is one the next Session re-derives from nothing' +
      `; absent from the section: ${absentFrom(RECORDED, section).join(', ') || 'none'}`,
  );
});

test('one Unit per Session bends without being weakened', () => {
  const section = budget();

  // The rule this one is allowed to bend, still stated where the Teacher meets
  // it: the spine's, not a copy here. A bend in a rule that has gone soft is
  // not a bend.
  assert.match(
    SKILL,
    /One Unit is what one Session delivers/i,
    'the rule being bent is the spine\'s, and it has to still be there to bend',
  );

  // And the floor it ends on is worded in terms of what the *Unit* produced, so
  // a Session that delivered no Unit is not an exception to it. Without that,
  // the reading in the authoring reference is an exemption living in one file
  // while the spine says something unconditional in another.
  assert.match(
    SKILL,
    /Learning Record this Unit produced/,
    'a floor that asks for a Learning Record unconditionally is one a Tool Session has to break',
  );

  const PRESERVED = [
    { what: 'that the tool is delivered instead of the Unit', re: /instead of/i },
    { what: 'and never as well as it', re: /never as well as/i },
    { what: 'so that the bend is visible in the Workspace rather than silent', re: /\bsilent\b/i },
  ];

  assert.ok(
    carriedTogether(section, PRESERVED),
    'a Session delivering a tool *and* a Unit is the overrun this rule exists to stop' +
      `; absent from the section: ${absentFrom(PRESERVED, section).join(', ') || 'none'}`,
  );
});

test('the Curriculum has somewhere to put the choice, and the first run knows it', () => {
  // The recording is the whole of what makes a converted Session a plan rather
  // than an overrun, and it lands in a file whose shape the first run sets. A
  // requirement to record something into a document with no place for it is a
  // requirement that becomes a note at the bottom and then nothing — which is
  // the argument decision 41 made when it added a column to `TECH-STACK.md`.
  const firstRun = foldedDoc(SKILL_DIR, 'FIRST-RUN.md');

  const ROOM = [
    { what: 'the file the plan lives in', re: /CURRICULUM\.md/ },
    { what: 'that an entry of it need not be a Unit', re: /not every entry is a Unit/i },
    { what: 'and what such an entry says', re: /displaced|instead of the Unit/i },
  ];

  assert.deepEqual(
    absentFrom(ROOM, firstRun),
    [],
    'a Tool Session written into a list of Units has nowhere to be, so it becomes a note nobody reads',
  );

  // And the other door a Session builds through. Step 7 of the first run is
  // where the first Components get built, before any Unit has been written and
  // before the teaching loop has run once — so a bound reachable only from the
  // loop is one that Session never meets.
  const building = oneSection(firstRun, 2, /^\d+\. Build what the first Units need/i, 'the first run\'s build step');
  assert.ok(building.includes(ANCHOR), 'the first Session builds Components and never meets the bound');

  // It points rather than restating. A second copy of the ceiling one link from
  // the document that owns it is a copy that can drift, which is what the
  // Component table decision 39 removed was.
  //
  // The ceiling's *substance* rather than every pattern that finds it: the
  // first of those is `one Session`, which this document says in its own right
  // — the link to the bound is written with those words in it — so holding it
  // absent would be forbidding the pointer along with the copy.
  const COPIED = CEILING.slice(1).concat(EVIDENCE);

  assert.deepEqual(
    absentFrom(COPIED, firstRun),
    COPIED.map((c) => c.what),
    'the ceiling belongs to the rule; stating it here is a second copy nothing holds to the first',
  );
});

test('the hand-off is a written specification, and it says what goes in one', () => {
  const section = budget();

  // What may be handed over at all, in one breath with how. Said apart, the
  // eligibility is a preamble and the mechanism is the instruction.
  const HANDOFF = [
    { what: 'that only reusable plumbing is eligible', re: /reusable plumbing/i },
    { what: 'that it goes to a subagent', re: /\bsubagent\b/i },
    { what: 'against a written specification', re: /written specification/i },
  ];

  assert.ok(
    carriedTogether(section, HANDOFF),
    'a hand-off with no eligibility on it is one that takes the Unit with it' +
      `; absent from the section: ${absentFrom(HANDOFF, section).join(', ') || 'none'}`,
  );

  const entries = orderedEntries(section);

  // Guard the observer: a reader that recognised no entry would find nothing
  // missing from the specification and pass this for free.
  assert.ok(entries.length >= SPECIFICATION.length, `expected the specification's parts, found ${entries.length}`);

  // Read entry by entry rather than over the four joined together, for two
  // reasons: joined, one entry listing all four satisfies the claim, and a
  // failure cannot say which of them went missing.
  const carriedBy = SPECIFICATION.map((part) => ({
    ...part,
    at: entries.filter((e) => part.re.test(e.text)).map((e) => e.n),
  }));

  assert.deepEqual(
    carriedBy.filter((part) => part.at.length === 0).map((part) => part.what),
    [],
    'anything left out of the specification is simply absent from what comes back',
  );

  // And four of them, not one item listing four things. A specification a
  // subagent reads as a sentence is one it satisfies in a sentence.
  assert.equal(
    new Set(carriedBy.map((part) => part.at[0])).size,
    SPECIFICATION.length,
    'four requirements collapsed into one item is a list, not a specification',
  );

  const thin = entries.filter((e) => e.text.length < ROOM_FOR_A_REASON).map((e) => `part ${e.n}`);
  assert.deepEqual(thin, [], 'a part of the specification with no room to say what it means is a heading');

  // The last of the four is the one a hand-off written in a hurry drops: a
  // subagent has read none of this document, so the constraints have to travel
  // with the brief rather than be assumed.
  assert.ok(
    section.includes('#what-every-component-has-to-hold'),
    'the constraints are written down in one place; the specification points at that place',
  );
  assert.ok(
    anchorsIn(UNIT).has('what-every-component-has-to-hold'),
    'the constraints are not reachable at the anchor written for them',
  );
});

test('subject-specific content is never delegated, on the mark the derivations already carry', () => {
  const section = budget();

  const CONTENT = [
    { what: 'that subject-specific content is never delegated', re: /never delegated/i },
    { what: 'and that the reason is that it is the teaching', re: /that is the teaching/i },
  ];

  assert.ok(
    carriedTogether(section, CONTENT),
    'a line drawn without its reason is one a Session crosses the first time it is inconvenient' +
      `; absent from the section: ${absentFrom(CONTENT, section).join(', ') || 'none'}`,
  );

  // And the line is one that already exists. Each derivation places its output
  // on the plumbing-or-content axis, so this decision spends a judgement the
  // Teacher has already made rather than asking for a new one.
  assert.ok(anchorsIn(UNIT).has('the-derivations'), 'the derivations are not reachable at that anchor');
  assert.ok(
    carriedTogether(section, [{ re: /plumbing or\s*content/i }, { re: /#the-derivations/ }]),
    'without the mark, what may be delegated is decided afresh every time, by the Session that wants to',
  );
});

test('the Teacher verifies what comes back, and the reason it is not the subagent', () => {
  const section = budget();

  // The instruments, which are the ones a Teacher already runs. A new
  // verification pass invented for delegated work would be one nobody has run
  // before and nobody has calibrated.
  for (const anchor of [
    'look-at-the-page-before-handing-it-over',
    'simulate-only-what-can-be-checked-against-a-known-good-result',
  ]) {
    assert.ok(anchorsIn(UNIT).has(anchor), `the pass is not reachable at #${anchor}`);
    assert.ok(section.includes(`#${anchor}`), `a verification requirement naming no pass names no work`);
  }

  // Two reasons, and neither is the obvious one. The first is that the check
  // cannot be independent of the work when the same reading produced both.
  const DRIFTS = [
    { what: 'that a subagent would judge its own result', re: /its own result/i },
    { what: 'against its own reading of the specification', re: /its own reading/i },
    { what: 'so the standard drifts with the work', re: /drifts?\b/i },
  ];

  assert.ok(
    carriedTogether(section, DRIFTS),
    'stated as a preference, this is the first thing a Session delegates to save itself a step' +
      `; absent from the section: ${absentFrom(DRIFTS, section).join(', ') || 'none'}`,
  );

  // The second is the one only this repo can state: the record of how each
  // check misleads sits in the head comment of the checks file, and the
  // subagent was never sent to read it.
  const MISLEADS = [
    { what: 'the record of how each check misleads', re: /misleads?\b/i },
    { what: 'that it lives in the head comment of the checks file', re: /head comment/i },
    { what: 'and that the subagent has not read it', re: /never sent to read|does not have/i },
  ];

  assert.ok(
    carriedTogether(section, MISLEADS),
    'a verdict from something that never read the misreads is a verdict taken from checks that lie' +
      `; absent from the section: ${absentFrom(MISLEADS, section).join(', ') || 'none'}`,
  );
});

test('a Teacher about to build walks past the rule, from both directions', () => {
  const whole = derivingSection();

  assert.ok(anchorsIn(UNIT).has(ANCHOR.slice(1)), 'the rule is not reachable at the anchor written for it');

  // Placement is the claim. The rule is read at the point the match has said
  // **Build** and before the procedure for building says how — which is the
  // last moment the choice is still free. A rule met after the thing exists is
  // one a Teacher reads as an audit.
  const parts = partTitles(whole);

  assert.ok(parts.length >= 6, `expected the section's parts, found ${parts.length}`);

  const at = (re) => parts.findIndex((title) => re.test(title));
  assert.ok(at(/^what one Session can build$/i) > at(/reuse, build/i), 'the rule prices a description, so the description comes first');
  assert.ok(
    at(/^what one Session can build$/i) < at(/^building a component/i),
    'a bound read after the procedure it bounds is read after the building',
  );

  // And the procedure links back, because a Teacher can arrive at it directly
  // — from `TECH-STACK.md`, or from the first run's step 7.
  const building = oneSection(UNIT, 3, /^building a component/i, 'building a Component for this subject');
  assert.ok(building.includes(ANCHOR), 'a Teacher that arrived here has not necessarily priced anything');

  // The other direction is the spine: the teaching loop asks whether this Unit
  // needs a Component nobody has built, which is where the Session decides to
  // spend itself, one step before it opens the authoring reference at all.
  assert.ok(
    SKILL.includes(`./UNIT.md${ANCHOR}`),
    'the Session decides to build in the loop; the bound has to be reachable from there',
  );
});

test('the reasoning behind the budget is in the decisions record', () => {
  // The rule is what the Teacher reads; the argument is a maintainer's, and
  // this one will be argued with, because it tells an agent that the thing it
  // is confident it can build is larger than it can build.
  const decisions = foldedDoc(REPO_ROOT, 'docs', 'DECISIONS.md');
  const record = oneSection(decisions, 2, /budget for one Session/i, 'decisions-record entry for the budget');

  // Each pattern is the argument's own words rather than a word the argument
  // happens to use. A record checked on `/independent/i` goes on passing after
  // the reason it stated has been replaced by a different one.
  const REASONS = [
    { what: 'that the rules before it widened what a Session may reach for and said nothing about how much fits', re: /says how much of it fits/i },
    { what: 'that a ceiling stated bare is read as timidity', re: /read as timidity/i },
    { what: 'why there are two outcomes rather than one', re: /two outcomes rather than one/i },
    { what: 'that the line is the plumbing-or-content mark the derivations already carry', re: /plumbing-or-content mark/i },
    { what: 'that a subagent judging its own work cannot be independent of it', re: /cannot be independent/i },
    { what: 'and that the tool is delivered instead of the Unit rather than as well as it', re: /never as well as it/i },
  ];

  assert.deepEqual(
    absentFrom(REASONS, record),
    [],
    'the record keeps the decision but has dropped what argued for it',
  );
});
