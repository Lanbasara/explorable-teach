'use strict';

// What this holds, and why the checks are shaped the way they are:
// `docs/agents/tests.md`, "The disclosure check".
//
// The complaint, in the words of the ticket: first-run setup "fires on roughly
// one Session in twenty yet occupies about fifty inline lines under a top-level
// heading", and Tutor operations are "an operations runbook sitting between two
// teaching sections". Reference that should have been disclosed buries the
// steps beside it and turns attending to them into a coin flip. This is a
// variance fix, not tidying — so the checks are about where material *sits*,
// which is the thing that varies behaviour, not about whether it exists.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { REPO_ROOT } = require('./helpers/workspace.js');
const { SKILL_DIR } = require('./helpers/docs.js');
const { sections, step, logicalLines, linesMentioning } = require('./helpers/markdown.js');

const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');

const SKILL = read(SKILL_DIR, 'SKILL.md');

/**
 * The skill without its frontmatter. `disable-model-invocation` is a live
 * setting up there and a piece of removed rationale down here, so a check about
 * the second has to be able to tell them apart. Splitting on `---` cannot: a
 * Markdown table rule is spelled the same way, and the skill is full of tables.
 */
const SKILL_BODY = SKILL.replace(/^---\n[\s\S]*?\n---\n/, '');
const DECISIONS = read(REPO_ROOT, 'docs', 'DECISIONS.md');

