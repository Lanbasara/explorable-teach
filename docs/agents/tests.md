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
| `tests/from-disk.test.js` | The documents say what actually breaks a Lesson opened from disk — including a Lesson's own local assets, with both ways round it — and no longer ban a technology, nor sell serving on a restriction it does not lift |
| `tests/imagery.test.js` | The authoring reference still says to draw by default and why, what the borrow test is, that a diagram is built from elements before anything is drawn into a canvas, that no image ships unlooked-at, where the credit goes, the four bans with their reasons and the ceiling with its mechanism — and offers only image formats the service actually serves |
| `tests/motion.test.js` | Motion is sorted into three kinds, each with its verdict; interface feedback is permitted by name and carries its constraints; the reduced-motion preference is required rather than suggested — in the reference, and in every stylesheet the plugin ships |
| `tests/deriving.test.js` | The authoring reference derives an interaction from the passage instead of selecting one off a list — gates first, derivations that each carry their trigger question and their cheapest honest version, a match against the Workspace's own assets with three named outcomes, and the anti-patterns beside them |
| `tests/simulation.test.js` | A run that depicts something real is checked against a known-good result while it is authored — the four kinds that qualify are named, an engine is not one of them, a subject admitting none of them is paced rather than simulated, and the rule sits where a Teacher about to build one walks past it |
| `tests/skill-spine.test.js` | The skill opens on the Boot sequence, carries its spine and nothing else, ends a Session on a checkable outcome, and judges discovery one question at a time rather than aiming every Lesson at it |
| `tests/disclosure.test.js` | Material only some Sessions reach sits behind a pointer, not inline — and the serving precondition sits beside the instruction it makes sense of |
| `tests/assets.test.js` | Every `assets/…` path a document or template names is installed by the scaffold, on the side of the split it belongs to |
| `tests/components.test.js` | Each shipped Component mounts, responds, and leaves the page readable without it — including the hand-in on an Assignment page, which refuses what it cannot grade |
| `tests/nav.test.js` | Every artifact of a Unit is reachable from every other, and one that was never written says so where it would have been |
| `tests/init-workspace.test.js` | The scaffold never overwrites what a Workspace owns, re-points what the plugin owns, is safe to re-run either way, and leaves a Submission inside version control rather than outside it |
| `tests/wire-lessons.test.js` | The bootstrap tag lands exactly once, re-running is free, and every Lesson's served address is printed with the precondition that makes it work |
| `tests/page-checks.test.js` | The pass a Teacher runs over a page it just wrote answers in one shape, declines rather than passing when there is nothing to judge, tolerates a page lacking the thing it examines, and documents every condition under which it misleads |
| `tests/tutor-server.test.js` | The service serves, refuses and streams what it says it does — asked over HTTP, including at every address that names the Dossier and in every media type a Lesson's own assets arrive in — grades in a role composed from the Grader's own two files, never the Tutor's, writes the scaffolding it builds in English while the answer comes back in the Learner's language, and — started the way its documents say to start it — outlives the shell that launched it and says where each Lesson is served |
| `tests/dossier.test.js` | The Workspace entry point reports the Tutor service in three states — reached, not running, and cannot tell from here — and asks the service nothing from a page it never served |
| `tests/rich-text.test.js` | A Tutor answer renders as the rich text it was written as, and the markup in it stays text |
| `tests/tutor-drawer.test.js` | The in-page drawer renders a streamed answer and a pinned one through that renderer, reports the wait, carries a Submission to the Grader and its verdict back, and recovers from a service that is stopped or failing |
| `tests/language.test.js` | A Workspace states its language once and every page picks it up, the lookup falls back the way it says it does, nothing a Learner reads — in the drawer, in the bar, in any Component — is hardcoded in any language, every way the Tutor service can fail has words on the page to be read as, the role definitions are English down to the token a Grader refuses with, and nothing the plugin ships — nor the Workspace one scaffold run produces — is written in one Learner's language |
| `tests/release.test.js` | The version the plugin declares is the one the changelog most recently shipped |
| `tests/tutor-helper.test.js` | The service fixture below replays a stream in pieces, the way a real one arrives, and the readers that find the Grader's refusal token and the service's media types refuse to guess at either |
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

`page.inline()` is the other half of running a page: `script(file)` runs a tag the page *loads*,
which is every Component the plugin ships, and `inline()` runs one the page *carries*. The Dossier
is the only page that needs it, and needs it for the reason the whole subset exists — a page a
test only reads is not under test at all. A tag with a `type` is not one of these, so an
Assignment's Rubric stays the data it is, and a page carrying more than one is refused rather
than half-run.

`tests/helpers/drawer.js` mounts the Tutor's in-page drawer the way a Lesson mounts it, and owns
the seams that come with driving it — the stream, the health probe, the clock, the intervals, and
the Workspace's own table of Learner-facing text. Two suites ask different things of it:
`tutor-drawer.test.js` asks what the drawer does around an answer, and `language.test.js` asks
what language it does it in. `protocol` is the seam that says which reading of the Workspace a
page is being mounted under — `http:` for a page the service served, `file:` for one opened from
disk — and `page.probes` records every address the page asked the service's health at, so "it
asked nothing at all" is a claim rather than a hope. The stub refuses a request the browser would
refuse, and *which* requests those are lives in `tests/helpers/origin.js` rather than in either
fixture: two stubs standing in for one service have to refuse the same set, or one of them
answers a request that would never have left the page.

