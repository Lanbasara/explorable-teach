'use strict';

// What language a Learner reads, and what stops it drifting back to one.
//
// `docs/agents/tests.md`, "The language checks", holds the argument. The short
// of it: assert the *split*, never the strings. A check that pinned a word in a
// language would have to be rewritten the day a language was added, which is
// the defect the whole arrangement exists to have removed.
//
// Five things are checked, and they fail on five different mistakes:
//
//   the mechanism      a Workspace states its language once, and every page
//                      picks it up — the manifest, the bootstrap, the wiring
//   the lookup         exact tag, then base language, then English, then the
//                      key; a Workspace table wins at every rung
//   a pseudolocale     the drawer mounted under a synthetic language whose
//                      table holds only sentinels, with nothing outside the
//                      sentinel alphabet in what it renders. This is the one
//                      that catches a hardcoded *English* string
//   a non-ASCII scan   the drawer's own source, which catches the other thing:
//                      one Learner's language creeping back into shared code
//   two contracts      every key a Component asks for has an entry, and the
//                      shipped tables agree about which keys exist — both
//                      derived from source, never listed here

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { Workspace, REPO_ROOT } = require('./helpers/workspace.js');
const { lessonHtml, FIXTURE_LANG } = require('./helpers/unit.js');
const { drawerIn, event, mount, pageFor, settle } = require('./helpers/drawer.js');
const {
  TABLES,
  say,
  keysAskedBy,
  pseudoTable,
  sentinel,
  SENTINEL,
  SOURCE,
} = require('./helpers/learner-text.js');

const DRAWER = path.join(REPO_ROOT, 'skills/explorable-teach/runtime/assets/tutor.js');
const read = (abs) => fs.readFileSync(abs, 'utf8');

/** A synthetic tag no Workspace has, and no plugin table answers for. */
const PSEUDO = 'qps-ploc';

/* ------------------------------------------------------------- the mechanism */

/** A course manifest stating one thing: the language this Workspace is in. */
const manifestIn = (lang) =>
  `window.TEACH_COURSE = { lang: '${lang}', title: 'x' };\nwindow.TEACH_UNITS = [];\n`;

test('the scaffold places the Workspace\'s own table, and says so', (t) => {
  const ws = Workspace.create(t);
  const run = ws.scaffold();

  assert.equal(run.status, 0, run.stderr);

  // Read out of the script's own report rather than named here, the way
  // `init-workspace.test.js` reads it: the scaffold owns its file list. And
  // found by the one thing that makes it the table — the name the lookup reads
  // — rather than by its filename, which is the scaffold's to change.
  const placed = [...run.stdout.matchAll(/^\s{2}create\s+(assets\/\S+)/gm)].map((m) => m[1]);

  assert.ok(placed.length >= 1, 'the scaffold reported placing nothing under assets/');
  const table = placed.find((rel) => /window\.TEACH_STRINGS/.test(ws.read(rel)));

  assert.ok(table, `the scaffold placed no Workspace string table; it placed ${placed}`);
  assert.ok(fs.lstatSync(ws.path(table)).isFile(), 'it is the Workspace\'s own, so it is a copy');

  // A Teacher has to be told where to set the language, or the one place it
  // lives is a place nobody finds.
  assert.match(run.stdout, /lang/, 'the report should say where the language is set');
});

test('the wiring script fills in the language, and leaves a page that stated one alone', (t) => {
  const ws = Workspace.create(t);
  ws.scaffold();
  ws.write('assets/units.js', manifestIn('pt-BR'));
  ws.write('lessons/0001-intro.html', '<html><body><h1>Intro</h1></body></html>');
  ws.write('lessons/0002-own.html', '<html lang="ja"><body><h1>Own</h1></body></html>');

  const run = ws.wire();

  assert.equal(run.status, 0, run.stderr);
  assert.match(ws.read('lessons/0001-intro.html'), /<html lang="pt-BR">/, 'a page that stated none gets the Workspace\'s');
  assert.match(ws.read('lessons/0002-own.html'), /<html lang="ja">/, 'a page that stated one keeps it');
  assert.match(run.stdout, /^2 wired, 1 given a language, 0 already fine/m);
});

