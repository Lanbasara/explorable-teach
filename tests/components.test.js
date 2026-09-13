'use strict';

// The complaint this closes: "the Component catalog names roughly twenty
// component files; none are shipped." Shipping them is only half of it — a
// Component that is present but broken teaches nobody. So each one is mounted
// in a scaffolded Workspace and actually driven here.
//
// Every Component is held to three promises the catalog makes on its behalf:
// it mounts, it responds, and the page still reads as prose before any of it
// runs. That last one is what a learner gets when scripting is off.
//
// The generic checks iterate the pages of the fixture Unit rather than one
// page, because the Unit is more than one file: the Checkpoint is a page of its
// own, and the Component that gates it is used nowhere else.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const { Workspace } = require('./helpers/workspace.js');
const { Page } = require('./helpers/dom.js');
const { SHARED_STYLES, PAGES } = require('./helpers/unit.js');

const LESSON = PAGES.find((p) => p.key === 'lesson');
const GATE = PAGES.find((p) => p.key === 'checkpoint');

/**
 * A stylesheet minus its print rules. A class styled only when the lesson is
 * printed is not styled for the learner reading it, so it must not count as
 * coverage below.
 */
function onScreen(css) {
  return css.replace(/@media\s+print\s*\{[\s\S]*?\n\}/g, '');
}

/** One page of the fixture Unit, in a Workspace scaffolded the way a learner's is. */
function open(t, fixture, { run = fixture.components.map((c) => c.js) } = {}) {
  const ws = Workspace.create(t);
  ws.scaffold();

  const page = Page.load(fixture.html, ws.path('assets'));
  page.workspace = ws;
  for (const file of run) page.script(file);
  return page;
}

/** The Lesson page, which is what most of the Components below live on. */
function lesson(t, options) {
  return open(t, LESSON, options);
}

/** The Checkpoint page: the Exercises it is built from, then the gate itself. */
function checkpoint(t, options) {
  return open(t, GATE, options);
}

test('every page of the Unit reads as prose before a single Component runs', (t) => {
  for (const fixture of PAGES) {
    const page = open(t, fixture, { run: [] });

    // Derived from the fixture's own markup rather than from a list of expected
    // sentences: a list would have to be extended by hand for each new
    // Component, and a Component whose markup hid its own teaching text would
    // pass for as long as nobody remembered to extend it.
    for (const component of fixture.components) {
      const root = page.query(component.root);
      assert.ok(root, `${fixture.name}, ${component.name}: no root element`);

      const prose = page.text(component.root);
      assert.ok(
        prose.length >= 20,
        `${fixture.name}, ${component.name}: has almost no text to read (${prose.length} chars)`,
      );

      for (const node of [root, ...root.querySelectorAll('*')]) {
        assert.ok(
          !node.hasAttribute('hidden'),
          `${fixture.name}, ${component.name}: <${node.localName}> is hidden in the authored markup, ` +
            'so a learner with scripting off never sees it',
        );
        assert.doesNotMatch(
          node.getAttribute('style') || '',
          /display\s*:\s*none|visibility\s*:\s*hidden/,
          `${fixture.name}, ${component.name}: <${node.localName}> is hidden inline in the authored markup`,
        );
      }
    }
  }
});