`tests/helpers/dossier.js` mounts the Dossier, which is the one page in a Workspace the bootstrap
does not load: it reads the course manifest itself and carries its own script inline. It is
served on a port nobody wrote down, and its stub refuses any request naming an origin — so a
cover that went back to hard-coding a port would report a running service as stopped, which is
the defect it exists to hold shut. Its fixture manifest carries no subtitle and no thesis on
purpose: those two are authored HTML the cover splices, and splicing markup is what the fixture
DOM refuses.

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

`tests/helpers/markdown.js` answers four questions about a document's shape: what are its
sections, what anchors does it offer, where is each subject named, and what are its sentences. Two suites assert on the
shape of `SKILL.md`, because here shape *is* behaviour — what an agent reads first is what it
attends to, and material sitting inline is material it reads whether or not this Session needed
it.

```js
sections(SKILL)[0].title;                 // 'Boot sequence' — the opening material
step(boot.body, 1);                       // one numbered step, to the next number
anchorsIn(SKILL);                         // every heading, as the anchor it is reachable at
linesMentioning(SKILL, 'tutor');          // every mention, with the line it starts on
sentencesOf(SKILL);                       // every sentence, wrapping folded back out
```

`tests/helpers/docs.js` holds what sits on top of it for the suites that assert on *what a
document says*: `foldedDoc` reads one with its wrapping folded back out, `absentFrom` names which
entries of a list of claims the document is missing, `carriedTogether` answers whether one
logical line carries all of them — which is the difference between a claim and two remarks made
in the same breath — `oneSection` finds the one section that owns a subject, `orderedEntries`
reads the numbered entries of a part, and `namedBullets` reads the bold-led ones, with
`ROOM_FOR_A_REASON` the length floor two checks hold such a list to. They all live there for one
reason: several suites now read documents, and a reading rule kept in several copies is one that
can disagree with itself. The last three arrived that way rather than by design — the derivation
and simulation checks had a copy each of the entry reader, and one of the copies described itself
as being the other.

Everything here walks the document through one `eachLine`, so there is **one** rule for what
fenced code is. Three copies of that rule had drifted into three different spellings before
review caught it, which is how a parser ends up disagreeing with itself about what a heading is.

Four subtleties, all load-bearing, all pinned by `markdown-helper.test.js`:

**A heading inside a fenced block is not a heading.** The skill's documents fence a Lesson
template and a Markdown skeleton, and a reader fooled by either reports sections nobody sees. A fence
indented inside a list item is still a fence.

**Prose here is hard-wrapped**, so where a line break falls is a typographic accident.
`linesMentioning` folds a wrapped paragraph or list item back into one logical line before
matching, and reports the line it started on. A check reading raw lines reads the accident: one
sentence becomes two claims, a hard-wrapped `idle timeout` stops being findable, and re-wrapping
a paragraph breaks a check that has nothing to do with wrapping.

**A sentence is a smaller thing than a logical line, and sometimes that is what the claim is
about.** Two patterns required to arrive *together* are, read line by line, only required to
arrive in the same paragraph — and the spine check has a claim that has to be finer than that, so
`sentencesOf` splits the folded lines again. A semicolon or a colon does not end a sentence, since
a clause hung off either is the same claim continuing. Where it misreads is recorded beside it: an
ordered marker is punctuation followed by a space, so `2.` splits off as an entry of its own. That
orphan carries no words, which is what makes it harmless — but it means a count of these is a
floor to guard an observer with, not a measurement of prose.

**Slugging replaces each space, never a run of them.** Dropping the `—` in
`The two gates — most passages…` leaves *two* spaces, and GitHub hyphenates both, so the real
anchor is `the-two-gates--most-passages…`. Collapsing them — which this did until review caught
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
as its own process on a port of its own, and a test touches a socket, the Workspace on disk, and
the stub agent. No function in it is called directly.

One test reaches past those three, and only to avoid writing down something it does not own. The
Dossier is reachable from a Lesson because the navigation bar links to it, and the bar's address
is what the service used to rewrite — so the check mounts the bar in the fixture DOM and follows
the `href` it actually builds, rather than restating that address here. The bar belongs to
`nav.test.js`, which holds that every artifact of a Unit is reachable from every other; what this
suite adds is that the *service* answers what the bar asks for, and that claim still crosses the
socket.

The fixture starts it the way a Workspace does — `node <ws>/tutor/server.js`, which resolves
through the link into the plugin — so the split is exercised rather than bypassed. The server
defaults to its working directory when nothing names a Workspace, which is what keeps that
invocation meaningful.

**It also starts it the way every document tells the Learner to.** `TutorService.start(t, ws, {
control: true })` runs `tutor/tutorctl.sh start` — which was, until it did, the one way of running
the service that nothing here ran. What comes back is the same service; two differences are the
whole point of the mode. It is nobody's child, so it is identified by the pair nothing else on the
machine shares — this port, serving this throwaway Workspace — and stopped by the pid it reported
rather than by a handle. And its launcher is spawned `detached`, leading a process group of its
own, which is what a shell is: *did the service stay in the launching shell's group?* is then a
question a test can ask by signalling that group and seeing whether anything was still in it.

The cost of that mode is one guarantee the direct one keeps. `PATH` there holds the stub agent and
nothing else, so a real `claude` is unreachable even on a machine that has one; a shell script
needs `dirname`, `curl` and `python3` to run at all, so this mode puts the system directories
behind the stub — which still wins for `claude`, being still first.