/** The documents this ticket disclosed, and what each one has to carry. */
const DISCLOSED = [
  {
    file: 'FIRST-RUN.md',
    // Reached on roughly one Session in twenty — the first one in a Workspace.
    // `TUNING.md`, not `ROLE.md`: the role definition belongs to the plugin and
    // the tuning is the one Tutor file a first run authors.
    carries: [/MISSION\.md/, /TECH-STACK\.md/, /CURRICULUM\.md/, /TUNING\.md/],
  },
  {
    file: 'TUTOR.md',
    // Reached on installation or on failure, and on no other Session. Both
    // halves of the role, because reading only one of them is the degraded
    // Tutor this split exists to rule out.
    carries: [/tutorctl\.sh/, /\/api\/health/, /--resume/, /ROLE\.md/, /TUNING\.md/],
  },
  {
    file: 'UNIT.md',
    // Reached while a Unit is being written, which is one step of the teaching
    // loop rather than a decision the Session makes.
    carries: [/## The Lesson/, /Exercise/, /Checkpoint/, /Rubric/, /Dossier/],
  },
];

/**
 * The Tutor runbook, as the vocabulary only a runbook uses. A word here sitting
 * in `SKILL.md` means the operations material came back — whatever heading it
 * came back under.
 */
const RUNBOOK = [
  /tutorctl/i,
  /\/api\/health/,
  /\bport\b/i,
  /\bpid\b/i,
  /\bidle timeout\b/i,
  /\bdetached\b/i,
  /server\.log/,
  /--resume/,
  /\bROLES\b/,
  /server\.js/,
];

/**
 * Unit authoring, as the vocabulary only an authoring reference uses: markup,
 * the asset filenames a page links, CDN hosts, the attributes and constructors
 * that decide whether a page opened from disk works, a Component's `Deps:`
 * declaration, the numbering of a Lesson file. A word here sitting in
 * `SKILL.md` means the authoring material came back — whatever heading it came
 * back under.
 *
 * The list tracks the document rather than the reverse. It read `Tier \d` until
 * the Component catalog stopped being tiered, and the guard below failed on the
 * spot — which is the point: the alternative is a check that goes on passing
 * while looking for words nobody writes. Four entries arrived the same
 * way, when the ban on ES modules became a list of what an author types that
 * breaks from disk; `from-disk.test.js` holds what that list has to say. Then
 * one when the Teacher gained a pass to run over the page it had just written,
 * and three when it gained a policy for imagery: a borrowed image's
 * licence, and the two mitigations that keep a hand-drawn label inside its box.
 * Three arrived when choosing a Component from a table became deriving a
 * description from the passage — the derivations, the cheapest version of one
 * that still teaches, and the anti-patterns beside them; `deriving.test.js`
 * holds what that material has to say. The last three when the reference gained
 * a rule about what a diagram is built out of and what a page may move: the
 * clipping property from the list of what markup draws natively, the media
 * query a Lesson's motion sits behind, and the kind of motion that is permitted
 * by name; `motion.test.js` holds those. Three more when a run had to be
 * checked against something correct before it could ship — the result it is
 * checked against, the first of the four kinds that qualify, and the only
 * interaction a subject with no such result is allowed; `simulation.test.js`
 * holds what that material has to say. And three when the reference gained a
 * bound on what one Session can build and a way to hand a large piece of
 * plumbing over: the unit the ceiling is stated in, what a large piece is
 * handed to, and what it is handed against; `budget.test.js` holds those.
 */
const AUTHORING = [
  /<!DOCTYPE/i,
  /lesson-boot\.js/,
  /style\.css/,
  /predict-reveal|step-animation|drag-order/,
  /checkpoint\.js/,
  /cdnjs|unpkg|jsdelivr/,
  /devicePixelRatio/,
  /is-live/,
  /0001-slug/,
  /Deps:/,
  /type="module"/,
  /crossorigin/,
  /new Worker\(/,
  /stand-in sentence/i,
  /page-checks\.js/,
  /licen[cs]e/i,
  /coarse grid/i,
  /monospace/i,
  /\bderivations?\b/i,
  /cheapest/i,
  /anti-pattern/i,
  /clip-path/,
  /prefers-reduced-motion/,
  /interface feedback/i,
  /known-good/i,
  /conserved quantit/i,
  /\bpacing\b/i,
  /single mechanic/i,
  /\bsubagent\b/i,
  /\bspecification\b/i,
];

/**
 * The serving precondition, as the three things a Teacher has to read together:
 * the in-page Tutor connects only on a page the Tutor service served, a Lesson
 * opened from disk is the other reading, and that reading is by design rather
 * than a fault to go and chase.
 *
 * This check holds the precondition in place; it cannot hold it against being
 * wrong, which is review's job. What it rules out is the precondition
 * disappearing again — it was never written down in the first place, and the
 * Teacher who read the instruction beside it acted on the half that was left.
 */
const PRECONDITION = [
  { what: 'the drawer connects only on a page the service served', re: /\bonly\b[^.]*\bserv(?:ed|es|ing)\b/i },
  { what: 'a Lesson opened from disk is the other reading', re: /\bfrom disk\b/i },
  { what: 'that reading is by design rather than a fault', re: /\bby design\b|\bnot a (?:failure|fault)\b/i },
];

/** The instruction the precondition has to sit beside, as an instruction shape. */
const NO_RELOAD = /(?:do not|don't|never)[^.]*\breload\b/i;

/** Where the four format specifications live now that they live together. */
const FORMATS = path.join(SKILL_DIR, 'formats');

const show = (m) => `${m.line}: ${m.text.trim()}`;

test('each disclosed document exists and carries what it was disclosed for', () => {
  for (const { file, carries } of DISCLOSED) {
    const abs = path.join(SKILL_DIR, file);
    assert.ok(fs.existsSync(abs), `${file} should be a document of its own`);

    const text = read(abs);
    const missing = carries.filter((re) => !re.test(text));
    assert.deepEqual(
      missing.map(String),
      [],
      `${file} is the home of this material now; it should be all there`,
    );
  }
});

test('the main document points at each disclosed document', () => {
  // Disclosed is not the same as removed. Material behind a pointer nobody
  // follows is material that is gone.
  const unreachable = DISCLOSED.filter(({ file }) => !SKILL.includes(`](./${file})`));

  assert.deepEqual(
    unreachable.map((d) => d.file),
    [],
    'a Session that needs this material has no way to find out it is there',
  );
});

test('the skill root is the main document and the documents it points at', () => {
  // The document set has to be legible at a glance, which is a claim about the
  // directory rather than about any one file. Every neighbour of `SKILL.md` is
  // disclosed above — so it exists, carries its material, and is pointed at —
  // and a document that is none of those is one nobody is sent to.
  const atRoot = fs
    .readdirSync(SKILL_DIR)
    .filter((name) => name.endsWith('.md') && name !== 'SKILL.md')
    .sort();

  assert.deepEqual(
    atRoot,
    DISCLOSED.map((d) => d.file).sort(),
    'the documents beside the main one should be exactly the ones it discloses',
  );
});

test('the format specifications sit together in one subdirectory', () => {
  assert.ok(fs.existsSync(FORMATS), 'the format specifications should have a home of their own');

  const specs = fs.readdirSync(FORMATS).filter((name) => name.endsWith('.md'));

  // Guard the observer: an empty directory would satisfy the claim by having
  // nothing in it to be wrong.
  assert.ok(specs.length >= 4, `expected the four format specifications, found ${specs.length}`);

  // That they are also *reached* is `pointers.test.js`: every document under
  // the skill has to be pointed at from another one, and these are documents.
});

test('first-run setup is not a section of the main document', () => {
  const top = sections(SKILL);

  // Guard the observer: a parser that found no headings would pass for free.
  assert.ok(top.length >= 5, `expected the skill's sections, found ${top.length}`);

  const inline = top.filter((s) => /first[- ]run|research and plan/i.test(s.title));
  assert.deepEqual(
    inline.map((s) => s.title),
    [],
    'nineteen Sessions in twenty read this section for nothing',
  );
});

test('the Boot sequence branches to first-run setup by pointer', () => {
  const boot = sections(SKILL).find((s) => /boot sequence/i.test(s.title));
  assert.ok(boot, 'the skill should carry a Boot sequence section');

  // The branch is the only route to the document, so it is the one place the
  // pointer has to be. An in-document anchor here would send the one Session
  // that needs setup to a heading that is no longer there.
  assert.match(
    boot.body,
    /\]\(\.\/FIRST-RUN\.md\)/,
    'the Boot sequence decides whether this is a first run; it owns the pointer',
  );
  assert.ok(
    !/#first-run/i.test(boot.body),
    'the branch still points at a heading inside the main document',
  );
});

test('the Tutor runbook is not in the main document', () => {
  const tutorDoc = read(SKILL_DIR, 'TUTOR.md');

  // Guard the observer: a vocabulary the runbook itself does not use would find
  // nothing anywhere, and this check would pass by describing no runbook.
  const unknown = RUNBOOK.filter((re) => !re.test(tutorDoc));
  assert.deepEqual(unknown.map(String), [], 'this check is looking for words no runbook uses');

  // Logical lines, not raw ones. This check is the backstop for the pair below
  // it, and reading raw lines would let a hard-wrapped `idle\ntimeout` or
  // `/api/\nhealth` walk straight past it — the exact typographic accident the
  // Markdown reader exists to remove.
  const lines = logicalLines(SKILL);
  const found = RUNBOOK.flatMap((re) => lines.filter((l) => re.test(l.text)).map(show));

  assert.deepEqual(found, [], 'ports, processes and role files are reached on failure, not on every Session');
});

test('Unit authoring is not in the main document', () => {
  const authoring = read(SKILL_DIR, 'UNIT.md');

  // Guard the observer, the way the runbook check above is guarded: a
  // vocabulary the authoring document itself does not use would find nothing
  // anywhere and pass by describing no authoring material.
  const unknown = AUTHORING.filter((re) => !re.test(authoring));
  assert.deepEqual(unknown.map(String), [], 'this check is looking for words no authoring document uses');

  // Logical lines, for the reason the runbook check reads them: prose here is
  // hard-wrapped, so a `predict-\nreveal` broken across a line would walk past
  // a check that read raw ones.
  const lines = logicalLines(SKILL);
  const found = AUTHORING.flatMap((re) => lines.filter((l) => re.test(l.text)).map(show));

  assert.deepEqual(
    found,
    [],
    'markup, asset filenames and CDN hosts are read while writing a page, not while deciding what to teach',
  );
});

test('exactly two Tutor facts stay inline, and both are teaching facts', () => {
  // The two that earn their place: the question log is read at Boot because
  // that is a teaching judgement, and a Lesson must stay readable with the
  // service stopped because that constrains every page the Teacher authors.
  const FACTS = [
    {
      what: 'the logged questions are read at Boot',
      re: /questions\.jsonl/,
    },
    {
      // Tied to the thing that has to be stopped. A bare /stopped|down/ would
      // also match unrelated prose that happened to name the Tutor.
      what: 'a Lesson stays readable with the service stopped',
      re: /(?:Tutor|service)[^.]*\b(?:stopped|not running)\b/i,
    },
  ];
  const POINTER = /\]\(\.\/TUTOR\.md\)/;

  const mentions = linesMentioning(SKILL, 'tutor');

  // Guard the observer: a skill that never named the Tutor would satisfy every
  // assertion below without carrying either fact.
  assert.ok(mentions.length >= 3, `expected the Tutor named inline, found ${mentions.length}`);

  for (const fact of FACTS) {
    assert.ok(
      mentions.some((m) => fact.re.test(m.text)),
      `the skill no longer states that ${fact.what}`,
    );
  }
  assert.ok(mentions.some((m) => POINTER.test(m.text)), 'no mention sends a Session to TUTOR.md');

  const stray = mentions
    .filter((m) => !POINTER.test(m.text) && !FACTS.some((f) => f.re.test(m.text)))
    .map(show);

  assert.deepEqual(stray, [], 'these are Tutor facts the Teacher does not need in front of it');

  // The classification above has a hole, and review found it: a line is
  // forgiven for carrying a pointer, so a claim sharing a line with one passes.
  // That was a real Unit bullet — "a question about a passage is answered
  // without leaving the page" — riding on a `](./TUTOR.md)` beside it.
  //
  // So a line that names the Tutor in its own prose, rather than only inside a
  // link to `TUTOR.md`, has to be a signpost: short enough that there is no
  // room for a claim. A line that merely links out while talking about
  // something else — grading, recorded prohibitions — is exempt, because its
  // length is about its own subject.
  const SIGNPOST = 90;
  const inProse = (text) => /tutor/i.test(text.replace(/\]\([^)]*\)/g, '').replace(/TUTOR\.md/g, ''));

  // Guard the observer, on both sides. These are written to be obviously
  // synthetic: copying a real line from `SKILL.md` would leave the guard
  // testing text that no longer exists the moment that line is reworded.
  assert.ok(inProse('The Tutor does a thing. See [TUTOR.md](./TUTOR.md).'), 'named outside a link');
  assert.ok(!inProse('Something unrelated — see [TUTOR.md](./TUTOR.md).'), 'a link is not a mention');

  const named = mentions.filter((m) => inProse(m.text));

  const claims = named
    .filter((m) => !FACTS.some((f) => f.re.test(m.text)))
    .filter((m) => m.text.trim().length > SIGNPOST)
    .map(show);

  assert.deepEqual(claims, [], `these name the Tutor at more length than a signpost needs`);

  // A budget on top, so the Tutor cannot return by accumulating signposts. It
  // counts only lines that name the Tutor in their own prose — a line that
  // merely links out while discussing grading or recorded prohibitions is not
  // Tutor material and should not be spending Tutor budget.
  //
  // Two facts and two signposts is the whole of it, so there is no headroom by
  // design. Raising this is a decision to argue, not a way to go green.
  assert.ok(
    named.length <= 4,
    `the Tutor is named in the prose of ${named.length} lines; the budget is 4:\n` +
      named.map(show).join('\n'),
  );
});

