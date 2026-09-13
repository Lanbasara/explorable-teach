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
| `tests/components.test.js` | Each shipped Component mounts, responds, and leaves the page readable without it — including the hand-in on an Assignment page, which refuses what it cannot grade |
| `tests/nav.test.js` | Every artifact of a Unit is reachable from every other, and one that was never written says so where it would have been |
| `tests/init-workspace.test.js` | The scaffold never overwrites what a Workspace owns, re-points what the plugin owns, is safe to re-run either way, and leaves a Submission inside version control rather than outside it |
| `tests/wire-lessons.test.js` | The bootstrap tag lands exactly once, and re-running is free |
| `tests/tutor-server.test.js` | The service serves, refuses and streams what it says it does — asked over HTTP — grades in a role composed from the Grader's own two files, never the Tutor's, and writes the scaffolding it builds in English while the answer comes back in the Learner's language |
| `tests/rich-text.test.js` | A Tutor answer renders as the rich text it was written as, and the markup in it stays text |
| `tests/tutor-drawer.test.js` | The in-page drawer renders a streamed answer and a pinned one through that renderer, reports the wait, carries a Submission to the Grader and its verdict back, and recovers from a service that is stopped or failing |
| `tests/language.test.js` | A Workspace states its language once and every page picks it up, the lookup falls back the way it says it does, nothing a Learner reads — in the drawer, in the bar, in any Component — is hardcoded in any language, every way the Tutor service can fail has words on the page to be read as, the role definitions are English down to the token a Grader refuses with, and nothing the plugin ships — nor the Workspace one scaffold run produces — is written in one Learner's language |
| `tests/release.test.js` | The version the plugin declares is the one the changelog most recently shipped |
| `tests/tutor-helper.test.js` | The service fixture below replays a stream in pieces, the way a real one arrives, and the reader that finds the Grader's refusal token refuses to guess at it |
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
the bar was working. `placeholder` and `src` joined them with the language checks — a composer's
placeholder is Learner-facing text the pseudolocale check has to read back, and the bootstrap
finds `assets/` by reading its own `src` off `document.currentScript`, so a DOM leaving that an
expando could not mount the bootstrap at all. `page.script(file, attrs)` is the other half of driving it — the bar reads
`data-unit` off its own tag, so a test that could not write one would be driving a bar that
never mounted.

The window a script runs against is bare for the same reason, and `Page.load(html, dir, {
globals })` is the one way to widen it for one test. The Tutor's in-page drawer needs storage, a
service to probe and a stream to read; no Component needs any of them, so naming them at the call site is
what keeps a Component that starts reaching for one throwing rather than quietly passing.

`tests/helpers/drawer.js` mounts the Tutor's in-page drawer the way a Lesson mounts it, and owns
the seams that come with driving it — the stream, the health probe, the clock, the intervals, and
the Workspace's own table of Learner-facing text. Two suites ask different things of it:
`tutor-drawer.test.js` asks what the drawer does around an answer, and `language.test.js` asks
what language it does it in.

`tests/helpers/learner-text.js` runs the shipped lookup against a language and answers with what
a page in it would say, so an assertion can name a *key* rather than a word. It also builds the
sentinel tables the pseudolocale check mounts under.

`tests/helpers/unit.js` holds the fixture Unit — the pages one Unit is made of, written the way
the skill's authoring document says to write them, using every shipped Component. Each Component's
entry carries a `drive(page, root, step)` that puts it through its states, and the suites that
need one share it: `components.test.js` drives to see that every class a Component reaches is
styled, `language.test.js` drives to see that every label it reaches comes from the table. What a
drive types in is named beside the drives, and the part of it a Component reads back *onto the
screen* is exported as `ECHOED_INPUT` — so a check reading a rendered tree can take the Learner's
own words back out of a line rather than excusing the line.