**The agent is a stub binary first on `PATH`.** Started directly, `PATH` is set to *only* the
directory holding it, so the real `claude` cannot be reached even on a machine that has one; the
control-script mode above trades the *only* for the *first*, and nothing else. The stub records its argv
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

**Two things in that file are not a service at all.** `refusalToken()` reads the token a refusal has
to open with out of `tutor/GRADER.md`, which is the file that decides it — the service watches for
it, the drawer strips it, and three suites build a refusal out of this one reading rather than out
of three copies. It lives beside the service fixture because everything in `runtime/tutor/` is
driven from here, and it is held to refusing a `GRADER.md` that quotes more than one line: picking
between two would be a fixture deciding a contract it does not own.

`mediaTypes()` is the second, and sits there for the same reason: `tutor-server.test.js` asks
whether the media-type table admits an extension nothing ever requests, `imagery.test.js` asks
whether it serves an image format the authoring reference does not offer, and one reader between
them is what keeps two suites from disagreeing about what they read. It throws rather than
handing back an empty table, so the observer is guarded once where the reading happens instead of
in each suite — and `tutor-helper.test.js` holds it to that.

**The media types themselves are written down rather than read off the thing that owns them**,
which is the one exception in that file to the rule about restating. What a browser is handed
back *is* the contract — a `.glb` served as `text/plain` is a file a renderer refuses — so a check
sourcing the content type from `server.js` would assert nothing about it. The reader is used for
the opposite question only: is there an extension the gate admits that nothing here ever asks for?
The two lists have to be equal, so neither can drift.

**And each refusal is re-asked with a newly admitted extension in the URL** — every spelling of an
escape, a link the scaffold did not write, an extension off the list. The allowlist is the *first*
gate a request meets, so until the table grew, the containment check, the symlink check and the
`assets/…` fallback had never had anything to say about a `.glb`: a request for one was dropped
before it reached them. Each 404 is paired with an honestly placed `.glb` that does come back, or
the whole check is one on a service that refuses everything.

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

## The page pass

`scripts/page-checks.js` is the Teacher's own tool: seven checks it runs in a browser over a
Lesson it has just written, so that a page which is blank, broken or missing a dependency is
caught by the Teacher rather than by the Learner. It is built the way `rich-text.js` is built, and
for the same reason — the page, the window and the session's own console and network records are
arguments rather than globals — so `page-checks.test.js` runs the whole of it in a `vm` context
holding nothing at all, against a stub page that returns the boxes and the colours a test wrote
into it.

Four claims, and the last one is the deliverable rather than a footnote.

**One shape, and three values.** Every check answers `{ check, ok, summary, findings, examined,
notes }`, and `ok` is `true`, `false` or `null` — `null` meaning *there was nothing here to
judge*. A page with no canvas has not passed the canvas check, a check handed no console record
has not passed the console check, and a pass in which every check declined has judged nothing, so
the pass itself is three-valued too. Reporting an absence as a pass is the one answer a Teacher
would act on wrongly.

**Nothing throws on a page that lacks its subject.** Three shapes of absence are driven: a page
with nothing on it, no page at all, and a page whose every answer is a throw — which is what a
browser does on a canvas holding a cross-origin image.

**The observer is guarded per check**, because a check that answered `null` to everything would
satisfy both claims above for free. So every one of them is also driven against a page holding
its subject and has to reach a verdict there: an error in the console, a 404, a blank canvas
beside a drawn one, a canvas that is still while the page asks for frames, a panel parked past
the right edge, a label under a card, grey text on white.

**Every check documents where it misleads, and the suite reads that off the file's own list.**
For each check the file ships, the head comment has to carry the condition under which it reports
confidently and wrongly, the direction it misleads in, and the field in its own output that
reveals it — so a check added without its misread fails on the day it is added. Three of them are
matched by name rather than derived, because the pass was built around those three, and so are the
two environment hazards. Those five patterns are the one place in this repo that restates
anything from that head comment, and they are patterns rather than prose for that reason: a
document holding the list in sentences would be a second copy to keep in step, and the file owns
it.

Two of the misreads are driven rather than only asserted about, because a documented misread
nobody reproduces is a sentence: the overlay that ignores pointer events makes `labelsVisible`
report `ok: true` in this suite, with `coveredBy` and `ignoringPointerEvents` naming the overlay,
and the contrast check reports a ratio against a background it says in `assumed` and
`backgroundFrom` that it never read.

One more claim sits with the others because it is where the file lives rather than what it does:
a scaffolded Workspace holds nothing that resolves to it. The checks do not vary by subject and
are not page content, so they are named from the plugin root and installed nowhere — the same
shape as the wiring script.

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

**The Dossier is left out of the pseudolocale, and the test says so where the absence is.** Its
text is a hard-coded English Seed by decision — the cover is a copied file that does not load the
page bootstrap, so it has no table to look a string up in, and giving it one would make it depend
on the page infrastructure it deliberately does not use. Mounted under a sentinel table it would
render its own English and fail, correctly. So the exclusion is written down as a check of its
own, naming the scan below as what holds the cover to English instead. An absence nobody explains
reads as an oversight, and the next person to notice it fixes the wrong thing.

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
the derivation of an interaction and the navigation rules, and the check reads `SKILL.md` for the
vocabulary only an authoring reference uses — markup, asset filenames, CDN hosts, `type="module"`,
`crossorigin`, `new Worker(`, `is-live`, the stand-in sentence a picture carries, a Component's
`Deps:` declaration, a Lesson's numbering, a borrowed image's licence, the coarse grid and
monospace label a hand-drawn diagram is held to, and the derivations, the cheapest version of one
and the anti-patterns beside them. Same shape as the runbook check below it, and guarded the same
way: every pattern must be found in `UNIT.md`, or the check is describing no authoring material.

