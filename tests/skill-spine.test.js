'use strict';

// What this holds, and why the checks are shaped the way they are:
// `docs/agents/tests.md`, "The spine check".
//
// Three complaints, in the words of the ticket: a Session "wades through
// reference material" before orienting itself; four capabilities were bolted on
// with no named concept binding them; and a human had "two similarly-named
// entry points" to choose between.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { REPO_ROOT } = require('./helpers/workspace.js');
const { agentDocs, SKILL_DIR } = require('./helpers/docs.js');
const { sections, step, logicalLines, sentencesOf } = require('./helpers/markdown.js');

const SKILL_MD = path.join(SKILL_DIR, 'SKILL.md');
const SKILL = fs.readFileSync(SKILL_MD, 'utf8');

const rel = (abs) => path.relative(REPO_ROOT, abs);

/**
 * What the main document is for, one entry per role it carries. Every section
 * has to be one of these and every one of these has to be a section: a section
 * that is neither is material every Session reads on the way to the material it
 * came for, and a role that is missing is a decision the Session makes with
 * nothing in front of it.
 */
const SPINE = [
  { role: 'the Boot sequence', re: /^boot sequence$/i },
  { role: 'the Unit it delivers', re: /^the unit$/i },
  { role: 'the teaching steps', re: /^the teaching loop$/i },
  { role: 'the judgement criteria every Session uses', re: /^judging\b/i },
  { role: 'the assessment ladder', re: /^the assessment ladder$/i },
  { role: 'the Session-end criterion', re: /^ending a session$/i },
];

/**
 * The floor of Handoff actions, one entry per thing the next Boot sequence
 * reads. Anything here the Session did not write is something the next one has
 * to ask the learner for, which is the outcome the criterion forbids.
 */
const HANDOFF_FLOOR = [
  { what: 'the Learning Record this Unit produced', re: /Learning Record\b/ },
  { what: 'the progress marker in the Curriculum', re: /CURRICULUM\.md/ },
  { what: 'what the learner said about how to teach them', re: /NOTES\.md/ },
  { what: 'the Unit reachable from the Dossier', re: /index\.html|Dossier/ },
];

/**
 * The judgement that replaced the instruction to aim every Lesson at
 * discovery, as the four things one sentence has to say: whose wrong answer,
 * that the Teacher has to be able to write it down, what the question collects
 * when it cannot, and what follows. Three of the four are a description; the
 * fourth is what makes it actionable.
 */
const JUDGEMENT = [
  { what: 'the wrong answer the learner would actually give', re: /wrong answer\b/i },
  { what: 'that the Teacher has to be able to write it down', re: /\bcannot write down\b/i },
  { what: 'what the question collects instead', re: /\bguess\b/i },
  { what: 'that such a question is not asked', re: /\bshould not be asked\b|\bdo not ask\b/i },
];

/**
 * The three ways this judgement would stop being one. It is applied to one
 * question at a time, so a Teacher that can read a category off it — this
 * subject, this age, this kind of skill — has stopped looking at the question.
 * Each carries the control sentence that proves the pattern can see its own
 * subject, since a classification nobody wrote is not evidence of anything.
 */
const CLASSIFIES = [
  {
    by: "the learner's age",
    re: /\bages?\b|\byears old\b|\bgrade\b|\bchild(?:ren)?\b|\bteenager|\badults?\b/i,
    control: 'Younger learners hold fewer wrong beliefs, so ask below that age with care',
  },
  {
    by: 'subject area',
    re: /\bmaths?\b|\bmathematic|\bphysics\b|\bhistor|\bphilosoph|\bsciences?\b|\bhumanities\b|\bSTEM\b/i,
    control: 'The sciences earn this shape; history and the humanities rarely do',
  },
  {
    by: 'kind of skill',
    re: /\bmotor skill|\bprocedural\b|\bdeclarative\b|\bsoft skill|\bkinds? of skill\b/i,
    control: 'Procedural material suits it; declarative material does not',
  },
];

/**
 * The Component that asks for a prediction, as the three places the authoring
 * reference offers it — the move it comes from, the row a teaching act is
 * chosen on, and the row in the shipped table. Each is a place the Teacher
 * decides to reach for it, so each has to carry the judgement rather than an
 * invitation. The markup lines naming the same files are not offers and are
 * matched by none of these.
 */
const OFFERS_A_PREDICTION = [
  { where: 'the move it comes from', re: /\*\*Predict, then reveal\.\*\*/ },
  { where: 'the teaching act it answers', re: /^\|.*\|\s*Predict-reveal\s*\|/i },
  { where: 'the row in the shipped table', re: /^\|\s*\*\*Predict-Reveal\*\*/ },
];