That list is itself guarded, twice, because a list longer than the truth forgives text nothing
ever put there. Every entry has to have reached a screen — asserted after all three pages are
driven and *before* any line is forgiven on its account, so the guard does not depend on the
assertion it guards having passed. And no shipped string may contain an entry, or a Component
hardcoding that string would have part of itself cut away before it was read; that one is a
static property of the tables, so it sits with the other table checks rather than inside a check
that has to mount three pages to reach it. Every page is
built *for* a language rather than *in* one: `pagesIn(lang)` and `lessonHtml(lang)` take the tag,
and the bare `PAGES` and `LESSON_HTML` are those at the fixture's own. A fixture that hardcoded
one could only ever mount a single audience's page, and the check that matters most is the one
that needs a tag no Workspace has. Two pages,
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

**Grading is asked of the same fixture**, because it is the same endpoint: `service.ask({ role:
'grader', … })`. What the grading checks look at is the part that differs — the composed system
prompt, which must be the Grader's two files and must *not* contain either of the Tutor's; the
payload, which names the Assignment page and never carries the Rubric; and the Workspace on disk
afterwards, where a verdict has become a numbered Learning Record. That last one needs no
`waitFor`: the record is written before `done` is sent, which is the ordering that lets the page
name where it landed.

**One thing in that file is not a service at all.** `refusalToken()` reads the token a refusal has
to open with out of `tutor/GRADER.md`, which is the file that decides it — the service watches for
it, the drawer strips it, and three suites build a refusal out of this one reading rather than out
of three copies. It lives beside the service fixture because everything in `runtime/tutor/` is
driven from here, and it is held to refusing a `GRADER.md` that quotes more than one line: picking
between two would be a fixture deciding a contract it does not own.

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

## The language checks

`language.test.js` holds the split the whole project is built on: every string has exactly one
reader, and that reader decides its language. Maintainer-facing text — role definitions, prompt
scaffolding, comments, service logs — is English in every Workspace. Learner-facing text is
produced at run time from `<html lang>`, against a table. Decisions 30 and 31 argue it;
`CONTEXT.md` names the two halves.

The rule for writing one of these: **assert the split, never the strings.** A check that pinned a
particular word in a particular language would have to be rewritten the day a language was
added, which is the defect the arrangement exists to have removed. So every assertion elsewhere
in the suite that used to name a label now goes through `tests/helpers/learner-text.js`, which
runs the shipped lookup and answers with what a page in that language would say.

**The pseudolocale check is the one that earns its keep.** The drawer is mounted under a
synthetic `lang` whose table holds nothing but sentinels — each key transliterated into fullwidth
Latin, which no natural-language string carries — and the rendered tree is then asserted to hold
no character outside that alphabet.

Every page of the fixture Unit is mounted the same way, and so is the navigation bar: the
Component tags a Lesson author writes, then the one bootstrap tag, driven through every state
each Component has. Nothing there names a Component. The pages come from `helpers/unit.js` and
name the Components they are built from, and **each Component carries its own `drive`** on the
same entry — so a Component added to the fixture is mounted, driven and read here without this
check being edited. That is the one thing about a Component nothing can derive (which option is
the wrong one, which button reveals), so it is written once, beside the selector and the
filenames, rather than copied into every suite that needs it. That catches a string hardcoded in *any* language, including English, which no
scan of the bytes can see, and it never needs rewriting when a language is added. Three things
make it work, and all three were found the hard way:

- **The content the test feeds in is in the alphabet too.** What a Learner types and what a Tutor
  answers are theirs rather than the Component's, so they are fed as sentinels — otherwise they
  are the one part of the tree the check cannot read, and excluding them by hand is how a real
  string hides behind one.
- **The tree is read at every step, not once at the end.** A label that is replaced on the way —
  the pin button, which says something else once it is pinned — would otherwise be a string this
  check never looked at. It passed a hardcoded one that way before review caught it.