test('every Component mounts', (t) => {
  for (const fixture of PAGES) {
    const page = open(t, fixture);

    for (const component of fixture.components) {
      const root = page.query(component.root);
      assert.ok(root, `${fixture.name}, ${component.name}: no root element`);
      assert.ok(
        root.classList.contains('is-live'),
        `${fixture.name}, ${component.name}: mounted Components mark themselves is-live`,
      );
    }
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

test('a step can be jumped to by click or by keyboard', (t) => {
  const page = lesson(t, { run: ['step-animation.js'] });
  const steps = page.queryAll('.steps-step');

  page.click(steps[2]);
  assert.match(page.text('.steps-count'), /3\s*\/\s*4/);

  assert.equal(steps[0].getAttribute('tabindex'), '0', 'a clickable step must also be reachable');
  page.press(steps[0], 'Enter');
  assert.match(page.text('.steps-count'), /1\s*\/\s*4/);
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

test('a drag-ordering Component can be reordered without a mouse', (t) => {
  const page = lesson(t, { run: ['drag-order.js'] });
  const items = page.queryAll('.drag-order-item');

  assert.equal(items.length, 3);
  assert.equal(items[0].getAttribute('draggable'), 'true');

  page.click(items[1].querySelector('.drag-order-up'));

  const order = page.queryAll('.drag-order-item').map((li) => li.getAttribute('data-order'));
  assert.deepEqual(order, ['1', '2', '3'], 'moving the second item up should sort the list');
});

test('drag ordering is checked against the authored order', (t) => {
  const page = lesson(t, { run: ['drag-order.js'] });
  const check = page.query('.drag-order-check');

  page.click(check);

  assert.ok(page.query('.drag-order').classList.contains('is-wrong'), 'as authored, the order is wrong');
  assert.ok(page.query('.drag-order-item').classList.contains('is-misplaced'));
  assert.ok(page.text('.drag-order-verdict').length > 0, 'a verdict has to say something');

  page.click(page.queryAll('.drag-order-item')[1].querySelector('.drag-order-up'));
  page.click(check);

  assert.ok(page.query('.drag-order').classList.contains('is-correct'));
  assert.ok(!page.query('.drag-order').classList.contains('is-wrong'), 'the old verdict must be cleared');
  for (const item of page.queryAll('.drag-order-item')) {
    assert.ok(item.classList.contains('is-placed'), 'every item is in place once the order is right');
  }
});

test('dropping one item onto another reorders the list', (t) => {
  const page = lesson(t, { run: ['drag-order.js'] });
  const items = page.queryAll('.drag-order-item');
  const dataTransfer = { setData() {}, getData: () => '', effectAllowed: '', dropEffect: '' };

  page.fire(items[1], 'dragstart', { dataTransfer });
  assert.ok(items[1].classList.contains('is-dragging'));

  page.fire(items[0], 'dragover', { dataTransfer });
  page.fire(items[0], 'drop', { dataTransfer });
  page.fire(items[1], 'dragend', { dataTransfer });

  const order = page.queryAll('.drag-order-item').map((li) => li.getAttribute('data-order'));
  assert.deepEqual(order, ['1', '2', '3'], 'the dragged item lands where it was dropped');
  assert.ok(!items[1].classList.contains('is-dragging'), 'the drag state has to be cleaned up');
});

/* ------------------------------------------------------------- checkpoint */

test('a Checkpoint says nothing until every question has been answered', (t) => {
  const page = checkpoint(t);

  assert.equal(page.queryAll('.exercise').length, 3, 'the gate is built out of its questions');
  assert.equal(page.query('.checkpoint-pass').hidden, true, 'a verdict before the answers is not a verdict');
  assert.equal(page.query('.checkpoint-again').hidden, true);
  assert.match(page.text('.checkpoint-progress'), /0\s*\/\s*3/, 'the learner is told how far through they are');

  page.click(page.queryAll('.exercise')[0].querySelectorAll('.exercise-option')[1]);

  assert.ok(!page.query('.checkpoint').classList.contains('is-judged'), 'one answer is not the Unit');
  assert.match(page.text('.checkpoint-progress'), /1\s*\/\s*3/);
  assert.equal(page.query('.checkpoint-pass').hidden, true);
});

/** Answer every question of the fixture Checkpoint; `wrong` names the ones to fail. */
function sit(page, { wrong = [] } = {}) {
  page.queryAll('.exercise').forEach((question, i) => {
    const options = question.querySelectorAll('.exercise-option');
    const right = options.find((option) => option.hasAttribute('data-correct'));
    page.click(wrong.includes(i) ? options.find((option) => option !== right) : right);
  });
}

test('a Checkpoint answered right says the Unit may close', (t) => {
  const page = checkpoint(t);

  sit(page);

  const root = page.query('.checkpoint');
  assert.ok(root.classList.contains('is-judged'), 'the page judges, at the end of the Unit');
  assert.ok(root.classList.contains('is-passed'));
  assert.equal(page.query('.checkpoint-pass').hidden, false, 'the learner finds out they may move on');
  assert.equal(page.query('.checkpoint-again').hidden, true, 'and is not also told to go back');
  assert.match(page.text('.checkpoint-progress'), /3\s*\/\s*3/, 'the score is what they report to the Teacher');
});

test('one wrong answer holds the Unit open, and says where to go back to', (t) => {
  const page = checkpoint(t);

  sit(page, { wrong: [1] });

  const root = page.query('.checkpoint');
  assert.ok(root.classList.contains('is-judged'));
  assert.ok(root.classList.contains('is-failed'), 'a gate with a pass mark is a score, not a gate');
  assert.equal(page.query('.checkpoint-again').hidden, false);
  assert.equal(page.query('.checkpoint-pass').hidden, true);
  assert.match(page.text('.checkpoint-progress'), /2\s*\/\s*3/);

  const back = page.query('.checkpoint-again a');
  assert.ok(back, 'being sent back without being told where teaches nothing');
  assert.match(back.getAttribute('href'), /^0003-/, 'the way back is the Lesson this gate closes');
});

test('a Checkpoint is answerable from the keyboard, like the Exercises it counts', (t) => {
  const page = checkpoint(t);

  for (const question of page.queryAll('.exercise')) {
    page.press(question.querySelector('.exercise-option[data-correct]'), 'Enter');
  }

  assert.ok(page.query('.checkpoint').classList.contains('is-passed'));
});

test('a Checkpoint with no questions in it does not claim to have judged anything', (t) => {
  const page = checkpoint(t, { run: [] });

  for (const question of page.queryAll('.exercise')) question.remove();
  page.script('checkpoint.js');

  const root = page.query('.checkpoint');
  assert.ok(!root.classList.contains('is-live'), 'there is nothing here to gate the Unit with');
  assert.equal(page.query('.checkpoint-pass').hidden, false, 'and nothing has been taken over to hide');
});

/* ------------------------------------------------------- styles cover them */

test('every class a Component puts on the page is styled', (t) => {
  // Each page gets driven into its Components' states first, so the classes
  // that only exist after an interaction are on the page when this reads it.
  const drive = {
    lesson(page) {
      page.click(page.queryAll('.exercise-option')[0]);
      page.click(page.query('button.predict-reveal'));
      page.click(page.query('button.predict-reveal'));
      page.click(page.query('.steps-next'));
      page.click(page.query('.drag-order-check'));
    },
    checkpoint(page) {
      sit(page, { wrong: [2] });
    },
  };

  for (const fixture of PAGES) {
    const page = open(t, fixture);
    const shared = onScreen(fs.readFileSync(page.workspace.path(`assets/${SHARED_STYLES}`), 'utf8'));
    drive[fixture.key](page);

    for (const component of fixture.components) {
      const css = onScreen(fs.readFileSync(page.workspace.path(`assets/${component.css}`), 'utf8'));
      const root = page.query(component.root);
      const classes = new Set();

      // A Component nested inside another — the Exercises a Checkpoint counts —
      // is walked as itself and not as part of its host, so each class is still
      // checked against the stylesheet of the Component that put it there.
      const nested = fixture.components.filter((c) => c !== component).map((c) => c.root);
      const walk = (node) => {
        for (const child of node.children) {
          if (nested.some((selector) => child.matches(selector))) continue;
          for (const token of child.className.split(/\s+/).filter(Boolean)) classes.add(token);
          walk(child);
        }
      };
      for (const token of root.className.split(/\s+/).filter(Boolean)) classes.add(token);
      walk(root);

      // Guard the observer twice over: enough classes to be worth checking, and
      // at least one state class — proving the interactions above actually ran
      // rather than that this loop read a Component which never mounted.
      assert.ok(
        classes.size >= 4,
        `${fixture.name}, ${component.name}: expected classes to check, found ${classes.size}`,
      );
      assert.ok(
        [...classes].some((token) => token.startsWith('is-')),
        `${fixture.name}, ${component.name}: no state class on the page, so nothing was exercised`,
      );

      for (const token of classes) {
        // `is-live` is the mount marker every Component sets, and a Component
        // with nothing to restyle on mount legitimately never keys off it. It
        // still has to be set: the tests and the print rules both read it.
        if (token === 'is-live') continue;

        const styled = new RegExp(String.raw`\.${token}(?![\w-])`);
        assert.ok(
          styled.test(css) || styled.test(shared),
          `${fixture.name}, ${component.name}: .${token} lands on the page but nothing styles it`,
        );
      }
    }
  }
});