That vocabulary tracks the document, not the reverse: it read `Tier N` until the catalog stopped
being tiered, and the guard failed on the spot rather than going on passing while looking for
words nobody writes. Four entries arrived the same way when the ban on ES modules became a list
of what an author types that breaks from disk, one when the Teacher gained a pass to run over the
page it had just written, three when it gained a policy for imagery, and the last three when
choosing a Component off a table became deriving a description from the passage.

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

**The serving precondition sits beside the instruction not to ask for a reload.** The in-page
Tutor connects only on a Lesson the Tutor service served, and the runbook's instruction not to ask
the Learner to reload is true when served and false on disk — which is the sentence a Teacher acts
on. The check finds the one section carrying that instruction, by its shape rather than its
wording, and requires all three parts of the precondition in it: that the drawer connects only on
a page the service served, that a Lesson opened from disk is the other reading, and that this
reading is by design rather than a fault to go and chase. It holds the precondition in place; it
cannot hold it against being *wrong*, which is review's job.

**The rationale the skill no longer carries is in the decisions record.** Why the Tutor is a
Workspace template rather than a plugin-level agent is a maintainer's reasoning, so it left the
skill — and reasoning that leaves without being recorded is reasoning a future maintainer
re-derives, or reverses without knowing it. The check reads the record for the four things that
argued for it, and fails if the skill still carries them too.

## The from-disk check

`from-disk.test.js` is the one suite here whose subject is whether the documents are **right**
rather than where their material sits. It exists because a rule that is wrong in the safe
direction is still wrong, and this one was: the authoring reference banned ES modules and CDN
loading — "`file://` compatible by default, UMD or IIFE, never ES modules" — to buy an offline
property that the ban does not buy, and three other documents restated a matching claim from the
other side. Decision 34 in `docs/DECISIONS.md` has the argument; these are the checks that keep
it from being quietly undone.

**The authoring reference carries both halves of the list.** One section of `UNIT.md`, found by
its heading, has to name what an author types that breaks — a module script with a relative
source, a dynamic import of a sibling file, a relative `fetch`, a worker from a relative path —
*and* what does not: an image, a stylesheet, a classic script, anything at all aimed at an https
CDN. The second half is not decoration. A list of only what fails reads as a ban again, because
an author extends it to everything that looks similar.

Each list is read against **its own part** of that section rather than the whole of it, and that
is not tidiness. Review measured the whole-section version: the CDN row under *these do not*
carries `type="module"`, so it satisfied the pattern that exists to hold the row about a
*relative* module script, and deleting that row left the check green.

**The two consequences that do not follow from the rule.** `crossorigin` and `integrity` on a
local classic script — as a pair or not at all, since an integrity check cannot run against an
opaque response — and the ban on a cross-origin worker script, with the blob that gets a CDN
library around it. Neither is derivable from "a relative URL fails", and both break a page that
looks correct.

**Nothing that instructs still carries the ban**, in any of the three spellings the documents
carried it in. `docs/` is exempt: `DECISIONS.md` records the removal, and a record that may not
name what it removed is not a record. The observer is guarded against the sentences as they were
actually written, kept in the test file rather than in a document, because the document they came
from no longer has them.

**No document sells serving on a restriction it does not lift.** The claim is matched by its
shape — *lifts … restriction* — rather than by its wording, and it is guarded against both
spellings that existed. What has to be there instead is what serving does buy: the in-page Tutor,
which only works on a page the service served, and an origin, so the page may fetch its own files
by relative path — and both **in one paragraph**. Review measured the looser version and it held
nothing: the runbook already carried "the drawer connects only on a Lesson the service is
serving" as a precondition, so half the check passed with the answer deleted entirely. The two
facts are the answer only when they are given together.

**Both documents say why the plugin's rule and the Lesson's differ**, and say it in one place a
reader meets at once — one logical line carrying all three of: the shipped Components touch no
network, they are the same bytes in every Workspace, and a Lesson is not held to that rule. One
line rather than one document, because `UNIT.md` already argues the same-bytes point about the
*language* of the plugin's files, and a document-wide check would pass on the strength of a
sentence that says nothing about the network.

**A picture Component carries a stand-in sentence**, and a text one keeps being taken over by its
script. And nothing that needs the network or the service may fail silently — the page names
which of the two is missing.

**A Lesson's own local assets are the same rule met from the friendly side**, and the check
requires the consequence and both ways round it — inline the asset, or generate the geometry
procedurally — to arrive on **one logical line**, which is one paragraph, **inside the section
that owns the rule**. Neither half of that is tidiness. `UNIT.md` names the Tutor service and the
served address all over, so a document-wide read would pass on two sentences that never met; and
a consequence stated with no way out reads as *do not use local assets*, which is the ban again
wearing a different coat, so both ways out are checked rather than assumed.

Holding the placement is what turned up a bound that was missing. `sections` asked for level three
runs a body to the next level-three heading, so this section ran on through the page pass and the
imagery rules that follow it — the bleed `imagery.test.js` documents and works around. Measured:
the paragraph moved out of the section entirely still satisfied the check. The section is now
bounded at the next heading of any level, which every check reading a part of it inherits.