- **Digits are allowed and nothing else is.** A count of questions or a number of seconds is a
  value the page computes, and the same digit in every language.

Labels that are attributes rather than text are read too — `title`, `aria-label`, `placeholder` —
on the subtree's root as much as on anything inside it. A tooltip is as Learner-facing as a
button, and the bar's whole name for a screen reader is an `aria-label` on the `<nav>` itself, so
a reader that walked only the children walked straight past it. Each of those attributes has to
be modelled in the fixture DOM before it can be read back, for the reason `hidden` and `disabled`
are.

**A surface with two states needs mounting twice.** The bar's neighbour slots each say one of two
things — the Unit before this one, or that there is nothing before it — and one placement only
ever renders one of each, so the bar is mounted first in the Curriculum and then last in it. Its
observer is the table rather than a key written out: every entry under `nav.` has to have reached
a screen across the two, so an entry nothing renders is a finding too.

**What a Component is answerable for is what it put on the page**, and the check draws that line
by subtracting what the page said before anything ran. The rest is the author's: a Lesson's
prose, its questions, the two verdicts a Checkpoint's author writes out. *Which* passage to go
back and read is a sentence about one Unit and nothing else, so no table could hold it — it is in
the Learner's language because the whole page is. Subtraction draws that line without naming a
selector, and a Component that replaced an authored sentence with one of its own still shows up,
because the replacement is text that was not there before.

**The non-ASCII scan ships as well, and fails on a different thing**: one Learner's language
creeping back into what every other Learner is handed. It reads **every file the plugin owns**,
found by walking `skills/` and `scripts/` rather than listed — a document nobody remembered to add
to a list is exactly the one that drifts back. Its observer is guarded twice: on a count, because
a walk that quietly stopped descending would report nothing and pass; and against the scaffold's
own install list, read out of the script, because reaching *some* of it is not the claim.

**Two rules, and which one a file answers to is the split the Workspace is built on** — the same
question one section up, read off the directory because that split *is* the directory.

A file under `runtime/` is **linked**: the same bytes in every Workspace, so a label in one of
them is every Learner's. That gets the strict rule — the typographic punctuation this repo's
English prose is written with, and nothing else beyond ASCII, so a letter or a decorative glyph in
shared source is a finding. A glyph there is half a label whose other half belongs in a table. Any
document that is neither linked nor copied is read by a Maintainer alone and is strict too.

A file under `templates/` is **copied**, and is one Workspace's own from the moment it is placed.
It has no other Workspace to stay consistent with, so a glyph on its own cover — the `✅` a Dossier
marks a finished Unit with — is that Workspace's business rather than a missing table entry. The
only thing a seed may not arrive carrying is somebody *else's* language, and that is all the
narrower rule asks. `CONTEXT.md` defines **Seed** as the term for this.

`lesson-boot.js` is the single exception to being read at all, and it is the file the tables live
in: scanned whole, every line of `zh-CN` would be a finding, so its bootstrap half is read and its
table half is not. It is recognised by resolving the helper's own path rather than by a filename,
so moving the tables moves the exemption with them.

**The same claim is then made from the other end**, over a Workspace one scaffold run produced —
the copies and the links together, which is the only place the split stops being an arrangement
and becomes a directory a Teacher is handed. Which rule each file answers to is decided there by
the same fact one directory along: a link is the plugin's, a real file is the Workspace's own. The
two scans can disagree, which is why both ship.

A Component's own header comment shows the markup an author writes, which makes that comment
Maintainer-facing and therefore English like every other one.

One thing no scan of the bytes can see sits beside them: the page skeleton in the authoring
document, whose `lang` is ASCII whatever language it names. A real tag standing there is that
language copied forward into every Lesson written from it — which is how the pilot Workspace's
reached every page in the first place — so it is asserted to be a placeholder rather than a tag.

**Four consistency contracts here, all derived rather than listed.** Decision 30 describes them
as one set because they are one argument: a fact with one home, and every other place that needs
it reading it from there rather than keeping a copy.

