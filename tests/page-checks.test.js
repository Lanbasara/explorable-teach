'use strict';

// The pass a Teacher runs over a Lesson before handing it over, held to three
// things that can be checked without a browser: the file parses and says what
// it ships, every check answers in one shape, and no check throws on a page
// that lacks the thing it examines.
//
// What is *not* here is the browser. Nothing below lays anything out, computes
// a style or rasterises a pixel — the stub page returns the boxes and the
// colours a test wrote into it. So this suite holds the contract and the
// documented misreads; whether a real page is actually laid out the way the
// checks read it is what running the pass in a browser is for. That gap is
// written down in `docs/agents/tests.md`, under what is deliberately not
// tested, along with why a browser is not added here to close it.
//
// The observer is guarded the way the rest of the suite guards one: a check
// that answered `null` to everything would satisfy "returns the shape" and
// "does not throw" for free, so every check is also driven against a page
// holding its subject and has to reach a verdict there.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const { Workspace, REPO_ROOT } = require('./helpers/workspace.js');

const SOURCE_FILE = path.join(REPO_ROOT, 'scripts/page-checks.js');
const SOURCE = fs.readFileSync(SOURCE_FILE, 'utf8');

/**
 * The checks, loaded the way the page loads them: evaluated in a context that
 * holds nothing. A reach for a global `document` or `window` throws here
 * rather than in a browser session, which is the same reason `rich-text.js` is
 * written to take its nodes as an argument.
 */
function pageChecks() {
  const sandbox = {};
  vm.runInNewContext(SOURCE, sandbox, { filename: 'page-checks.js' });
  assert.equal(typeof sandbox.PageChecks, 'object', 'the file should define PageChecks on its global');
  return sandbox.PageChecks;
}

/** The head comment, which is where a check's misreads are documented. */
const HEAD = SOURCE.slice(0, SOURCE.indexOf('(function (root)'));

/* ------------------------------------------------------------- a stub page */

/**
 * A page as small as the checks' contract allows: elements that know their
 * box, their style and their text, and a document that can be asked for them.
 * Nothing here lays anything out — a test writes the boxes it wants read.
 */
function el(tag, options = {}) {
  const node = {
    tagName: tag.toUpperCase(),
    nodeType: 1,
    parentNode: null,
    childNodes: [],
    attrs: options.attrs || {},
    style: options.style || {},
    rect: options.rect || null,
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
    },
    getBoundingClientRect() {
      return this.rect;
    },
  };
  if (options.text) node.childNodes.push({ nodeType: 3, nodeValue: options.text });
  for (const child of options.children || []) {
    child.parentNode = node;
    node.childNodes.push(child);
  }
  Object.assign(node, options.extra || {});
  return node;
}

/** A rectangle, in the shape `getBoundingClientRect` hands one back in. */
const box = (left, top, width, height) => ({ left, top, width, height });

function descendants(nodes) {
  return nodes.flatMap((n) => [n, ...descendants(n.childNodes.filter((c) => c.nodeType === 1))]);
}

/**
 * A document over those elements. `at` is the element `elementFromPoint`
 * answers with — the seam the pointer-events misread lives in, because that is
 * exactly the answer a browser gives while an overlay covers the text.
 */
function pageOf(nodes, { at, blank = 'data:blank', animations } = {}) {
  const all = descendants(nodes);
  const doc = {
    documentElement: { clientWidth: 800, clientHeight: 600 },
    querySelectorAll(selector) {
      if (selector === '*') return all;
      return all.filter((n) => n.tagName.toLowerCase() === selector);
    },
    createElement() {
      return { width: 0, height: 0, toDataURL: () => blank };
    },
  };
  if (at) doc.elementFromPoint = typeof at === 'function' ? at : () => at;
  if (animations) doc.getAnimations = () => animations;
  return doc;
}

/**
 * A window for the checks to read styles and time through. `frames` is what a
 * page driving an animation does: it asks for frames while the check is
 * watching, which is how the check tells a still diagram from a stalled one.
 */
function windowOf({ frames = 0 } = {}) {
  const win = {
    innerWidth: 800,
    innerHeight: 600,
    getComputedStyle: (node) => node.style || {},
    requestAnimationFrame: (callback) => callback(0),
    setTimeout: (callback) => {
      for (let i = 0; i < frames; i++) win.requestAnimationFrame(() => {});
      callback();
      return 0;
    },
  };
  return win;
}

