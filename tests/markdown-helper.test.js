'use strict';

// The fixture reader below, under test. `docs/agents/tests.md`, "The Markdown
// reader", says what it is for; this says that it does it.
//
// Two suites assert on the shape of `SKILL.md`, and a reader that quietly
// mis-parsed it would make both of them pass for free — reporting sections a
// reader never sees, or missing ones a reader does.

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  sections,
  step,
  headings,
  anchorFor,
  anchorsIn,
  logicalLines,
  linesMentioning,
} = require('./helpers/markdown.js');

const DOC = [
  'Front matter prose, which belongs to no section.',
  '',
  '## Boot sequence',
  '',
  '1. Scaffold, if the Workspace is bare.',
  '   Run the script.',
  '2. Read the Mission.',
  '',
  '### A nested heading',
  '',
  'Still inside Boot sequence.',
  '',
  '## The Unit',
  '',
  'A Unit is what one Session delivers.',
  '',
  '```md',
  '## Not a heading',
  '```',
  '',
  'Back to prose about the Tutor, which runs',
  'on past the column this paragraph wraps at.',
  '',
  '- a bullet mentioning the Grader, which also',
  '  wraps onto a second line',
  '- a second bullet',
].join('\n');

test('sections come back in document order, titled and bodied', () => {
  const found = sections(DOC);

  assert.deepEqual(found.map((s) => s.title), ['Boot sequence', 'The Unit']);
  assert.match(found[0].body, /Scaffold, if the Workspace is bare/);
  assert.ok(
    !found[0].body.includes('Front matter prose'),
    'text before the first heading belongs to no section',
  );
});

test('a heading inside a fenced block is not a section', () => {
  // Real case: `SKILL.md` fences both a Lesson template and a Markdown
  // skeleton. A parser fooled by either reports a section nobody reads.
  const titles = sections(DOC).map((s) => s.title);

  assert.ok(!titles.includes('Not a heading'), 'fenced code is not document structure');
  assert.match(
    sections(DOC)[1].body,
    /Back to prose/,
    'the section continues past the block it fenced',
  );
});

test('the heading level is selectable, and one level does not see another', () => {
  assert.deepEqual(sections(DOC, 3).map((s) => s.title), ['A nested heading']);
  assert.deepEqual(sections(DOC, 4), []);
});

test('a step runs from its own number to the next one', () => {
  const boot = sections(DOC)[0].body;

  assert.match(step(boot, 1), /Run the script/, 'a step carries its continuation lines');
  assert.ok(!step(boot, 1).includes('Read the Mission'), 'and stops at the next step');
  assert.equal(step(boot, 9), null, 'a step that is not there is absent, not empty');
});

test('a wrapped paragraph or bullet folds back into one logical line', () => {
  // Prose here is hard-wrapped at a column, so where a break falls is a
  // typographic accident. A reader that saw it would read one sentence as two.
  const folded = logicalLines(DOC).map((l) => l.text);

  assert.ok(
    folded.includes('Back to prose about the Tutor, which runs on past the column this paragraph wraps at.'),
    'a wrapped paragraph is one line',
  );
  assert.ok(
    folded.includes('- a bullet mentioning the Grader, which also wraps onto a second line'),
    'a wrapped list item is one line',
  );
  assert.ok(folded.includes('- a second bullet'), 'the next item starts a line of its own');
  assert.ok(folded.includes('## Not a heading'), 'fenced content is kept, never folded away');
});

test('mentions come back with the line number that locates them', () => {
  const found = linesMentioning(DOC, 'tutor');

  assert.equal(found.length, 1, 'one mention, however many lines it was wrapped across');
  assert.match(
    DOC.split('\n')[found[0].line - 1],
    /Back to prose about the Tutor/,
    'the line number points at where the mention starts',
  );
  assert.deepEqual(linesMentioning(DOC, 'checkpoint'), [], 'a term that is absent finds nothing');
});

test('a heading slugs to the anchor GitHub would give it', () => {
  // Every one of these is a heading this repo actually writes. The pairs with
  // punctuation *between spaces* are the ones that matter: dropping the `—`
  // leaves two spaces, and GitHub replaces each of them, so the anchor carries
  // a double hyphen. Collapsing them instead — which this did until review
  // caught it — rejects the correct link and accepts the broken one.
  const cases = [
    ['Knowledge, skills, wisdom', 'knowledge-skills-wisdom'],
    ['Recorded preferences (`NOTES.md`)', 'recorded-preferences-notesmd'],
    ['Tier 1: Core — ships with the plugin, already in `assets/`', 'tier-1-core--ships-with-the-plugin-already-in-assets'],
    ['Tier 3: Simulation & Practice (when hands-on matters)', 'tier-3-simulation--practice-when-hands-on-matters'],
    ['Tier 4: Retention & Review', 'tier-4-retention--review'],
  ];

  for (const [heading, anchor] of cases) {
    assert.equal(anchorFor(heading), anchor, `"${heading}" slugs wrong`);
  }
});

test('headings come back with their level, and anchors skip fenced ones', () => {
  const found = headings(DOC);

  assert.deepEqual(
    found.map((h) => [h.level, h.text]),
    [[2, 'Boot sequence'], [3, 'A nested heading'], [2, 'The Unit']],
    'every level, in document order, and nothing from inside the fence',
  );
  assert.equal(DOC.split('\n')[found[0].line - 1], '## Boot sequence', 'the line locates it');

  const anchors = anchorsIn(DOC);
  assert.ok(anchors.has('boot-sequence') && anchors.has('a-nested-heading'));
  assert.ok(!anchors.has('not-a-heading'), 'a fenced heading offers no anchor');
});

test('a fence indented inside a list item still fences', () => {
  // One rule for what fenced code is, shared by every reader here. Three
  // spellings of it had drifted apart before they were consolidated.
  const nested = ['- an item:', '', '  ```md', '  ## Not a heading', '  ```'].join('\n');

  assert.deepEqual(headings(nested), [], 'an indented fence is a fence');
  assert.deepEqual(sections(nested), [], 'and the section reader agrees');
});