test('running the wiring script again changes nothing', (t) => {
  const ws = Workspace.create(t);
  ws.scaffold();
  ws.write('assets/units.js', manifestIn('pt-BR'));
  ws.write('lessons/0001-intro.html', '<html><body><h1>Intro</h1></body></html>');
  ws.wire();

  const before = ws.snapshot();
  const second = ws.wire();

  assert.deepEqual(ws.snapshot(), before, 'the second run modified the Workspace');
  assert.match(second.stdout, /^0 wired, 0 given a language, 1 already fine/m);
});

test('only the course block decides the language, not the rest of the manifest', (t) => {
  // The manifest is hand-edited from its first day. A unit that grows a `lang`
  // of its own, or a comment that mentions one, must not become the thing every
  // page in the Workspace is given.
  const ws = Workspace.create(t);
  ws.scaffold();
  ws.write(
    'assets/units.js',
    "window.TEACH_COURSE = {\n  lang: 'pt-BR',\n  title: 'x'\n};\n"
      + "window.TEACH_UNITS = [{ id: '01', lang: 'ru' }];\n",
  );
  ws.write('lessons/0001-intro.html', '<html><body><h1>Intro</h1></body></html>');

  ws.wire();

  assert.match(ws.read('lessons/0001-intro.html'), /<html lang="pt-BR">/);
});

test('a Workspace that records no language is left as it is', (t) => {
  // The manifest of an older Workspace, which has no `lang` in it at all. The
  // absence has to be harmless: this is what "no migration step" means.
  const ws = Workspace.create(t);
  ws.scaffold();
  ws.write('assets/units.js', "window.TEACH_COURSE = { title: 'x' };\n");
  ws.write('lessons/0001-intro.html', '<html><body><h1>Intro</h1></body></html>');

  ws.wire();

  assert.match(ws.read('lessons/0001-intro.html'), /<html><body>/, 'nothing was invented');
  assert.match(ws.read('lessons/0001-intro.html'), /lesson-boot\.js/, 'and the page was still wired');
});

/**
 * Run the bootstrap the way a browser runs it: one script at a time, each one
 * executed and then told it loaded.
 *
 * The fixture DOM does not fetch or execute a script somebody appends to it —
 * nothing else in the suite needs it to. So the loading is done here, off the
 * elements the bootstrap actually appended, which is what makes this a test of
 * the bootstrap's own ordering rather than of a list copied out of it.
 */
