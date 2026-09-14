'use strict';

// What this holds, and why the checks are shaped the way they are:
// `docs/agents/tests.md`, "The from-disk check".
//
// The complaint, in the words of the ticket: the authoring reference banned a
// technology — `file://` compatible by default, UMD or IIFE, never ES modules —
// to protect a property nobody had measured. The measurement says the ban does
// not buy it. What breaks a page opened from disk is a handful of things an
// author *types*, and neither "a module" nor "a CDN" is one of them: a module
// fetched over https loads onto a page whose origin is null, because the CDN
// answers with a permissive CORS header, while a module fetched by relative
// path does not.
//
// So these are checks about a *claim* rather than about where material sits.
// A ban costs one line to write and every interaction it forbids to obey, and
// the same claim was restated in three other documents — so the truth has to be
// written where the page is written, and the old claim may not survive
// anywhere that instructs.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { REPO_ROOT } = require('./helpers/workspace.js');
const { agentDocs, foldedDoc, SKILL_DIR } = require('./helpers/docs.js');
const { sections, logicalLines } = require('./helpers/markdown.js');

const rel = (abs) => path.relative(REPO_ROOT, abs);

/**
 * A document's logical lines — its hard wrapping folded back out. Prose here is
 * wrapped at a column, so where a line break falls is a typographic accident,
 * and every claim below is about a sentence rather than a line. A raw read lets
 * an `**accessible\ndescription**` walk past a check looking for it.
 */
const foldedLines = (...p) => logicalLines(fs.readFileSync(path.join(...p), 'utf8'));

/**
 * The same document as one string, for the checks that only ask "is this said
 * anywhere?" — the shared reader under the name these checks call it by. One
 * folding rule, in one place, now that a second document suite reads documents
 * too.
 */
const folded = foldedDoc;

const UNIT = folded(SKILL_DIR, 'UNIT.md');
const TUTOR = folded(SKILL_DIR, 'TUTOR.md');
const README = folded(REPO_ROOT, 'README.md');

/** Every entry of `list` whose pattern is absent from `text`, named. */
const absentFrom = (list, text) => list.filter((e) => !e.re.test(text)).map((e) => e.what);

/** The service's own runbook, which made the same claim and is not an `agentDocs()` document. */
const SERVICE_README = path.join(SKILL_DIR, 'runtime', 'tutor', 'README.md');

/**
 * The documents that *instruct* — a Teacher writing a Unit, or a human setting
 * the plugin up. `docs/` is exempt on purpose: `DECISIONS.md` records the
 * removal, and a record that may not name what it removed is not a record.
 */
function INSTRUCTS() {
  const found = [
    ...agentDocs().filter((d) => d.startsWith(SKILL_DIR + path.sep)),
    path.join(REPO_ROOT, 'README.md'),
    SERVICE_README,
  ];

  // Guard the observer. A scan that found no documents satisfies every "this
  // claim survives nowhere" assertion below by having nowhere to look — so the
  // documents that carried the claim have to be in it by name.
  for (const required of ['UNIT.md', 'TUTOR.md', 'README.md', path.join('tutor', 'README.md')]) {
    assert.ok(
      found.some((d) => d.endsWith(required)),
      `the scan missed ${required}, so a claim in it would go unread`,
    );
  }
  assert.ok(found.length >= 5, `expected the documents that instruct, found ${found.length}`);

  return found;
}

/**
 * The one section of the authoring reference that owns this rule, split into
 * the three parts the three lists below are each about.
 *
 * Whole-section matching is not good enough here, and review caught it: the CDN
 * row under *these do not* carries `type="module"`, so it satisfied a pattern
 * that exists to hold the row about a *relative* module script, and the word
 * `CORS` in the section's opening paragraph satisfied a pattern about the
 * consequences at the end. Each list is now read against the part it names.
 */
function fromDiskSection() {
  const found = sections(UNIT, 3).filter((s) => /from disk/i.test(s.title));

  assert.equal(
    found.length,
    1,
    'the authoring reference should say what breaks from disk, in exactly one section of its own',
  );

  const [breaks, rest] = found[0].body.split(/\*\*These do not:?\*\*/);
  assert.ok(rest !== undefined, 'the section should turn from what fails to what does not');

  const [works, consequences] = rest.split(/Two consequences/);
  assert.ok(consequences !== undefined, 'the section should end on the two consequences');

  return { breaks, works, consequences };
}

/**
 * The patterns that stop working, as the thing an author types rather than as
 * the technology it belongs to. Each one is a URL the page resolves against its
 * own origin, and a page opened from disk has none.
 */
