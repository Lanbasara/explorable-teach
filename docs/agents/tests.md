# Tests

How to run this repo's tests, and what they are for.

## Running them

```
npm test          # or: node --test
```

Node's built-in test runner, no third-party dependencies and no install step. There is no
build. `package.json` exists only to name that one command.

## What is under test

This plugin ships documents and shell scripts, not an application. So the suite asks one
question: **do the plugin's documents and scripts still describe reality?**

| Suite | Holds this promise |
|-------|--------------------|
| `tests/pointers.test.js` | Every relative pointer in an agent-facing document resolves to a file that exists |
| `tests/assets.test.js` | Every `assets/…` path a document or template names is installed by the scaffold |
| `tests/components.test.js` | Each shipped Component mounts, responds, and leaves the Lesson readable without it |
| `tests/init-workspace.test.js` | The scaffold never overwrites, so it is safe as a repair tool |
| `tests/wire-lessons.test.js` | The bootstrap tag lands exactly once, and re-running is free |
| `tests/workspace-helper.test.js` | The fixture Workspace below actually observes what it claims to |
| `tests/dom-helper.test.js` | The fixture DOM below parses and dispatches what it claims to |

## The fixture Workspace

`tests/helpers/workspace.js` gives a test a throwaway directory standing in for a learner's
Workspace, removed when the test ends. Build on it rather than reaching for `mkdtemp` again.

```js
const ws = Workspace.create(t);              // bound to this test's lifetime
ws.write('lessons/0003-fork-exec.html', html);
ws.scaffold();                               // scripts/init-workspace.sh
const before = ws.snapshot();
ws.wire();                                   // scripts/wire-lessons.sh
assert.deepEqual(ws.snapshot(), before);     // nothing changed
```

`snapshot()` is the load-bearing part. It hashes content and records modes for every entry,
so "running this twice changed nothing" is a real claim rather than a timestamp comparison.
`run(script, args)` executes any repo script with the Workspace as its working directory,
directly rather than through `sh`, so the shebang and the executable bit are under test too.
It waits for the command to exit, with a timeout as a backstop — a script that hangs should
fail one test rather than wedge the suite.

## The fixture DOM

`tests/helpers/dom.js` is a DOM small enough to read and real enough to mount a Component in.
There is no browser here and no jsdom, so a Component that a test only *reads* is not under
test at all — "it renders" has to mean something ran.

```js
const page = Page.load(LESSON_HTML, ws.path('assets'));  // a scaffolded Workspace's assets/
page.script('exercise.js');                              // run the shipped file, not a copy
page.click(page.queryAll('.exercise-option')[1]);
assert.ok(page.query('.exercise').classList.contains('is-correct'));
```

It is deliberately a subset, and it fails loudly rather than quietly when a Component reaches
past that subset: an unsupported selector throws instead of matching nothing, and `innerHTML`
throws on assignment, because a shipped Component must build nodes rather than splice markup.
Grow the subset on purpose when a Component genuinely needs more.

`tests/helpers/lesson.js` holds the fixture Lesson — one page written the way `SKILL.md`'s
Lesson template says to write one, using every shipped Component. Both `assets.test.js` and
`components.test.js` read it, so **adding a Component means adding one entry to `COMPONENTS`
and its markup to that page**; every check then covers it without being told separately.

## Two rules for adding tests

**Never restate what a script installs.** The scaffold owns its own file list; a test that
copied it would be one more document caching a fact it does not own — the exact defect this
repo keeps hitting. `init-workspace.test.js` reads the expected paths back out of the
script's own report instead.

**Guard the observer.** A check that quietly sees nothing passes for free. Every suite here
first asserts that it found something to look at — pointers were extracted, files were
installed — before asserting anything about it.

## What counts as a pointer

`pointers.test.js` scans `AGENTS.md`, `README.md`, and every `.md` under `skills/`,
`commands/` and `docs/`. Inside those, two forms count:

- a Markdown link with a relative target, resolved from the document's own folder;
- a path rooted at a directory this repo owns — `scripts/`, `templates/`, `commands/`,
  `docs/`, `skills/`, `tests/` — anywhere in the text, prose or code block. That last part
  is what puts the file list in `SKILL.md`'s "Installing it" block under the check.

Each form resolves against **exactly one** root. Never offer a pointer a list of roots to
try: a pointer that happens to exist somewhere the agent would never look would pass while
still sending its reader nowhere.

A bare filename is not a pointer. When a document names `MISSION.md` or `TECH-STACK.md` it
means a path inside the *learner's* Workspace, which does not exist when this suite runs. An
`assets/…` path is the same shape and is skipped here too — `assets.test.js` resolves those
against a scaffolded Workspace instead, which is the only place they can mean anything.

## What is deliberately not tested

Known gaps, so that nobody reads a green suite as a stronger claim than it is:

- **`templates/` is not scanned as a document.** It is material copied into a Workspace, so
  its relative paths resolve *there*. `assets.test.js` covers the part that matters — every
  `assets/…` path a template names must exist in a scaffolded Workspace.
- **The Component catalog's later tiers are not checked**, on purpose. A row written as a
  bare filename (`scrolly.js`) is a pattern to build on demand, not a promise. A row written
  as a path (`assets/exercise.js`) *is* a promise, and `assets.test.js` holds it. Writing a
  catalog row with an `assets/` prefix is therefore how you opt a Component into the check.
- **No browser runs any of this.** The fixture DOM dispatches events and mutates the tree; it
  computes no styles and lays nothing out. `components.test.js` checks that every class a
  Component puts on the page has a rule *somewhere on screen* — print-only rules do not count,
  and `is-live` is exempt because it is the mount marker rather than a visual state — but never
  that it looks right. Judging a lesson's appearance still means opening it.
- **`file://` is inferred, not observed.** `assets.test.js` reads the Components for `fetch`,
  `XMLHttpRequest`, module syntax and URLs; nothing here actually opens a page from disk.
- **`docs/adr/` is exempt.** `docs/agents/domain.md` names it as the convention this repo
  rejects in favour of one narrative `docs/DECISIONS.md`. It is supposed to be absent.
- **The tutor server is not exercised.** `run()` runs a command to completion; a
  long-running server needs a method this helper does not have yet.