The fourth is the only one whose authority is a document. `tutor/GRADER.md` tells a Grader to open
a refusal with a fixed ASCII token; `server.js` recognises that token to keep the refusal out of
`learning-records/`, and the drawer strips it so the Learner reads the explanation under it rather
than a marker addressed to a service. The check reads the token out of the role definition — the
one indented block in it — and holds both patterns to it, so editing the definition alone goes
red here rather than breaking the contract in silence. It is asserted to be ASCII too: what
follows it is the Learner's language and the token is not, which is the whole reason it is a token.
Two more checks land on the same edit — the drawer's, in `tutor-drawer.test.js`, and the service's
own, in `tutor-server.test.js`, both building their refusal out of the same reading.

The third is the service's. A stream can fail in ways that are the *service's* to name — the
agent never started, the agent never finished — and it sends a code for those rather than a
sentence, because a sentence there would be in one language, in a file every Workspace runs. So
the codes are read out of `server.js`, the key each one is read as is read out of the drawer, and
the entry behind that key out of the table. Its observer runs both ways: a code the service can
send with no words behind it is a Learner told nothing, and an entry the service can never send
is what a code renamed on one side leaves behind. Nothing about it needs a running service, which
is why it sits here rather than in the service's own suite.

Every key a Component asks for is read out of the Component's own source — the keys are written
as literals under a namespace, and no source builds one by concatenation, which is what makes
this derivable — and checked against the table English falls back to, so a missing translation
fails before a Learner meets a raw key. Three things are derived, not listed: the sources, from
the same directory listing the scan reads; the keys, from those sources; and **which prefixes
count as namespaces, off the table itself** — so a Component under a new one is visible here the
moment its entries land, which is the same edit that makes them exist at all. And the shipped
tables are checked against each other, so a typo in one is not a silent hole. Neither check names
a key: `docs/agents/tests.md` bans a test caching a fact it does not own, and a list of keys here
would be a second copy of the table.

`lesson-boot.js` is excluded from the reading side, because it is the file that *holds* the
table: every key it ships is a literal in it, so counting it as a reader would find every key
asked for and every namespace in use, and pass whatever anything else had stopped doing.

**The floor of that derivation is worth knowing.** A key under a namespace the table carries no
entry for at all is invisible here — the regex can only recognise prefixes the table already has,
so a Component asking for `widget.check` against a table with no `widget.` in it passes this
check. What catches it is the pseudolocale: an unanswered key renders as its own name, which is
ASCII, which is outside the sentinel alphabet. So the net holds, through a different check, and
for any Component that is in the fixture Unit. Nothing is worth trading for that — a check that
could see a namespace nobody has written down yet would have to be told the namespaces, which is
the list this stopped being.

Its observer runs two ways. Every Component the fixture Unit names has to ask for at least one
key — a Component that quietly stopped looking anything up would otherwise pass a completeness
check for free, there being nothing left to be incomplete. And every namespace the table carries
has to be asked for by something, which is how a whole surface going back to holding its own
strings gets caught rather than merely going quiet.

**Non-ASCII inputs in the suite are deliberate, and are not to be tidied away.** The fixture
Unit's prose, the Rubric it stores, the questions the drawer tests ask and the answers they
receive are all non-English on purpose. They are the only coverage the pipeline has of handling
bytes that are not ASCII — which is exactly the class of defect the verdict slug's hardcoded
character range was. Anything added here should widen that rather than narrow it.

**And one of them is deliberately neither Latin nor CJK.** `tutor-server.test.js` hands in two
Assignments named in Cyrillic and in Devanagari, because those are the scripts the old slug threw
away entirely: a character class written with two alphabets in it passes everything written in
those two. The Devanagari one carries combining marks, which is the second half of the same
lesson — a check that only ever sees scripts where a letter is one code point will not notice a
pipeline dropping the parts of a letter. Widening the inputs means reaching for a script nothing
here handles yet, not another sentence in one it already does.