/** The terms `CONTEXT.md` defines under one of its `###` groupings. */
function glossaryTerms(grouping) {
  const context = fs.readFileSync(path.join(REPO_ROOT, 'CONTEXT.md'), 'utf8');
  const group = sections(context, 3).find((s) => s.title === grouping);
  assert.ok(group, `CONTEXT.md has no "${grouping}" grouping`);

  return [...group.body.matchAll(/^\*\*(.+?)\*\*:$/gm)].map((m) => m[1]);
}

/**
 * Every file `scripts/init-workspace.sh` installs into a Workspace — the source
 * end of each one, not the destination. Both halves of the split count: what it
 * copies out of `templates/`, and what it links at in `runtime/`.
 *
 * `init-workspace.test.js` reads the script's *report* instead, which is the
 * route `docs/agents/tests.md` endorses. It cannot serve here: the report names
 * where each file landed, and what a document restating the list would name is
 * where each file came from. So this one reads the install list itself.
 */
function scaffoldSources() {
  const script = fs.readFileSync(path.join(REPO_ROOT, 'scripts/init-workspace.sh'), 'utf8');
  return [
    ...[...script.matchAll(/place\s+"\$TPL\/(\S+?)"/g)].map((m) => `templates/${m[1]}`),
    ...[...script.matchAll(/link\s+"\$RUNTIME\/(\S+?)"/g)].map((m) => `runtime/${m[1]}`),
  ];
}

test('the Boot sequence is the first thing the Teacher reads', () => {
  const top = sections(SKILL);

  // Guard the observer: a parser that found no headings would pass for free.
  assert.ok(top.length >= 5, `expected the skill's sections, found ${top.length}`);

  assert.match(
    top[0].title,
    /boot sequence/i,
    'a Session orients itself first; reference material cannot sit in front of that',
  );
});

test('the main document is its spine and nothing else', () => {
  const top = sections(SKILL);

  // Guard the observer: a parser that found no headings would pass for free.
  assert.ok(top.length >= 5, `expected the skill's sections, found ${top.length}`);

  // And guard it from the other side, on titles written to be obviously
  // synthetic: a role list loose enough to match reference material would let
  // the catalog back in under any name.
  const matches = (title) => SPINE.some((s) => s.re.test(title));
  assert.ok(matches('Boot sequence'), 'this check does not recognise the spine');
  assert.ok(!matches('Catalog of interaction patterns'), 'this check reads reference material as spine');
  // The near miss that matters: a heading naming the Unit is not the Unit
  // section, and disclosed authoring material would come back under one.
  assert.ok(!matches('Authoring a Unit'), 'this check would take authoring material for the spine');

  assert.deepEqual(
    top.filter((s) => !matches(s.title)).map((s) => s.title),
    [],
    'every Session reads this on the way to what it came for',
  );

  assert.deepEqual(
    SPINE.filter((s) => !top.some((t) => s.re.test(t.title))).map((s) => s.role),
    [],
    'the main document should carry this, and does not',
  );
});

test('the Boot sequence opens by scaffolding, and delegates to the script', () => {
  const boot = sections(SKILL).find((s) => /boot sequence/i.test(s.title));
  assert.ok(boot, 'the skill should carry a Boot sequence section');

  const first = step(boot.body, 1);

  assert.ok(first, 'the Boot sequence should be a numbered sequence');
  assert.match(
    first,
    /scripts\/init-workspace\.sh/,
    'the first step scaffolds a bare Workspace by invoking the script',
  );
});

test('no document restates what the scaffold installs', () => {
  const sources = scaffoldSources();

  // Guard the observer: an extraction that found nothing would pass for free.
  assert.ok(sources.length >= 10, `expected the scaffold's copy list, found ${sources.length}`);

  // Naming one template path in prose is a reference. Naming two is the start
  // of a copy of the script's own list, which is what goes stale.
  const restates = (text) => {
    const named = [...new Set(sources.filter((s) => text.includes(s)))];
    return named.length >= 2 ? named : null;
  };

  // Built from the script, never typed out: a control listing real template
  // paths would be this check keeping its own copy of the list it forbids.
  const asTheBlockWrote = sources
    .slice(0, 2)
    .map((src) => `${src}   → <workspace>/${src.replace(/^(templates|runtime)\//, '')}`)
    .join('\n');

  assert.ok(
    restates(asTheBlockWrote),
    'this check would have let through the install block it exists to forbid',
  );

  const found = agentDocs()
    .map((doc) => ({ doc, named: restates(fs.readFileSync(doc, 'utf8')) }))
    .filter((d) => d.named)
    .map((d) => `${rel(d.doc)} lists ${d.named.join(', ')}`);

  assert.deepEqual(found, [], 'the script owns its file list; a document holds the step that runs it');
});

