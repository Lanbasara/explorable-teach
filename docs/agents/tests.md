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
| `tests/skill-spine.test.js` | The skill opens on the Boot sequence, carries its spine and nothing else, and ends a Session on a checkable outcome |
| `tests/disclosure.test.js` | Material only some Sessions reach sits behind a pointer, not inline |
| `tests/assets.test.js` | Every `assets/…` path a document or template names is installed by the scaffold, on the side of the split it belongs to |
| `tests/components.test.js` | Each shipped Component mounts, responds, and leaves the page readable without it |
| `tests/nav.test.js` | Every artifact of a Unit is reachable from every other, and one that was never written says so where it would have been |
| `tests/init-workspace.test.js` | The scaffold never overwrites what a Workspace owns, re-points what the plugin owns, and is safe to re-run either way |
| `tests/wire-lessons.test.js` | The bootstrap tag lands exactly once, and re-running is free |
| `tests/tutor-server.test.js` | The Tutor service serves, refuses and streams what it says it does — asked over HTTP |
| `tests/rich-text.test.js` | A Tutor answer renders as the rich text it was written as, and the markup in it stays text |
| `tests/tutor-drawer.test.js` | The in-page drawer renders a streamed answer and a pinned one through that renderer, reports the wait, and recovers from a service that is stopped or failing |
| `tests/tutor-helper.test.js` | The service fixture below replays a stream in pieces, the way a real one arrives |
| `tests/workspace-helper.test.js` | The fixture Workspace below actually observes what it claims to |
| `tests/dom-helper.test.js` | The fixture DOM below parses and dispatches what it claims to |
| `tests/markdown-helper.test.js` | The Markdown reader below sees the document structure a reader sees |

## The split a scaffolded Workspace is built on

One question decides where a file lives: **does it vary by subject?** No means it lives in
`skills/explorable-teach/runtime/` and a Workspace holds a symlink at it, so one fix reaches every
Workspace. Yes means it lives in `skills/explorable-teach/templates/`, is copied in once, and is
the learner's from then on.

Three suites hold that. `init-workspace.test.js` reads the scaffold's own report and checks that
what it says it *created* is a file, what it says it *linked* is a live symlink, and that a real
file sitting where a link belongs is *kept* rather than deleted — the scaffold re-points links on
every run, so without that it would be the one thing in this repo that destroys work.
`assets.test.js` checks the direction the report cannot: that every asset in a Workspace has a
plugin source, that the invariant ones resolve to the plugin's copy, that editing the course
manifest does not write through to the plugin, and that a stale link is re-pointed by the next
scaffold run. `tutor-server.test.js` checks the role definition end of it — the plugin's
definition plus the Workspace's tuning, composed in that order, and the same two files named in
the same order by the subagent.

The hazard that comes with symlinks is real and cost the plugin's role prompt once: writing to a
Workspace path follows the link. `Workspace.write()` unlinks first for exactly that reason, and
`workspace-helper.test.js` holds it to that.

Reading has the same shape, and `tutor-server.test.js` covers it from the other side. The
server's containment check bounds the *path*; a Workspace full of links means it has to bound the
*bytes* too, so a link the scaffold did not write — pointing anywhere but the plugin's `assets/`
— is refused while the scaffold's own links are served.

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
fail one test rather than wedge the suite. A server does not exit, so it gets its own fixture
below.

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

The quiet way to reach past it is a property nothing models, because assigning one silently
succeeds: `el.disabled = true` would set an expando, and a test asserting a button is *not*
disabled would then read `undefined` and pass on a button that is. `hidden` and `disabled` are
both backed by the attribute for that reason, and `dom-helper.test.js` holds them to it. A
property a test reads back as a boolean has to be modelled before it is read.

`href` and `title` joined them when the nav bar came under test: the bar builds every link by
assigning both, so a DOM modelling neither would have reported a bar with no links in it while
the bar was working. `page.script(file, attrs)` is the other half of driving it — the bar reads
`data-unit` off its own tag, so a test that could not write one would be driving a bar that
never mounted.

