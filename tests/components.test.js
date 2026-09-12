'use strict';

// The complaint this closes: "the Component catalog names roughly twenty
// component files; none are shipped." Shipping them is only half of it — a
// Component that is present but broken teaches nobody. So each one is mounted
// in a scaffolded Workspace and actually driven here.
//
// Every Component is held to three promises the catalog makes on its behalf:
// it mounts, it responds, and the Lesson still reads as prose before any of it
// runs. That last one is what a learner gets when scripting is off.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const { Workspace } = require('./helpers/workspace.js');
const { Page } = require('./helpers/dom.js');
const { COMPONENTS, SHARED_STYLES, LESSON_HTML } = require('./helpers/lesson.js');

/** The fixture Lesson, in a Workspace scaffolded the way a learner's is. */
function lesson(t, { run = COMPONENTS.map((c) => c.js) } = {}) {
  const ws = Workspace.create(t);
  ws.scaffold();

  const page = Page.load(LESSON_HTML, ws.path('assets'));
  page.workspace = ws;
  for (const file of run) page.script(file);
  return page;
}

test('the Lesson reads as prose before a single Component runs', (t) => {
  const page = lesson(t, { run: [] });

  // Derived from the fixture's own markup rather than from a list of expected
  // sentences: a list would have to be extended by hand for each new
  // Component, and a Component whose markup hid its own teaching text would
  // pass for as long as nobody remembered to extend it.
  for (const component of COMPONENTS) {
    const root = page.query(component.root);
    assert.ok(root, `${component.name}: no root element`);

    const prose = page.text(component.root);
    assert.ok(prose.length >= 20, `${component.name}: has almost no text to read (${prose.length} chars)`);

    for (const node of [root, ...root.querySelectorAll('*')]) {
      assert.ok(
        !node.hasAttribute('hidden'),
        `${component.name}: <${node.localName}> is hidden in the authored markup, ` +
          'so a learner with scripting off never sees it',
      );
      assert.doesNotMatch(
        node.getAttribute('style') || '',
        /display\s*:\s*none|visibility\s*:\s*hidden/,
        `${component.name}: <${node.localName}> is hidden inline in the authored markup`,
      );
    }
  }
});

test('every Component mounts', (t) => {
  const page = lesson(t);

  for (const component of COMPONENTS) {
    const root = page.query(component.root);
    assert.ok(root, `${component.name}: no root element`);
    assert.ok(
      root.classList.contains('is-live'),
      `${component.name}: mounted Components mark themselves is-live`,
    );
  }
});

/* -------------------------------------------------------------- exercise */

test('an Exercise judges the answer the instant it is given', (t) => {
  const page = lesson(t, { run: ['exercise.js'] });
  const options = page.queryAll('.exercise-option');

  assert.equal(options.length, 3, 'each authored option becomes answerable');
  assert.equal(page.query('.exercise-why').hidden, true, 'the reason waits until they commit');

  page.click(options[1]); // the one marked data-correct

  assert.ok(page.query('.exercise').classList.contains('is-answered'));
  assert.ok(page.query('.exercise').classList.contains('is-correct'));
  assert.ok(options[1].classList.contains('is-chosen'));
  assert.equal(page.query('.exercise-why').hidden, false, 'the reason is shown once it is earned');
});

test('a wrong answer is named wrong, and the right one is shown', (t) => {
  const page = lesson(t, { run: ['exercise.js'] });
  const options = page.queryAll('.exercise-option');

  page.click(options[0]);

  assert.ok(page.query('.exercise').classList.contains('is-wrong'));
  assert.ok(options[0].classList.contains('is-wrong'));
  assert.ok(options[1].classList.contains('is-answer'), 'the learner has to be told which was right');
  assert.equal(page.query('.exercise-why').hidden, false);
});

test('the first answer is the one that counts', (t) => {
  const page = lesson(t, { run: ['exercise.js'] });
  const options = page.queryAll('.exercise-option');

  page.click(options[0]); // wrong
  page.click(options[1]); // then the right one, too late

  assert.ok(page.query('.exercise').classList.contains('is-wrong'), 'the verdict must not be re-rolled');
  assert.ok(!options[1].classList.contains('is-chosen'), 'the second click is not a second answer');
});

