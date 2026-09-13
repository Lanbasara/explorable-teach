'use strict';

// The complaint this closes: "the navigation bar renders a 'Checkpoint' slot
// for every Unit, but Checkpoint is never defined anywhere". The definition is
// the other ticket; this is the slot.
//
// A Unit is more than one file, and a file nobody can find was not worth
// writing. So the claim here is about reachability: from any page of a Unit,
// every other page of that Unit is one click away — and a page that does not
// exist says so where it would have been, rather than leaving a gap the
// learner has to interpret.
//
// Nothing here writes a link list, and neither does a page: the bar derives
// every link from the course manifest, so what is under test is that
// derivation against a manifest with one Unit that has a Checkpoint and one
// that does not.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { Workspace } = require('./helpers/workspace.js');
const { Page } = require('./helpers/dom.js');
const { SKILL_DIR } = require('./helpers/docs.js');
const { UNIT, PAGES } = require('./helpers/unit.js');

/** The Unit after the fixture one: taught, but with no Checkpoint written. */
const BARE = { id: '0004', num: 'L04', lesson: 'lessons/0004-pipes.html' };

const MANIFEST = `window.TEACH_COURSE = { title: '进程' };
window.TEACH_UNITS = [
  {
    id: '${UNIT.id}', num: '${UNIT.num}', status: 'done',
    title: '${UNIT.title}',
    lesson: '${UNIT.lesson}',
    checkpoint: '${UNIT.checkpoint}',
    assignment: '${UNIT.assignment}'
  },
  {
    id: '${BARE.id}', num: '${BARE.num}', status: 'teaching',
    title: '管道',
    lesson: '${BARE.lesson}'
  }
];
`;

/**
 * One page of a Workspace, with the nav bar mounted on it the way
 * `lesson-boot.js` mounts it: the manifest first, then the bar, carrying the
 * Unit id the page declares.
 *
 * `at` is the file the learner has open, which is how the bar knows which slot
 * is the page they are already on.
 */
function opened(t, { html, at, unit }) {
  const ws = Workspace.create(t);
  ws.scaffold();
  ws.write('assets/units.js', MANIFEST);

  const page = Page.load(html, ws.path('assets'), {
    globals: {
      location: { protocol: 'file:', pathname: `/${at}`, href: `file:///${at}` },
    },
  });
  page.script('units.js');
  page.script('nav.js', { 'data-unit': unit });
  return page;
}

/** The slots for this Unit's own pages, in the order the bar renders them. */
function slots(page) {
  const bar = page.query('.tnav');
  assert.ok(bar, 'the nav bar did not mount, so nothing below is a claim about it');

  const found = page.query('.tnav-sibs').children;
  assert.equal(found.length, 3, 'a Unit has three artifacts, and the bar has a slot for each');
  return found;
}

const hrefs = (page) => page.queryAll('.tnav a').map((a) => a.getAttribute('href'));

const fixture = (key) => PAGES.find((p) => p.key === key);

test('a Lesson whose Unit has a Checkpoint links to it', (t) => {
  const page = opened(t, {
    html: fixture('lesson').html,
    at: UNIT.lesson,
    unit: UNIT.id,
  });

  const [lesson, checkpoint, assignment] = slots(page);

  assert.equal(lesson.localName, 'span', 'the Lesson is the page they are on');
  assert.ok(lesson.classList.contains('tnav-here'));

  assert.equal(checkpoint.localName, 'a', 'the Checkpoint exists, so the slot is a way to reach it');
  assert.equal(checkpoint.getAttribute('href'), `../${UNIT.checkpoint}`);
  assert.ok(checkpoint.textContent.trim().length > 0, 'and it is labelled');

  assert.equal(assignment.localName, 'a', 'and so does the Assignment');
  assert.equal(assignment.getAttribute('href'), `../${UNIT.assignment}`);

  // The bar is derived and always there; the Lesson still sends the learner on
  // at the point in the page where they have finished reading it, which is the
  // sibling rule the authoring document states.
  const sibling = page.queryAll('.lesson a').map((a) => a.getAttribute('href'));
  assert.ok(
    sibling.includes(path.basename(UNIT.checkpoint)),
    'the Lesson should point at its own Checkpoint where it ends, not only from the bar',
  );
  assert.ok(
    sibling.includes(`../${UNIT.assignment}`),
    'and at its own Assignment, which does not sit in the same directory it does',
  );
});

test('an Assignment reaches back into the Unit it draws on', (t) => {
  // An Assignment fires one to three Units after the material, from a directory
  // of its own. So it is the page most likely to be opened cold — and the one
  // where "which Lesson was this?" has to be one click rather than a search.
  const page = opened(t, {
    html: fixture('assignment').html,
    at: UNIT.assignment,
    unit: UNIT.id,
  });

  const [lesson, , assignment] = slots(page);

  assert.equal(lesson.localName, 'a', 'the Lesson it draws on is reachable from here');
  assert.equal(lesson.getAttribute('href'), `../${UNIT.lesson}`);

  assert.ok(assignment.classList.contains('tnav-here'), 'and this is the page they are on');
  assert.equal(assignment.getAttribute('aria-current'), 'page');

  assert.ok(
    hrefs(page).some((href) => href.endsWith('index.html')),
    'every page of a Unit is reachable from the Dossier, and reaches it back',
  );
});