function boot(page, assetsDir) {
  page.script('lesson-boot.js');

  for (let guard = 0; guard < 20; guard += 1) {
    const next = page.queryAll('script').find((tag) => tag.onload && !tag.loaded);
    if (!next) return page;

    next.loaded = true;
    const file = next.src.replace(/^.*assets\//, '');

    // One or the other, never both: the bootstrap wires the same handler to
    // each, so telling it twice would advance the chain twice and skip a file.
    if (fs.existsSync(path.join(assetsDir, file))) {
      page.script(file);
      next.onload();
    } else {
      next.onerror();
    }
  }
  throw new Error('the bootstrap is still loading scripts after 20 of them');
}

test('a page that declares no language ends up with the Workspace\'s', (t) => {
  const ws = Workspace.create(t);
  ws.scaffold();
  ws.write('assets/units.js', manifestIn('pt-BR'));

  // No `lang` on this page at all, which is the discipline the bootstrap exists
  // to stop depending on.
  const page = pageFor(ws.path('assets'), {
    html: '<!DOCTYPE html>\n<html>\n<head></head>\n<body><div class="lesson"></div></body>\n</html>\n',
  });
  boot(page, ws.path('assets'));

  assert.equal(page.document.documentElement.getAttribute('lang'), 'pt-BR');

  // And the bootstrap is the only thing that mounted anything. A page carrying
  // two drawers would answer every assertion in this file from whichever one
  // the selector reached first.
  assert.equal(page.queryAll('.tutor-drawer').length, 1, 'the drawer mounted once');
});

test('the Dossier takes its language from the manifest too', (t) => {
  // The one page in a Workspace the bootstrap does not mount, because it loads
  // the manifest itself. Asserted on its source rather than by mounting it: the
  // cover splices authored HTML into the page, which the fixture DOM refuses on
  // purpose, so there is nothing here to drive.
  const ws = Workspace.create(t);
  ws.scaffold();
  const cover = ws.read('index.html');

  assert.doesNotMatch(cover, /<html[^>]*\slang=/i, 'the cover must not carry a language of its own');
  assert.match(
    cover,
    /documentElement\.setAttribute\('lang', course\.lang\)/,
    'so it has to take the one the manifest states',
  );
});

test('a page that declares its own language keeps it', (t) => {
  const ws = Workspace.create(t);
  ws.scaffold();
  ws.write('assets/units.js', manifestIn('pt-BR'));

  const page = pageFor(ws.path('assets'), { html: lessonHtml('ja') });
  boot(page, ws.path('assets'));

  assert.equal(
    page.document.documentElement.getAttribute('lang'),
    'ja',
    'the page is the authority, and the tooling may only fill a gap',
  );
});

/* ----------------------------------------------------------------- the lookup */

test('lookup runs exact tag, then base language, then English, then the key', () => {
  // Guard the observer: an entry that is the same in two tables would make
  // every claim below pass without the lookup doing anything.
  assert.notEqual(TABLES.en['tutor.send'], TABLES['zh-CN']['tutor.send']);

  assert.equal(say('zh-CN', 'tutor.send'), TABLES['zh-CN']['tutor.send'], 'the exact tag');
  // Truncation is the second rung, and the only cleverness there is. Shown
  // against a language the plugin does not ship, because that is where the case
  // lives: a page in `ja-JP` reaching a table written for `ja`.
  const japanese = mountedSay('ja-JP', { ja: { 'tutor.send': 'OKURU' } });
  assert.equal(japanese('tutor.send'), 'OKURU', 'no exact table, so the base language');
  assert.equal(say('fr', 'tutor.send'), TABLES.en['tutor.send'], 'no table at all, so English');
  assert.equal(say('', 'tutor.send'), TABLES.en['tutor.send'], 'nothing recorded, so English');
  assert.equal(say('en', 'tutor.nothing.is.here'), 'tutor.nothing.is.here', 'and past English, the key itself');
});

test('a regional tag never falls back to a different region of its language', () => {
  // Handing someone the wrong script is worse than handing them English, so
  // truncation is the only cleverness there is.
  assert.equal(say('zh-TW', 'tutor.send'), TABLES.en['tutor.send']);
  assert.notEqual(say('zh-TW', 'tutor.send'), TABLES['zh-CN']['tutor.send']);
});

test('a Workspace can override an entry, or supply a language the plugin does not ship', () => {
  const table = { 'zh-CN': { 'tutor.send': 'GO' }, ja: { 'tutor.send': 'OKURU' } };
  const speaking = (lang) => mountedSay(lang, table);

  assert.equal(speaking('zh-CN')('tutor.send'), 'GO', 'the Workspace wins over the plugin');
  assert.equal(speaking('zh-CN')('tutor.status.online'), TABLES['zh-CN']['tutor.status.online'],
    'and everything it does not cover still comes from the plugin');

  assert.equal(speaking('ja')('tutor.send'), 'OKURU', 'a language the plugin never shipped');
  assert.equal(speaking('ja')('tutor.status.online'), TABLES.en['tutor.status.online'],
    'and a gap in it is English rather than somebody else\'s language');
});

/** The shipped lookup, run against a Workspace table, in a bare window. */
function mountedSay(lang, strings) {
  const vm = require('node:vm');
  const win = {
    document: { documentElement: { getAttribute: (name) => (name === 'lang' ? lang : null) } },
    TEACH_STRINGS: strings,
  };
  win.window = win;
  vm.createContext(win);
  new vm.Script(read(SOURCE), { filename: 'learner-text.js' }).runInContext(win);
  return win.LearnerText.say;
}

test('the page is the only place a language is read from', () => {
  // Not the browser. The requirement is that the Learner's *recorded*
  // preference decides, and a browser setting is a guess wearing a record's
  // clothes — it would also make one Workspace read differently on two
  // machines. Asserted from both sides, the way `rich-text.test.js` asserts its
  // own interface claim.
  const vm = require('node:vm');
  const win = {
    document: { documentElement: { getAttribute: () => null } },
    navigator: { language: 'zh-CN', languages: ['zh-CN'] },
  };
  win.window = win;
  vm.createContext(win);
  new vm.Script(read(SOURCE), { filename: 'learner-text.js' }).runInContext(win);

  assert.equal(
    win.LearnerText.say('tutor.send'),
    TABLES.en['tutor.send'],
    'a browser that asked for Chinese still got English, because the page named none',
  );
  assert.doesNotMatch(read(SOURCE), /navigator|Intl\b/, 'and nothing in it reaches for one');
});

test('a Workspace with no table of its own still reads in its language', async (t) => {
  // What every existing Workspace is: pages declaring `zh-CN`, a manifest with
  // no `lang` in it, and no `assets/strings.js` anywhere. Nothing is run to
  // migrate it, so the absence has to be what degrades.
  const ws = Workspace.create(t);
  ws.scaffold();
  ws.write('assets/units.js', "window.TEACH_COURSE = { title: 'x' };\n");
  fs.rmSync(ws.path('assets/strings.js'));

  // Booted rather than hand-mounted, because the absence is the point: the
  // bootstrap has to carry on past the file that is not there.
  const page = pageFor(ws.path('assets'), { html: lessonHtml(FIXTURE_LANG) });
  boot(page, ws.path('assets'));
  await settle();

  assert.equal(page.document.documentElement.getAttribute('lang'), FIXTURE_LANG, 'the page keeps its own');
  assert.equal(
    page.text('.tutor-status'),
    TABLES[FIXTURE_LANG]['tutor.status.online'],
    'the shipped table is what an un-migrated Workspace falls back to',
  );
});

test('a page recording no language anywhere reads in English', async (t) => {
  const ws = Workspace.create(t);
  ws.scaffold();

  const page = mount(ws.path('assets'), {
    html: '<!DOCTYPE html>\n<html>\n<head></head>\n<body><div class="lesson"></div></body>\n</html>\n',
  });
  await settle();

  assert.equal(page.text('.tutor-status'), TABLES.en['tutor.status.online']);
  assert.equal(page.text('.tutor-send'), TABLES.en['tutor.send']);
});

/* ------------------------------------------------------------ the pseudolocale */

/** Every text and every label a reader meets, out of one subtree. */
function rendered(root) {
  const found = [];
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) found.push(child.data);
      else {
        for (const name of ['title', 'aria-label', 'placeholder']) {
          const label = child.getAttribute(name);
          if (label) found.push(label);
        }
        walk(child);
      }
    }
  };
  walk(root);
  return found.filter((text) => text.trim() !== '');
}