test('a script the skill tells a Session to run is named from the plugin root', () => {
  // The Session's working directory is the learner's Workspace. These scripts
  // live in the plugin, which is never copied into it, so a bare `scripts/…`
  // names nothing from where the Teacher is standing.
  const named = (text) => [...text.matchAll(/(\S*)(scripts\/[\w.-]+\.sh)/g)];
  const unrooted = (text) =>
    named(text)
      .filter(([, prefix]) => !prefix.endsWith('${CLAUDE_PLUGIN_ROOT}/'))
      .map(([, , script]) => script);

  assert.deepEqual(
    unrooted('run `scripts/init-workspace.sh` first'),
    ['scripts/init-workspace.sh'],
    'this check sees a script the Teacher could not run',
  );
  assert.deepEqual(
    unrooted('run `${CLAUDE_PLUGIN_ROOT}/scripts/init-workspace.sh` first'),
    [],
    'this check leaves a rooted invocation alone',
  );

  const docs = agentDocs().filter((d) => d.startsWith(SKILL_DIR + path.sep));
  const found = docs.map((doc) => ({ doc, text: fs.readFileSync(doc, 'utf8') }));

  // Guard the observer: a skill naming no script would pass this for free.
  assert.ok(
    found.reduce((n, f) => n + named(f.text).length, 0) >= 2,
    'the skill should tell a Session to run at least the scaffold and the wiring script',
  );

  assert.deepEqual(
    found.flatMap((f) => unrooted(f.text).map((s) => `${rel(f.doc)} names ${s}`)),
    [],
    'a Session runs from the Workspace, so a plugin script needs the plugin root in front of it',
  );
});

test('there is one entry point for a human to remember', () => {
  const second = /\/explorable-teach:\w/;

  assert.ok(second.test('run /explorable-teach:init first'), 'this check sees a second command');
  assert.ok(!second.test('run /explorable-teach'), 'this check leaves the one entry point alone');

  // The decisions record is exempt, and has to be: it records the removal, and
  // a record that may not name what it removed is not a record. Everywhere else
  // a `/explorable-teach:…` is an instruction, and instructions must work.
  const RECORDS_THE_PAST = path.join(REPO_ROOT, 'docs', 'DECISIONS.md');

  const found = agentDocs()
    .filter((doc) => doc !== RECORDS_THE_PAST)
    .filter((doc) => second.test(fs.readFileSync(doc, 'utf8')))
    .map(rel);

  assert.deepEqual(found, [], 'these documents still send a human to a command that is gone');

  const commands = path.join(REPO_ROOT, 'commands');
  const shipped = fs.existsSync(commands) ? fs.readdirSync(commands) : [];
  assert.deepEqual(shipped, [], 'the plugin ships no command beside the skill');
});

test('the Unit is the spine the Teacher reasons about', () => {
  const unit = sections(SKILL).find((s) => /\bunit\b/i.test(s.title));
  assert.ok(unit, 'the skill should name the Unit in a heading of its own');

  assert.match(unit.body, /one Session delivers/i, 'a Unit is what one Session delivers');

  const missing = ['Lesson', 'Exercise', 'Checkpoint', 'Assignment', 'Learning Record'].filter(
    (part) => !new RegExp(`\\b${part}`, 'i').test(unit.body),
  );
  assert.deepEqual(missing, [], 'the Unit binds these artifacts; its definition should name them');
});

test('the ladder says when a Unit warrants the instruments it does not always earn', () => {
  const ladder = sections(SKILL).find((s) => /^the assessment ladder$/i.test(s.title));
  assert.ok(ladder, 'the skill should carry the assessment ladder in a section of its own');

  // The prose, not the table. The table says what each instrument *is* and
  // when it fires; an instrument a Unit may or may not earn also needs a
  // criterion for reaching for it, or the Teacher decides by appetite — and a
  // Checkpoint that nothing asks for is the slot the navigation bar renders
  // for a Unit that never got one.
  const prose = ladder.body.split('\n').filter((line) => !line.trim().startsWith('|')).join('\n');

  // Guard the observer: a ladder that is all table would find no criterion
  // anywhere, and this check would pass by describing nothing.
  assert.ok(prose.trim().length > 200, 'expected the ladder to argue in prose, not only tabulate');

  // Sentences rather than lines. A paragraph holds both instruments and every
  // condition word in the section, so a line-level check passes on a document
  // that says only "some Units earn a Checkpoint" — measured, not assumed.
  const sentences = sentencesOf(prose);

  for (const instrument of ['Checkpoint', 'Assignment']) {
    const stated = sentences.filter(
      (sentence) =>
        new RegExp(instrument, 'i').test(sentence) && /\b(when|unless|only|no|never)\b/i.test(sentence),
    );
    assert.ok(
      stated.length >= 1,
      `nothing tells the Teacher which Units warrant a ${instrument} and which do not`,
    );
  }
});

