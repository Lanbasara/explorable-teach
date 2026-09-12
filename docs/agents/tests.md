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
| `tests/pointers.test.js` | Every pointer in an agent-facing document resolves — to a file that exists, and to a heading that is there |
| `tests/decoupling.test.js` | The skill carries its own pedagogy — nothing under it points at the upstream project |
| `tests/skill-spine.test.js` | The skill opens on the Boot sequence, hangs everything off the Unit, and names one entry point |
| `tests/disclosure.test.js` | Material only some Sessions reach sits behind a pointer, not inline |
| `tests/assets.test.js` | Every `assets/…` path a document or template names is installed by the scaffold |
| `tests/components.test.js` | Each shipped Component mounts, responds, and leaves the Lesson readable without it |
| `tests/init-workspace.test.js` | The scaffold never overwrites, so it is safe as a repair tool |
| `tests/wire-lessons.test.js` | The bootstrap tag lands exactly once, and re-running is free |
| `tests/workspace-helper.test.js` | The fixture Workspace below actually observes what it claims to |
| `tests/dom-helper.test.js` | The fixture DOM below parses and dispatches what it claims to |
| `tests/markdown-helper.test.js` | The Markdown reader below sees the document structure a reader sees |

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

## The Markdown reader

`tests/helpers/markdown.js` answers three questions about a document's shape: what are its
sections, what anchors does it offer, and where is each subject named. Two suites assert on the
shape of `SKILL.md`, because here shape *is* behaviour — what an agent reads first is what it
attends to, and material sitting inline is material it reads whether or not this Session needed
it.

```js
sections(SKILL)[0].title;                 // 'Boot sequence' — the opening material
step(boot.body, 1);                       // one numbered step, to the next number
anchorsIn(SKILL);                         // every heading, as the anchor it is reachable at
linesMentioning(SKILL, 'tutor');          // every mention, with the line it starts on
```

Everything here walks the document through one `eachLine`, so there is **one** rule for what
fenced code is. Three copies of that rule had drifted into three different spellings before
review caught it, which is how a parser ends up disagreeing with itself about what a heading is.

Three subtleties, all load-bearing, all pinned by `markdown-helper.test.js`:

**A heading inside a fenced block is not a heading.** `SKILL.md` fences a Lesson template and a
Markdown skeleton, and a reader fooled by either reports sections nobody ever sees. A fence
indented inside a list item is still a fence.

**Prose here is hard-wrapped**, so where a line break falls is a typographic accident.
`linesMentioning` folds a wrapped paragraph or list item back into one logical line before
matching, and reports the line it started on. A check reading raw lines reads the accident: one
sentence becomes two claims, a hard-wrapped `idle timeout` stops being findable, and re-wrapping
a paragraph breaks a check that has nothing to do with wrapping.

**Slugging replaces each space, never a run of them.** Dropping the `—` in
`Tier 1: Core — ships…` leaves *two* spaces, and GitHub hyphenates both, so the real anchor is
`tier-1-core--ships…`. Collapsing them — which this did until review caught it — inverts the
check: the correct link fails and the broken one passes.

## The disclosure check

`disclosure.test.js` holds the second half of the same argument the spine check makes about
ordering, applied to volume. First-run setup fired on roughly one Session in twenty and occupied
about fifty inline lines under a top-level heading; the Tutor's ports, start commands and
troubleshooting order sat between two teaching sections. Reference that should have been
disclosed does not merely take up room — it buries the steps beside it, and turns attending to
them into a coin flip. So these are variance checks, not tidiness checks: every one of them is
about where material *sits*.

**Each disclosed document exists, carries its material, and is pointed at.** `FIRST-RUN.md` and
`TUTOR.md` each have to hold what they were disclosed for, and `SKILL.md` has to link both.
Disclosed is not removed: material behind a pointer nobody follows is material that is gone.

**First-run setup is not a section of the main document**, and the Boot sequence branches to it
by pointer rather than by in-document anchor — the branch is the only route there, so it is the
one place the pointer has to be.