const view = (nodes, options = {}) => ({
  document: pageOf(nodes, options),
  window: windowOf(options),
  sampleMs: 1,
  ...options.handed,
});

/** A page with nothing on it at all, which is what every check tolerates. */
const bare = () => view([]);

/* ------------------------------------------------------------- what it ships */

test('the file parses, and what it exports is what it runs', () => {
  const checks = pageChecks();

  assert.ok(Array.isArray(checks.checks), 'the pass should name its checks');
  assert.ok(checks.checks.length >= 7, `expected the checks to be there, found ${checks.checks.length}`);

  for (const check of checks.checks) {
    assert.equal(typeof check.name, 'string');
    assert.equal(typeof check.run, 'function');
    // Named one at a time as well, because that is how a Teacher re-runs the
    // one check a finding sent it back to — and a name in one list and not the
    // other is a pointer at nothing.
    assert.equal(checks[check.name], check.run, `${check.name} is in the pass but not exported`);
  }
});

/* ------------------------------------------------------------- the one shape */

/** Every key a check promises, and what a caller may read out of it. */
function assertShape(report, name) {
  assert.equal(report.check, name);
  assert.ok(
    report.ok === true || report.ok === false || report.ok === null,
    `${name} answered ${JSON.stringify(report.ok)}, which is not one of the three`,
  );
  assert.equal(typeof report.summary, 'string');
  assert.ok(report.summary.length > 0, `${name} said nothing in its summary`);
  assert.ok(report.findings && typeof report.findings.length === 'number', `${name} should hand back findings`);
  assert.ok(report.examined && typeof report.examined.length === 'number', `${name} should hand back what it looked at`);
  assert.ok(report.notes && typeof report.notes === 'object', `${name} should hand back its notes`);
  assert.notEqual(report.notes.threw, true, `${name} threw: ${report.summary}`);
  if (report.ok === false) {
    // A failure with nothing in it is the one verdict a Teacher cannot act on:
    // it says the page is broken and names nothing to go and look at.
    assert.ok(report.findings.length > 0, `${name} failed without naming anything: ${report.summary}`);
  } else {
    assert.equal(report.findings.length, 0, `${name} found something it did not fail on`);
  }
}

test('every check answers in one shape, on a page missing what it examines', async () => {
  const checks = pageChecks();

  for (const check of checks.checks) {
    const report = await check.run({ ...bare(), sampleMs: 1 });
    assertShape(report, check.name);
    assert.equal(report.ok, null, `${check.name} judged a page that has nothing on it`);
  }
});

test('no check throws on a page that lacks the thing it examines', async () => {
  const checks = pageChecks();

  // Three shapes of absence, because they fail differently: a page with
  // nothing on it, no page at all, and a page whose every answer is a throw —
  // which is what a browser does on a canvas holding a cross-origin image.
  const hostile = {
    document: {
      documentElement: { clientWidth: 800, clientHeight: 600 },
      querySelectorAll() { throw new Error('no'); },
      createElement() { throw new Error('no'); },
      elementFromPoint() { throw new Error('no'); },
      getAnimations() { throw new Error('no'); },
    },
    window: {
      getComputedStyle() { throw new Error('no'); },
      setTimeout: (callback) => callback(),
    },
    sampleMs: 1,
  };

  for (const absent of [bare(), { sampleMs: 1 }, hostile]) {
    for (const check of checks.checks) {
      const report = await check.run({ ...absent });
      assertShape(report, check.name);
    }
  }
});

test('the whole pass declines rather than passing when nothing could be judged', async () => {
  const report = await pageChecks().run({ ...bare(), sampleMs: 1 });

  assert.equal(report.ok, null, 'a pass in which every check declined has judged nothing');
  assert.equal(report.checks.length, pageChecks().checks.length);
  for (const one of report.checks) assertShape(one, one.check);
});

/* --------------------------------------------- the observer, guarded per check */