The window a script runs against is bare for the same reason, and `Page.load(html, dir, {
globals })` is the one way to widen it for one test. The Tutor's in-page drawer needs storage, a
service to probe and a stream to read; no Component needs any of them, so naming them at the call site is
what keeps a Component that starts reaching for one throwing rather than quietly passing.

`tests/helpers/unit.js` holds the fixture Unit — the pages one Unit is made of, written the way
the skill's authoring document says to write them, using every shipped Component. Two pages,
because a Unit is more than one file: the Lesson, and the Checkpoint that gates it. `PAGES` is
what the generic checks iterate, and each page names the Components it is built from — so
**adding a Component means adding one entry and its markup to the page it belongs on**, and
`assets.test.js`, `components.test.js` and `nav.test.js` then cover it without being told
separately.

A Component nested inside another — the Exercises a Checkpoint counts — is walked as itself
rather than as part of its host, so a class is still checked against the stylesheet of the
Component that put it there.

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

**A heading inside a fenced block is not a heading.** The skill's documents fence a Lesson
template and a Markdown skeleton, and a reader fooled by either reports sections nobody sees. A fence
indented inside a list item is still a fence.

**Prose here is hard-wrapped**, so where a line break falls is a typographic accident.
`linesMentioning` folds a wrapped paragraph or list item back into one logical line before
matching, and reports the line it started on. A check reading raw lines reads the accident: one
sentence becomes two claims, a hard-wrapped `idle timeout` stops being findable, and re-wrapping
a paragraph breaks a check that has nothing to do with wrapping.

**Slugging replaces each space, never a run of them.** Dropping the `—` in
`Shipped Components — already…` leaves *two* spaces, and GitHub hyphenates both, so the real
anchor is `shipped-components--already…`. Collapsing them — which this did until review caught
it — inverts the check: the correct link fails and the broken one passes.

## The running Tutor service

`tests/helpers/tutor.js` starts the service installed in a scaffolded Workspace and hands back
something to ask questions of. `Workspace.run()` waits for a command to exit; this is the method
it says it does not have.

```js
const service = await TutorService.start(t, ws, { agent: [agentSays.result('好。')] });
const health = await service.get('/api/health');
const answer = await service.ask({ question: '这是什么？', selection: 'fork() 返回两次' });
assert.deepEqual(answer.sequence(), ['open', 'done']);
service.agentFlag('-p');                 // the payload the agent was actually handed
```

`server.js` carries the security-sensitive code in this plugin, and `TUTOR.md` says a Workspace
links at it rather than any Session writing it *because* re-deriving it from prose risks silently
dropping a guard. Nothing noticed if one had been. So the service is held at arm's length: it runs
as its own process on a port of its own, and a test touches only a socket, the Workspace on disk,
and the stub agent. No function in it is called directly.

The fixture starts it the way a Workspace does — `node <ws>/tutor/server.js`, which resolves
through the link into the plugin — so the split is exercised rather than bypassed. The server
defaults to its working directory when nothing names a Workspace, which is what keeps that
invocation meaningful.

**The agent is a stub binary first on `PATH`.** `PATH` is set to *only* the directory holding it,
so the real `claude` cannot be reached even on a machine that has one. The stub records its argv
and working directory — which is the only window onto the payload the service built, and therefore
the only way to see history trimming from outside — and then replays a fixed transcript. `agentSays`
spells the stream shapes the service documents: a text delta, a thinking delta, a tool use, a
result, a failure.

**The stub writes in three awkward slices, cut mid-line and never mid-character.** The service
reassembles NDJSON across chunk boundaries; a stub that wrote one tidy chunk would leave that
untested while every assertion went on passing. That is the one part of this fixture the suite
above does not cross-guard, so `tutor-helper.test.js` pins it — from the stub's own record of
where it cut, not from the chunks that came back. Where the stub cut is the stub's to promise;
whether a reader sees those cuts as separate chunks is the pipe's, and a reader that stalls long
enough gets the lot in one.