**The Tutor runbook is not in the main document.** The check reads for the vocabulary only a
runbook uses — `tutorctl`, `/api/health`, ports, pids, the idle timeout, `server.js` — and
fails on any of it in `SKILL.md`, whatever heading it came back under. The observer is guarded
against `TUTOR.md`: a vocabulary the runbook itself does not use would find nothing anywhere and
pass by describing no runbook.

**Exactly two Tutor facts stay inline**, because exactly two change what the Teacher does: the
learner's logged questions are read at Boot, which is a teaching judgement, and a Lesson must
stay readable with the service stopped, which constrains every page authored. Every mention of
the Tutor in `SKILL.md` must be one of those two or a pointer at `TUTOR.md`; anything else fails
by name and line number. That is what stops the runbook drifting back a paragraph at a time,
which is how it arrived the first time.

That classification has a hole, and review found it before this shipped: a line is forgiven for
carrying a pointer, so a claim sharing a line with one classified cleanly. The instance was a
Unit bullet asserting that a question is answered without leaving the page, passing because
`](./TUTOR.md)` sat beside it.

Two things close it, and it is worth knowing which does what — a **line budget** alone does
*not*, because folding a claim into a line that already exists leaves the count unchanged. That
was measured, not assumed.

- **A signpost stays short.** A line naming the Tutor in its own prose — rather than only inside
  a link to `TUTOR.md` — must fit in 90 characters, which is room to point and no room to claim.
  A line that merely links out while discussing something else, like grading or recorded
  prohibitions, is exempt: its length is about its own subject.
- **At most six lines may name the Tutor at all**, so it cannot return by accumulating
  signposts. Raising that number is a decision to argue, not a way to make a red suite green.

**The rationale the skill no longer carries is in the decisions record.** Why the Tutor is a
Workspace template rather than a plugin-level agent is a maintainer's reasoning, so it left the
skill — and reasoning that leaves without being recorded is reasoning a future maintainer
re-derives, or reverses without knowing it. The check reads the record for the four things that
argued for it, and fails if the skill still carries them too.

## The spine check

`skill-spine.test.js` holds the shape of `SKILL.md` itself, because shape is behaviour here:
what an agent reads first is what it attends to. Five claims, each of which was false before
the rebuild.

**The Boot sequence is the opening section**, and its first step scaffolds a bare Workspace by
*invoking* `scripts/init-workspace.sh`. A Session that has to wade through reference material to
find out what to do first will sometimes not do it.

**No document restates what the scaffold installs.** The copy list is read out of the script
itself; a document naming two or more of those template paths is holding a second copy of a
list it does not own. Naming one — the way the Tutor's design rationale names
`templates/agents/tutor.md` — is a reference, not a list.

**Every script the skill tells a Session to run is named from the plugin root.** The Teacher's
working directory is the learner's Workspace; these scripts live in the plugin, which is never
copied into it. A bare `scripts/…` reads fine and runs nowhere, which is the worst kind of
broken pointer — the resolver in `pointers.test.js` resolves it against the repo and is happy.

**There is one entry point.** No document sends a human to a `/explorable-teach:…` command, and
the plugin ships no command document beside the skill.

**The Unit and the assessment ladder are stated where the Teacher reads them.** The Unit section
must name the artifacts it binds; the ladder must place each of Exercise, Checkpoint and
Assignment on all three axes — when it fires, who judges it, what it measures — with no blanks,
because an instrument missing an axis is one the Teacher will choose by feel. The terms come
from `CONTEXT.md`, so the glossary and the skill cannot drift apart.

## The decoupling check

`SKILL.md` was once written as a diff against another author's skill: a heading naming seven
pedagogical topics, and a body saying "same rules as" and pointing at a document the running
agent cannot open. On the author's machine that plugin happened to be installed, so the defect
never reproduced there. `decoupling.test.js` reads every file under `skills/` and fails on any
line that names that project — by name, by author, by a "same rules as" deferral, or by a path
into the plugin cache.

