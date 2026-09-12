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
const { sections, step } = require('./helpers/markdown.js');

const SKILL_MD = path.join(SKILL_DIR, 'SKILL.md');
const SKILL = fs.readFileSync(SKILL_MD, 'utf8');

const rel = (abs) => path.relative(REPO_ROOT, abs);

/** The terms `CONTEXT.md` defines under one of its `###` groupings. */
function glossaryTerms(grouping) {
  const context = fs.readFileSync(path.join(REPO_ROOT, 'CONTEXT.md'), 'utf8');
  const group = sections(context, 3).find((s) => s.title === grouping);
  assert.ok(group, `CONTEXT.md has no "${grouping}" grouping`);

  return [...group.body.matchAll(/^\*\*(.+?)\*\*:$/gm)].map((m) => m[1]);
}

/**
 * Every template `scripts/init-workspace.sh` copies into a Workspace — the
 * source end of each copy, not the destination.
 *
 * `init-workspace.test.js` reads the script's *report* instead, which is the
 * route `docs/agents/tests.md` endorses. It cannot serve here: the report names
 * where each file landed, and what a document restating the list would name is
 * where each file came from. So this one reads the copy list itself.
 */
function scaffoldSources() {
  const script = fs.readFileSync(path.join(REPO_ROOT, 'scripts/init-workspace.sh'), 'utf8');
  return [...script.matchAll(/place\s+"\$TPL\/(\S+?)"/g)].map((m) => `templates/${m[1]}`);
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
    .map((src) => `${src}   → <workspace>/${src.replace('templates/', '')}`)
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