test('the assessment ladder separates the three instruments', () => {
  const terms = glossaryTerms('Assessment');

  // Guard the observer: a glossary parse that found nothing would pass for free.
  assert.ok(terms.length >= 3, `expected the glossary's Assessment terms, found ${terms.length}`);

  const unused = terms.filter((t) => !new RegExp(`\\b${t}`, 'i').test(SKILL));
  assert.deepEqual(unused, [], 'the Teacher cannot use a term the skill never states');

  const instruments = ['Exercise', 'Checkpoint', 'Assignment'];
  const ladder = sections(SKILL).find((s) =>
    instruments.every((i) => new RegExp(`\\*\\*${i}\\*\\*`, 'i').test(s.body)),
  );
  assert.ok(ladder, 'no one section defines the three instruments against each other');

  // The ladder is the three axes laid side by side: an instrument the Teacher
  // cannot place on all three is one it will choose between by feel.
  const rows = ladder.body.split('\n').filter((l) => l.trim().startsWith('|'));
  const cellsOf = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

  assert.ok(rows.length >= 4, `expected the ladder as a table, found ${rows.length} rows`);
  for (const axis of [/when/i, /judge/i, /measure/i]) {
    assert.match(rows[0], axis, 'the ladder heading should name all three axes');
  }

  for (const instrument of instruments) {
    const row = rows.find((r) => new RegExp(`\\*\\*${instrument}\\*\\*`, 'i').test(r));
    assert.ok(row, `the ladder should carry a row for ${instrument}`);

    const cells = cellsOf(row).slice(1);

    assert.equal(cells.length, 3, `${instrument} should be placed on exactly the three axes`);
    assert.deepEqual(
      cells.filter((c) => c === ''),
      [],
      `${instrument} leaves one of the three axes blank`,
    );
  }
});

test('a Session ends on a verifiable outcome, backed by a floor of actions', () => {
  const end = sections(SKILL).find((s) => /ending a session/i.test(s.title));
  assert.ok(end, 'the skill should say when a Session is over');

  // "stop deliberately" is a bound no agent can evaluate: a Session that
  // stopped anywhere at all can report that it stopped deliberately, so the
  // instruction constrains nothing and the next Session boots onto whatever
  // state was left. The replacement is an outcome, and outcomes are checkable.
  const UNEVALUABLE = /stop(?:s|ping|ped)? deliberately/i;
  assert.ok(UNEVALUABLE.test('deliver one Unit, then stop deliberately'), 'this check cannot see the bound it replaced');
  assert.ok(!UNEVALUABLE.test(SKILL), 'the Session boundary is back to a judgement call');

  assert.match(end.body, /\bresume\b/i, 'the criterion is about what the next Session can do');
  assert.match(end.body, /without asking/i, 'and about what it must not have to ask for');

  // A floor is a list of actions rather than a sentence of intent. Logical
  // lines, so a wrapped item is one item.
  const items = logicalLines(end.body)
    .map((l) => l.text)
    .filter((text) => /^\s*(?:[-*]|\d+\.)\s/.test(text));

  assert.ok(items.length >= 4, `a floor is a list of actions; found ${items.length}`);

  assert.deepEqual(
    HANDOFF_FLOOR.filter((f) => !items.some((item) => f.re.test(item))).map((f) => f.what),
    [],
    'the next Boot sequence reads this, so a Session that did not write it leaves a question to ask',
  );
});