const BREAKS = [
  { what: 'a module script with a relative source', re: /type="module"/ },
  { what: 'a dynamic import of a sibling file', re: /\bimport\(/ },
  { what: 'a fetch of a relative path', re: /\bfetch\(/ },
  { what: 'a worker constructed from a relative path', re: /new Worker\(/ },
];

/**
 * The patterns that do not. Without these the section is a ban again, in a
 * longer form: an author who reads only what fails assumes the rest fails too.
 */
const WORKS = [
  { what: 'an image with a relative path', re: /<img\b/ },
  { what: 'a stylesheet with a relative path', re: /<link rel="stylesheet"/ },
  { what: 'a classic script with a relative path', re: /<script src="\.\./ },
  { what: 'anything aimed at an https CDN', re: /https:\/\/cdn\./ },
];

/** The two consequences that ride along, and are invisible from the rule above. */
const CONSEQUENCES = [
  { what: 'a local classic script carries no `crossorigin`', re: /crossorigin/ },
  { what: 'and no `integrity` either', re: /integrity/ },
  { what: 'both because either one opts it into the CORS check', re: /\bCORS\b/ },
  {
    // `integrity` alone on a cross-origin script is a network error, not a
    // stricter page: SRI cannot check a response the browser handed back
    // opaque. The document said "both are fine" until review measured it.
    what: 'that on a CDN script the two are written as a pair or not at all',
    re: /crossorigin="anonymous"/,
  },
  { what: 'a worker script may never be cross-origin, on any scheme', re: /cross-origin[^.]*worker|worker[^.]*cross-origin/i },
  { what: 'so a CDN library that spawns one has to build it from a blob', re: /\bblob\b/i },
];

/** The ban, in each of the spellings the documents carried it in. */
const THE_BAN = [
  { what: 'a ban on ES modules', re: /(?:never|no|not) ES modules/i },
  { what: 'a requirement that a library be UMD or IIFE', re: /\bUMD\b/ },
  { what: 'file:// compatibility as a blanket property of a Component', re: /compatible by default/i },
];

/**
 * The oversold claim: that serving *lifts a restriction*. It is the same
 * mistake as the ban, made from the other side — it tells a Teacher that a
 * module script or an in-page runtime is something serving unlocks, when
 * measurement says both already work from disk.
 */
const OVERSOLD = /lift(?:s|ing|ed)?\b[^.]*restriction/i;

test('the authoring reference says what an author types that breaks from disk', () => {
  const { breaks } = fromDiskSection();

  assert.deepEqual(
    absentFrom(BREAKS, breaks),
    [],
    'a rule stated as a technology is a rule an author cannot check its own page against',
  );
});

test('and says what does not, beside it', () => {
  const { works } = fromDiskSection();

  assert.deepEqual(
    absentFrom(WORKS, works),
    [],
    'a list of only what fails is the ban again — an author reads it as "and everything like it"',
  );
});

test('the two consequences that do not follow from the rule are stated', () => {
  const { consequences } = fromDiskSection();

  assert.deepEqual(
    absentFrom(CONSEQUENCES, consequences),
    [],
    'neither of these is derivable from "a relative URL fails"; both break a page that looks correct',
  );
});

test('nothing that instructs still bans a technology to buy what the ban does not buy', () => {
  // Guard the observer: patterns nothing ever wrote would pass for free. These
  // are the sentences as the documents carried them, kept here rather than in a
  // document so that the check reads a rule that is gone.
  const AS_WRITTEN = [
    '**`file://` compatible by default** — UMD or IIFE scripts, never ES modules.',
    'What qualifies: a UMD or IIFE build, small enough to load from disk',
  ].join('\n');

  const seen = THE_BAN.filter((b) => b.re.test(AS_WRITTEN)).map((b) => b.what);
  assert.equal(seen.length, THE_BAN.length, 'this check can no longer see the ban it exists to forbid');

  const found = INSTRUCTS().flatMap((doc) =>
    THE_BAN.filter((b) => b.re.test(folded(doc))).map((b) => `${rel(doc)} still states ${b.what}`),
  );

  assert.deepEqual(found, [], 'a Teacher reading this reaches for none of what the web platform offers');
});

test('no document claims that serving lifts a restriction measurement did not find', () => {
  // Guard the observer, on both of the sentences that carried the claim.
  assert.ok(
    OVERSOLD.test('serves the Lessons over http — which also lifts the `file://` restrictions that gate Pyodide'),
    'this check cannot see the claim it exists to forbid',
  );
  assert.ok(
    OVERSOLD.test('Serves the workspace over http, which lifts the `file://` restrictions a lesson would be under'),
    'this check reads one spelling of the claim and not the other',
  );
  assert.ok(!OVERSOLD.test('serving buys the in-page Tutor and a fetch by relative path'), 'this check reads the truth as the claim');

  const found = INSTRUCTS()
    .filter((doc) => OVERSOLD.test(folded(doc)))
    .map(rel);

  assert.deepEqual(found, [], 'these sell serving on something a page opened from disk already has');
});

test('the Tutor documentation says what serving actually buys', () => {
  const BUYS = [
    {
      what: 'the in-page Tutor, which can only be reached from a page the service served',
      re: /\bonly\b[^.]*\bserv(?:ed|es|ing)\b/i,
    },
    {
      what: "a fetch of the page's own files by relative path",
      re: /relative[^.]*\bfetch|fetch(?:es|ed)?[^.]*\brelative\b/i,
    },
  ];

  // Both in one paragraph, not both somewhere in the document. Review measured
  // the looser version and it held nothing: the runbook already carried "the
  // drawer connects only on a Lesson the service is serving" as a precondition,
  // so the first pattern passed with the answer to *what serving buys* deleted
  // entirely. The two facts are that answer only when they are given together.
  const together = foldedLines(SKILL_DIR, 'TUTOR.md').filter((l) =>
    BUYS.every((b) => b.re.test(l.text)),
  );

  assert.equal(
    together.length,
    1,
    'with the overstated claim removed, one place has to say what starting the service is for — ' +
      `found ${together.length}`,
  );
});

test('the no-network rule belongs to the shipped Components, and both documents say why', () => {
  const WHY = [
    { what: 'that the shipped Components load nothing', re: /touch(?:es)? the network/i },
    { what: 'why: they are the same bytes in every Workspace', re: /same bytes in every (?:workspace|course)/i },
    {
      what: 'and that the rule a Lesson is held to is not that one',
      re: /only the rule[^.]*lesson|lessons? (?:you write )?(?:are|is) not held to/i,
    },
  ];

  // One paragraph, not one document. `UNIT.md` already argues elsewhere that
  // the plugin's files are the same bytes in every Workspace — about their
  // *language* — so a check that read the whole document would pass on the
  // strength of a sentence that says nothing about the network.
  for (const [name, lines] of [
    ['UNIT.md', foldedLines(SKILL_DIR, 'UNIT.md')],
    ['README.md', foldedLines(REPO_ROOT, 'README.md')],
  ]) {
    const together = lines.filter((l) => WHY.every((w) => w.re.test(l.text)));

    assert.equal(
      together.length,
      1,
      `${name} should state the shipped Components' rule, its reason, and that a Lesson is not ` +
        `held to it, in one place a reader meets at once — found ${together.length}`,
    );
  }
});

test('a Component that is a picture carries a sentence a Learner can read instead', () => {
  const DEGRADES = [
    {
      what: 'a Component made of text writes its content into the markup and is taken over',
      re: /take(?:s|n)? (?:it )?over|is-live/,
    },
    { what: 'a Component that is a picture cannot, and carries a stand-in sentence', re: /stand-in sentence/i },
    { what: 'which is also the accessible description', re: /accessible description/i },
    { what: 'and is what the Tutor has to go on about something nobody can see', re: /Tutor/ },
  ];

  assert.deepEqual(
    absentFrom(DEGRADES, UNIT),
    [],
    'a picture that never rendered leaves a hole; "write the content into the markup" cannot fill it',
  );
});

test('nothing that needs the network or the service is allowed to fail silently', () => {
  // The shape — *which of two* — rather than one spelling of it. The first
  // version read `which of the two is (missing|down)`, which review called
  // brittle: "names which one is absent" says the same thing and broke it.
  const SAYS_WHICH = /\bwhich\b[^.]*\b(?:of the two|one is|one of them|one it)\b/i;

  assert.ok(SAYS_WHICH.test('it says which of the two is missing'), 'this check cannot see the rule');
  assert.ok(SAYS_WHICH.test('the page names which one is absent'), 'this check reads one wording only');
  assert.ok(!SAYS_WHICH.test('the page says that something went wrong'), 'this check reads silence as the rule');

  const stated = foldedLines(SKILL_DIR, 'UNIT.md').filter((l) => SAYS_WHICH.test(l.text));
  assert.ok(
    stated.length >= 1,
    'a Lesson that reaches for a CDN or the service has two ways to be unreachable, and the page has to name one',
  );
});