Every check here reads the documents with their hard wrapping folded back out, through the
Markdown reader, because every claim it makes is about a sentence rather than a line. The scan
over "the documents that instruct" is guarded by name — `UNIT.md`, `TUTOR.md`, both READMEs —
because a scan that found nothing satisfies every *this claim survives nowhere* assertion by
having nowhere to look.

What this suite cannot do is check the browser. Nothing here opens a page from disk, so what it
defends is that the documents go on agreeing with the measurement and with each other — see
"`file://` is inferred, not observed" below.

## The imagery check

`imagery.test.js` has the same kind of subject as the from-disk check above — whether a document
is **right** — and arrives for the opposite reason. There was no wrong rule about imagery to
correct: there was no rule at all, so Lessons contained almost no images — the costliest of the
three gaps decisions 34 and 35 started closing, because an annotated static diagram beside prose
is the most consistently effective format in the instructional literature. A rule that is absent is
obeyed by nobody, and one that is present and unargued is overridden by the first Session that
finds it inconvenient. So both the rule and its argument are checked. Decision 36 has the
reasoning.

**The rule and the borrow test, read against the part of the section that states them.** One
section of `UNIT.md`, found by its heading, has to carry *default to drawing*, the test in the
form of the question it actually is — *would a drawing of this be a claim about how reality
looks?* — and all seven borrow categories by name. The part before the first subsection is what
is read, rather than the whole section. That is the shape the from-disk check arrived at the hard
way — measured there, and applied here in advance: the subsections reuse the rule's own vocabulary
(drawings, diagrams, photography, licences), so a whole-section read is a check that can go on
passing while the sentence it is about has been deleted.

**The reason, and the sentence it lands on.** Four things have to be said — that the Teacher
already knows what the diagram must say, that the only question left is whether it rendered
legibly, that a borrowed image instead poses the question of whether it depicts what is claimed,
and that a look at the page answers that one badly — and then the conclusion has to arrive in
**one logical line**: drawing trades an unverifiable risk for a verifiable one. Both words
somewhere in the section is not the argument; the sentence is.

**Each ban sits on one logical line with its own reason.** Generated imagery for a diagram and its
missing symbolic representation, generated decoration and stock photography and the measured
negative they are, embedded figures from paper repositories and the licences that do not grant
redistribution, and a server-side diagram service and the third party it ships the Lesson's
content to. A reason that has drifted off its ban is a reason nobody reads while deciding, which
is why one-line-carries-both is the shape rather than "both appear in the subsection".

**The ceiling, the handover, and the mechanism in one sentence.** A ceiling has to be named, a
layout engine has to be what takes over past it — a ceiling with nothing beyond it is a ban — and
the mechanism has to arrive whole: *geometric rather than semantic*, with the width of a label in
the same breath. All six mitigations are required, each of which removes one way for a label to be
wider than the author guessed.

**Elements before a canvas, read as a rule rather than as a preference.** The subsection has to
say which of the two words it is, name all five things a diagram of elements is worth — labelled,
focusable, reachable by keyboard, readable by assistive technology, inspectable — and put what a
canvas costs in one sentence with the canvas: the *only* check it can ever support is whether
anything was drawn at all. Then the escape hatch, by its four cases rather than by the phrase
*when elements cannot express it*, which is a judgement an author makes in the direction of
whatever it already knows how to build. And the list of what markup and styles draw natively,
entry by entry, because that list is the whole difference between a rule and an aspiration: an
author told to prefer elements and shown none of them reaches for the canvas.

**The formats are read off the service, not restated.** `server.js` owns the MIME table, so the
check parses the image types out of it and requires the document to offer each one and to offer
nothing else. This is the rule about never restating what another file owns, applied to a document:
a reference that named `.webp` would send the Teacher to download one, and the page would render
from disk and 404 the moment it was served.

**The destination is held from both ends.** Naming `./images/` in a document is a promise about a
Workspace, the same shape as an `assets/…` path — so the check reads the destination out of the
document and the directory list out of `init-workspace.sh`, and requires the second to contain the
first. Neither side is restated here, which is the rule that keeps a test from becoming one more
document caching a fact it does not own.

**And the argument is in the decisions record**, which the check reads folded, the way it reads
every document here — the record is hard-wrapped, so `rendered and looked\nat` is one sentence
broken across two lines and nothing that reads raw lines can see it. Both document suites now read
through one folding reader, in `helpers/docs.js`: two copies of a reading rule is how a reader ends
up disagreeing with itself, which is the defect the Markdown module's own head comment records.
Finding the one section that owns a subject moved there for the same reason when the motion check
became the fourth suite to do it — and two of the four copies had already disagreed, over whether
to search a whole document or only the section that owns the subject. Passing the text in makes
that a decision at the call site rather than a difference nobody meant.

## The derivation check

`deriving.test.js` has the same kind of subject as the from-disk and imagery checks — whether a
document is **right** — and it is about the shape of a decision rather than about a fact. Deciding
what a passage needs was a table of eleven teaching acts, each routed to what to reach for.
Indexing by teaching act rather than by library was the right direction, and the defect it left is
structural: a table is read *before* writing, so it decides the answer, and the two commonest true
answers — *this passage needs nothing*, and *this passage needs something nobody has built* — are
not expressible as rows. Decision 39 has the reasoning.

**Both tables are gone, in the spelling they were written in.** The two row patterns are kept in
the test file rather than in a document, for the reason the from-disk check keeps the ban it
forbids: the document they came from no longer has them, so a pattern with nothing to see would be
a check that cannot fail.

**The derivations are not a table wearing another shape**, which is the half that matters. Four
columns of trigger, output, mark and cheapest version carry the same facts and read as the closed
list again, so **no table row may appear anywhere in the section** — not the two by name.

