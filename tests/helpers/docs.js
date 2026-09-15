'use strict';

/**
 * Finding the agent-facing documents, and the pointers inside them.
 *
 * The plugin's documents are read by an agent that will follow what they say,
 * so a pointer at a file that is not there is a defect the same way a broken
 * import is. This module locates those pointers; `pointers.test.js` resolves
 * them.
 *
 * Two kinds count as a pointer:
 *
 *   1. A Markdown link with a relative target — `[templates/](./templates/)`.
 *      Its `#fragment`, when it has one, is part of the promise: a link at a
 *      heading that is not there lands its reader at the top of a document and
 *      leaves them to search. An in-document `#anchor` is the same promise made
 *      about the document it sits in.
 *   2. A path rooted at a directory this repo owns — `scripts/wire-lessons.sh`,
 *      `templates/agents/tutor.md` — wherever it appears, prose or code block.
 *
 * Each kind resolves against exactly one root, never a list of candidates. A
 * fallback would trade a false positive for a false negative: a pointer that
 * happens to exist under some *other* root would pass while still sending its
 * reader nowhere.
 *
 * A bare filename is deliberately not a pointer. When a document names
 * `MISSION.md` or `TECH-STACK.md` it means a path inside the *learner's*
 * Workspace, which does not exist when this suite runs. Resolving those against
 * the repo would be meaningless.
 *
 * `assets/…` is the same shape and is likewise skipped here — but it is not
 * uncovered: `assets.test.js` resolves those against a *scaffolded* Workspace,
 * which is the only place they can mean anything.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { REPO_ROOT } = require('./workspace.js');
const { headings, logicalLines, sections } = require('./markdown.js');

/** Directories this repo owns, so a path starting with one is ours to check. */
const OWNED_ROOTS = ['scripts', 'templates', 'commands', 'docs', 'skills', 'tests'];

/** Directories holding documents an agent reads. Scanned when they exist. */
const DOC_ROOTS = ['skills', 'commands', 'docs'];

/**
 * Directories whose contents belong to a Workspace rather than to this repo —
 * copied into one, or linked at from one. A document in either writes paths
 * that mean something over there.
 */
const WORKSPACE_FACING = new Set(['templates', 'runtime']);

/**
 * `docs/agents/domain.md` names `docs/adr/` as the convention this repo
 * deliberately rejects in favour of one narrative `docs/DECISIONS.md`. It is
 * supposed to be absent; flagging it would be flagging the repo for agreeing
 * with itself.
 */
const MEANT_TO_BE_ABSENT = ['docs/adr/'];

const MARKDOWN_LINK = /\[[^\]]*\]\(([^)\s]+)\)/g;

const ROOTED_PATH = new RegExp(
  // Not preceded by anything that would make this the tail of a longer path
  // or a URL — `cdnjs.com/x/scripts/y` is not a pointer at our scripts/.
  String.raw`(?<![\w./-])(?:\$\{CLAUDE_PLUGIN_ROOT\}/)?` +
    `(?:${OWNED_ROOTS.join('|')})/[\\w./#-]*`,
  'g',
);

/**
 * The one directory under `skills/`. Documents across the repo write
 * `templates/…` meaning this skill's templates, because there is only ever one
 * place that can mean.
 */
function skillDir() {
  const skills = path.join(REPO_ROOT, 'skills');
  const found = fs
    .readdirSync(skills, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(skills, e.name));

  if (found.length !== 1) {
    throw new Error(
      `expected exactly one skill, found ${found.length} — ` +
        'a bare `templates/` no longer names one place, so this resolver needs revisiting',
    );
  }
  return found[0];
}

const SKILL_DIR = skillDir();

/**
 * Every Markdown document that instructs an agent working on or with this
 * plugin. Two directories are excluded, for one reason: `templates/` is
 * material copied into a Workspace and `runtime/` is material a Workspace
 * links at, so the paths either one writes resolve there rather than here.
 */