test('an Exercise is answerable from the keyboard', (t) => {
  const page = lesson(t, { run: ['exercise.js'] });
  const options = page.queryAll('.exercise-option');

  assert.equal(options[0].getAttribute('tabindex'), '0', 'options have to be reachable by tab');
  page.press(options[1], 'Enter');

  assert.ok(page.query('.exercise').classList.contains('is-correct'));
});

/* --------------------------------------------------------- predict-reveal */

test('a prediction is asked for before the answer is available', (t) => {
  const page = lesson(t, { run: ['predict-reveal.js'] });

  assert.equal(page.query('.predict-answer').hidden, true, 'the answer must not be readable yet');
  assert.ok(page.query('textarea.predict-guess'), 'there has to be somewhere to commit a guess');
  assert.ok(page.query('button.predict-reveal'), 'and a way to ask for the answer');
});

test('revealing with nothing written nudges first, then gives way', (t) => {
  const page = lesson(t, { run: ['predict-reveal.js'] });
  const button = page.query('button.predict-reveal');

  page.click(button);

  assert.equal(page.query('.predict-answer').hidden, true, 'first click should hold the answer back');
  assert.ok(page.query('.predict-nudge'), 'and say why');

  page.click(button);

  assert.equal(page.query('.predict-answer').hidden, false, 'a learner who is stuck is not held hostage');
});

test('a written guess reveals the answer at once and is kept', (t) => {
  const page = lesson(t, { run: ['predict-reveal.js'] });
  const guess = page.query('textarea.predict-guess');

  page.type(guess, '管道右边的先创建');
  page.click(page.query('button.predict-reveal'));

  assert.equal(page.query('.predict-answer').hidden, false);
  assert.ok(page.query('.predict').classList.contains('is-revealed'));
  assert.equal(guess.value, '管道右边的先创建', 'the prediction stays visible next to the answer');
  assert.ok(guess.hasAttribute('readonly'), 'and cannot be quietly rewritten afterwards');
});

/* --------------------------------------------------------- step-animation */

test('a step animation starts at the first step and shows only its stage', (t) => {
  const page = lesson(t, { run: ['step-animation.js'] });
  const steps = page.queryAll('.steps-step');

  assert.equal(steps.length, 4);
  assert.ok(steps[0].classList.contains('is-current'));
  assert.ok(steps[1].classList.contains('is-ahead'));
  assert.equal(page.query('[data-step="2"]').hidden, true, 'a later stage is not on screen yet');
  assert.match(page.text('.steps-count'), /1\s*\/\s*4/);
});

test('stepping forward moves the current step and its stage with it', (t) => {
  const page = lesson(t, { run: ['step-animation.js'] });

  page.click(page.query('.steps-next'));

  const steps = page.queryAll('.steps-step');
  assert.ok(steps[0].classList.contains('is-past'));
  assert.ok(steps[1].classList.contains('is-current'));
  assert.equal(page.query('[data-step="2"]').hidden, false, 'stage 2 belongs to step 2');
  assert.equal(page.query('[data-step="3"]').hidden, true);
  assert.match(page.text('.steps-count'), /2\s*\/\s*4/);
});

test('a step with nothing to stage shows no empty frame', (t) => {
  const page = lesson(t, { run: ['step-animation.js'] });

  // Step 1 has no `data-step="1"` element; steps 2 and 3 do.
  assert.ok(page.query('.steps-stage').classList.contains('is-empty'));

  page.click(page.query('.steps-next'));
  assert.ok(!page.query('.steps-stage').classList.contains('is-empty'));
});

test('a step animation cannot run off either end', (t) => {
  const page = lesson(t, { run: ['step-animation.js'] });

  assert.ok(page.query('.steps-prev').hasAttribute('disabled'), 'there is nothing before the first step');

  for (let i = 0; i < 6; i++) page.click(page.query('.steps-next'));

  assert.match(page.text('.steps-count'), /4\s*\/\s*4/);
  assert.ok(page.query('.steps-next').hasAttribute('disabled'));
});

test('a step animation is drivable from the keyboard', (t) => {
  const page = lesson(t, { run: ['step-animation.js'] });
  const root = page.query('.steps');

  page.press(root, 'ArrowRight');
  assert.match(page.text('.steps-count'), /2\s*\/\s*4/);

  page.press(root, 'ArrowLeft');
  assert.match(page.text('.steps-count'), /1\s*\/\s*4/);
});