**The gates are first, and the order of the parts is asserted.** A document stating the gates
after the derivations has the Teacher deciding what to build and then asking whether to build
anything, which is a decision it would defend rather than make. The match against what exists has
to come after the derivations for the same reason: a description is the first artifact that can be
priced, and *nothing* stops being reachable once a Component has been named.

**"This passage needs nothing" arrives on one logical line, which is one paragraph.** Both halves
are required and neither is enough: that most passages stop at the gates is a measurement, and
that stopping is a legitimate place to stop is the permission an author needs in order to act on
it. Said in separate paragraphs, the second reads as consolation.

**Every ordered entry in the derivations carries all four of its fields** — the question it asks
of the passage, the form it outputs, whether that output is reusable plumbing or subject-specific
content, and the cheapest version that still teaches. Two of the four are held to more than their
label: the trigger has to contain a question mark, because a trigger stated rather than asked is a
row describing a thing to build, and the mark has to name *plumbing*, *content* or *neither* after
its label rather than merely carrying it. Reading every entry is also what holds the five moves
out: a surviving move is an ordered entry with no trigger question, so it fails as an incomplete
derivation rather than needing a check of its own.

**Three outcomes, all of them named and none marked as the failure.** *Reuse*, *build* and
*nothing*, with the sentence that they are all normal on the same line as the third of them — a
three-outcome decision whose third outcome reads as the other two having failed is a two-outcome
decision.

**The Teacher is sent to the directory and to the head comments.** `assets/` is what a course has
and a Component's head comment is documentation that cannot drift from the code above it, so the
match part has to name both and say why the copy in the code is the one to trust.

**The seven anti-patterns are each named, and each has room for a reason after it.** The names are
patterns; the reason is a **length proxy** and is recorded as one — nothing here can read whether
a sentence is a reason. What the proxy catches is the shape the list would collapse into, a bare
bullet per form, which is what the imagery bans were written against.

**No line pairs a Component with its files** — the shape of the `Files` column the shipped table
carried. Read against this section rather than the whole document, and markup is exempt: it is
recognised by the tag brackets alone, since the `assets/…` paths are what this check is made of.
Both bounds are recorded under "What is deliberately not tested" below.

Every check here reads `UNIT.md` with its hard wrapping folded back out, through the shared
Markdown reader, because every claim it makes is about a sentence rather than a line. The section
is found by its heading and each part of it is bounded at the next heading of *any* level — the
bound the from-disk check arrived at the hard way, applied here in advance.

## The motion check

`motion.test.js` is the only suite here with one foot in each kind of subject: most of it asks
whether a document still says something, the way the imagery and derivation checks do, and one
check reads code. Decision 40 has the reasoning.

The complaint it answers is a rule that was true and incomplete. The material arguing against
decoration is about **content** — mascots, jokes, tangent anecdotes, ornamental art — and a
Teacher reading it with no distinction drawn does not dare put a transition on a disclosure. So
the fix is a sort rather than a permission, and what is checked is that the sort survives.

**Three kinds, each on one logical line with its verdict.** Motion that *is* the explanation,
motion that is interface feedback, and motion competing with the content, carrying *permitted*,
*permitted* and *removed* respectively. One-line-carries-both is the shape for the reason each
imagery ban sits on a line with its reason: a verdict that has drifted off its kind is a verdict
nobody reads while deciding, and a kind named without one is a taxonomy.

**The middle kind's reason for existing is checked, not just its permission.** One sentence has to
carry the case against decoration, the word *content*, and the interface affordance it is not
about — and the four things the evidence is really about have to be named, because "decoration"
is a word every author believes it is already avoiding.

**Its constraints arrive in the same breath that permits it**, all four together: *short*, a
number in milliseconds, *interruptible*, and the reduced-motion preference. Permission in one
paragraph and constraints in another is permission with a footnote. The number is required because
*short* with nothing on it is a word an author reads as agreeing with whatever it wrote.

**The preference is required rather than suggested, and that is checked three ways.** The media
query has to appear as the thing an author types rather than as a paraphrase of it; a requirement
word has to sit on the same line as the preference; and no line that names the preference may also
carry a hedge — *consider*, *where possible*, *if you can*, *optional*. `suggest` is deliberately
not one of those, since the rule states itself as *required, not suggested* and a guard that could
not tell those apart would forbid the document from saying what it is. The explanatory kind's
path — it stops being automatic and the Learner steps it — is required too, because a rule with no
answer for the one case where removing the motion removes the teaching is a rule broken silently.

**And the requirement is held against the plugin's own stylesheets, selector by selector.** Every
rule under `runtime/assets/` that declares a transition or an animation **of its own** has to have
its selector named inside a `prefers-reduced-motion` block in the same file. Per selector rather
than per file, because a file-wide "does the words appear" test passes a seventh animating rule on
the strength of the block guarding the other six. *Of its own* is the other half: the reader cuts
every guard out before it looks, since guards are written as `transition: none` and a reader
counting declarations naively would report a file as animating **because** it had already been
fixed. Both halves were got wrong first, and the second wrongly enough to be worth recording — the
optional whitespace after the colon has to sit *inside* the lookahead, because written outside it
backtracks to nothing and the lookahead reads the space rather than the word, so every guard in
the repo reads as a rule that moves. Five files gained a block when this arrived. The reason to
check the code at all is that a Teacher models a new Component on a shipped one, so a stylesheet
that animates unguarded teaches the opposite of the rule sitting beside it.