function agentDocs() {
  const docs = [path.join(REPO_ROOT, 'AGENTS.md'), path.join(REPO_ROOT, 'README.md')];

  const walk = (dir) => {
    // `commands/` is optional: the plugin ships one entry point, the skill, and
    // a directory that holds no command is absent rather than empty.
    if (!fs.existsSync(dir)) return;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory() && !WORKSPACE_FACING.has(entry.name)) walk(abs);
      else if (entry.isFile() && entry.name.endsWith('.md')) docs.push(abs);
    }
  };

  for (const dir of DOC_ROOTS) walk(path.join(REPO_ROOT, dir));

  return docs.sort();
}

/**
 * One document, with its hard wrapping folded back out.
 *
 * Prose in this repo is wrapped at a column, so where a line break falls is a
 * typographic accident — and a claim about what a document *says* is a claim
 * about a sentence rather than about a line. Folding first also makes one
 * logical line one line of the returned string, which is what lets a check
 * require several patterns to arrive *together*.
 *
 * This lives here rather than in either suite that reads documents, because two
 * of them now do and a reader with two copies is a reader that can disagree
 * with itself — the defect the Markdown module's own head comment records.
 */
function foldedDoc(...parts) {
  return logicalLines(fs.readFileSync(path.join(...parts), 'utf8'))
    .map((l) => l.text)
    .join('\n');
}

/**
 * Every entry of `list` whose pattern is absent from `text`, named.
 *
 * A claim about a document is a list of the things it has to say, so a failure
 * has to name *which* of them is missing rather than reporting that the
 * document is wrong. This and the reader below live here for the reason
 * `foldedDoc` does: three suites now assert on documents, and a rule kept in
 * three places is one that can disagree with itself.
 */
const absentFrom = (list, text) => list.filter((e) => !e.re.test(text)).map((e) => e.what);

/**
 * True when **one logical line** of `text` carries every pattern in `list` —
 * `text` having been folded by `foldedDoc`, so one logical line is one line.
 *
 * For the claims that are about patterns arriving *together*. Several of them
 * are: a consequence stated with no way round it, or a measurement stated
 * without the permission to act on it, is a different claim from the two said
 * in different breaths.
 */
const carriedTogether = (text, list) =>
  text.split('\n').some((line) => list.every((e) => e.re.test(line)));

/**
 * The one section of `markdown` at heading `level` whose title matches `re`,
 * bounded at the next heading of **any** level — `what` naming it, so a failure
 * says which section went missing rather than that a count was wrong.
 *
 * Both halves of that are learned rather than chosen. *Exactly one*, because a
 * `find` quietly redirects a check at whichever section matched first on the day
 * a second one's title also mentions the subject. And the bound, because
 * `sections` asked for level three runs a body to the next level-*three*
 * heading, so the last subsection of a section bleeds into whatever follows the
 * section itself — a check then reads material it makes no claim about and can
 * match a pattern in by accident. `from-disk.test.js` found that the hard way,
 * by measuring that a paragraph moved out of the section entirely still
 * satisfied the check that was supposed to hold its placement.
 *
 * It lives here for the reason `foldedDoc` does: four suites now find a section
 * this way, and a reading rule kept in four copies is one that can disagree
 * with itself — which two of those copies already did, over whether to search a
 * whole document or only the section that owns the subject. Passing the text in
 * makes that a decision at the call site rather than a difference nobody meant.
 */
function oneSection(markdown, level, re, what) {
  const found = sections(markdown, level).filter((s) => re.test(s.title));

  assert.equal(found.length, 1, `expected exactly one ${what} section, found ${found.length}`);
  return found[0].body.split(new RegExp(`^#{1,${level - 1}} `, 'm'))[0];
}

/**
 * The titles of a document's parts at `level`, **in the order they appear**.
 *
 * For the checks whose claim is about *placement* rather than presence, which
 * three of them now are: a rule read after the thing it bounds is a rule read
 * as an audit, and one read before the decision it constrains is one read
 * before there is anything to constrain.
 *
 * It lives here for the reason `oneSection` and `orderedEntries` do — a reading
 * rule kept in copies is one the copies can disagree about. This one had three:
 * the derivation check, the simulation check and the budget check each decided
 * for themselves which headings counted as the parts of a section.
 */
const partTitles = (text, level = 3) =>
  headings(text)
    .filter((h) => h.level === level)
    .map((h) => h.text);

