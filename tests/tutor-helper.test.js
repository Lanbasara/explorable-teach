'use strict';

// The service fixture stands between every claim in `tutor-server.test.js` and
// the thing it is a claim about, so the parts of it that could quietly see
// nothing are pinned here.
//
// Most of it is already cross-guarded: a stub that never ran would fail the
// payload assertions, an SSE reader that returned nothing would fail every
// sequence, and a `waitFor` that never resolved would hang a test rather than
// pass it. One part is not, and it is the whole reason the stub is written the
// way it is — that the transcript goes out in pieces, cut mid-line. A stub that
// wrote one tidy chunk would leave the service's line buffering untested while
// every assertion above went on passing.
//
// What the stub cannot promise is that those pieces *arrive* as pieces: a
// reader that stalls gets them coalesced, which is the pipe's decision rather
// than the fixture's. So the claim here is made about where the stub cut, which
// it records, and the part it cannot make is written down with the other gaps.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { test } = require('node:test');

const { Workspace } = require('./helpers/workspace.js');
const { Response, STUB_AGENT, agentSays, waitFor } = require('./helpers/tutor.js');

/** Run the stub agent on its own, outside any service, and collect what it wrote. */
function runStub(t, transcript, env = {}) {
  const scratch = Workspace.create(t);
  const bin = scratch.path('claude');

  fs.writeFileSync(bin, STUB_AGENT, { mode: 0o755 });
  scratch.write('transcript.ndjson', transcript.map((event) => JSON.stringify(event) + '\n').join(''));

  return new Promise((resolve, reject) => {
    const child = spawn(bin, ['-p', 'hello'], {
      env: {
        ...process.env,
        ...env,
        STUB_RUN: scratch.path('run.json'),
        STUB_TRANSCRIPT: scratch.path('transcript.ndjson'),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const chunks = [];
    child.stdout.on('data', (c) => chunks.push(c));
    child.on('error', reject);
    child.on('close', (code) => {
      // Reading the stub's own report can fail — an unwritable temp directory,
      // a mode bit that did not take. Rejecting keeps that one test's failure
      // attributable, where throwing from an event callback would take the
      // whole file down with an uncaught exception.
      try {
        resolve({
          code,
          chunks,
          written: Buffer.concat(chunks),
          expected: fs.readFileSync(scratch.path('transcript.ndjson')),
          run: JSON.parse(scratch.read('run.json')),
        });
      } catch (err) {
        reject(err);
      }
    });
  });
}

const CHINESE_TRANSCRIPT = [
  agentSays.delta('先说结论：'),
  agentSays.delta('进程被复制了一份，父子各自往下走。'),
  agentSays.result('先说结论：进程被复制了一份，父子各自往下走。'),
];

test('the stub records the argv and working directory it was given', async (t) => {
  const { run, code } = await runStub(t, CHINESE_TRANSCRIPT);

  assert.equal(code, 0);
  assert.deepEqual(run.argv, ['-p', 'hello']);
  assert.equal(typeof run.cwd, 'string');
});

test('the stub writes its transcript in pieces, and cuts mid-line', async (t) => {
  const { run, written, expected } = await runStub(t, CHINESE_TRANSCRIPT);

  // Asserted from the stub's own record of where it cut, rather than from the
  // chunks that came back. Whether three writes arrive as three chunks is the
  // pipe's decision — a reader that stalls long enough gets the lot in one, and
  // an assertion on that is an assertion about the machine's mood.
  assert.equal(run.cuts.length, 4, 'three pieces, as four boundaries');
  assert.deepEqual(written, expected, 'the pieces should reassemble into exactly the transcript');

  assert.ok(
    run.cuts.slice(1, -1).some((cut) => expected[cut - 1] !== 0x0a),
    'every cut fell on a newline, which is the easy case the service is not being tested on',
  );
});

test('no piece ends inside a character', async (t) => {
  const { run, expected } = await runStub(t, CHINESE_TRANSCRIPT);

  // The service decodes each chunk on its own. A cut mid-character is a defect
  // this fixture must not manufacture on the service's behalf — so the stub
  // walks each cut forward past any continuation byte, and this is that claim.
  for (const cut of run.cuts) {
    assert.notEqual(expected[cut] & 0xc0, 0x80, `the cut at byte ${cut} landed inside a character`);
  }

  // Guard: the transcript has to hold multi-byte characters at all, or the
  // check above is a question with no wrong answer.
  assert.ok(expected.some((byte) => byte > 0x7f), 'the fixture transcript should not be pure ASCII');
});

test('the stub exits with the code it was asked for', async (t) => {
  const { code } = await runStub(t, CHINESE_TRANSCRIPT, { STUB_EXIT: '7' });

  assert.equal(code, 7);
});

test('a response that is not an event stream is refused, not read as an empty one', () => {
  const notSse = new Response(200, {}, Buffer.from('{"error":"question is required"}', 'utf8'));

  assert.throws(() => notSse.events(), /not an SSE frame/);

  const empty = new Response(200, {}, Buffer.from('', 'utf8'));
  assert.deepEqual(empty.events(), [], 'an empty body is the one body with no frames in it');
});

test('waiting for something that never happens says what it was waiting for', async () => {
  await assert.rejects(
    waitFor('the thing that never happens', () => null, { timeout: 60, interval: 10 }),
    /timed out after 60ms waiting for the thing that never happens/,
  );

  assert.equal(await waitFor('something already true', () => 'here'), 'here');
});
