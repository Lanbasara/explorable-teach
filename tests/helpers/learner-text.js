'use strict';

/**
 * The plugin's own table of Learner-facing text, read the way a page reads it.
 *
 *   say('zh-CN', 'tutor.send')                 // '发送'
 *   say('en', 'tutor.recorded', { record: 'x' })
 *   keysAskedBy(source)                        // every key that file looks up
 *   pseudoTable(TABLES.en)                     // the same keys, as sentinels
 *
 * A test asserting that a button says a particular word would have to be
 * rewritten the day a language is added, which is the defect the whole
 * arrangement exists to have removed. So assertions go through the same lookup
 * the drawer goes through, and what they pin is the *key* — the split — while
 * the word itself stays the table's business.
 *
 * The table is a browser script rather than a module, so this runs it in a `vm`
 * context holding a document stub that declares one language.
 * That stub is the whole of what the lookup reads: `<html lang>` is the single
 * authority, and a lookup reaching for anything else would throw here.
 *
 * The sentinel half is the other tool. `pseudoTable` turns a real table into a
 * synthetic one whose every entry is its own key transliterated into fullwidth
 * Latin — characters no natural-language string carries. Mount a Component
 * under it and any string the Component hardcoded stands out, in *any*
 * language, including English, which a non-ASCII scan cannot see. The `{name}`
 * slots of the original entry are kept, so a slot the page forgets to fill
 * arrives as a literal `{name}` and fails the same check.
 */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { REPO_ROOT } = require('./workspace.js');

/**
 * Where the tables live: inside the bootstrap, because that is the one file an
 * existing Workspace already links, and a table it cannot reach renders keys on
 * a Learner's screen. Loading it here runs only its first part — the second
 * returns at once, having no `currentScript` to resolve paths against.
 */
const SOURCE = path.join(
  REPO_ROOT,
  'skills/explorable-teach/runtime/assets/lesson-boot.js',
);

/**
 * Fullwidth Latin — the sentinel alphabet, and what recognises one.
 *
 * Plain digits are in it, and deliberately. A count of questions or a number of
 * seconds is a value the page computes rather than a string it holds, and it is
 * the same digit in every language — so a tree carrying one is not evidence of
 * anything hardcoded. Nothing else outside the fullwidth block is allowed.
 */
const SENTINEL = /^[\uFF01-\uFF5E0-9\s]*$/;

/**
 * The shipped lookup, run against one language and one Workspace table, in a
 * window holding nothing else. The one way this suite gets at it — a test that
 * built its own would be asserting against a copy of the thing under test.
 */
function speaking(lang, workspaceStrings, alsoOnTheWindow) {
  const win = {
    document: {
      currentScript: null,
      documentElement: { getAttribute: (name) => (name === 'lang' ? lang : null) },
    },
    ...alsoOnTheWindow,
  };
  win.window = win;
  if (workspaceStrings) win.TEACH_STRINGS = workspaceStrings;
  vm.createContext(win);
  new vm.Script(fs.readFileSync(SOURCE, 'utf8'), { filename: 'lesson-boot.js' }).runInContext(win);
  return win.LearnerText;
}

/** Where `SOURCE` divides itself into the tables and the bootstrap. */
function halves() {
  const whole = fs.readFileSync(SOURCE, 'utf8');
  const at = whole.indexOf('Part two — the bootstrap');
  if (at < 0) throw new Error(`${SOURCE} no longer divides itself into parts`);
  return [whole.slice(0, at), whole.slice(at)];
}

/**
 * The half of `SOURCE` that holds the lookup, cut at the banner the file
 * divides itself with. A claim about what the lookup reads is a claim about
 * this half; the bootstrap below it answers for itself.
 */
function lookupSource() {
  return halves()[0];
}

/**
 * The other half: the bootstrap, which holds no table and is therefore the
 * half the non-ASCII scan can read. Scanning the whole file would report every
 * line of `zh-CN` as a finding, which is the one thing this file is *for*.
 */
function bootstrapSource() {
  return halves()[1];
}

const TABLES = speaking('en').TABLES;

/**
 * The namespaces a key lives under, read off the table rather than listed.
 *
 * A key has to be told apart from every other dotted literal a source holds —
 * `'assets/tutor.js'`, `'exercise-options'` — and the table is the one place
 * that already knows which prefixes are keys. Derived, so a Component under a
 * new namespace teaches this the moment its entries land in the table, which is
 * the same edit that makes them exist at all.
 */
const NAMESPACES = [...new Set(Object.keys(TABLES.en).map((key) => key.split('.')[0]))].sort();

/** A key as a source writes one: a namespace, then dotted lowercase. */
const KEY = new RegExp(`'((?:${NAMESPACES.join('|')})\\.[a-z0-9.]+)'`, 'g');

const speakers = new Map();

/** What a page in `lang` says for `key`, as the shipped lookup answers it. */
function say(lang, key, values) {
  if (!speakers.has(lang)) speakers.set(lang, speaking(lang));
  return speakers.get(lang).say(key, values);
}

/**
 * Every key a source file looks up, read out of the file rather than listed.
 *
 * The keys are written as literals on purpose — no source builds one by
 * concatenation — which is what makes this derivable at all, and what keeps
 * the completeness check from being a second copy of the table.
 *
 * The prefix is the namespace a key lives under, and `NAMESPACES` reads those
 * off the table — so a Component under a new one costs nothing here at all.
 */
function keysAskedBy(source) {
  return [...new Set([...source.matchAll(KEY)].map((m) => m[1]))].sort();
}

/**
 * Latin text as its fullwidth twin: `tutor.send` → `ｔｕｔｏｒ．ｓｅｎｄ`.
 *
 * Both what a sentinel table is built from and what a test writes its own
 * content in — a question, an answer, a file path — because content the test
 * fed in is otherwise the one part of a rendered tree the check cannot read.
 */
function sentinel(text) {
  return text.replace(/[\x21-\x7e]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0));
}

/**
 * Characters a Maintainer-facing string may carry beyond ASCII: the typographic
 * punctuation this repo's English prose is written with. Everything else — a
 * letter, a digit, an emoji — is a string that belongs in a table, or a
 * Learner's language reaching somewhere only a Maintainer reads.
 */
const ENGLISH_PUNCTUATION = new Set([...'—–…‘’“”']);

/**
 * Every character of `text` that no English sentence would carry.
 *
 * Two suites read this differently and both need the same answer: one scans the
 * scripts the plugin puts on a page, the other reads the payload the service
 * builds and the record it writes. What counts as "still English" has to be one
 * answer, or a string that fails one check passes the other.
 */
function notEnglish(text) {
  return [...text].filter((c) => c.charCodeAt(0) > 0x7f && !ENGLISH_PUNCTUATION.has(c));
}

/** A whole table as sentinels, keeping each entry's `{name}` slots. */
function pseudoTable(table) {
  const sentinels = {};
  for (const [key, value] of Object.entries(table)) {
    const slots = [...value.matchAll(/\{\w+\}/g)].map((m) => m[0]).join('');
    sentinels[key] = sentinel(key) + slots;
  }
  return sentinels;
}

module.exports = {
  NAMESPACES,
  TABLES,
  say,
  speaking,
  lookupSource,
  bootstrapSource,
  keysAskedBy,
  notEnglish,
  pseudoTable,
  sentinel,
  SENTINEL,
  SOURCE,
};