`teach` is a verb this repo uses in almost every paragraph, so the patterns never match the bare
word; they match it *as a skill*. The observer is guarded from both sides: every reference the
repo actually carried before the pedagogy was absorbed must still be recognised, and a handful of
sentences naming `explorable-teach` itself must still be ignored.

The README is checked for the opposite thing. What the rebuild removed is the runtime dependency,
not the debt — so the acknowledgement has to stay somewhere a human reads, and the check fails if
it goes missing.

## Two rules for adding tests

**Never restate what a script installs.** The scaffold owns its own file list; a test that
copied it would be one more document caching a fact it does not own — the exact defect this
repo keeps hitting. `init-workspace.test.js` reads the expected paths back out of the
script's own report instead.

**Guard the observer.** A check that quietly sees nothing passes for free. Every suite here
first asserts that it found something to look at — pointers were extracted, files were
installed — before asserting anything about it.

## What counts as a pointer

`pointers.test.js` scans `AGENTS.md`, `README.md`, and every `.md` under `skills/` and
`docs/` — plus a `commands` directory, on the day the plugin ships one again. Inside those,
two forms count:

- a Markdown link with a relative target, resolved from the document's own folder;
- a path rooted at a directory this repo owns — `scripts/`, `templates/`, `docs/`, `skills/`,
  `tests/`, `commands` — anywhere in the text, prose or code block. That last part is what
  puts a script a document tells an agent to run, or a template it names, under the check.

A `#fragment` is part of the pointer, and a bare `#anchor` is the same promise made about the
document it sits in. Both resolve against the headings of the file they land on, slugged the way
GitHub slugs them. This is the half that a restructuring breaks: disclosing a section removes its
heading, and every link at it still resolves as a *file* — so the reader arrives at the top of a
long document and is left to search it, with nothing failing.

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
- **The decoupling check stops at the skill directory.** That is the boundary that matters —
  an agent *running* the skill can open nothing else. `AGENTS.md` and `docs/` are read by
  agents working on this repo instead, and `README.md` is checked for the opposite thing. If a
  document an agent runs from ever lands outside `skills/`, widen the scan rather than
  trusting that.
- **The restatement check reads one spelling.** It matches the `templates/…` paths the
  scaffold copies *from*. The same list spelled as destinations — `tutor/server.js`,
  `.claude/agents/tutor.md` — would pass. That spelling cannot simply be added: a document
  naming `assets/exercise.js` is making a promise rather than keeping a copy, and
  `assets.test.js` already holds that promise. Nothing holds the `tutor/` subset.
- **`docs/DECISIONS.md` is exempt from the one-entry-point check.** It records the removal of
  the setup command, and a record that may not name what it removed is not a record. Every
  other document naming a `/explorable-teach:…` is instructing someone.
- **`docs/adr/` is exempt.** `docs/agents/domain.md` names it as the convention this repo
  rejects in favour of one narrative `docs/DECISIONS.md`. It is supposed to be absent.
- **The tutor server is not exercised.** `run()` runs a command to completion; a
  long-running server needs a method this helper does not have yet.
- **The "exactly two Tutor facts" check cannot read a sentence.** Length is a proxy for whether
  a line claims or points, and a short claim would pass — "the Tutor is stateless" is 24
  characters. What the checks really hold is that the *runbook* cannot come back and that the
  Tutor cannot spread. Judging whether a short line is a fact or a signpost is still a reader's
  job.
- **Nothing measures how long the main document is.** The checks hold what is *in* it, which is
  the thing that changes behaviour. A document that stayed long by growing material every
  Session genuinely reads would pass, and should.
- **No Markdown renderer validates the anchors.** `anchorFor` reimplements GitHub's slug rules,
  and is pinned against real headings from this repo — but it is a reimplementation, not the
  renderer. Duplicate headings, which GitHub disambiguates with a numeric suffix, are not
  modelled: two identical headings in one document would make the second unreachable without
  failing anything.