## The navigation check

`nav.test.js` holds the claim a Unit's own definition makes: a Unit is more than one file, and
one nobody can find was not worth writing. The bar is mounted the way `lesson-boot.js` mounts it
— the course manifest, then the bar carrying the page's Unit id — against a manifest with one
Unit that has a Checkpoint and one that does not.

**A slot that resolves, and a slot that degrades.** From the Lesson, the Checkpoint is a link;
from the Checkpoint, the Lesson is a link and the Checkpoint is the page you are on. For the Unit
with no Checkpoint the slot is still rendered, labelled, and marked unreachable — the failure it
rules out is a gap the learner has to interpret.

That the slot is *visible* is half tree and half stylesheet, and the stylesheet half is the one
that would break silently — so **every** rule naming the slot is read, with its transitions
stripped first. Both halves of that are load-bearing and both were wrong when this shipped:
review found the check reading only the first matching rule, which is the one the slot shares
with the links beside it, and counting its `transition: color` as the colour that made the slot
visible. It passed against a slot styled `display: none`, which is the one thing it exists to
catch. It now fails on that, and on a slot left unstyled altogether.

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

## The release check

`CHANGELOG.md` says what shipped and `.claude-plugin/plugin.json` says what a learner installs, and
the two are written at different moments by different hands. `release.test.js` holds them together:
the newest version heading in the changelog must be the version the manifest declares. Cutting a
release heading and forgetting the bump is the ordinary way that drifts, and the result is a
changelog describing a version nobody can install.

Two smaller promises ride along. Version headings appear once and read newest-first, because a
version written twice splits one release across two places and a list out of order stops answering
"what is current?" from its first line. And a version heading with nothing under it fails — that is
a record that something shipped without a record of *what*, which is the only thing the file is for.

`## Unreleased` is deliberately not a release. Entries wait there between releases, so the check
reads it as a waiting-room; the day it is mistaken for a version is the day an unbumped manifest
starts passing. That the reader can tell the two apart is checked on a synthetic changelog holding
one of each.

**Every assertion here is over a list, so the guard goes inside each test rather than once beside
them.** An empty list has no duplicate version, no version out of order and no empty release
section — three of the four tests pass for free the moment the reader stops recognising a heading,
and the first review of this file caught exactly that. `shipped()` asserts the list is non-empty
and then returns it, so a test that reads the changelog cannot skip the guard on the way.

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
  check. Every file the selection guide names is one the plugin ships — the shipped Components,
  the shared stylesheet, the bootstrap — and every other row names a teaching act and what to
  reach for, which resolves to no file at all. (No count here on purpose: a number written into
  prose is a fact this file does not own, and it was already one behind before it was two.) The underlying rule is unchanged and still enforced: an
  `assets/…` path in any shipped document is a promise that the scaffold installs it, so writing
  a row with that prefix is how a Component opts into `assets.test.js`. Nothing stops a future
  row naming `scrolly.js` as a bare filename — that would be invisible here, and it is also what
  the guide was rewritten to stop doing.
- **No browser runs any of this.** The fixture DOM dispatches events and mutates the tree; it
  computes no styles and lays nothing out. `components.test.js` checks that every class a
  Component puts on the page has a rule *somewhere on screen* — print-only rules do not count,
  and `is-live` is exempt because it is the mount marker rather than a visual state — but never
  that it looks right. Judging a lesson's appearance still means opening it.
- **The Grader's judgement is not tested, and cannot be.** The stub agent replays a fixed
  transcript, so every grading check here is about what the Grader is *asked* and what happens to
  what it *said* — never about whether the verdict is right. That it judges against the stored
  Rubric is a property of `tutor/GRADER.md` plus the payload, and both are checked; whether it
  judges well is read by opening `learning-records/`.
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
