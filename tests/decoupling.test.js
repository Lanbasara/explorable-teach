'use strict';

// What this holds, and why the check is shaped the way it is:
// `docs/agents/tests.md`, "The decoupling check".

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { REPO_ROOT } = require('./helpers/workspace.js');
const { SKILL_DIR } = require('./helpers/docs.js');

/**
 * What naming the upstream project looks like in text. `label` completes the
 * sentence "this line names …" in the failure message.
 *
 * `teach` is a verb this repo uses in almost every paragraph, so matching the
 * bare word would flag the whole corpus. Every pattern matches it *as a skill*,
 * and the lookbehinds exclude a preceding hyphen so that none of them fire on
 * this project's own `explorable-teach`.
 *
 * `BY_NAME` is split out because the README check needs it alone: a README that
 * dropped the credit but happened to use the word "upstream" must not pass for
 * having kept it.
 */
const BY_NAME = [
  {
    label: 'the upstream skill by name',
    re: /(?<![\w-])`teach`|(?<![\w-])teach skill\b|skills\/productivity\/teach/i,
  },
  { label: 'its author', re: /matt ?pocock/i },
];

const UPSTREAM = [
  ...BY_NAME,
  {
    // The shape the absorbed passages had: a heading naming a topic, and a body
    // deferring to someone else's document for what it actually says.
    label: 'a deferral to it',
    re: /\b(?:inherits?|inherited|same(?: rules)? as|overrides?)\s+(?:the\s+|from\s+)?`?teach`?(?![\w-])/i,
  },
  { label: 'a comparison against it', re: /\bupstream\b/i },
  { label: 'the installed plugin copy', re: /plugins\/cache|claude-plugins-official/i },
];

/**
 * Guard the observer. Every line here is a real reference this repo carried
 * before the pedagogy was absorbed, plus the shape a future one would take. A
 * check that no longer recognises them has stopped checking anything.
 */
const KNOWN_REFERENCES = [
  'This skill inherits the pedagogical foundations of the `teach` skill.',
  'Same rules as the teach skill, plus:',
  '### Inherited from teach',
  'Same as teach — delegate to communities when the question requires experience.',
  "Built on the pedagogy of Matt Pocock's skill.",
  'This deliberately overrides the upstream skill.',
  '~/.claude/plugins/cache/mattpocock-skills/1.2.3/skills/productivity/teach/SKILL.md',
];

/** Text that names this project, and must never be mistaken for the other one. */
const OUR_OWN = [
  'Teach a topic through interactive, explorable HTML lessons.',
  'The `explorable-teach` skill owns the pedagogy.',
  'window.TEACH_UNITS.forEach(render)',
  '`/explorable-teach` scaffolds the workspace on its first run.',
];

function filesUnder(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...filesUnder(abs));
    else if (entry.isFile()) found.push(abs);
  }
  return found;
}

const skillFiles = filesUnder(SKILL_DIR);

test('the check can see a reference, and does not see one where there is none', () => {
  for (const sample of KNOWN_REFERENCES) {
    assert.ok(
      UPSTREAM.some((p) => p.re.test(sample)),
      `this check would have let through: ${sample}`,
    );
  }

  for (const sample of OUR_OWN) {
    const hit = UPSTREAM.find((p) => p.re.test(sample));
    assert.ok(!hit, `this check reads our own project as the other one (${hit?.label}): ${sample}`);
  }

  // Not a count: the one file whose absence would make this suite meaningless.
  assert.ok(
    skillFiles.includes(path.join(SKILL_DIR, 'SKILL.md')),
    `the scan missed SKILL.md; it found ${skillFiles.length} files under the skill`,
  );
});

test('nothing under the skill directory references the upstream project', () => {
  const found = [];

  for (const file of skillFiles) {
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
      for (const pattern of UPSTREAM) {
        if (pattern.re.test(line)) {
          found.push(
            `${path.relative(REPO_ROOT, file)}:${index + 1} names ${pattern.label} — ${line.trim()}`,
          );
        }
      }
    });
  }

  assert.deepEqual(
    found,
    [],
    'the skill must carry its own pedagogy; an agent running it cannot open anyone else\'s',
  );
});

test('the README keeps the acknowledgement', () => {
  const readme = fs.readFileSync(path.join(REPO_ROOT, 'README.md'), 'utf8');

  // BY_NAME, not UPSTREAM: a README that dropped the credit but used the word
  // "upstream" somewhere would otherwise pass for having kept it.
  assert.ok(
    BY_NAME.some((p) => p.re.test(readme)),
    'what was removed is the runtime dependency, not the debt — the README still owes the credit',
  );
});
