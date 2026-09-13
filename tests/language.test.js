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
//   a pseudolocale     the drawer, then every page of a Unit, mounted under a
//                      synthetic language whose table holds only sentinels,
//                      with nothing outside the sentinel alphabet in what they
//                      render. This is the one that catches a hardcoded
//                      *English* string
//   a non-ASCII scan   every file the plugin owns, and then the Workspace one
//                      scaffold run produces, which catches the other thing:
//                      one Learner's language creeping back into what every
//                      other Learner is handed
//   four contracts     every key any of them asks for has an entry, the shipped
//                      tables agree about which keys exist, every way the Tutor
//                      service can fail a stream has words on the page to be
//                      read as, and a Grader's refusal opens with the token its
//                      role definition mandates — all four derived from source,
//                      never listed here
//
// The drawer and every Component a Lesson is built from, on one mechanism. The
// drawer is not a Component — `CONTEXT.md` keeps that word for a reusable
// interaction pattern — but it reads out of the same table, so the checks are
// the same checks. Nothing below lists a Component: the sources are the shipped
// scripts, found on disk, and the keys are read out of them.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { Workspace, REPO_ROOT } = require('./helpers/workspace.js');
const {
  ALL_COMPONENTS,
  ECHOED_INPUT,
  UNIT,
  lessonHtml,
  pagesIn,
  FIXTURE_LANG,
} = require('./helpers/unit.js');
const { drawerIn, event, mount, pageFor, settle } = require('./helpers/drawer.js');
const { refusalToken } = require('./helpers/tutor.js');
const {
  NAMESPACES,
  TABLES,
  say,
  speaking,
  lookupSource,
  bootstrapSource,
  keysAskedBy,
  notEnglish,
  notThisLanguage,
  pseudoTable,
  sentinel,
  SENTINEL,
  SOURCE,
} = require('./helpers/learner-text.js');

const ASSETS = path.join(REPO_ROOT, 'skills/explorable-teach/runtime/assets');
const DRAWER = path.join(ASSETS, 'tutor.js');
const SERVICE = path.join(REPO_ROOT, 'skills/explorable-teach/runtime/tutor/server.js');
const GRADER_ROLE = path.join(REPO_ROOT, 'skills/explorable-teach/runtime/tutor/GRADER.md');
const read = (abs) => fs.readFileSync(abs, 'utf8');

/**
 * Every script the plugin puts on a Learner's page, found rather than listed.
 *
 * Listing them is the failure this is written against: a Component added to the
 * plugin and forgotten here is a Component nothing holds to the table, and it
 * would ship rendering English at a Learner who reads none. Reading the
 * directory means the day a Component arrives it is already covered.
 */
function shippedScripts() {
  return fs.readdirSync(ASSETS).filter((file) => file.endsWith('.js')).sort();
}

/**
 * The shipped scripts that *read* the table, which is all of them but the one
 * that holds it. `lesson-boot.js` writes every key it ships as a literal, so a
 * check that counted it as a reader would find every key asked for and every
 * namespace in use — and pass whatever anything else had stopped doing.
 */
function tableReaders() {
  return shippedScripts().filter((file) => path.join(ASSETS, file) !== SOURCE);
}

/**
 * Every file this plugin owns, found rather than listed, for the reason
 * `shippedScripts` is: what the plugin ships into a Workspace — copied out of
 * `templates/` or linked at in `runtime/` — and the scripts that put it there.
 * A document added and forgotten here is a document nothing holds to English.
 */
function pluginFiles() {
  const found = [];

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.isFile()) found.push(path.relative(REPO_ROOT, abs));
    }
  };

  for (const dir of ['skills', 'scripts']) walk(path.join(REPO_ROOT, dir));
  return found.sort();
}

/**
 * The source path of everything `init-workspace.sh` installs, read out of the
 * script rather than written here — `docs/agents/tests.md` bans keeping a copy
 * of the list the script owns, and a guard listing files would be that list a
 * line at a time.
 *
 * It is what makes the walk above a claim rather than a count: every file a
 * Workspace is actually handed has to be one the scan read.
 */
function scaffoldSources() {
  const script = read(path.join(REPO_ROOT, 'scripts/init-workspace.sh'));
  return [...script.matchAll(/(?:place|link)\s+"\$(?:TPL|RUNTIME)\/(\S+?)"/g)].map((m) => m[1]);
}

/**
 * Which question a file answers to, which is the split the whole Workspace is
 * built on — `docs/agents/tests.md`, "The split a scaffolded Workspace is built
 * on". Read off the directory, because that split *is* the directory.
 *
 * A file under `runtime/` is linked: the same bytes in every Workspace, so a
 * label in one is every Learner's and the strict rule applies. A file under
 * `templates/` is copied, and is one Workspace's own from the moment it lands —
 * so the only thing it may not arrive carrying is somebody else's language.
 * Everything else is a document only a Maintainer reads, and is strict too.
 */
function ruleFor(rel) {
  return rel.includes(`${path.sep}templates${path.sep}`) ? notThisLanguage : notEnglish;
}