Selectors are compared **as text**, which is deliberately strict: a guard written more loosely
than the rule it means to cover is not counted as covering it. The alternative is a check that
decides CSS specificity for itself, and a wrong answer there signs off a page that still moves.

## The simulation check

`simulation.test.js` holds the one rule here that exists to catch something no other check in this
repo can see. Decision 41 has the reasoning.

Every other suite asks whether a page *works* or whether a document still describes reality. None
of them can see a Lesson that renders cleanly, passes the page pass, satisfies every document
check — and depicts something **false**, because seeing that requires knowing what the number in
the box means. So what is checked is that the one procedure that catches it is still written
down, and still written where it is read before the run gets built.

**The requirement and the moment it happens at arrive on one logical line.** "Verify your
simulation" with no *when* attached is a check that happens after the page ships, which is never.
The hazard has to sit beside it for a different reason: read without it, the rule looks like
belt-and-braces next to a dozen checks that already pass, rather than the only one of them that
can see this defect at all.

**The four kinds are each named, with room to say what checking against one looks like** — a
conserved quantity, a closed-form solution, a published worked example, and a reference
implementation compared step by step. The room is a **length proxy** and is recorded as one, the
way the anti-pattern check records its own. The fourth kind carries two extra claims, because it
is the one a Teacher does not think of: that the comparison is step by step, since two
implementations agreeing at the end can disagree about everything in between, and that it is the
kind most easily overlooked.

**The no-check case carries its prohibition and its sanctioned form in the same breath.** A
Teacher who reads only the first half has a passage it has been told not to build and no other
way to teach it, and will build it. So one logical line has to carry the case, *do not simulate*,
the citation, the drawing and the pacing — and the three forms of pacing have to be named, since
pacing with no forms under it is a word. The *asserted*-rather-than-*computed* distinction is
checked too: without it the substitute reads as a cheaper simulation rather than a different kind
of claim.

**What an engine buys and what it does not buy have to be one sentence.** Said apart, the first
half is read as the answer and the second as a caveat — which is the reading this paragraph exists
to prevent, since it is the reading the genre's most-praised example took. The named cases are
held too: the kart an engine would have caught, the orbital period it would not, and that a better
library is not an answer here.

**Placement is asserted, not only presence.** This is the line in this body of work most likely to
be skipped quietly, so the check reads where it sits: after the derivations, because it constrains
what they may output; before the match against what the Workspace has, because a run with no
known-good result is not a description to go shopping with; linked from every derivation whose
output is something the page **computes** — found by reading the entries, with the reader guarded,
rather than by counting them — and linked from the procedure for building a Component, which is
the other door into building one. *Computed* rather than *a run*, which is wider than it looks:
the derivation that has the Learner set a number and watch the claim change computes that claim as
much as a simulation does, so the three entries naming a precomputed run, a simulation or a number
the claim depends on are the ones held, rather than the two that say "run".

**And the file the result is recorded in has to have a column for it.** The recording is what makes
a skip conspicuous, and it lands in the `TECH-STACK.md` skeleton the first run hands the Teacher —
so the header row listing the Components this subject settled on has to carry *Checked against*,
and the document has to link the rule beside it — and *only* link it: the four kinds are asserted
**absent** there, because a second copy of them one link from the document that owns them is a
copy that can drift, which is what the removed Component table was. A requirement to record something into a template
with no place for it is one that becomes a note at the bottom, and then nothing. The header is
found by `Component` being a column of its own, because the deferred table beside it names one
inside a cell and holds things nobody has built yet.

What none of this can hold is whether a check was actually run, or whether the known-good result
an entry names is the right one for the subject. That is review's job and the Teacher's, and it is
recorded under "What is deliberately not tested".

## The spine check

`skill-spine.test.js` holds the shape of `SKILL.md` itself, because shape is behaviour here:
what an agent reads first is what it attends to. Nine claims. Seven were false before the
rebuild; the last two arrived together, when an instruction that was sound as a technique stopped
being a default.

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

**Discovery is a technique the Teacher judges, not a shape every Lesson is aimed at.** The first
of the two, and the one claim here that was true rather than absent: the spine used to instruct the
Teacher to aim every Lesson at the shape where the learner manipulates the subject first, which is
a technique with good evidence behind it and no evidence behind the default. Decision 37 has the
reasoning.
Three things are checked. A universal quantifier over Lessons and the vocabulary of that shape may
not meet in **one sentence** anywhere in the spine — sentences rather than logical lines, because a
paragraph folds into a single logical line here and a line-level conjunction would fail on a
paragraph saying each half innocently in a different breath. The judgement that replaced it has to
arrive **whole on one logical line** — whose wrong answer, that the Teacher has to be able to write
it down, what the question collects when it cannot, and that it should then not be asked — inside
the subsection that states it rather than anywhere in the section, for the reason the imagery check
reads the part before the first subsection. And that subsection is held against the three
classifications the judgement must not have become: by the learner's age, by subject area, by kind
of skill. Each pattern carries the control sentence that proves it can see its own subject, since a
classification nobody wrote is not evidence of anything.

**The Component that asks for a prediction is offered on the same judgement.** This one reads
`UNIT.md`, which is otherwise the disclosure check's business, and it reads it because the spine's
sentence and the Component's description are one claim: a claim held in two documents is one that
can drift, and this pair had already drifted apart — the Component was offered for *anything where
intuition can be wrong*, which an author believes about every passage it has just written.