/**
 * The **ordered entries** of a part of a document, as `{ n, text }` — an ordered
 * list item opens a block, so each entry runs from its own marker to the next
 * one.
 *
 * Two suites read the same entries of the same section: the derivation check
 * holds each one to its four fields, and the simulation check asks which of them
 * offer something the page computes. It lives here for the reason `oneSection`
 * does — a reading rule kept in two copies is one that can disagree with itself,
 * and the two copies of this one had already started to, one of them describing
 * itself as the other's reader.
 */
function orderedEntries(text) {
  const lines = text.split('\n');
  const starts = lines.map((l, i) => (/^\d+\.\s+\*\*/.test(l) ? i : -1)).filter((i) => i >= 0);

  return starts.map((start, n) => ({
    n: n + 1,
    text: lines.slice(start, starts[n + 1] ?? lines.length).join('\n'),
  }));
}

/**
 * The **named bullets** of a part of a document, trimmed — a bold lead-in being
 * how this repo writes a list whose items are each a named thing.
 *
 * Shared with the floor below it, because two checks ask the same question of
 * two such lists: the anti-patterns and the kinds of known-good result each have
 * to name every member *and* leave room after it for the reason or the
 * instruction that makes the name worth anything.
 */
const namedBullets = (text) =>
  text
    .split('\n')
    .filter((line) => /^\s*-\s+\*\*/.test(line))
    .map((line) => line.trim());

/**
 * How long a named bullet has to be before it can be carrying a reason as well
 * as a name.
 *
 * A **length proxy**, and recorded as one: nothing here can read whether a
 * sentence is a reason. What it catches is the shape such a list collapses into
 * — a bare bullet per member — which is the form the imagery bans were written
 * against and the one a Session routes around the first time it is inconvenient.
 */
const ROOM_FOR_A_REASON = 120;

/**
 * Every relative pointer in one document, as
 * `{ doc, line, raw, target, root, fragment }` — `root` being the single
 * directory the target must resolve against, and `fragment` the heading it
 * names inside the file it lands on, when it names one.
 */
function pointersIn(doc) {
  const docDir = path.dirname(doc);
  const found = [];

  // Logical lines, not raw ones. Prose here is hard-wrapped, and a link whose
  // text wrapped before its target — `[Fluency and storage\nstrength](./…)` —
  // is not a link on either raw line. One escaped this check that way, and a
  // pointer nobody extracts is a pointer nobody resolves.
  logicalLines(fs.readFileSync(doc, 'utf8')).forEach(({ line, text }) => {
    const at = (raw, target, root, fragment) => {
      if (MEANT_TO_BE_ABSENT.some((p) => target.startsWith(p))) return;
      found.push({ doc, line, raw, target, root, fragment });
    };

    for (const [, href] of text.matchAll(MARKDOWN_LINK)) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(href)) continue; // http:, mailto:, …
      const [file, fragment] = href.split('#');
      // A link is written from where the document sits, and a bare `#anchor`
      // names the document it is written in.
      at(href, file === '' ? path.basename(doc) : file, docDir, fragment);
    }

    for (const [raw] of text.matchAll(ROOTED_PATH)) {
      const [target, fragment] = raw.replace('${CLAUDE_PLUGIN_ROOT}/', '').split('#');
      at(raw, target, target.startsWith('templates/') ? SKILL_DIR : REPO_ROOT, fragment);
    }
  });

  return found;
}

/**
 * Where a pointer lands, or `null` if it lands nowhere. A trailing glob
 * (`lessons/*.html`) resolves to its directory — the pattern names a shape,
 * not a file.
 */
function resolvePointer(pointer) {
  const relative = pointer.target.includes('*')
    ? path.dirname(pointer.target)
    : pointer.target;

  const abs = path.resolve(pointer.root, relative);
  return fs.existsSync(abs) ? abs : null;
}

module.exports = {
  agentDocs,
  pointersIn,
  resolvePointer,
  foldedDoc,
  absentFrom,
  carriedTogether,
  oneSection,
  orderedEntries,
  partTitles,
  namedBullets,
  ROOM_FOR_A_REASON,
  DOC_ROOTS,
  SKILL_DIR,
};