test('the console check reads the session\'s record, and says when it has none', () => {
  const checks = pageChecks();

  const quiet = checks.consoleErrors({ ...bare(), messages: [{ level: 'log', text: 'mounted' }] });
  assert.equal(quiet.ok, true);

  const loud = checks.consoleErrors({
    ...bare(),
    messages: [{ level: 'log', text: 'mounted' }, { level: 'error', text: 'orbit.js failed' }],
  });
  assert.equal(loud.ok, false);
  assert.equal(loud.findings.length, 1);
  assert.equal(loud.findings[0].text, 'orbit.js failed');

  // The misread it documents: a session that hands levels in has them read,
  // and one that hands bare strings in has the text read instead.
  const unlevelled = checks.consoleErrors({ ...bare(), messages: ['Uncaught TypeError: x'] });
  assert.equal(unlevelled.ok, false);
  assert.equal(unlevelled.examined[0].level, 'unknown');

  assert.equal(checks.consoleErrors(bare()).notes.handedIn, false);
});

test('the request check reads what did not arrive', () => {
  const checks = pageChecks();

  const arrived = checks.failedRequests({
    ...bare(),
    requests: [{ url: 'https://cdn.jsdelivr.net/npm/p@1.2.3/+esm', status: 200 }],
  });
  assert.equal(arrived.ok, true);

  const lost = checks.failedRequests({
    ...bare(),
    requests: [
      { url: 'https://cdn.jsdelivr.net/npm/p@1.2.3/+esm', status: 200 },
      { url: '../assets/orbit.js', status: 404 },
      { url: 'https://example.test/x', errorText: 'net::ERR_FAILED' },
    ],
  });
  assert.equal(lost.ok, false);
  assert.deepEqual(Array.from(lost.findings, (f) => f.url), ['../assets/orbit.js', 'https://example.test/x']);
});

test('the canvas check tells a drawn canvas from a blank one', () => {
  const checks = pageChecks();

  const drawn = el('canvas', { extra: { width: 300, height: 150, toDataURL: () => 'data:drawn' } });
  const empty = el('canvas', { extra: { width: 300, height: 150, toDataURL: () => 'data:blank' } });

  assert.equal(checks.canvasHasContent(view([drawn])).ok, true);

  const report = checks.canvasHasContent(view([drawn, empty]));
  assert.equal(report.ok, false);
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0].drawn, false);

  // A canvas with nothing in it is never asked for a context: asking binds
  // one, and a Lesson that takes WebGL when the learner presses play would
  // then never get it.
  const untouched = el('canvas', {
    extra: {
      width: 300,
      height: 150,
      toDataURL: () => 'data:blank',
      getContext() { throw new Error('the check bound a context on an empty canvas'); },
    },
  });
  const left = checks.canvasHasContent(view([untouched]));
  assert.equal(left.ok, false);
  assert.match(left.examined[0].unread, /context was left alone/);

  // A canvas that refuses to be read is not a canvas that is blank.
  const tainted = el('canvas', {
    extra: { width: 300, height: 150, toDataURL() { throw new Error('SecurityError'); } },
  });
  const unread = checks.canvasHasContent(view([tainted]));
  assert.equal(unread.ok, null);
  assert.match(unread.examined[0].unread, /could not be read/);
});

test('the animation check separates a still diagram from a stalled one', async () => {
  const checks = pageChecks();

  // A canvas whose reading changes, on a page asking for frames: moving.
  let tick = 0;
  const moving = el('canvas', { extra: { width: 10, height: 10, toDataURL: () => `data:${tick++}` } });
  const running = await checks.animationMoves(view([moving], { frames: 4 }));
  assert.equal(running.ok, true);
  assert.equal(running.notes.looping, true);
  assert.ok(running.notes.framesRequested >= 4);

  // The same canvas, still, on a page asking for frames: the defect.
  const stuck = el('canvas', { extra: { width: 10, height: 10, toDataURL: () => 'data:frame' } });
  const stalled = await checks.animationMoves(view([stuck], { frames: 4 }));
  assert.equal(stalled.ok, false);
  assert.equal(stalled.findings.length, 1);

  // The same canvas on a page asking for no frames at all: a drawing, which is
  // not a defect and must not be reported as one.
  const drawing = await checks.animationMoves(view([stuck]));
  assert.equal(drawing.ok, null);

  // A page driving frames with nothing this check can sample — an explorable
  // animating the DOM or an SVG. There is something happening and no way to
  // read it, which is not the same as reading it and finding it still, and a
  // `false` here would be a failure naming nothing to go and look at.
  const elsewhere = await checks.animationMoves(view([el('p', { text: 'moving' })], { frames: 4 }));
  assert.equal(elsewhere.ok, null);
  assert.equal(elsewhere.notes.framesRequested >= 4, true);

  // And the page is left as it was found.
  const page = view([stuck], { frames: 2 });
  const before = page.window.requestAnimationFrame;
  await checks.animationMoves(page);
  assert.equal(page.window.requestAnimationFrame, before, 'the check kept the page\'s own rAF');
});