/* -------------------------------------------------------------- drag-order */

test('a drag exercise can be reordered without a mouse', (t) => {
  const page = lesson(t, { run: ['drag-order.js'] });
  const items = page.queryAll('.dragorder-item');

  assert.equal(items.length, 3);
  assert.equal(items[0].getAttribute('draggable'), 'true');

  page.click(items[1].querySelector('.dragorder-up'));

  const order = page.queryAll('.dragorder-item').map((li) => li.getAttribute('data-order'));
  assert.deepEqual(order, ['1', '2', '3'], 'moving the second item up should sort the list');
});

test('a drag exercise is checked against the authored order', (t) => {
  const page = lesson(t, { run: ['drag-order.js'] });
  const check = page.query('.dragorder-check');

  page.click(check);

  assert.ok(page.query('.dragorder').classList.contains('is-wrong'), 'as authored, the order is wrong');
  assert.ok(page.query('.dragorder-item').classList.contains('is-misplaced'));
  assert.ok(page.text('.dragorder-verdict').length > 0, 'a verdict has to say something');

  page.click(page.queryAll('.dragorder-item')[1].querySelector('.dragorder-up'));
  page.click(check);

  assert.ok(page.query('.dragorder').classList.contains('is-correct'));
  assert.ok(!page.query('.dragorder').classList.contains('is-wrong'), 'the old verdict must be cleared');
  for (const item of page.queryAll('.dragorder-item')) {
    assert.ok(item.classList.contains('is-placed'), 'every item is in place once the order is right');
  }
});

test('dropping one item onto another reorders the list', (t) => {
  const page = lesson(t, { run: ['drag-order.js'] });
  const items = page.queryAll('.dragorder-item');
  const dataTransfer = { setData() {}, getData: () => '', effectAllowed: '', dropEffect: '' };

  page.fire(items[1], 'dragstart', { dataTransfer });
  assert.ok(items[1].classList.contains('is-dragging'));

  page.fire(items[0], 'dragover', { dataTransfer });
  page.fire(items[0], 'drop', { dataTransfer });
  page.fire(items[1], 'dragend', { dataTransfer });

  const order = page.queryAll('.dragorder-item').map((li) => li.getAttribute('data-order'));
  assert.deepEqual(order, ['1', '2', '3'], 'the dragged item lands where it was dropped');
  assert.ok(!items[1].classList.contains('is-dragging'), 'the drag state has to be cleaned up');
});

/* ------------------------------------------------------- styles cover them */

test('every class a Component puts on the page is styled', (t) => {
  const page = lesson(t);
  const shared = fs.readFileSync(page.workspace.path(`assets/${SHARED_STYLES}`), 'utf8');

  // Drive each Component into its states first, so the classes that only exist
  // after an interaction are on the page when this check reads it.
  page.click(page.queryAll('.exercise-option')[0]);
  page.click(page.query('button.predict-reveal'));
  page.click(page.query('button.predict-reveal'));
  page.click(page.query('.steps-next'));
  page.click(page.query('.dragorder-check'));

  for (const component of COMPONENTS) {
    const css = fs.readFileSync(page.workspace.path(`assets/${component.css}`), 'utf8');
    const root = page.query(component.root);
    const classes = new Set();

    const walk = (node) => {
      for (const child of node.children) {
        for (const token of child.className.split(/\s+/).filter(Boolean)) classes.add(token);
        walk(child);
      }
    };
    for (const token of root.className.split(/\s+/).filter(Boolean)) classes.add(token);
    walk(root);

    // Guard the observer twice over: enough classes to be worth checking, and
    // at least one state class — proving the interactions above actually ran
    // rather than that this loop read a Component which never mounted.
    assert.ok(classes.size >= 4, `${component.name}: expected classes to check, found ${classes.size}`);
    assert.ok(
      [...classes].some((token) => token.startsWith('is-')),
      `${component.name}: no state class on the page, so nothing was exercised`,
    );

    for (const token of classes) {
      const styled = new RegExp(String.raw`\.${token}(?![\w-])`);
      assert.ok(
        styled.test(css) || styled.test(shared),
        `${component.name}: .${token} lands on the page but nothing styles it`,
      );
    }
  }
});