**Each test gets its own service**, because the stub's transcript is fixed when the process
starts. A port is picked by asking the OS for a free one — which makes it free a moment ago rather
than reserved — so the fixture checks that the pid answering `/api/health` is the child it
started, and retries on a different port rather than quietly driving somebody else's Workspace.

## The answer renderer

`assets/rich-text.js` is the one piece of security-relevant client code this plugin puts on a
page, and it is written to be checkable: it takes a node factory and never names `document`. So
`rich-text.test.js` loads it into a `vm` context holding nothing at all and renders through a
factory of plain objects. A reach for a browser global throws there rather than in a learner's
page, and the interface claim is asserted from both sides — the file is read for the names of
browser globals, and a spy factory shows that every node came from it.

Two claims, and the second is why the first is not done with a Markdown library and an
`innerHTML` assignment. **Shape**: a heading is a heading, a fence is literal, a list is a list,
an unterminated fence still renders — which every streamed answer is, for most of its life.
**Inertness**: a table of sources a Tutor could be talked into writing is rendered, and the
whole tree is walked for a tag outside the allowlist, an attribute outside it, an `on*` handler,
or a destination a browser would run. Answers are generated text that has read the learner's
Workspace, so "the source is trusted" is not a position available here.

`tutor-drawer.test.js` holds the other half: that the drawer actually renders *through* it. It
mounts `assets/tutor.js` in the fixture DOM against a scaffolded Workspace's `assets/`, with a
stub that answers the health probe and streams the event shapes `server.js` emits, cut into
chunks that fall mid-event. Then it asks a question the way a learner does — open the drawer,
type, send — and reads the nodes back out of the thread, out of the pinned note in the Lesson,
and out of a second mount sharing the first one's storage, which is what a reload is.

That the drawer has to be *opened* before a question is asked is not ceremony: it is where the
thread gets its id, and a test that skipped it found the thread was never persisted.

The same file holds what the drawer does *around* an answer, because all of it is what a learner
meets on a service that is slow, stopped, or having a bad day. Those need the stub to be driven
rather than merely replayed, so the fixture grew four seams, each named at the call site the way
`globals` is: `chunks`/`ends` replay a fixed transcript, which is what most of these tests want;
`feed` hands the test the stream itself, one event at a time, so a stage of the wait can be
observed while it is still that stage; `reply` takes over the response entirely, for a request
that has to fail or to differ from the one before it; and `health` is asked per probe rather than
fixed, so the service can be started — or stopped — while the page is already open. A clock and
an interval the test advances by hand come with all of them, so an elapsed indication can be read
off one and "nothing is left ticking" is a claim rather than a hope.

Two of these tests are about a request *not* finishing, and both assert on the stub rather than
on the page: a stop is only a stop if the stream was let go, because letting it go is what closes
the connection the service is watching. One of them lands the stop before the response has
arrived at all — the window a learner is most likely to press it in, and the one where there is
no reader yet to cancel.

## The navigation check

`nav.test.js` holds the claim a Unit's own definition makes: a Unit is more than one file, and
one nobody can find was not worth writing. The bar is mounted the way `lesson-boot.js` mounts it
— the course manifest, then the bar carrying the page's Unit id — against a manifest with one
Unit that has a Checkpoint and one that does not.

**A slot that resolves, and a slot that degrades.** From the Lesson, the Checkpoint is a link;
from the Checkpoint, the Lesson is a link and the Checkpoint is the page you are on. For the Unit
with no Checkpoint the slot is still rendered, labelled, and marked unreachable — the failure it
rules out is a gap the learner has to interpret. That the slot is *visible* is half tree and half
stylesheet, and the stylesheet half is the one that would break silently, so the rule is read for
a hiding declaration rather than assumed.

**No page writes a link list.** The bar derives every link from the manifest, so a Checkpoint
page hand-writes exactly one link — the way back into the Lesson, in the prose of its own verdict
— and the check fails if the fixture starts writing more. A renamed file is then chased in one
place rather than through every page of the Unit.

## The disclosure check