test('the layout check finds what is off the page, and says what put it there', () => {
  const checks = pageChecks();

  const inside = el('p', { text: 'here', rect: box(20, 20, 400, 40) });
  assert.equal(checks.nothingOffPage(view([inside])).ok, true);

  const parked = el('aside', {
    attrs: { class: 'tutor-drawer' },
    style: { position: 'fixed' },
    rect: box(820, 0, 320, 600),
  });
  const report = checks.nothingOffPage(view([inside, parked]));
  assert.equal(report.ok, false);
  assert.equal(report.findings[0].selector, 'aside.tutor-drawer');
  assert.equal(report.findings[0].reason, 'right of the viewport');
  // The field that reveals the misread: parked on purpose reads exactly like
  // lost, and `position` is what tells them apart.
  assert.equal(report.findings[0].position, 'fixed');
});

test('an overlay that ignores pointer events passes the hit test and is reported anyway', () => {
  const checks = pageChecks();

  const label = el('p', { attrs: { class: 'caption' }, text: 'aphelion', rect: box(0, 0, 200, 40) });
  const overlay = el('div', {
    attrs: { class: 'veil' },
    style: { pointerEvents: 'none' },
    rect: box(0, 0, 400, 400),
  });

  // `elementFromPoint` walks straight through the overlay and hands back the
  // label, which is the answer a clear page gives. The check passes, and the
  // two fields that reveal it are populated.
  const report = checks.labelsVisible(view([label, overlay], { at: label }));
  assert.equal(report.ok, true);
  assert.equal(report.examined[0].hit, 'self');
  assert.deepEqual(Array.from(report.examined[0].coveredBy), ['div.veil']);
  assert.deepEqual(Array.from(report.examined[0].ignoringPointerEvents), ['div.veil']);
});

test('the occlusion check finds a covered label and an overlapping pair', () => {
  const checks = pageChecks();

  const under = el('p', { attrs: { class: 'caption' }, text: 'aphelion', rect: box(0, 0, 200, 40) });
  const over = el('div', { attrs: { class: 'card' }, text: 'later', rect: box(0, 0, 400, 400) });

  const covered = checks.labelsVisible(view([under, over], { at: over }));
  assert.equal(covered.ok, false);
  assert.equal(covered.findings[0].hit, 'covered');
  assert.equal(covered.findings[0].hitBy, 'div.card');

  // Overlap is the other way text stops being readable, and neither of the two
  // has to be on top for it.
  assert.ok(Array.from(covered.examined[0].overlaps).includes('div.card'));

  const clear = el('p', { attrs: { class: 'next' }, text: 'perihelion', rect: box(0, 100, 200, 40) });
  const apart = checks.labelsVisible(view([under, clear], { at: (x, y) => (y < 50 ? under : clear) }));
  assert.equal(apart.ok, true);
});