test('the rationale the skill no longer carries is in the decisions record', () => {
  // Why the Tutor is a Workspace template rather than a plugin-level agent. It
  // is a maintainer's reasoning, not a Teacher's instruction, so it left the
  // skill — but reasoning that leaves without being recorded is reasoning a
  // future maintainer re-derives, or reverses without knowing it.
  const REASONS = [
    { what: 'where subagents are discovered', re: /\.claude\/agents/ },
    { what: 'that a plugin-level agent registers globally', re: /\bglobal(?:ly)?\b/i },
    { what: 'that subagents cannot opt out of model invocation', re: /disable-model-invocation/ },
    { what: 'that project scoping is the control being spent', re: /project[- ]scop/i },
  ];

  const record = sections(DECISIONS).find((s) => /workspace template|plugin agent/i.test(s.title));
  assert.ok(record, 'the decisions record should carry the Tutor deployment decision');

  const missing = REASONS.filter((r) => !r.re.test(record.body)).map((r) => r.what);
  assert.deepEqual(missing, [], 'the record keeps the decision but has dropped what argued for it');

  // And it is not in both places: a rationale kept inline is attention spent at
  // run time on a question the Teacher never has to answer.
  assert.match(SKILL, /disable-model-invocation/, 'this check cannot tell frontmatter from body');
  assert.ok(
    !/disable-model-invocation/.test(SKILL_BODY),
    'the plugin-agent rationale is still in the skill body',
  );
});

