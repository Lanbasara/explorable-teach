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
    carries: [/MISSION\.md/, /TECH-STACK\.md/, /CURRICULUM\.md/, /ROLE\.md/],
  },
  {
    file: 'TUTOR.md',
    // Reached on installation or on failure, and on no other Session.
    carries: [/tutorctl\.sh/, /\/api\/health/, /--resume/, /ROLE\.md/],
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
