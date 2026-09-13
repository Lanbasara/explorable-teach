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
 * `assets/learner-text.js` is a browser script rather than a module, so this
 * runs it in a `vm` context holding a document stub that declares one language.
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

const SOURCE = path.join(
  REPO_ROOT,
  'skills/explorable-teach/runtime/assets/learner-text.js',
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

/** Run the shipped lookup against one language and one Workspace table. */
function speaking(lang, workspaceStrings) {
  const win = {
    document: { documentElement: { getAttribute: (name) => (name === 'lang' ? lang : null) } },
  };
  win.window = win;
  if (workspaceStrings) win.TEACH_STRINGS = workspaceStrings;
  vm.createContext(win);
  new vm.Script(fs.readFileSync(SOURCE, 'utf8'), { filename: 'learner-text.js' }).runInContext(win);
  return win.LearnerText;
}

const TABLES = speaking('en').TABLES;

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
 */
function keysAskedBy(source) {
  return [...new Set([...source.matchAll(/'((?:tutor)\.[a-z0-9.]+)'/gi)].map((m) => m[1]))].sort();
}

/** Latin text as its fullwidth twin: `tutor.send` → `ｔｕｔｏｒ．ｓｅｎｄ`. */
function widen(text) {
  return text.replace(/[\x21-\x7e]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0));
}

/** A whole table as sentinels, keeping each entry's `{name}` slots. */
function pseudoTable(table) {
  const sentinels = {};
  for (const [key, value] of Object.entries(table)) {
    const slots = [...value.matchAll(/\{\w+\}/g)].map((m) => m[0]).join('');
    sentinels[key] = widen(key) + slots;
  }
  return sentinels;
}

/** Text a test feeds a Component, in the alphabet its assertions allow. */
function sentinel(text) {
  return widen(text);
}

module.exports = { TABLES, say, keysAskedBy, pseudoTable, sentinel, widen, SENTINEL, SOURCE };