test('the teaching loop still reaches its own steps', () => {
  // Disclosure removes material; it must not remove the thread through what is
  // left. The loop is what every Session runs, so it stays whole and inline.
  const loop = sections(SKILL).find((s) => /teaching loop/i.test(s.title));
  assert.ok(loop, 'the skill should carry the teaching loop');

  for (const n of [1, 2, 3]) {
    assert.ok(step(loop.body, n), `the teaching loop lost step ${n}`);
  }
});

test('the serving precondition sits beside the instruction not to ask for a reload', () => {
  const tutorDoc = read(SKILL_DIR, 'TUTOR.md');

  // Guard the observer on the instruction: a shape that matched no section
  // would leave every assertion below with nothing to be wrong about, and a
  // shape that matched several would not be naming one place.
  const owning = sections(tutorDoc).filter((s) => NO_RELOAD.test(s.body));
  assert.equal(
    owning.length,
    1,
    'the runbook should tell the Teacher not to ask for a reload, in exactly one section',
  );

  const missing = PRECONDITION.filter((p) => !p.re.test(owning[0].body)).map((p) => p.what);
  assert.deepEqual(
    missing,
    [],
    'that instruction is true of a served Lesson and false of one opened from disk, ' +
      'and it is the sentence a Teacher acts on — so the precondition belongs beside it',
  );
});
