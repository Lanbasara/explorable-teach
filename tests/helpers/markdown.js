'use strict';

/**
 * Reading the shape of a Markdown document.
 *
 * Several suites here assert on document *shape* rather than on document text,
 * because in this plugin shape is behaviour: what an agent reads first is what
 * it attends to, and material that sits inline is material it reads whether or
 * not this Session needed it. Those assertions need one honest answer to "what
 * are this document's sections, in order?" and "where is this subject named?".
 *
 * Everything here goes through `eachLine`, so there is **one** rule for what
 * fenced code is. Three copies of that rule had drifted into three different
 * spellings before review caught it, which is how a parser ends up disagreeing
 * with itself about what a heading is.
 */

/** Markdown that begins a block of its own rather than continuing one. */
const OPENS_A_BLOCK = /^\s*(?:#{1,6} |[-*+] |\d+\. |\||>)/;

/**
 * Walk a document, telling the visitor whether each line sits inside a fenced
 * block. The fence line itself is reported as fenced, so a visitor that skips
 * fenced lines skips the ``` too.
 *
 * The rule is `trim()`-based: a fence indented inside a list item is still a
 * fence, and this repo writes those.
 */
function eachLine(markdown, visit) {
  let fenced = false;

  markdown.split('\n').forEach((text, index) => {
    const isFence = text.trim().startsWith('```');
    if (isFence) fenced = !fenced;
    visit(text, { index, fenced: fenced || isFence });
  });
}

/** Every heading, as `{ level, text, line }`, in document order. */
function headings(markdown) {
  const found = [];

  eachLine(markdown, (text, { index, fenced }) => {
    if (fenced) return;
    const m = text.match(/^(#{1,6}) +(.*?)\s*$/);
    if (m) found.push({ level: m[1].length, text: m[2], line: index + 1 });
  });

  return found;
}

/**
 * The anchor a heading is reachable at, slugged the way GitHub slugs it:
 * lower-cased, punctuation dropped, then **each remaining space** replaced by a
 * hyphen.
 *
 * That last step is one character of regex and was wrong here until review
 * caught it. Collapsing runs of whitespace instead (`/\s+/g`) disagrees with
 * GitHub on any heading whose punctuation sits between spaces — dropping the
 * `—` in `Shipped Components — already…` leaves *two* spaces, so the real
 * anchor is `shipped-components--already…`. A checker that collapsed them
 * rejected the correct link and accepted the broken one.
 */
function anchorFor(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/ /g, '-');
}

/** The anchors a Markdown document offers, one per heading. */
function anchorsIn(markdown) {
  return new Set(headings(markdown).map((h) => anchorFor(h.text)));
}

/**
 * A document's sections at one heading level, as `{ title, body }` in document
 * order. Anything before the first heading is not a section and is dropped.
 */
function sections(markdown, level = 2) {
  const found = [];

  eachLine(markdown, (text, { fenced }) => {
    const marker = '#'.repeat(level) + ' ';

    if (!fenced && text.startsWith(marker)) {
      found.push({ title: text.slice(marker.length).trim(), body: [] });
    } else if (found.length) {
      found[found.length - 1].body.push(text);
    }
  });

  return found.map((s) => ({ title: s.title, body: s.body.join('\n') }));
}

/** One numbered step of an ordered list, from its number to the next one. */
function step(body, number) {
  const lines = body.split('\n');
  const start = lines.findIndex((l) => l.startsWith(`${number}.`));
  if (start < 0) return null;

  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^\d+\./.test(l));
  return [lines[start], ...(end < 0 ? rest : rest.slice(0, end))].join('\n');
}

/**
 * A document's *logical* lines — each paragraph, list item, heading or table row
 * folded back into the one line it would be if nobody had wrapped it — as
 * `{ line, text }`, where `line` is where it started.
 *
 * Prose in this repo is hard-wrapped at a column, so where a line break falls is
 * a typographic accident. A check reading raw lines reads that accident: one
 * sentence becomes two facts, `idle timeout` wrapped after `idle` stops being
 * findable, and rewrapping a paragraph breaks a check that has nothing to do
 * with wrapping.
 */
function logicalLines(markdown) {
  const found = [];
  let open = false; // is the last entry still taking continuations?

  eachLine(markdown, (text, { index, fenced }) => {
    const blank = text.trim() === '';

    if (!fenced && !blank && open && !OPENS_A_BLOCK.test(text)) {
      const last = found[found.length - 1];
      last.text = `${last.text.replace(/\s+$/, '')} ${text.trim()}`;
      return;
    }

    found.push({ line: index + 1, text });
    open = !blank && !fenced;
  });

  return found;
}

/**
 * Every logical line of a document that mentions `term`, as `{ line, text }`.
 * Used by checks that a document carries a subject only in the places it should
 * — a claim that has to be made mention by mention, because "does this word
 * appear anywhere" is too coarse to say anything.
 */
function linesMentioning(markdown, term) {
  const re = new RegExp(term, 'i');
  return logicalLines(markdown).filter((l) => re.test(l.text));
}

module.exports = {
  sections,
  step,
  headings,
  anchorFor,
  anchorsIn,
  logicalLines,
  linesMentioning,
};