It reads a rule over the document rather than a list of places in it, and that is the second
shape it has had. The first named three — the move the Component came from, the row a teaching act
was chosen on, and the row in the shipped table — and two of the three were table rows, so the
day both tables left, a list would have been one entry long. A one-entry list is a check that
stops seeing the next place the offer is written. So every logical line that names a prediction in
its own **prose** has to carry the judgement and may not offer it for anything at all. Markup is
not an offer and is excluded by the tag brackets alone, since the page skeleton links the
Component's stylesheet and the from-disk table names its script. **Alone** is the correction
review made: the first version also excused any line naming an `assets/…` path, which is wider
than markup — a sentence offering a prediction would have escaped by citing the file it lives in.
The recogniser is guarded on three sides, because one that read markup as an offer would demand
the judgement inside a `<script>` tag, one that read a path-citing sentence as markup would let a
real offer through, and one that read no offer anywhere would pass for free.

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
  check. No document lists what a Workspace has any more — the authoring reference sends the
  Teacher to read `assets/` and each Component's head comment — so the only `assets/…` paths left
  in the documents are the ones a page is shown linking, and the plugin ships every one of them.
  (No count here on purpose: a number written into prose is a fact this file does not own, and it
  was already one behind before it was two.) The underlying rule is unchanged and still enforced:
  an `assets/…` path in any shipped document is a promise that the scaffold installs it, so
  writing one is how a Component opts into `assets.test.js`. Nothing stops a document naming
  `scrolly.js` as a bare filename — that would be invisible here, and it is also what the
  reference was rewritten to stop doing.
- **No browser runs any of this.** The fixture DOM dispatches events and mutates the tree; it
  computes no styles and lays nothing out. `components.test.js` checks that every class a
  Component puts on the page has a rule *somewhere on screen* — print-only rules do not count,
  and `is-live` is exempt because it is the mount marker rather than a visual state — but never
  that it looks right. Judging a lesson's appearance still means opening it.
- **Real layout is not covered, and the page pass does not change that.**
  `page-checks.test.js` holds the contract of `scripts/page-checks.js` — the shape of every
  answer, the tolerance of an absent subject, the documented misreads — against a stub page that
  *returns* the boxes and colours a test wrote into it. Nothing here lays anything out, computes
  a style or rasterises a pixel, so whether a real page is laid out the way those checks read it
  is exactly what running the pass in a browser is for. **Adding a browser here is refused**, and
  not on grounds of effort: this suite takes no third-party dependencies and needs no install
  step, which is what makes it runnable by any agent that has just cloned the repo, and a
  headless browser is a large binary, a version to pin, a platform matrix and a second way for
  the suite to fail that has nothing to do with the plugin. The thing a browser would buy is
  already bought elsewhere and better — a Teacher opens the real page, on the real service, once
  per Lesson. What the suite must never do is *simulate* enough of a browser to look like it
  covers this; the stub page is deliberately small enough that nobody could mistake it for one.
- **A catalog could come back outside the section that had one.** The check that no line pairs a
  Component with both of its files reads the derivation section, not the whole document, and that
  bound is the honest one: elsewhere a paragraph naming both files is an author being told what to
  type — the Checkpoint page links two stylesheets and loads two scripts — which is instruction
  rather than a list. A table of shipped Components rebuilt under some other heading would be
  caught only if it used one of the two removed spellings. What is checked in full is the positive
  half: the reference has to send the Teacher to `assets/` and to each head comment.
- **A format nobody has named yet is offered for free.** The half of the imagery check that
  forbids offering an image format the service will not serve recognises formats from a fixed list
  written into the test — there is no registry of them to read instead — so a document offering
  `.jxl` would pass it. The other direction has no floor: the formats the service *does* serve are
  read off `server.js`, so one added there and not offered in the document fails on the day it is
  added.
- **Neither taste constraint on motion can be measured here.** *Short* is checked as "a number in
  milliseconds appears beside the word", and *interruptible* as the word itself — nothing here
  runs a transition, clicks through one, or reads a duration out of a Lesson's stylesheet. What is
  real is the third constraint: the preference is held against every stylesheet the plugin ships.
  A Lesson's own CSS is written in a Workspace that does not exist when this suite runs, so the
  rule reaches it as a rule and not as a check.
- **Whether an image was drawn, borrowed, or looked at is not knowable here.** `imagery.test.js`
  checks that the rule is stated and argued; it cannot check a Learner's Lesson, which is where
  the rule either was or was not followed. Nothing here can tell a drawing from a borrowed
  photograph, say whether a credit names the right source, or know whether anyone opened the page
  — the last of those is what the page pass is, and it runs in a browser a Teacher is sitting in
  front of.
- **Whether a run was ever checked against anything is not knowable here.**
  `simulation.test.js` checks that the rule is stated, argued and placed where a Teacher walks
  past it; it cannot check a Lesson, and it cannot read whether the known-good result an entry
  names is the right one for the subject or whether the comparison came out equal. That is the
  point of the recording requirement rather than something the suite recovers: an entry that
  computes something real and names no known-good result is visible to a reviewer, and a named
  result that was never actually compared is visible to nobody. Review and the Teacher's own
  honesty carry that half.
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
  `XMLHttpRequest`, module syntax and URLs, and `from-disk.test.js` reads the documents for what
  they claim about a page opened from disk; nothing here actually opens one. The claim itself —
  that a module from a CDN loads and a module from a sibling file does not — was measured by hand
  once, and is recorded in decision 34 rather than re-measured on every run.
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