test('the contrast check reads a ratio, and says when it assumed the background', () => {
  const checks = pageChecks();

  const page = el('body', {
    style: { backgroundColor: 'rgb(255, 255, 255)' },
    rect: box(0, 0, 800, 600),
    children: [
      el('p', {
        attrs: { class: 'faint' },
        style: { color: 'rgb(200, 200, 200)', fontSize: '16px' },
        text: 'a claim',
        rect: box(0, 0, 400, 40),
      }),
    ],
  });

  const report = checks.textContrast(view([page]));
  assert.equal(report.ok, false);
  assert.equal(report.findings[0].selector, 'p.faint');
  assert.ok(report.findings[0].ratio < 4.5, `expected a low ratio, got ${report.findings[0].ratio}`);
  assert.equal(report.findings[0].assumed, false);
  assert.equal(report.findings[0].backgroundFrom, 'body');

  const readable = el('body', {
    style: { backgroundColor: '#ffffff' },
    rect: box(0, 0, 800, 600),
    children: [
      el('p', { style: { color: '#1a1a1a', fontSize: '16px' }, text: 'a claim', rect: box(0, 0, 400, 40) }),
    ],
  });
  assert.equal(checks.textContrast(view([readable])).ok, true);

  // The misread this check is documented for: nothing declares a background,
  // so white is assumed — and the two fields that say so are set.
  const canvasBacked = el('p', {
    style: { color: 'rgb(240, 240, 240)', fontSize: '16px' },
    text: 'over a canvas',
    rect: box(0, 0, 400, 40),
  });
  const assumed = checks.textContrast(view([canvasBacked]));
  assert.equal(assumed.examined[0].assumed, true);
  assert.equal(assumed.examined[0].backgroundFrom, null);
  assert.equal(assumed.notes.assumed, 1);
});

/* ------------------------------------------------------ what the head comment owes */

test('every check documents where it misleads, which way, and what reveals it', () => {
  const checks = pageChecks();

  // Read from the file's own list of checks rather than from a list here, so a
  // check added without its misread fails on the day it is added.
  const missing = [];
  for (const check of checks.checks) {
    const at = HEAD.indexOf(` *   ${check.name} `);
    if (at === -1) {
      missing.push(`${check.name}: not documented at all`);
      continue;
    }
    const block = HEAD.slice(at, HEAD.indexOf('\n *\n', at));
    for (const owed of ['Misleads when', 'Direction', 'Revealed by']) {
      if (!block.includes(owed)) missing.push(`${check.name}: no "${owed}"`);
    }
  }

  assert.deepEqual(missing, [], 'a check trusted while wrong is worse than no check');
});

test('the three misreads that report confidently and wrongly are named', () => {
  // Named rather than derived, because these are the cases the pass was built
  // around: each one reports a verdict a Teacher would act on, and each is
  // invisible from the verdict alone.
  const named = [
    // A drawing buffer that was not preserved: one cause, two directions.
    [/preserveDrawingBuffer/, /passes falsely/, /fails falsely/],
    // An overlay a hit test walks through, while the text under it is gone.
    [/pointer-events/, /passes falsely/],
    // A background nothing in the page declares, which misleads both ways and
    // is worst on the pages this work licenses.
    [/canvas painted underneath/, /Direction\s+both/],
  ];

  for (const patterns of named) {
    for (const pattern of patterns) {
      assert.match(HEAD, pattern);
    }
  }

  // The contrast one has to say where it hurts, which is the whole reason it
  // is called out rather than left as a known limit.
  assert.match(HEAD, /dark-themed and canvas-backed/);
});

test('the two hazards that belong to the browser are recorded', () => {
  assert.match(HEAD, /--disable-gpu/);
  assert.match(HEAD, /indistinguishable/);
  assert.match(HEAD, /extensions/);
});

test('the pass says it is light, and is not a gate', () => {
  assert.match(HEAD, /not a gate/);
  assert.match(HEAD, /broken/);
  assert.match(HEAD, /Tutor/);
});

/* ------------------------------------------------------------ where it lives */

test('the scaffold does not install the checks into a Workspace', (t) => {
  const ws = Workspace.create(t);
  const run = ws.scaffold();
  assert.equal(run.status, 0, run.stderr);

  // The checks are the Teacher's tool rather than page content, so they are
  // named from the plugin root and never copied or linked into a Workspace.
  // Read as "does anything in a scaffolded Workspace resolve to this file?",
  // which is the question, rather than as a filename absent from a list.
  const entries = Object.keys(ws.snapshot()).filter((rel) => !rel.endsWith('/'));
  assert.ok(entries.length >= 20, `expected a scaffolded Workspace to read, found ${entries.length}`);

  const installed = entries.filter((rel) => fs.realpathSync(ws.path(rel)) === SOURCE_FILE);
  assert.deepEqual(installed, [], 'the checks belong to the plugin, not to a Workspace');
});