test('discovery is a technique the Teacher judges, not a shape every Lesson is aimed at', () => {
  const judging = sections(SKILL).find((s) => /^judging\b/i.test(s.title));
  assert.ok(judging, 'the skill should carry the judgement criteria in a section of its own');

  // The instruction that was removed: a universal quantifier over Lessons,
  // pointed at the shape where the learner manipulates the subject first. The
  // conjunction is the check, because each half alone is legitimate — a Unit
  // may be built that way, and other rules here do bind every Unit.
  const UNIVERSAL = /\b(?:every|each|all|any)\s+(?:Lesson|Unit)s?\b/i;
  const THE_SHAPE = /Explorable|discover|manipulate|th(?:at|is) shape/i;
  const aimsEveryLessonAtIt = (sentence) => UNIVERSAL.test(sentence) && THE_SHAPE.test(sentence);

  assert.ok(
    aimsEveryLessonAtIt(
      'An Explorable lets the learner manipulate the subject before it is explained, and a wrong ' +
        'prediction meeting the real answer is the strongest learning signal there is; aim every ' +
        'Lesson at that shape.',
    ),
    'this check cannot see the instruction it replaced',
  );
  assert.ok(
    !aimsEveryLessonAtIt('Every Unit should leave the learner challenged just enough'),
    'this check reads an unrelated rule binding every Unit as the universal default',
  );
  assert.ok(
    !aimsEveryLessonAtIt('A wrong prediction meeting the real answer is the strongest signal there is'),
    'this check reads the technique itself as an instruction to reach for it',
  );

  // Sentences rather than logical lines: a paragraph folds into one line here,
  // so a line-level conjunction would fail on a paragraph that names the shape
  // in one sentence and every Lesson in another, innocently.
  const sentences = sentencesOf(SKILL);

  // Guard the observer: an empty list has no universal default in it, so a
  // reader that stopped recognising a sentence would pass this for free.
  assert.ok(sentences.length >= 50, `expected the spine's sentences, found ${sentences.length}`);

  assert.deepEqual(
    sentences.filter(aimsEveryLessonAtIt),
    [],
    'the technique is sound where it holds; the universal default is not',
  );

  // The subsection, not the whole section. `Judging what to teach next` also
  // holds knowledge-versus-skills and the zone of proximal development, and
  // both of those speak about every Unit — a whole-section read is a check
  // that can go on passing while the sentence it is about has been deleted.
  const shape = sections(judging.body, 3).find((s) => /interaction before explanation/i.test(s.title));
  assert.ok(shape, 'the skill should still carry interaction before explanation as a judgement it makes');

  assert.deepEqual(
    JUDGEMENT.filter((j) => !j.re.test(shape.body)).map((j) => j.what),
    [],
    'without this the Teacher has no test for whether a question has a wrong answer to confront',
  );

  // And it has to arrive whole, in one sentence. Sentences rather than logical
  // lines for the reason above — a paragraph folds into one of those, so a
  // line-level read would accept the four parts as four remarks made in the
  // same paragraph, which is not the one thing a Teacher applies to the
  // question in front of it.
  const whole = sentencesOf(shape.body).filter((sentence) =>
    JUDGEMENT.every((j) => j.re.test(sentence)),
  );
  assert.ok(whole.length >= 1, 'the judgement is one sentence, not four things said in one place');

  // And it stays a judgement about one question rather than becoming a
  // taxonomy: a Teacher reading "discovery suits the sciences" or "not below
  // this age" is back to deciding by category.
  for (const { by, re, control } of CLASSIFIES) {
    assert.match(control, re, `this check cannot see a classification by ${by}`);
    assert.ok(!re.test(shape.body), `the judgement is applied one question at a time, not by ${by}`);
  }
});

test('the Component that asks for a prediction is offered on the same judgement', () => {
  const authoring = fs.readFileSync(path.join(SKILL_DIR, 'UNIT.md'), 'utf8');

  // An open invitation is what the judgement replaced: the Component was for
  // "anything where intuition can be wrong", which an author believes about
  // every passage it has just written.
  const INVITATION = /\banything where\b/i;
  const WRITABLE = /\bwrit(?:e|ten|ing) down\b/i;

  assert.match('**The strongest of them.** Anything where intuition can be wrong', INVITATION,
    'this check cannot see the description it replaced');
  assert.doesNotMatch('Where you can write down the wrong answer the learner will give', INVITATION,
    'this check reads the description that replaced it as an invitation too');

  const lines = logicalLines(authoring);

  for (const { where, re } of OFFERS_A_PREDICTION) {
    const found = lines.filter(({ text }) => re.test(text));
    assert.equal(found.length, 1, `expected ${where}, found ${found.length} lines`);

    const [{ line, text }] = found;
    assert.ok(!INVITATION.test(text), `${where} (UNIT.md:${line}) still offers it for anything at all`);
    assert.match(
      text,
      WRITABLE,
      `${where} (UNIT.md:${line}) does not say what makes the question worth asking`,
    );
    assert.match(
      text,
      /wrong|misread|mistak/i,
      `${where} (UNIT.md:${line}) does not name a wrong answer as what is being confronted`,
    );
  }
});