/**
 * A plugin file as the non-ASCII scan reads it. `lesson-boot.js` is the one
 * exception, and it is the file the table lives in: scanned whole, every line
 * of `zh-CN` would be a finding. Its bootstrap half holds no table and is read
 * like any other. Recognised by resolving the helper's own path rather than by
 * a filename, so moving the table moves the exemption with it.
 */
function scannable(rel) {
  return path.join(REPO_ROOT, rel) === SOURCE ? bootstrapSource() : read(path.join(REPO_ROOT, rel));
}

/** A synthetic tag no Workspace has, and no plugin table answers for. */
const PSEUDO = 'qps-ploc';

/**
 * The Workspace's own table, in a scaffolded Workspace — found by the two
 * things that make it one rather than by a filename this suite does not own:
 * it *assigns* the global the lookup reads, and it is a copy rather than a link
 * into the plugin. `docs/agents/tests.md` bans restating what a script
 * installs, and a path written here is that list, a line at a time.
 *
 * Both halves are load-bearing. The bootstrap reads the same global, so the
 * name alone finds two files; and a link is the plugin's, which is the opposite
 * of what a Workspace's own table is.
 */
function ownTable(ws) {
  const found = Object.keys(ws.snapshot())
    .filter((rel) => rel.startsWith('assets/') && !rel.endsWith('/'))
    .filter((rel) => fs.lstatSync(ws.path(rel)).isFile())
    .filter((rel) => /window\.TEACH_STRINGS\s*=/.test(ws.read(rel)));

  assert.equal(found.length, 1, `expected one Workspace string table, found ${found}`);
  return found[0];
}

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

  const table = ownTable(ws);
  assert.ok(placed.includes(table), `the scaffold placed ${table} without reporting it`);
  assert.ok(fs.lstatSync(ws.path(table)).isFile(), 'it is the Workspace\'s own, so it is a copy');

  // A Teacher has to be told where to set the language, or the one place it
  // lives is a place nobody finds. Read out of the paragraph the scaffold
  // writes about what is still to author — a bare scan of the whole report
  // would pass on the word turning up anywhere in it, filenames included.
  const stillToAuthor = run.stdout.slice(run.stdout.indexOf('Still to author'));
  assert.ok(stillToAuthor.length > 0, 'the scaffold no longer says what is left to author');
  assert.match(stillToAuthor, /\blang\b/, 'it should say where the language is set');
  assert.ok(stillToAuthor.includes(table), `it should point at ${table}`);
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
  // Run with the attributes the page's own bootstrap tag carries. `data-unit`
  // is the one genuinely per-page value there is, and the bar reads it off the
  // tag the bootstrap writes for it — so a boot that dropped it would drive a
  // bar that never mounted.
  const declared = page
    .queryAll('script')
    .find((tag) => /assets\/lesson-boot\.js/.test(tag.getAttribute('src') || ''));
  const unit = declared && declared.getAttribute('data-unit');
  page.script('lesson-boot.js', unit ? { 'data-unit': unit } : {});

  for (let guard = 0; guard < 20; guard += 1) {
    const next = page.queryAll('script').find((tag) => tag.onload && !tag.loaded);
    if (!next) return page;

    next.loaded = true;
    const file = next.src.replace(/^.*assets\//, '');
    // Carried across rather than dropped: the bootstrap is what passes the
    // page's Unit id down to the bar, and a bar handed none never mounts.
    const carried = next.getAttribute('data-unit');

    // One or the other, never both: the bootstrap wires the same handler to
    // each, so telling it twice would advance the chain twice and skip a file.
    if (fs.existsSync(path.join(assetsDir, file))) {
      page.script(file, carried ? { 'data-unit': carried } : {});
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

test('the language the page declares rides the request', async (t) => {
  // The service produces exactly one Learner-facing thing — the answer — and
  // nothing on its side of the socket can see a page. So the page names the
  // language, out of the same `<html lang>` every label on it is looked up
  // against; what a request naming none means is then the service's to decide
  // rather than the drawer's to guess.
  const declared = drawerIn(t, lessonHtml('pt-BR'));
  await settle();
  declared.click(declared.query('.tutor-fab'));
  declared.type(declared.query('.tutor-input'), 'what does this mean');
  declared.click(declared.query('.tutor-send'));
  await settle();

  assert.equal(declared.asked.length, 1, 'the drawer never asked anything, so nothing here is a claim');
  assert.equal(declared.asked[0].lang, 'pt-BR');

  const silent = drawerIn(
    t,
    '<!DOCTYPE html>\n<html>\n<head></head>\n<body><div class="lesson"></div></body>\n</html>\n',
  );
  await settle();
  silent.click(silent.query('.tutor-fab'));
  silent.type(silent.query('.tutor-input'), 'what does this mean');
  silent.click(silent.query('.tutor-send'));
  await settle();

  assert.equal(silent.asked[0].lang, '', 'a page declaring no language should invent none');
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
  const japanese = speaking('ja-JP', { ja: { 'tutor.send': 'OKURU' } }).say;
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
  const speaks = (lang) => speaking(lang, table).say;

  assert.equal(speaks('zh-CN')('tutor.send'), 'GO', 'the Workspace wins over the plugin');
  assert.equal(speaks('zh-CN')('tutor.status.online'), TABLES['zh-CN']['tutor.status.online'],
    'and everything it does not cover still comes from the plugin');

  assert.equal(speaks('ja')('tutor.send'), 'OKURU', 'a language the plugin never shipped');
  assert.equal(speaks('ja')('tutor.status.online'), TABLES.en['tutor.status.online'],
    'and a gap in it is English rather than somebody else\'s language');
});

test('the page is the only place a language is read from', () => {
  // Not the browser. The requirement is that the Learner's *recorded*
  // preference decides, and a browser setting is a guess wearing a record's
  // clothes — it would also make one Workspace read differently on two
  // machines. Asserted from both sides, the way `rich-text.test.js` asserts its
  // own interface claim.
  const browser = { navigator: { language: 'zh-CN', languages: ['zh-CN'] } };
  const asked = speaking('', null, browser);

  assert.equal(
    asked.say('tutor.send'),
    TABLES.en['tutor.send'],
    'a browser that asked for Chinese still got English, because the page named none',
  );
  assert.doesNotMatch(lookupSource(), /navigator|Intl\b/, 'and nothing in it reaches for one');
});

test('a Workspace upgraded to this plugin reads exactly as it did before', async (t) => {
  // The claim that costs the most if it is wrong: an existing Workspace holds
  // symlinks, so a file the plugin *already* links follows an upgrade the
  // moment it lands, and a file the plugin has newly added simply is not there
  // until the scaffold next runs. A table nobody can reach renders its own keys
  // on a Learner's screen — which is what this caught, and why the tables live
  // in the bootstrap rather than in a file of their own.
  //
  // So: scaffold, then take away everything this change added, and read the
  // drawer. Nothing may have moved.
  const ws = Workspace.create(t);
  ws.scaffold();
  fs.rmSync(ws.path(ownTable(ws)));
  ws.write('assets/units.js', "window.TEACH_COURSE = { title: 'x' };\n");

  const page = pageFor(ws.path('assets'), { html: lessonHtml(FIXTURE_LANG) });
  boot(page, ws.path('assets'));
  await settle();

  for (const [selector, key] of [
    ['.tutor-status', 'tutor.status.online'],
    ['.tutor-send', 'tutor.send'],
    ['.tutor-fab', 'tutor.fab'],
    ['.tutor-title', 'tutor.role.tutor.title'],
  ]) {
    const shown = page.text(selector);
    assert.notEqual(shown, key, `${selector} is showing a raw key — the table never reached the page`);
    assert.ok(
      shown.includes(TABLES[FIXTURE_LANG][key]),
      `${selector} should read ${TABLES[FIXTURE_LANG][key]}, not ${shown}`,
    );
  }
});

test('a Workspace with no table of its own still reads in its language', async (t) => {
  // What every existing Workspace is: pages declaring `zh-CN`, a manifest with
  // no `lang` in it, and no table of its own anywhere. Nothing is run to
  // migrate it, so the absence has to be what degrades.
  const ws = Workspace.create(t);
  ws.scaffold();
  ws.write('assets/units.js', "window.TEACH_COURSE = { title: 'x' };\n");
  fs.rmSync(ws.path(ownTable(ws)));

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

test('a Workspace with no table of its own still mounts its Components', async (t) => {
  // The upgrade path, now that mounting waits for the bootstrap. An older
  // Workspace has no assets/strings.js at all, so the step the release hangs
  // off is a script that is not there. If the chain stopped at it, every Lesson
  // in that Workspace would go inert on upgrade — no verdict, no reveal, no
  // gate — with nothing erroring, which is the worst shape this could fail in.
  const ws = Workspace.create(t);
  ws.scaffold();
  ws.write('assets/units.js', "window.TEACH_COURSE = { title: 'x' };\n");
  fs.rmSync(ws.path(ownTable(ws)));

  const fixture = pagesIn(FIXTURE_LANG).find((page) => page.key === 'lesson');
  const page = pageFor(ws.path('assets'), { html: fixture.html });
  for (const component of fixture.components) page.script(component.js);
  boot(page, ws.path('assets'));
  await settle();

  for (const component of fixture.components) {
    assert.ok(
      page.query(component.root).classList.contains('is-live'),
      `${component.name} never mounted, so the absent table took the Lesson with it`,
    );
  }
  assert.equal(
    page.text('.steps-count'),
    say(FIXTURE_LANG, 'steps.count', { at: 1, of: 4 }),
    'and it reads out of the shipped table, which is what an un-migrated Workspace falls back to',
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

/**
 * Every text and every label a reader meets, out of one subtree — the root's own
 * labels included, because the thing a check is handed is as likely to carry one
 * as anything inside it. The bar's whole name for a screen reader is an
 * `aria-label` on the `<nav>` itself, and reading only the children walked past
 * it.
 *
 * A `<script>` is walked past rather than read: a browser renders none of it,
 * and an Assignment page carries its Rubric in one. A `<style>` goes with it
 * for the same reason.
 *
 * What this reads decides what `ECHOED_INPUT` has to hold. It reads text and
 * labels, never a box's `value`, which is why only one of the things the
 * fixture's drives type ever reaches a tree and why the exclusion list below is
 * one entry long. Widening this to read `value` — a Learner does read what is
 * in a textarea — means widening that list in the same commit, or four inputs'
 * worth of a Learner's own words start failing the sentinel test with no hint
 * why.
 */
function rendered(root) {
  const found = [];
  const labels = (node) => {
    for (const name of ['title', 'aria-label', 'placeholder']) {
      const label = node.getAttribute(name);
      if (label) found.push(label);
    }
  };
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) found.push(child.data);
      else if (child.localName !== 'script' && child.localName !== 'style') {
        labels(child);
        walk(child);
      }
    }
  };
  if (root.getAttribute) labels(root);
  walk(root);
  return found.filter((text) => text.trim() !== '');
}

/**
 * What a page says that it did not say before anything ran — which is the half
 * a Component is answerable for.
 *
 * The other half is the author's: a Lesson's prose, its questions, its steps,
 * the verdicts a Checkpoint's author wrote out. Those are written in the
 * Learner's language by the Teacher rather than looked up, so a check that read
 * them would be reading the fixture rather than the Component. Subtracting what
 * was already there is how that line gets drawn without naming a selector — and
 * a Component that replaced an authored sentence with one of its own would show
 * up here as text that was not on the page before.
 */
function putThere(before, after) {
  const authored = new Set(before);
  return after.filter((text) => !authored.has(text));
}

/**
 * One line of a rendered tree with the Learner's own words taken out of it.
 *
 * A refusal names the path it refused, and that path is the Learner's — there
 * is no fullwidth spelling of `/etc/passwd` that a hand-in would refuse, so the
 * line it is in cannot be all sentinels. Cutting the typed text out of the line
 * rather than excusing the line keeps the rest of that sentence under check,
 * which is where the hardcoded half of a refusal would be.
 *
 * The cut is made in every captured line rather than only the one it landed in.
 * That is safe because `ECHOED_INPUT` holds one entry and it is an escaping
 * path: no label anywhere else could contain it. Two checks keep it that way —
 * one asserts every entry reached a screen before any line is forgiven on its
 * account, and one asserts no shipped string contains one.
 */
function withoutTypedText(text) {
  return ECHOED_INPUT.reduce((left, typed) => left.split(typed).join(''), text);
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

test('a failure the service names is read out of the table as well', async (t) => {
  // The service holds no Learner-facing string, so a failure of its own arrives
  // as a code and this is where a code becomes words. Fed as an event rather
  // than by breaking the transport: what is under test is the drawer reading
  // the code, and a request that never connected is the other failure, which
  // the check above already drives.
  const strings = { [PSEUDO]: pseudoTable(TABLES.en) };
  const page = drawerIn(t, lessonHtml(PSEUDO), {
    strings,
    chunks: [
      event('open', { role: 'tutor' }),
      event('error', { code: 'timeout', durationMs: 120_000 }),
    ],
  });

  await settle();
  page.click(page.query('.tutor-fab'));
  page.type(page.query('.tutor-input'), sentinel('what does this mean'));
  page.click(page.query('.tutor-send'));
  await settle();

  const shown = drawerText(page);
  assert.ok(
    shown.some((text) => text.includes(sentinel('tutor.fail.timeout'))),
    `the code was never read out of the table: ${shown.slice(0, 8).join(' | ')}`,
  );
  assert.deepEqual(
    shown.filter((text) => !SENTINEL.test(text)),
    [],
    'the failed request is holding these strings itself rather than looking them up',
  );
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

/* ------------------------------------------- the pseudolocale, over a whole Unit */

/**
 * A page of the fixture Unit in a language nothing ships a table for, loaded
 * the way a browser loads it and driven the way a Learner drives it.
 *
 * The Workspace's own `assets/strings.js` is the only table that can answer, so
 * this is also the check that a Workspace supplying a language the plugin has
 * never collected gets neither English nor Chinese anywhere on the page.
 *
 * The order is the page's own: a Lesson writes its Component tags above the one
 * bootstrap tag, so every Component runs first and only hands its mount over —
 * `boot` then drives the real chain, and what mounts them is the bootstrap,
 * after the Workspace's table has had its chance to load. A Component that
 * mounted at once would render out of the plugin's tables here and fail.
 */
function unitPage(t, fixture, { strings, units = [], health } = {}) {
  const ws = Workspace.create(t);
  ws.scaffold();
  ws.write('assets/strings.js', `window.TEACH_STRINGS = ${JSON.stringify(strings)};\n`);
  ws.write(
    'assets/units.js',
    `window.TEACH_COURSE = { lang: '${PSEUDO}', title: ${JSON.stringify(sentinel('a course'))} };\n`
      + `window.TEACH_UNITS = ${JSON.stringify(units)};\n`,
  );

  const page = pageFor(ws.path('assets'), {
    html: fixture.html,
    at: `/${fixture.file}`,
    ...(health ? { health } : {}),
  });

  page.authored = componentText(page, fixture);
  for (const component of fixture.components) page.script(component.js);
  boot(page, ws.path('assets'));
  return page;
}

/**
 * What this page's Components have on screen — their own subtrees and no more.
 *
 * The drawer is on the page too, and answers for itself two checks above; what
 * a Tutor says back is content rather than either one's string, and reading it
 * here would be reading the stub.
 */
function componentText(page, fixture) {
  return fixture.components.flatMap((component) => page.queryAll(component.root).flatMap(rendered));
}

test('every string the Components render comes from the table, in any language', async (t) => {
  const strings = { [PSEUDO]: pseudoTable(TABLES.en) };
  const rendering = [];

  // Every page driven first, and judged afterwards. The order is the observer
  // rule: what this check forgives is guarded below out of what the pages
  // actually put on screen, and a guard that ran after the assertion it guards
  // would only hold on a suite that was already green.
  for (const fixture of pagesIn(PSEUDO)) {
    const page = unitPage(t, fixture, { strings });
    await settle();

    // Read at every state rather than once at the end, for the reason the
    // drawer's own check is: a label replaced on the way — a reveal button once
    // it has revealed, a progress line once it becomes a score — would
    // otherwise be a string nothing ever looked at. Each Component's own drive
    // comes off the fixture, so a Component added there is driven here without
    // this being edited.
    const shown = [];
    const capture = () => shown.push(...componentText(page, fixture));
    capture();
    for (const component of fixture.components) {
      component.drive(page, page.query(component.root), capture);
    }
    await settle();
    capture();

    const mine = putThere(page.authored, shown);

    // Guard the observer, twice. A page whose Components never mounted, or a
    // table that never reached them, would pass every claim below for free.
    assert.ok(
      mine.length >= 5,
      `${fixture.name}: expected its Components to have rendered something, found ${mine.length}`,
    );
    for (const component of fixture.components) {
      assert.ok(
        page.query(component.root).classList.contains('is-live'),
        `${fixture.name}: ${component.name} never mounted, so nothing below is a claim about it`,
      );
    }

    rendering.push({ fixture, mine });
  }

  // Guard the last observer there is: the list of text this check forgives.
  // An entry nothing ever put on a screen forgives that text on every page
  // forever, so an entry that stops being echoed — a drive dropped, a refusal
  // that stops naming what it refused — fails here, before anything is
  // forgiven on its account below.
  const everything = rendering.flatMap(({ mine }) => mine);
  for (const typed of ECHOED_INPUT) {
    assert.ok(
      everything.some((text) => text.includes(typed)),
      `nothing put ${JSON.stringify(typed)} on a screen, so taking it back out forgives whatever holds it`,
    );
  }

  // What the drives typed is the Learner's own, and is taken back out of the
  // line it landed in rather than the line being excused. The list comes off
  // the fixture that typed it, so a drive that starts typing something new does
  // not quietly widen what this check forgives.
  for (const { fixture, mine } of rendering) {
    const foreign = mine.filter((text) => !SENTINEL.test(withoutTypedText(text)));
    assert.deepEqual(foreign, [], `${fixture.name}: these are held in source rather than looked up`);
  }
});

test('a Checkpoint gives the author\'s verdict, and counts in the Learner\'s language', async (t) => {
  // Two different things on one page, told apart by who wrote them. *Which*
  // passage to go back and read is a sentence about this Unit and nothing else,
  // so a Checkpoint's two outcomes are the author's own prose, written in the
  // Learner's language because the whole page is. What the Component adds is
  // the score, and that comes off the table like every label it renders. The
  // failure this rules out is either half taking the other's place.
  const strings = { [PSEUDO]: pseudoTable(TABLES.en) };
  const gate = pagesIn(PSEUDO).find((page) => page.key === 'checkpoint');
  const page = unitPage(t, gate, { strings });
  await settle();

  const authored = page.text('.checkpoint-again');
  assert.ok(authored.length > 0, 'the fixture gate carries no retry message, so there is nothing to hold');

  for (const component of gate.components) component.drive(page, page.query(component.root), () => {});

  assert.equal(page.query('.checkpoint-again').hidden, false, 'one wrong answer holds the Unit open');
  assert.equal(page.query('.checkpoint-pass').hidden, true, 'and it is not also told it may close');
  assert.equal(page.text('.checkpoint-again'), authored, 'in the words the author wrote, untouched');
  assert.match(
    page.text('.checkpoint-progress'),
    new RegExp(sentinel('checkpoint.right')),
    'while the score beside it is the table\'s',
  );
});

test('the navigation bar across the top of a Unit is in the Learner\'s language too', async (t) => {
  const strings = { [PSEUDO]: pseudoTable(TABLES.en) };
  const lesson = pagesIn(PSEUDO).find((page) => page.key === 'lesson');

  // The fixture Unit as the bar meets it: a Lesson and a Checkpoint written, no
  // Assignment — which is what puts a slot on the bar with nothing behind it.
  // Its own title and number are the author's, so they are fed as sentinels the
  // way the drawer's check feeds a question.
  const here = {
    id: UNIT.id,
    num: sentinel('L03'),
    title: sentinel('fork and exec'),
    lesson: UNIT.lesson,
    checkpoint: UNIT.checkpoint,
  };
  const other = (id, num) => ({
    id,
    num: sentinel(num),
    title: sentinel('pipes'),
    lesson: `lessons/${id}-pipes.html`,
  });

  // Mounted twice, because the two neighbour slots each have two states and one
  // placement only ever shows one of each. First in the Curriculum, the bar
  // says there is nothing before; last in it, that the next Unit is unwritten.
  // A hardcoded label in the half a single placement never renders is exactly
  // what this check exists to catch.
  const shown = [];
  for (const units of [[here, other('0004', 'L04')], [other('0002', 'L02'), here]]) {
    const page = unitPage(t, lesson, { strings, units });
    await settle();

    const bar = page.query('.tnav');
    assert.ok(bar, 'the bar never mounted, so nothing below is a claim about it');
    shown.push(...rendered(bar));
  }

  // Guard the observer against the table rather than against a key written out
  // here: every entry the bar's namespace carries has to have reached a screen
  // across the two placements, so an entry nothing renders is a finding too.
  const missed = Object.keys(TABLES.en)
    .filter((key) => key.startsWith('nav.'))
    .filter((key) => !shown.some((text) => text.includes(sentinel(key))));
  assert.deepEqual(missed, [], 'the bar never put these on screen, so nothing here is a claim about them');

  assert.deepEqual(
    shown.filter((text) => !SENTINEL.test(text)),
    [],
    'the bar is holding these strings itself rather than looking them up',
  );
});

/* ----------------------------------------------------------- the four contracts */

test('every key any shipped script asks for has an entry in the table it falls back to', () => {
  // Derived three times over: the scripts are found on disk, the keys are read
  // out of each one, and what counts as a key comes off the table's own
  // namespaces. Nothing here names a Component, so a Component added to the
  // plugin is covered by this the day its entries land in the table.
  const asked = {};
  for (const file of tableReaders()) asked[file] = keysAskedBy(read(path.join(ASSETS, file)));

  const total = Object.values(asked).reduce((n, keys) => n + keys.length, 0);
  assert.ok(total >= 40, `expected keys to check, found ${total}`);

  // Guard the observer from the other side, twice. A Component that quietly
  // stopped asking for anything would have every claim below pass for free —
  // and a namespace the table still carries that no script asks for is a whole
  // surface that fell off it, which is how the bar could go back to holding its
  // own strings with this check none the wiser.
  for (const component of ALL_COMPONENTS) {
    assert.ok(
      asked[component.js] && asked[component.js].length > 0,
      `${component.js} looks up no Learner-facing text at all`,
    );
  }
  const everyKey = Object.values(asked).flat();
  const unread = NAMESPACES.filter((namespace) => !everyKey.some((key) => key.startsWith(`${namespace}.`)));
  assert.deepEqual(unread, [], 'the table carries these namespaces, and nothing on a page asks for them');

  const missing = {};
  for (const [file, keys] of Object.entries(asked)) {
    const gaps = keys.filter((key) => !Object.prototype.hasOwnProperty.call(TABLES.en, key));
    if (gaps.length) missing[file] = gaps;
  }
  assert.deepEqual(missing, {}, 'these are asked for, and a Learner would get the raw key');
});

/**
 * Every way the service can fail a stream, read out of the service.
 *
 * It sends a code rather than a sentence, because it holds no Learner-facing
 * string: a sentence there would be in one language, in a file every Workspace
 * runs. Read off the emission sites rather than off a list, for the reason
 * every other derivation here is — a code added without an entry is exactly the
 * mistake this is written against, and a list would have to be edited by the
 * same person making it.
 */
function failureCodes() {
  return [...new Set([...read(SERVICE).matchAll(/\bcode: '([a-z0-9-]+)'/g)].map((m) => m[1]))].sort();
}

/** How the drawer turns one of those codes into a key, read out of the drawer. */
function failureKeys() {
  const map = /var FAILED = \{([^}]*)\}/.exec(read(DRAWER));
  assert.ok(map, 'the drawer no longer says which key a failure code is read as');

  const entries = {};
  for (const [, code, key] of map[1].matchAll(/'([a-z0-9-]+)':\s*'([a-z0-9.]+)'/g)) entries[code] = key;
  return entries;
}

test('every failure the service can name has words on the page to be read as', () => {
  const codes = failureCodes();
  const keys = failureKeys();

  // Guard the observer from both sides: a regex that found nothing would pass
  // this for free, and an entry the service can never send is a word nobody
  // will ever read — the shape a code being renamed on one side leaves behind.
  assert.ok(codes.length >= 2, `expected the service's failure codes, found ${codes}`);
  assert.deepEqual(
    Object.keys(keys).filter((code) => !codes.includes(code)),
    [],
    'the page reads these as words, and the service cannot send them',
  );

  const unreadable = codes.filter(
    (code) => !keys[code] || !Object.prototype.hasOwnProperty.call(TABLES.en, keys[code]),
  );
  assert.deepEqual(unreadable, [], 'the service can fail this way, and the Learner would be told nothing');

  // The floor of the derivation, named and then held to. A code is read here as
  // a literal at the point it is sent, so one sent by way of a variable would be
  // invisible to everything above — which is the one way this check could pass
  // while a Learner met a failure with no words behind it.
  const sent = [...read(SERVICE).matchAll(/code:\s*([^,}\n]+)/g)].map((m) => m[1].trim());
  assert.deepEqual(
    sent.filter((value) => !/^'[a-z0-9-]+'$/.test(value)),
    [],
    'a failure code has to be written where it is sent, because that is what this check can read',
  );
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

test('no shipped string holds text the pseudolocale check cuts out', () => {
  // A static property of the tables, so it is asserted here rather than from
  // inside a check that has to mount three pages to get to it. `ECHOED_INPUT`
  // is text a Learner typed that a Component reads back onto the screen, and
  // the pseudolocale check cuts it out of a line before asking whether what is
  // left came from the table. A shipped string that happened to contain one
  // would have that much of itself cut away before it was ever read — so a
  // Component hardcoding it would pass on the strength of the coincidence.
  for (const typed of ECHOED_INPUT) {
    const holding = Object.keys(TABLES)
      .flatMap((tag) => Object.keys(TABLES[tag]).map((key) => [`${tag}/${key}`, TABLES[tag][key]]))
      .filter(([, value]) => value.includes(typed))
      .map(([where]) => where);

    assert.deepEqual(holding, [], `these hold ${JSON.stringify(typed)}, so cutting it out cuts a shipped string`);
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

/**
 * A regular expression a shipped file holds, read back out of its source.
 *
 * Flags travel with it. A pattern read without them is not the pattern the file
 * runs, and the two that matter here — a refusal is case-sensitive, and it is
 * anchored at the start rather than at every line — are both flags away from
 * meaning something else.
 */
function patternIn(file, name) {
  const literal = new RegExp(`\\b${name} = /(.+)/([a-z]*);`).exec(read(file));
  assert.ok(literal, `${path.basename(file)} no longer holds a pattern called ${name}`);
  return new RegExp(literal[1], literal[2]);
}

test('a refusal opens with the token its role definition mandates, and both readers know it', () => {
  // The fourth contract, and the only one whose authority is a document rather
  // than a script. `GRADER.md` tells a Grader to open a refusal with this line;
  // the service reads it to keep that refusal out of `learning-records/`,
  // because a record claiming a judgement nobody reached is worse than no
  // record; and the drawer strips it, because it is a marker rather than
  // something to read. Translating the definition without moving the other two
  // breaks that silently, which is what this is written against.
  const token = refusalToken();

  // ASCII, in every Workspace. What follows it is the Learner's language and
  // this is not: a token that had to be translated would be the same defect
  // again in the next language.
  assert.deepEqual(notEnglish(token), [], 'the refusal opens with something that has to be translated');
  assert.match(token, /:$/, 'the opening has to be recognisable as the marker it is');

  // Three ways the same refusal can arrive, and all three have to be one.
  //
  // The middle one is the sharp case: `GRADER.md` sets the token off as an
  // indented block, so a Grader told to reproduce it "character for character"
  // sends the indentation with it — read off the document rather than spelled
  // here, because how the definition presents the token is the definition's to
  // change. The third is the other half of the same question: the service reads
  // an answer trimmed and the drawer reads a stream as it accumulates, so a
  // reader that anchored hard would recognise a refusal the other one missed,
  // and the Learner would meet a marker addressed to a service.
  const asShown = read(GRADER_ROLE).split('\n').find((line) => line.trim() === token);
  assert.ok(asShown, 'the definition no longer quotes the token on a line of its own');

  const explained = '\nThe Assignment page stores no Rubric.';
  const refusals = [token + explained, asShown + explained, '\n' + token + explained];
  const verdict = 'Passed. You named what each stage reads.';

  // The service recognises the token to keep the refusal off the record; the
  // drawer recognises it to take it off the screen. Two files, one reading.
  const readers = [
    ['service', patternIn(SERVICE, 'CANNOT_GRADE')],
    ['drawer', patternIn(DRAWER, 'REFUSAL')],
  ];

  for (const [who, pattern] of readers) {
    for (const refusal of refusals) {
      assert.ok(
        pattern.test(refusal),
        `the ${who} does not recognise a refusal arriving as ${JSON.stringify(refusal.slice(0, 24))}`,
      );
    }
    assert.ok(!pattern.test(verdict), `the ${who} takes a verdict for a refusal`);
  }
});

/* ------------------------------------------------------------ the non-ASCII scan */

/**
 * Every line of `text` that `rule` finds a character it should not carry on.
 *
 * The rule is the caller's because two of them apply, and which one a file
 * answers to is `ruleFor` above. `notEnglish` is the strict one, and it is the
 * helper's rather than this file's because the service's suite reads the
 * payload it builds with the same question — two answers to it would let a
 * string that fails one check pass the other.
 */
function foreignLines(text, rule = notEnglish) {
  return text.split('\n').flatMap((line, index) => {
    const stray = rule(line);
    return stray.length ? [`${index + 1}: ${line.trim()}`] : [];
  });
}

/**
 * The findings across a set of files, as `name -> lines`. Both scans below ask
 * the same question of a different set, so they read them the same way: one
 * says where the bytes come from, the other which rule each name answers to.
 */
function strayLanguage(names, bytesOf, ruleOf) {
  const stray = {};
  for (const name of names) {
    const found = foreignLines(bytesOf(name), ruleOf(name));
    if (found.length) stray[name] = found;
  }
  return stray;
}

test('the scan can see a string that does not belong, and lets English prose through', () => {
  // Guard the observer, from both sides, and on both rules.
  //
  // The strict one is what a linked file answers to. It has to see the three
  // shapes this has actually taken — a label, a comment, a decorative glyph,
  // because a glyph in shared source is half a label whose other half is in a
  // table — and it has to let through the typographic punctuation this repo's
  // English prose is written with.
  assert.equal(foreignLines("var label = '发送';").length, 1);
  assert.equal(foreignLines('// the header still reading 问答助教').length, 1);
  assert.equal(foreignLines("var fab = '🎓 Ask';").length, 1);
  assert.deepEqual(foreignLines('// a claim — and the caveat beside it… still English'), []);
  assert.deepEqual(foreignLines('// never started → timed out → stale port · in that order'), []);

  // The narrower one is what a copied file answers to, and it differs in
  // exactly one way: a glyph on a page that is one Workspace's own is that
  // Workspace's business, while a language that is not theirs is still not.
  assert.deepEqual(foreignLines("var ICON = { done: '✅', todo: '⬜' };", notThisLanguage), []);
  assert.equal(foreignLines("var label = '课程序列';", notThisLanguage).length, 1);
  assert.equal(foreignLines("var send = 'Enviá';", notThisLanguage).length, 1);
});

test('nothing the plugin ships is written in one Learner\'s language', () => {
  // Every file the plugin owns, in one pass. It used to be the scripts alone,
  // which was all that could pass while the seeds and the runtime README were
  // still the pilot Workspace's — and a scan over a subset is a scan the next
  // document drifts back in behind.
  const files = pluginFiles();

  // Guard the observer twice. A walk that quietly stopped descending would
  // report nothing and pass every assertion below; and a walk that reached
  // some of it is not the claim, so every file the scaffold installs has to be
  // one of these. Derived from the script, because the script owns that list.
  assert.ok(files.length >= 40, `expected the plugin's files to scan, found ${files.length}`);

  const installs = scaffoldSources();
  assert.ok(installs.length >= 10, `expected the scaffold's install list, found ${installs.length}`);
  assert.deepEqual(
    installs.filter((src) => !files.some((rel) => rel.endsWith(`/${src}`))),
    [],
    'the scan does not reach every file a Workspace is handed',
  );

  assert.deepEqual(
    strayLanguage(files, scannable, ruleFor),
    {},
    'this reaches a Learner who may read none of it',
  );
});

test('a scaffolded Workspace is seeded in English, and carries no other course', (t) => {
  // The same claim from the other end, because the two can disagree: the scan
  // above reads what the plugin holds, and this reads what a Teacher is
  // actually handed on day one — the copies and the links together, which is
  // the only place the split stops being an arrangement and becomes a
  // directory.
  const ws = Workspace.create(t);
  ws.scaffold();

  // The tables are the one exemption, reached through whichever link the
  // scaffold pointed at them — resolved rather than named, because naming the
  // file here would be a second copy of the install list.
  const entries = Object.keys(ws.snapshot())
    .filter((rel) => !rel.endsWith('/'))
    .filter((rel) => fs.realpathSync(ws.path(rel)) !== SOURCE);

  assert.ok(entries.length >= 20, `expected a scaffolded Workspace to read, found ${entries.length}`);

  // Which rule a file in a Workspace answers to is decided the same way, and
  // by the same fact: a link is the plugin's and a real file is this
  // Workspace's own, which is the split one directory along from `ruleFor`.
  const copied = (rel) => (fs.lstatSync(ws.path(rel)).isSymbolicLink() ? notEnglish : notThisLanguage);

  assert.deepEqual(
    strayLanguage(entries, (rel) => ws.read(rel), copied),
    {},
    'a fresh Workspace should start generic, in English, about nobody in particular',
  );
});

test('the authoring guide tells a Teacher to write the Learner\'s language', () => {
  // The page skeleton is what every Lesson is copied from, so a real tag
  // standing in it is that one language copied forward into every page a
  // Teacher writes — which is how the pilot Workspace's got everywhere to
  // begin with. The scan above is blind to this one: `lang="en"` is ASCII.
  //
  // Found by the attribute rather than by the document, because which document
  // holds the skeleton is disclosure's to move.
  const guide = read(path.join(REPO_ROOT, 'skills/explorable-teach/UNIT.md'));
  const declared = [...guide.matchAll(/<html lang="([^"]*)"/g)].map((m) => m[1]);

  assert.ok(declared.length >= 1, 'the authoring guide no longer shows a page skeleton');

  // A BCP-47 tag, as a page carries one. Anything that is not one is a
  // placeholder, and what to put there is the prose beside it.
  const TAG = /^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/;
  assert.deepEqual(
    declared.filter((value) => TAG.test(value)),
    [],
    'the skeleton mandates a language, so every Lesson copied from it is written in that one',
  );
});

test('the fixture Unit is built for a language rather than in one', () => {
  // The seam the pseudolocale checks above hang off. A fixture that hardcoded a
  // tag could only ever mount the pilot Workspace's audience.
  assert.match(lessonHtml(PSEUDO), new RegExp(`<html lang="${PSEUDO}">`));
  assert.match(lessonHtml(), new RegExp(`<html lang="${FIXTURE_LANG}">`));
});
