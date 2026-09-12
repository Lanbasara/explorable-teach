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

const fs = require('node:fs');
const path = require('node:path');

const { REPO_ROOT } = require('./workspace.js');

/** Directories this repo owns, so a path starting with one is ours to check. */
const OWNED_ROOTS = ['scripts', 'templates', 'commands', 'docs', 'skills', 'tests'];

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
    `(?:${OWNED_ROOTS.join('|')})/[\\w./-]*`,
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
 * plugin. `templates/` is excluded: it is material copied into a Workspace, so
 * its relative paths resolve there rather than here.
 */
function agentDocs() {
  const docs = [path.join(REPO_ROOT, 'AGENTS.md'), path.join(REPO_ROOT, 'README.md')];

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'templates') walk(abs);
      else if (entry.isFile() && entry.name.endsWith('.md')) docs.push(abs);
    }
  };

  walk(path.join(REPO_ROOT, 'skills'));
  walk(path.join(REPO_ROOT, 'commands'));
  walk(path.join(REPO_ROOT, 'docs'));

  return docs.sort();
}

/**
 * Every relative pointer in one document, as `{ doc, line, raw, target, root }`
 * — `root` being the single directory the target must resolve against.
 */
function pointersIn(doc) {
  const docDir = path.dirname(doc);
  const found = [];

  fs.readFileSync(doc, 'utf8').split('\n').forEach((text, index) => {
    const at = (raw, target, root) => {
      if (MEANT_TO_BE_ABSENT.some((p) => target.startsWith(p))) return;
      found.push({ doc, line: index + 1, raw, target, root });
    };

    for (const [, target] of text.matchAll(MARKDOWN_LINK)) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue; // http:, mailto:, …
      if (target.startsWith('#')) continue; // in-document anchor
      // A link is written from where the document sits.
      at(target, target.split('#')[0], docDir);
    }

    for (const [raw] of text.matchAll(ROOTED_PATH)) {
      const target = raw.replace('${CLAUDE_PLUGIN_ROOT}/', '');
      at(raw, target, target.startsWith('templates/') ? SKILL_DIR : REPO_ROOT);
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

module.exports = { agentDocs, pointersIn, resolvePointer, SKILL_DIR };