`disclosure.test.js` holds the second half of the same argument the spine check makes about
ordering, applied to volume. First-run setup fired on roughly one Session in twenty and occupied
about fifty inline lines under a top-level heading; the Tutor's ports, start commands and
troubleshooting order sat between two teaching sections. Reference that should have been
disclosed does not merely take up room — it buries the steps beside it, and turns attending to
them into a coin flip. So these are variance checks, not tidiness checks: every one of them is
about where material *sits*.

**Each disclosed document exists, carries its material, and is pointed at.** `FIRST-RUN.md`,
`TUTOR.md` and `UNIT.md` each have to hold what they were disclosed for, and `SKILL.md` has to
link all three.
Disclosed is not removed: material behind a pointer nobody follows is material that is gone.

**First-run setup is not a section of the main document**, and the Boot sequence branches to it
by pointer rather than by in-document anchor — the branch is the only route there, so it is the
one place the pointer has to be.

**Unit authoring is not in the main document.** `UNIT.md` holds the forms, the page conventions,
the Component selection guide and the navigation rules, and the check reads `SKILL.md` for the
vocabulary only an authoring reference uses — markup, asset filenames, CDN hosts, `is-live`, a
Component's `Deps:` declaration, a Lesson's numbering. Same shape as the runbook check below it,
and guarded the same way: every pattern must be found in `UNIT.md`, or the check is describing no
authoring material.

That vocabulary tracks the document, not the reverse: it read `Tier N` until the catalog stopped
being tiered, and the guard failed on the spot rather than going on passing while looking for
words nobody writes.

**The skill root is the main document and the documents it points at.** Every `.md` beside
`SKILL.md` must be one of the disclosed documents, which are already required to exist, carry
their material and be pointed at. That is what makes the document set legible at a glance, and it
is a claim about the directory rather than about any one file. The four format specifications sit
under `formats/`; that each of them is also *reached* is the pointer suite's business, in the
reverse direction.

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
- **At most four lines may name the Tutor in their own prose**, so it cannot return by
  accumulating signposts. A line that merely links out while discussing something else does not
  spend that budget — it is not Tutor material. Two facts and two signposts is the whole of it,
  so there is no headroom by design: raising the number is a decision to argue, not a way to
  make a red suite green.

**The rationale the skill no longer carries is in the decisions record.** Why the Tutor is a
Workspace template rather than a plugin-level agent is a maintainer's reasoning, so it left the
skill — and reasoning that leaves without being recorded is reasoning a future maintainer
re-derives, or reverses without knowing it. The check reads the record for the four things that
argued for it, and fails if the skill still carries them too.

## The spine check

`skill-spine.test.js` holds the shape of `SKILL.md` itself, because shape is behaviour here:
what an agent reads first is what it attends to. Seven claims, each of which was false before
the rebuild.

**The Boot sequence is the opening section**, and its first step scaffolds a bare Workspace by
*invoking* `scripts/init-workspace.sh`. A Session that has to wade through reference material to
find out what to do first will sometimes not do it.

**No document restates what the scaffold installs.** The install list is read out of the script
itself — both halves of it, the `templates/…` it copies and the `runtime/…` it links — and a
document naming two or more of those source paths is holding a second copy of a list it does not
own. Naming one — the way the Tutor's design rationale names `templates/agents/tutor.md` — is a
reference, not a list.

**Every script the skill tells a Session to run is named from the plugin root.** The Teacher's
working directory is the learner's Workspace; these scripts live in the plugin, which is never
copied into it. A bare `scripts/…` reads fine and runs nowhere, which is the worst kind of
broken pointer — the resolver in `pointers.test.js` resolves it against the repo and is happy.

**The main document is its spine and nothing else.** Every `##` section has to fill one of the
roles the document exists for — the Boot sequence, the Unit, the teaching steps, the judgement
criteria, the assessment ladder, the Session-end criterion — and every one of those roles has to
be a section. A section that is neither is material every Session reads on the way to what it
came for, which is how the Component catalog got there the first time. The roles match a title
from its start rather than anywhere in it, so that "Authoring a Unit" is not mistaken for the
Unit; both near misses guard the observer.