/** Everything the drawer put on the page, wherever on it the drawer put it. */
function drawerText(page) {
  const roots = ['.tutor-drawer', '.tutor-fab', '.tutor-chip', '#tutor-notes'];
  return roots.flatMap((selector) => page.queryAll(selector).flatMap(rendered));
}

test('every string the drawer renders comes from the table, in any language', async (t) => {
  // The synthetic language: every key the plugin ships for English, as its own
  // name in fullwidth Latin. Any string the drawer holds itself then stands out
  // — including an English one, which the non-ASCII scan below cannot see.
  const strings = { [PSEUDO]: pseudoTable(TABLES.en) };

  // Content, fed in the same alphabet. What a Learner types and what a Tutor
  // answers are theirs, not the drawer's, so they would otherwise be the one
  // thing in the tree this check could not read.
  const question = sentinel('what does this mean');
  const answer = sentinel('it returns twice');
  const record = sentinel('learning-records/0004.md');

  const page = drawerIn(t, lessonHtml(PSEUDO), {
    strings,
    chunks: [
      event('open', { role: 'tutor' }),
      event('tool', { name: sentinel('Read'), target: sentinel('lessons/0003.html') }),
      event('delta', { text: answer }),
      event('done', { answer, durationMs: 12, record }),
    ],
  });

  // Read at every step rather than once at the end. A label that is replaced
  // on the way — the pin button, which says something else once it is pinned —
  // would otherwise be a string this check never looked at.
  const shown = [];
  const capture = () => shown.push(...drawerText(page));

  await settle();
  capture();
  page.click(page.query('.tutor-fab'));
  page.type(page.query('.tutor-input'), question);
  page.click(page.query('.tutor-send'));
  await settle();
  capture();

  // The whole of what a Learner can reach: the answer landed, it was pinned
  // into the Lesson, and the history panel is open over the top of it.
  page.click(page.query('.tutor-pin'));
  capture();
  page.click(page.query('.tutor-hist-btn'));
  capture();

  // Guard the observer. A drawer that rendered nothing, or a table that did not
  // reach it, would pass every claim below for free.
  assert.ok(shown.length >= 20, `expected the drawer to have rendered something, found ${shown.length} texts`);
  assert.ok(
    shown.some((text) => text.includes(sentinel('tutor.send'))),
    `the sentinel table never reached the drawer: ${shown.slice(0, 8).join(' | ')}`,
  );

  const foreign = shown.filter((text) => !SENTINEL.test(text));
  assert.deepEqual(foreign, [], 'the drawer is holding these strings itself rather than looking them up');
});