test('a Checkpoint links back to the Lesson it closes', (t) => {
  const page = opened(t, {
    html: fixture('checkpoint').html,
    at: UNIT.checkpoint,
    unit: UNIT.id,
  });

  const [lesson, checkpoint] = slots(page);

  assert.equal(lesson.localName, 'a', 'the way back has to be in the bar, not only in the prose');
  assert.equal(lesson.getAttribute('href'), `../${UNIT.lesson}`);

  assert.ok(checkpoint.classList.contains('tnav-here'), 'and this is the page they are on');
  assert.equal(checkpoint.getAttribute('aria-current'), 'page');

  assert.ok(
    hrefs(page).some((href) => href.endsWith('index.html')),
    'every page of a Unit is reachable from the Dossier, and reaches it back',
  );
});

test('a Unit with no Checkpoint shows the slot as missing rather than hiding it', (t) => {
  const page = opened(t, {
    html: fixture('lesson').html,
    at: BARE.lesson,
    unit: BARE.id,
  });

  const [, checkpoint, assignment] = slots(page);

  assert.ok(assignment.classList.contains('tnav-off'), 'a Unit with no Assignment degrades the same way');
  assert.ok(checkpoint.classList.contains('tnav-off'), 'the slot degrades rather than disappearing');
  assert.ok(!checkpoint.hidden, 'a slot the learner cannot see tells them nothing');
  assert.ok(checkpoint.textContent.trim().length > 0, 'it still says which artifact is missing');
  assert.ok(checkpoint.getAttribute('title'), 'and says that it has not been written');

  // Guard the observer: an empty bar would satisfy the filter below for free.
  // Two is what this Unit's bar holds — the Dossier and the Unit before it —
  // because it is the last Unit in the manifest and has no Checkpoint.
  assert.ok(hrefs(page).length >= 2, `expected a bar with links in it, found ${hrefs(page).length}`);
  assert.ok(hrefs(page).some((href) => href.endsWith('index.html')), 'starting with the Dossier');
  assert.deepEqual(
    hrefs(page).filter((href) => href.includes('checkpoint')),
    [],
    'nothing in the bar points at a Checkpoint that was never written',
  );
});

/**
 * Every rule that names `selector`, as `{ selector, body }`.
 *
 * Two things here are load-bearing, and both were wrong first time round. The
 * slot is styled by more than one rule — a shared one it shares with the links
 * beside it, and its own — so reading the *first* match reads the shared rule
 * and never the slot's. And a `transition` names properties it does not set, so
 * a body is read with its transitions stripped; otherwise `transition: color`
 * counts as giving the slot a colour, which is how the first version of the
 * check passed against a slot styled `display: none`.
 */
function rulesNaming(css, selector) {
  // The selector is a class, so its leading `.` has to be escaped before it is
  // a pattern. `(?![\w-])` keeps `.tnav-off` from matching a `.tnav-offer`.
  const names = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`);

  return css.split('}').flatMap((block) => {
    const brace = block.indexOf('{');
    if (brace < 0) return [];

    const written = block.slice(0, brace).replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (!names.test(written)) return [];

    return [{ selector: written, body: block.slice(brace + 1).replace(/transition:[^;]*;?/g, '') }];
  });
}

test('a missing slot is visible, not merely present', () => {
  // The claim above is about the tree; this is the half of it that lives in the
  // stylesheet, and it is the half that would break silently. No browser runs
  // here, so what is checkable is that nothing styles the slot out of sight.
  const css = fs.readFileSync(path.join(SKILL_DIR, 'runtime', 'assets', 'nav.css'), 'utf8');
  const rules = rulesNaming(css, '.tnav-off');

  // Guard the observer: a selector nothing matches would pass every check below.
  assert.ok(rules.length >= 1, 'the unavailable slot should be styled as unavailable');

  for (const rule of rules) {
    assert.doesNotMatch(
      rule.body,
      /display:\s*none|visibility:\s*hidden/,
      `"${rule.selector}" takes the slot off the page instead of showing it out of reach`,
    );
  }

  assert.ok(
    rules.some(({ body }) => /opacity:|color:/.test(body)),
    'the slot is shown, and shown to be unreachable — not merely left unstyled',
  );
});

test('the bar is derived from the manifest, so a page writes no link list', (t) => {
  const page = opened(t, {
    html: fixture('checkpoint').html,
    at: UNIT.checkpoint,
    unit: UNIT.id,
  });

  // The page hand-writes the way back into its own Lesson and nothing else:
  // every other link in the bar came from the manifest, which is what keeps a
  // renamed file from being chased through every page of the Unit.
  assert.ok(hrefs(page).length >= 3, `expected the bar to derive its links, found ${hrefs(page).length}`);
  assert.ok(
    hrefs(page).some((href) => href === `../${BARE.lesson}`),
    'the next Unit is reachable from this one, and it is the manifest that says so',
  );
});