**A Session ends on a verifiable outcome.** "Stop deliberately" is a bound the agent it binds
cannot evaluate, so the check fails on that phrase anywhere in the document. What replaces it has
to state the resumption criterion — the next Session resumes without asking — and back it with a
floor that is a *list* of at least four actions naming what the next Boot sequence reads: the
Learning Record, the Curriculum's progress marker, `NOTES.md`, and the Dossier. Criterion without
floor is a judgement an optimistic Teacher passes itself; floor without criterion is a checklist
that cannot notice what it failed to anticipate.

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

Both forms are read from *logical* lines, folded the way the Markdown reader folds them. Prose
here is hard-wrapped, so a link's text and its target routinely land on different lines — and
neither line is a link on its own. One pointer hid from this check that way, at a heading that
had been renamed, so a synthetic wrapped link now guards the extractor.

The check also runs in reverse: **every document under the skill must be reached from another
one.** `SKILL.md` is the entry point and is exempt. A document nothing points at resolves nothing
wrongly — it simply sits there, and the Session that needed it never finds out it exists, which
is the failure disclosure introduces.

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

- **`templates/` and `runtime/` are not scanned as documents.** One is material copied into a
  Workspace and the other is material a Workspace links at, so the relative paths either one
  writes resolve *there*. `assets.test.js` covers the part that matters — every `assets/…` path
  either one names must exist in a scaffolded Workspace.
- **The Components the Teacher builds are not checked**, because there is nothing there to
  check. Every file the selection guide names is one the plugin ships — the four Components, the
  shared stylesheet, the bootstrap — and every other row names a teaching act and what to reach
  for, which resolves to no file at all. The underlying rule is unchanged and still enforced: an
  `assets/…` path in any shipped document is a promise that the scaffold installs it, so writing
  a row with that prefix is how a Component opts into `assets.test.js`. Nothing stops a future
  row naming `scrolly.js` as a bare filename — that would be invisible here, and it is also what
  the guide was rewritten to stop doing.
- **No browser runs any of this.** The fixture DOM dispatches events and mutates the tree; it
  computes no styles and lays nothing out. `components.test.js` checks that every class a
  Component puts on the page has a rule *somewhere on screen* — print-only rules do not count,
  and `is-live` is exempt because it is the mount marker rather than a visual state — but never
  that it looks right. Judging a lesson's appearance still means opening it.
- **The Dossier is not driven.** `index.html` renders the same three slots from the same
  manifest, and degrades the same way, but its script is inline rather than a file — the fixture
  DOM runs `<script src>` only, so nothing here mounts it. What `assets.test.js` covers is the
  paths it names; the cover itself is still judged by opening it.
- **`file://` is inferred, not observed.** `assets.test.js` reads the Components for `fetch`,
  `XMLHttpRequest`, module syntax and URLs; nothing here actually opens a page from disk.
- **The decoupling check stops at the skill directory.** That is the boundary that matters —
  an agent *running* the skill can open nothing else. `AGENTS.md` and `docs/` are read by
  agents working on this repo instead, and `README.md` is checked for the opposite thing. If a
  document an agent runs from ever lands outside `skills/`, widen the scan rather than
  trusting that.
- **The restatement check reads the source spelling only.** It matches the `templates/…` and
  `runtime/…` paths the scaffold installs *from*. The same list spelled as destinations —
  `tutor/server.js`, `.claude/agents/tutor.md` — would pass. That spelling cannot simply be
  added: a document naming `assets/exercise.js` is making a promise rather than keeping a copy,
  and `assets.test.js` already holds that promise. Nothing holds the `tutor/` subset.
- **Nothing checks that a linked file is never edited through its link.** A Workspace's
  `assets/style.css` is a symlink into the plugin, so writing to it rewrites the plugin's copy
  and every other Workspace with it. `UNIT.md` and `TUTOR.md` both state the rule; the only
  mechanical guard is in the test helper, where `Workspace.write()` unlinks before writing —
  added after a test quietly rewrote the plugin's role prompt. A Teacher that ignores the rule
  is not caught here. What *is* covered is the server's side of the same hazard: it refuses to
  serve a file whose real path is neither in the Workspace nor in the plugin's `assets/`.