test('the same holds for the drawer with no service to reach', async (t) => {
  // The other half of what a Learner meets, and the half most likely to be
  // written in prose: the offline hint, the composer that degrades to the
  // clipboard, and the box a failure leaves behind.
  const strings = { [PSEUDO]: pseudoTable(TABLES.en) };
  const page = drawerIn(t, lessonHtml(PSEUDO), { strings, health: () => false });

  const shown = [];
  const capture = () => shown.push(...drawerText(page));

  await settle();
  capture();
  page.click(page.query('.tutor-fab'));
  page.type(page.query('.tutor-input'), sentinel('what does this mean'));
  page.click(page.query('.tutor-send'));
  await settle();
  capture();

  assert.ok(
    shown.some((text) => text.includes(sentinel('tutor.offline.hint'))),
    'the offline hint should be the thing on screen',
  );
  // The one thing on this path that is deliberately not a sentinel: the command
  // the Learner is told to run, which is a command in every language.
  const foreign = shown.filter((text) => !SENTINEL.test(text) && text !== 'node tutor/server.js');
  assert.deepEqual(foreign, [], 'the offline drawer is holding these strings itself');
});

test('the prompt handed to a Learner with no service is in their language', async (t) => {
  const strings = { [PSEUDO]: pseudoTable(TABLES.en) };
  const page = drawerIn(t, lessonHtml(PSEUDO), { strings, health: () => false });

  await settle();
  page.click(page.query('.tutor-fab'));
  page.type(page.query('.tutor-input'), sentinel('what does this mean'));
  page.click(page.query('.tutor-send'));
  await settle();

  const prompt = page.clipboard.text;
  assert.ok(prompt, 'the composer offline is the clipboard');

  // Scaffolding by every other measure, and the one exception the decision
  // names: its reader is the Learner, who reads it and may edit it before
  // sending it. A wall of English to check first defeats the whole fallback.
  for (const key of ['tutor.role.tutor.lead', 'tutor.copy.question', 'tutor.role.tutor.brief']) {
    assert.ok(prompt.includes(sentinel(key)), `the prompt is not in the Learner's language: ${key}`);
  }
});

