#!/usr/bin/env node
/**
 * contrast.js — every text token against every surface it can land on, in both
 * colour schemes, as WCAG AA ratios.
 *
 *   node ${CLAUDE_PLUGIN_ROOT}/scripts/contrast.js [workspace-dir]
 *
 * Exits non-zero when any pair is under the floor, and prints the failing pairs
 * first. Run it after writing `assets/theme.css`, and read the failures rather
 * than the summary line.
 *
 * Why this ships here rather than being worked out each time. A theme is judged
 * by arithmetic nobody can do by eye, and the one Workspace that tried measured
 * its replacement against `--bg` alone — the darkest surface, where a dark
 * token flatters itself by about 0.7 — and shipped a value that still failed on
 * `--bg-card`, which is the surface `.callout-label` actually sits on. The
 * defect was not the arithmetic. It was choosing which pair to measure, and
 * that choice is what this file takes away: it measures all of them.
 *
 * **It over-approximates on purpose.** Not every text token lands on every
 * surface in practice, and this checks all of them anyway, because the
 * alternative is a hand-maintained list of which pairs occur — and that list
 * goes stale the first time a Component puts a label somewhere new, silently,
 * in the direction of passing. A pair that genuinely cannot occur is cheap to
 * read past. A pair that occurs and was not in the list is a defect that ships.
 *
 * The floor is 4.5:1, WCAG AA for body text. `--fg-faint` is small type — 11 to
 * 13.5px in the shipped stylesheet — so the large-text allowance of 3:1 is not
 * available to it, which is exactly the reasoning that would talk you into the
 * value that failed.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const FLOOR = 4.5;

/** The tokens that carry text, and the tokens that sit behind it. */
const TEXT = ['--fg', '--fg-dim', '--fg-faint', '--accent', '--accent-warm', '--accent-good', '--accent-bad'];
const SURFACE = ['--bg', '--bg-soft', '--bg-card'];

/**
 * Token declarations from one stylesheet, split into the two schemes.
 *
 * `:root` outside any media query is the dark scheme in this design — it is
 * the default, and the light values arrive inside
 * `@media (prefers-color-scheme: light)`. So the light scheme starts as a copy
 * of the dark one and is then overlaid, which is what the cascade does and what
 * makes a theme redefining only one of the two behave the way its author meant.
 */
function tokensOf(css) {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const light = {};
  const dark = {};

  // Every `@media (prefers-color-scheme: light) { … }` block, matched by
  // counting braces rather than by a lazy `[^}]*` — the block contains a
  // nested `:root { … }`, so the lazy form stops at the wrong brace.
  const lightBlocks = [];
  const opener = /@media[^{]*prefers-color-scheme:\s*light[^{]*\{/g;
  for (let m; (m = opener.exec(stripped)); ) {
    let depth = 1;
    let i = m.index + m[0].length;
    const from = i;
    while (i < stripped.length && depth > 0) {
      if (stripped[i] === '{') depth += 1;
      else if (stripped[i] === '}') depth -= 1;
      i += 1;
    }
    lightBlocks.push(stripped.slice(from, i - 1));
    opener.lastIndex = i;
  }

  const declarations = (text, into) => {
    for (const [, name, value] of text.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*[;}]/g)) {
      into[name] = value;
    }
  };

  declarations(lightBlocks.join('\n'), light);

  // The dark scheme is everything outside those blocks.
  let outside = stripped;
  for (const block of lightBlocks) outside = outside.replace(block, '');
  declarations(outside, dark);

  return { dark, light: { ...dark, ...light } };
}

function luminance(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h.slice(0, 6);
  const channel = (pair) => {
    const c = parseInt(pair, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [full.slice(0, 2), full.slice(2, 4), full.slice(4, 6)].map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function main() {
  const workspace = process.argv[2] || process.cwd();
  const read = (file) => {
    const abs = path.join(workspace, 'assets', file);
    return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  };

  const base = read('style.css');
  if (base === null) {
    console.error(`no assets/style.css under ${workspace} — is this a workspace?`);
    process.exit(2);
  }
  const theme = read('theme.css');

  const merged = {};
  for (const scheme of ['dark', 'light']) {
    merged[scheme] = { ...tokensOf(base)[scheme], ...(theme ? tokensOf(theme)[scheme] : {}) };
  }

  const rows = [];
  for (const scheme of ['light', 'dark']) {
    for (const text of TEXT) {
      for (const surface of SURFACE) {
        const fg = merged[scheme][text];
        const bg = merged[scheme][surface];
        if (!fg || !bg) continue;
        rows.push({ scheme, text, surface, fg, bg, value: ratio(fg, bg) });
      }
    }
  }

  if (!rows.length) {
    console.error('no token pairs found — assets/style.css declared none of the expected tokens');
    process.exit(2);
  }

  const failed = rows.filter((r) => r.value < FLOOR);
  const show = (r) =>
    `  ${r.value.toFixed(2).padStart(5)} : 1  ${r.value < FLOOR ? 'FAIL' : 'ok  '}  ` +
    `${r.scheme.padEnd(5)} ${r.text} ${r.fg} on ${r.surface} ${r.bg}`;

  if (failed.length) {
    console.log(`Under the ${FLOOR}:1 floor — fix these:\n`);
    failed.forEach((r) => console.log(show(r)));
    console.log('');
  }
  console.log(`All pairs (${rows.length}), ${theme ? 'style.css + theme.css' : 'style.css only'}:\n`);
  rows.forEach((r) => console.log(show(r)));
  console.log(`\n${rows.length - failed.length}/${rows.length} at or above ${FLOOR}:1`);

  process.exit(failed.length ? 1 : 0);
}

main();
