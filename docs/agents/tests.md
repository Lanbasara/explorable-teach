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
| `tests/init-workspace.test.js` | The scaffold never overwrites, so it is safe as a repair tool |
| `tests/wire-lessons.test.js` | The bootstrap tag lands exactly once, and re-running is free |
| `tests/workspace-helper.test.js` | The fixture Workspace below actually observes what it claims to |

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

A bare filename is not a pointer. When a document names `MISSION.md` or `assets/quiz.js` it
means a path inside the *learner's* Workspace, which does not exist when this suite runs.

## What is deliberately not tested

Known gaps, so that nobody reads a green suite as a stronger claim than it is:

- **`templates/` is not scanned as a document.** It is material copied into a Workspace, so
  its relative paths resolve *there*.
- **The Component catalog in `SKILL.md` is not checked.** It names roughly twenty component
  files as bare filenames, which are Workspace paths by the rule above — and none are
  shipped. Closing that is a rewrite of the catalog, not a tightening of this check.
- **Nothing verifies that a shipped template only references assets the scaffold installs.**
  `templates/index.html` links `assets/style.css`, which `scripts/init-workspace.sh` never
  places. That is a live defect and a different check from this one.
- **`docs/adr/` is exempt.** `docs/agents/domain.md` names it as the convention this repo
  rejects in favour of one narrative `docs/DECISIONS.md`. It is supposed to be absent.
- **The tutor server is not exercised.** `run()` runs a command to completion; a
  long-running server needs a method this helper does not have yet.