- **Symlinks are a POSIX assumption.** The scaffold uses `ln -s`, and the suite asserts
  `lstat().isSymbolicLink()`. Neither would hold on a filesystem without symlinks; the server's
  fallback to the plugin's `assets/` would still serve such a Workspace over http, but nothing
  tests that path as the only one.
- **Nothing runs a Workspace against a plugin that has moved.** "A stale link is re-pointed" is
  tested by pointing one at a decoy inside the fixture Workspace, which is the same code path;
  an actual plugin upgrade, with the old root still on disk, is not staged. The half that
  matters is that the Boot sequence runs the scaffold every Session — and that is checked as a
  property of `SKILL.md`, not by running one.
- **`docs/DECISIONS.md` is exempt from the one-entry-point check.** It records the removal of
  the setup command, and a record that may not name what it removed is not a record. Every
  other document naming a `/explorable-teach:…` is instructing someone.
- **`docs/adr/` is exempt.** `docs/agents/domain.md` names it as the convention this repo
  rejects in favour of one narrative `docs/DECISIONS.md`. It is supposed to be absent.
- **Whether the pieces arrive as pieces is the pipe's decision.** The stub cuts its transcript
  mid-line and that much is asserted, but a reader busy enough to let three writes coalesce
  receives one chunk — measured: a reader stalled 80ms got the lot in one, every time. When that
  happens the service's line reassembly is not exercised and nothing says so.
- **The real agent never runs.** The stub emits the shapes `server.js` documents and nothing
  else. What the service does with a shape the real `claude` emits and this fixture does not is
  unknown, and a stream format change would be invisible here.
- **Neither traversal guard is pinned on its own.** Removing normalisation leaves the suite
  green, because `path.resolve` re-expands the escape and the containment check catches it;
  removing the containment check leaves it green, because normalisation collapsed the escape
  first. Removing both fails. So the suite holds the *behaviour* — traversal is refused — rather
  than either line, and this is defence in depth by measurement rather than by assertion.
- **The traversal claim is about paths, not about what they point at.** Paths are resolved
  lexically, so a symlink inside the Workspace is followed wherever it goes — measured, not
  inferred. Putting one there takes write access to the Workspace, which is the learner, so this
  is a limit on what the check above proves rather than a way in.
- **Neither timeout is exercised.** The 120-second answer timeout and a client that disconnects
  mid-answer are both real paths; only the idle shutdown is driven, and that one only in the
  direction that matters — a status probe must not keep an abandoned service alive.
- **The in-page drawer is driven through the fixture DOM, so anything a browser decides is not
  covered.** `tutor-drawer.test.js` holds the paths that render an answer, the three stages of
  the wait, the stop, the retry and the health poll — but the clipboard lands in a stub, so the
  `document.execCommand` half of the fallback is exercised by nothing, and the thread history and
  the selection chip are still under no test. The Tutor *service* suite still ends at the socket.
- **The 4000-character cap on inlined `NOTES.md` and `MISSION.md` is not covered**, only the
  history caps beside it.
- **The "exactly two Tutor facts" check cannot read a sentence.** Length is a proxy for whether
  a line claims or points, and a short claim would pass — "the Tutor is stateless" is 24
  characters. What the checks really hold is that the *runbook* cannot come back and that the
  Tutor cannot spread. Judging whether a short line is a fact or a signpost is still a reader's
  job.
- **Nothing measures how long the main document is.** The checks hold what is *in* it, which is
  the thing that changes behaviour. A document that stayed long by growing material every
  Session genuinely reads would pass, and should. The tickets state line targets — "around 150"
  for the main document — and those are outcomes of the disclosure, deliberately not turned into
  a number a future change has to satisfy.
- **No Markdown renderer validates the anchors.** `anchorFor` reimplements GitHub's slug rules,
  and is pinned against real headings from this repo — but it is a reimplementation, not the
  renderer. Duplicate headings, which GitHub disambiguates with a numeric suffix, are not
  modelled: two identical headings in one document would make the second unreachable without
  failing anything.