/* ------------------------------------------------------------ the two contracts */

test('every key the drawer asks for has an entry in the table it falls back to', () => {
  const asked = keysAskedBy(read(DRAWER));

  assert.ok(asked.length >= 40, `expected keys to check, found ${asked.length}`);

  const missing = asked.filter((key) => !Object.prototype.hasOwnProperty.call(TABLES.en, key));
  assert.deepEqual(missing, [], 'the drawer asks for these, and a Learner would get the raw key');
});

test('the shipped tables agree about which keys exist', () => {
  const shipped = Object.keys(TABLES);
  assert.ok(shipped.length >= 2, `expected more than one shipped table, found ${shipped}`);

  const english = Object.keys(TABLES.en).sort();
  assert.ok(english.length >= 40, `expected entries to check, found ${english.length}`);

  for (const tag of shipped) {
    assert.deepEqual(Object.keys(TABLES[tag]).sort(), english, `${tag} does not hold the same keys as en`);
  }
});

test('every table puts a Submission to the Grader by name, whatever language it is in', () => {
  // The one thing this entry says that is not a matter of wording. The prompt
  // is pasted into whichever session the Learner has open, and the likeliest
  // one is the Teacher that wrote the Assignment — so naming the subagent is
  // what stops the fallback breaking the rule the arrangement exists for.
  for (const tag of Object.keys(TABLES)) {
    assert.match(
      TABLES[tag]['tutor.role.grader.brief'],
      /\.claude\/agents\/grader\.md/,
      `${tag}'s grader brief does not name the subagent that may judge this`,
    );
  }
});

/* ------------------------------------------------------------ the non-ASCII scan */

/**
 * Characters a Maintainer-facing file may carry beyond ASCII: the typographic
 * punctuation this repo's English prose is written with. Everything else —
 * a letter, a digit, an emoji — is a string that belongs in a table.
 */
const ENGLISH_PUNCTUATION = new Set([...'—–…‘’“”']);

/** Every line of `text` holding a character no English comment would. */
function foreignLines(text) {
  return text.split('\n').flatMap((line, index) => {
    const stray = [...line].filter((c) => c.charCodeAt(0) > 0x7f && !ENGLISH_PUNCTUATION.has(c));
    return stray.length ? [`${index + 1}: ${line.trim()}`] : [];
  });
}

test('the scan can see a string that does not belong, and lets English prose through', () => {
  // Guard the observer, from both sides. It has to see the three shapes this
  // has actually taken — a label, a comment, a decorative glyph — and it has to
  // let through the punctuation almost every paragraph in this repo uses.
  assert.equal(foreignLines("var label = '发送';").length, 1);
  assert.equal(foreignLines('// the header still reading 问答助教').length, 1);
  assert.equal(foreignLines("var fab = '🎓 Ask';").length, 1);
  assert.deepEqual(foreignLines('// a claim — and the caveat beside it… still English'), []);
});

test('the drawer\'s own source holds no Learner-facing string', () => {
  const stray = foreignLines(read(DRAWER));
  assert.deepEqual(
    stray,
    [],
    'assets/tutor.js is linked into every Workspace, so a string here is every Learner\'s language',
  );
});

test('the fixture Unit is built for a language rather than in one', () => {
  // The seam the pseudolocale checks above hang off. A fixture that hardcoded a
  // tag could only ever mount the pilot Workspace's audience.
  assert.match(lessonHtml(PSEUDO), new RegExp(`<html lang="${PSEUDO}">`));
  assert.match(lessonHtml(), new RegExp(`<html lang="${FIXTURE_LANG}">`));
});
