'use strict';

// The Dossier — the Workspace entry point, and the one page the bootstrap does
// not mount, because it loads the course manifest itself.
//
// What is driven here is the one thing on it that makes a claim about something
// outside the page: the line saying whether the Tutor service can be reached.
// It has three answers and they are not two. A served page may ask the service
// and report what it said. A page opened from disk may not ask at all — a
// request from `file:` to the service's origin is one the browser refuses to
// make — so what it has to report is that it cannot tell, rather than the
// answer a refused request looks like.
//
// Nothing here pins a word, and not for the usual reason. The cover's text is a
// hard-coded English Seed by decision: it is a copied file that does not load
// the page bootstrap, so it has no table to read from, and `CONTEXT.md` says a
// copied file is the Workspace's own from the moment it is placed. So the
// claims below are made of the things that are not wording — which address was
// asked for, whether a command is offered, what the indicator says, and the
// numbers the service itself supplied.

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { settle } = require('./helpers/drawer.js');
const { DOCS, HEALTHY, TITLE, courseIn, dossierIn } = require('./helpers/dossier.js');

/** The Unit list the fixture course carries, so the cover has something to be. */
const UNITS = [
  { id: '0001', num: 'L01', status: 'done', title: 'fork and exec', lesson: 'lessons/0001-fork-exec.html' },
  { id: '0002', num: 'L02', status: 'todo', title: 'pipes' },
];

const course = (extra) => courseIn({ units: UNITS, ...extra });

/**
 * Guard the observer: a cover that never ran renders no units, and every claim
 * about its status line would then be a claim about an unmounted page.
 */
function mounted(page) {
  assert.equal(page.queryAll('.unit').length, UNITS.length, 'the cover never rendered the course');
  assert.equal(page.queryAll('.doc-card').length, DOCS.length, 'nor the documents it was handed');
  assert.equal(page.text('#course-title'), TITLE, 'nor the name of the course it is the cover of');
  return page;
}

/** What the cover offers as a command, if it offers one at all. */
const command = (page) => (page.query('#tmsg code') ? page.text('#tmsg code') : null);

/** Which of the three the indicator is showing. */
const indicator = (page) => page.query('#tdot').className;

test('a served Dossier reports the service it reached, on whatever port it is bound to', async (t) => {
  // The fixture serves the cover on a port nobody wrote down, and refuses any
  // request naming an origin. A cover that still held the default port in it
  // would have that request refused and report a running service as stopped —
  // which is the defect. So the address it asked for is the claim, and the
  // state it reached is the proof that the address worked.
  const page = mounted(dossierIn(t, { manifest: course() }));
  await settle();

  assert.deepEqual(page.probes, ['/api/health'], 'a relative address is the only one right on every port');
  assert.equal(indicator(page), 'dot up');
  assert.equal(command(page), null, 'a service that is running needs no starting');

  // The service's own numbers, which is the other half of "it reached it". Both
  // are guarded against the fixture drifting under them: a health body whose
  // uptime stopped being a quarter of an hour would leave the pattern matching
  // some other number on the line, or nothing, with no hint why.
  assert.equal(HEALTHY.uptimeSec / 60, 15, 'the fixture and the arithmetic have to agree');
  assert.equal(HEALTHY.idleTimeoutSec / 3600, 2, 'and again for the timeout it reports');
  assert.match(page.text('#tmsg'), /\b15\b/, 'it should report how long the service has been up');
  assert.match(page.text('#tmsg'), /\b2\b/, 'and when it will exit for being idle');
});

test('a served Dossier whose service is down says how to start it', async (t) => {
  const page = mounted(dossierIn(t, { manifest: course(), health: () => false }));
  await settle();

  assert.deepEqual(page.probes, ['/api/health'], 'it asked, and the asking is what it is reporting');
  assert.equal(indicator(page), 'dot down');
  assert.equal(command(page), './tutor/tutorctl.sh start', 'the one thing the Learner can do from here');
});

test('a Dossier opened from disk asks nothing, and claims nothing about the service', async (t) => {
  // The state the originating report was handed twice: the cover probed across
  // origins, the browser blocked it, and the cover read the block as "not
  // running" and told the Learner to start a service that was already up.
  const page = mounted(dossierIn(t, { manifest: course(), served: false }));
  await settle();

  assert.deepEqual(page.probes, [], 'a request the browser would block is a request not worth making');
  assert.equal(indicator(page), 'dot unknown', 'no claim either way is the only true one from here');
  assert.equal(command(page), null, 'and the start command cannot help on this page');
});

test('the three states the Dossier reports are three different things to read', async (t) => {
  // Three states that rendered the same sentence would satisfy every claim
  // above while telling the Learner the same thing in all three cases.
  const said = [];
  for (const options of [{}, { health: () => false }, { served: false }]) {
    const page = mounted(dossierIn(t, { manifest: course(), ...options }));
    await settle();
    said.push(page.text('#tmsg'));
  }

  assert.equal(new Set(said).size, 3, `the cover says the same thing in more than one state: ${said}`);
  for (const text of said) assert.ok(text.length > 0, 'a state with nothing in it is not a state');
});
