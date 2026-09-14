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
  sentencesOf,
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
  // Real case: the skill's documents fence both a Lesson template and a Markdown
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

test('a paragraph comes back as its sentences, wrapping and all', () => {
  // Two patterns that have to arrive *together* are a claim about one sentence.
  // Read off logical lines they would only be a claim about one paragraph,
  // which is a weaker thing than the check saying it.
  const sentences = sentencesOf(DOC);

  assert.ok(
    sentences.includes('Back to prose about the Tutor, which runs on past the column this paragraph wraps at.'),
    'a sentence wrapped across two lines comes back whole',
  );
  assert.ok(
    sentences.includes('Read the Mission.'),
    'two sentences in one folded item come back apart',
  );
  assert.deepEqual(
    sentences.filter((x) => /Scaffold/.test(x) && /Run the script/.test(x)),
    [],
    'a paragraph is not one sentence, which is the whole reason this exists',
  );
  // The one place it misreads, pinned rather than left to be discovered: an
  // ordered marker is punctuation followed by a space, so it splits off. The
  // orphan carries no words, which is what makes it harmless — recorded here so
  // that nobody reads a count of these as a count of prose sentences.
  assert.ok(sentences.includes('2.'), 'an ordered list marker splits off, and is expected to');

  assert.deepEqual(sentencesOf(''), [], 'a document with nothing in it has no sentences');
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
  // Every one of these is a heading this repo writes — in its own documents, or
  // in the `TECH-STACK.md` skeleton it hands the Teacher.
  //
  // The pair with punctuation *between spaces* is the one that matters:
  // dropping the `—` leaves two spaces, and GitHub replaces each of them, so
  // the anchor carries a double hyphen. Collapsing them instead — which this
  // did until review caught it — rejects the correct link and accepts the
  // broken one.
  const cases = [
    ['Knowledge, skills, wisdom', 'knowledge-skills-wisdom'],
    ['4. Write `TECH-STACK.md`', '4-write-tech-stackmd'],
    ['Subject-Specific Tools (if any)', 'subject-specific-tools-if-any'],
    ['Shipped Components — already in every Workspace', 'shipped-components--already-in-every-workspace'],
    ['Building a Component for this subject', 'building-a-component-for-this-subject'],
    // Synthetic, and deliberately so: no heading here carries an `&`, and the
    // three that did left with the Component catalog's tiers. Writing one into
    // a document to keep this case real would be the tail wagging the dog.
    ['Retention & Review', 'retention--review'],
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
