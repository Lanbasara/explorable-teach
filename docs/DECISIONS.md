# Design decisions

Why this works the way it does, and what was rejected along the way. `CHANGELOG.md` records
*what* shipped; this records *why*, including the reasoning that never appears in a diff.

**Provenance.** Everything from `b8c4fd6` (2026-09-11 17:42) onward is git-verifiable — the
commit messages carry the reasoning. Everything before that predates packaging and has no
version control; it is reconstructed from the session transcript and from rationale that was
deliberately written into `SKILL.md` and `README.md` at the time. Where the record is thin, it
says so.

---

## 1. Teach mental models, never command lists

**Decided:** commands appear only as illustrations of a deeper concept, never as a lesson's goal.

**Why:** the first lesson produced for the pilot learner was a command table with frontend
analogies. They rejected it outright — "照本宣科" (rote recitation) — on the grounds that
memorising commands is pointless when AI can write any of them. The real gap was structural
knowledge: process model, file descriptors, evaluation order.

**Consequence:** curricula are ordered by dependency between *ideas*, not by any book's table of
contents.

## 2. Two phases, and the tool stack is chosen per subject

**Decided:** Phase 1 researches and plans (mission, sources, curriculum, tech stack); Phase 2
teaches one lesson at a time. The component catalog is a menu, not a manifest.

**Rejected:** a fixed tool set applied to every topic. A philosophy course and an algorithms
course should not end up with the same tooling.

## 3. Default to minimal interactivity

**Decided:** before adding any interactive component, answer *what can the learner not
understand without this?* No answer means don't add it.

**Why:** the catalog grew fast (3D terrain, particle systems, D3 races) and the pull toward
building impressive things rather than necessary ones is strong. The rule exists to resist the
author's own enthusiasm, including a future agent's.

## 4. The tutor holds no process state

**Decided:** every question spawns a fresh headless `claude`. Never `--resume`.

**Rejected:** reusing the authoring session. It carries curriculum-planning state that has no
business leaking into an explanation, and it decays as it grows — which was the learner's
original objection to "just ask the session that wrote it".

**Refined later (`944b41f` onward):** follow-ups replay a capped transcript *inside the request*.
Bounded replay, not a session — state lives in the payload and dies with it. This keeps
multi-turn continuity without reintroducing the decay.

## 5. The tutor ships as a workspace template, not a plugin agent

**Decided:** the plugin carries an inert `templates/agents/tutor.md`; the scaffold copies it into
the workspace, where it registers project-scoped.

**Rejected:** a top-level `agents/` directory in the plugin, which would be tidier. Claude Code
discovers subagents only in `.claude/agents/` (project) and `~/.claude/agents/` (user) — never
inside a skill directory — and a plugin-level agent registers **globally**.
Subagents have no `disable-model-invocation` equivalent, so it would be auto-routable in every
unrelated project. Project scoping is the only invocation control a subagent has.

It also would not want to be global: a tutor for Shell and a tutor for music theory are not the
same role. Each workspace tunes its own `ROLE.md`.

**Refined by 24:** the subagent definition is still copied into the workspace — that part is
forced, and the reasoning above still has to be answered — but it no longer carries any role text.
It is a pointer at the plugin's role definition plus the workspace's own tuning. "Each workspace
tunes its own `ROLE.md`" is now "each workspace writes its own `TUNING.md`".

**This entry is now the only copy of that reasoning.** `SKILL.md` carried it as a section for a
human reader who was never going to read it there — it argues a packaging decision the Teacher
cannot act on and will never face. Decision 19 moved it here. If a future maintainer is tempted
by the tidier `agents/` directory, this is the paragraph that has to be answered first.

## 6. The skill is manual-only

**Decided:** `disable-model-invocation: true`, and a one-line description.

**Why:** only name and description are permanently resident in context. The original description
was 396 characters of trigger bait written to attract auto-invocation; once invocation is manual
that text is pure overhead. Cut to 96.

## 7. The skill scaffolds; it never silently hosts a process

**Decided:** the skill writes the tutor files. It does not start the server as a side effect of
teaching. It *may* start, restart or stop it on request — always detached, so the process
outlives the conversation. Lessons must work with the server down; that is the normal state.

**Why:** artifacts persist across conversations, processes do not. An 8-hour idle timeout guards
against a forgotten process lingering for days, not against one idle over lunch.

**Refined by 26:** all of this stands. What did not stand is how the page said so — it told the
learner to start the service *and reload*. The page now finds a service started under it, so
"start it" is the whole instruction.

## 8. Assignments are specified loosely, on purpose

**Decided:** whether an assignment exists, its shape, its difficulty and its rubric are all the
agent's judgement. Two things are fixed: the rubric travels inside the assignment file, and
assignments are spaced and interleaved.

**Why:** the pilot learner explicitly warned that over-specifying would make the agent follow the
spec mechanically and turn assignments into a rigid ritual. The listed shapes are labelled
inspiration, not a menu.

**The one hard rule earns its place:** a rubric stored with the task is what lets *any* future
session grade it without the context of the session that wrote it.

## 9. Sessions are disposable; the workspace is the memory

**Decided:** teach one lesson per session, two or three at most, then stop deliberately. Every
session opens with a fixed boot sequence.

**Why:** two different failures hide here. Context *loss* between sessions, which state files
solve; and quality *decay* inside a long session, which they do not. Only ending sessions solves
the second.

**Superseded by 21:** "stop deliberately" is not a bound the agent it binds can evaluate. The
one-unit scope stands; the stopping rule is now an outcome the session can check.

## 10. Files stay flat; the fix for "I can't find anything" is an entry point

**Decided:** `index.html` as the dossier cover, a nav bar on every page, `units.js` as the single
manifest. (`944b41f`)

**Rejected:** a folder per teaching unit. It would break every relative asset path across every
existing and future lesson, and the actual complaint was discoverability, not organisation.

## 11. Page infrastructure is injected, not hand-wired

**Decided:** one `lesson-boot.js` tag replaces five boilerplate lines, and
`scripts/wire-lessons.sh` injects even that into any page missing it. (`61e84f5`)

**Why:** requiring the authoring agent to remember five lines spent its attention on boilerplate
and made orphaned pages a matter of whether it remembered. Adding a future page-wide component
now means editing one file instead of every lesson.

**Found while doing it:** `tutor.js` initialised on a bare `DOMContentLoaded` listener, which
never fires for a dynamically loaded script. The widget would have silently failed to mount while
the nav bar — which guards on `document.body` — worked fine.

## 12. `init` sets up a directory and stops

**Decided:** `init` copies files. It does not interview, research, plan, or teach. (`442d587`)

**Why:** its second half had duplicated Phase 1 of the skill outright, giving one responsibility
two homes free to drift apart — and it broke the boundary a command named `init` implies. `git
init` and `npm init` set up a directory; they do not ask what your product is for.

**Superseded by 17:** once the command did nothing but invoke a script, the script was the
thing worth keeping.

## 13. Interview on evidence, not on a missing file

**Decided:** interview only when the mission is genuinely underdetermined. (`f5446fd`)

**Why:** `teach` triggers its interview when `MISSION.md` is absent — always true in a new
workspace. Inherited wholesale, that meant a learner who opened with their role, their goal and
an explicit list of non-goals still got a questionnaire.

**Worth recording, because the first diagnosis was wrong:** the same prompt had *not* triggered an
interview earlier that day. The initial explanation blamed the rule. It was not the rule — the
spec text was byte-identical across both runs. The difference was auto-memory: the earlier run
sat in a directory whose memory namespace already held the learner's profile and stated
prohibitions, so the mission was already known. The new directory was a fresh namespace.

The deeper defect was therefore that correct behaviour depended on whether memory happened to be
populated. The fix makes the mission readable from the opening request itself. **A missing file
is not evidence of a missing mission.**

## 14. The Components that do not vary by subject ship with the plugin

**Decided:** shared styles, Exercise, Predict-Reveal, Step Animation and Drag Ordering live in
the plugin's asset directory and are installed by the scaffold. The rest of the catalog stays a
menu.

**Why:** the catalog named roughly twenty component files and shipped none, and the Lesson
template linked a stylesheet the scaffold never placed — so every new workspace opened with a
dead link. Those five are identical for every subject, which makes twenty copies of them across
twenty workspaces twenty places for the same bug to live. One home, fixed once.

**Rejected:** shipping the whole catalog. Decision 3 stands — the catalog is a menu, and a
plugin that installs a 3D engine into a philosophy course has misread its own rule. The line is
"does this vary by subject?", not "is this useful?".

**Rejected:** the CDN dependencies the catalog listed for two of them — GSAP for step animation,
SortableJS for drag ordering. Both are replaceable with a CSS transition and native drag events.
A Component that needs a CDN fails on a train, and the plugin's own rule is that a Lesson works
from `file://`.

**Consequence:** a catalog row written as a path (`assets/exercise.js`) is a promise the test
suite enforces; a row written as a bare filename (`scrolly.js`) is a pattern to build on demand.
The prefix is the opt-in.

**Finished by 23.** "One home, fixed once" was the argument, and copying them into every workspace
did not deliver it — it delivered one home for the *source* and N copies of the bug. A workspace
now links at them.

**The duplication between Components is deliberate.** All four repeat the same mount tail
(`document.body ? mountAll() : wait for DOMContentLoaded`), a three-line `each()` helper, and a
card shell in their stylesheets. Factoring those into a shared `component-base.js` would make
every Component depend on a file loading first — and a Lesson links only the Components it
uses, so `lesson-boot.js` would have to learn an ordering it deliberately does not model. One
file per Component, self-contained, is also what makes a Component copyable into a workspace
and editable there. Twelve duplicated lines is the cheaper side of that trade; do not
"fix" it without changing the loading model first.

## 15. A DOM small enough to read, rather than a browser

**Decided:** `tests/helpers/dom.js` — a hand-written DOM subset that parses the fixture Lesson,
runs the shipped Component files, and dispatches real events at them.

**Why:** the suite takes no third-party dependencies and has no install step, so there is no
jsdom and no headless browser. Without *something*, a Component test degrades into asserting
that a file contains the word `click`, which is not a test of anything.

**Rejected:** asserting on component source text. It passes for free — a file can contain every
word such a check greps for and still never mount.

**The subset fails loudly.** An unimplemented selector throws rather than matching nothing, and
`innerHTML` throws on assignment — the second doubles as a guard that a shipped Component builds
nodes instead of splicing markup into the page.

**Known limit, stated so nobody over-reads a green suite:** nothing here computes a style or
lays anything out. The tests check that every class a Component applies is styled *somewhere*;
whether a lesson looks right is still answered by opening it.

## 16. The Unit is the spine, and the Boot sequence is the opening material

**Decided:** one Unit is what one Session delivers — a Lesson, its Exercises, optionally a
Checkpoint and an Assignment, plus the Learning Record and progress marker they produce. Lesson
names the body alone. `SKILL.md` opens on the Boot sequence, and everything after it is written
as a face of the Unit.

**Why:** four capabilities — Components, the Tutor, Assignments, Session boundaries — had been
designed in isolation and bolted on one at a time, so the document read as four patches with no
object binding them. Naming the object is what lets a Teacher reason about one thing.

Ordering is the other half of it, and it is a variance fix rather than tidying. What an agent
reads first is what it attends to; a Session that had to wade through a Component catalog and an
operations runbook to find out what to do first would sometimes not do it. The Boot sequence is
what every Session actually does, so it goes where every Session actually looks.

**Rejected: letting Lesson go on naming both things.** It was already doing two jobs — the HTML
file you read, and the whole increment a Session delivers — so "one lesson per session" meant
either "one file" or "one teaching increment" depending on who read it, and the Checkpoint and
the Assignment had nowhere to hang. The cheapest fix is to keep one word and say which job it is
doing each time, which is the arrangement that produced the ambiguity in the first place.

**Rejected: Module, Chapter, Topic.** All three are borrowed from a book's table of contents, and
decision 1 is that a curriculum is ordered by dependency between ideas rather than by anyone's
contents page. A name that imports the wrong ordering is not a neutral label. `CONTEXT.md` keeps
all three on Unit's avoid-list for that reason.

**Consequence:** "one lesson per session" became "one Unit per Session", which is a different
promise — a teaching increment rather than a file.

## 17. Scaffolding is the Boot sequence's first step, not a command

**Decided:** the standalone setup command is removed. The Boot sequence opens by running
`scripts/init-workspace.sh` when the Workspace is bare, and no document restates what that
script installs.

**Why:** after decision 12 the command's whole payload was a scaffold invocation plus a seed
file and a report. It could be skipped with no consequence — the skill already declared itself
able to do all of it — so it was a second name to remember for a step that runs itself. Its
documentation had also drifted into contradicting its own behaviour, which is what a document
does when it caches a fact it does not own.

**Rejected:** keeping it as a convenience alias. Two similarly-named entry points is exactly the
choice the learner was being asked to make and had no basis for making.

**Rejected: keeping the command and fixing its documentation instead.** The drift was the visible
symptom and the cheap fix was to correct the prose, which is what a maintainer reaches for first.
It would not have held. The command's text described what the scaffold installs, and a document
that caches a fact it does not own drifts again the next time the fact moves — the same defect
decision 20 later removed the Workspace file map for, and the same one `skill-spine.test.js` now
fails a document over. Deleting the second copy is what stops it recurring; correcting it only
resets the clock.

**Rejected: keeping the command and moving the scaffold out of the skill.** Splitting the other
way — the skill teaches, the command sets up — reads tidy and reinstates the failure decision 12
was written against: a learner who never ran the command gets a Session booting onto a Workspace
that has no files in it. The step has to run whether or not anyone remembers it, and only the
Boot sequence runs unconditionally.

**Consequence:** `skill-spine.test.js` now fails a document that names two or more of the
scaffold's template paths. One is a reference; two is a copy of a list the document does not own.

**Amended by 23:** "when the Workspace is bare" did not survive. The scaffold now runs on *every*
Session, because the links it re-points are how a Workspace follows the plugin across an upgrade,
and a step gated on emptiness would have stranded every Workspace that already had files in it.

## 18. Three assessment instruments, separated by three axes

**Decided:** an Exercise fires inside the Lesson and is judged by the page the instant it is
answered; a Checkpoint fires at the Unit's end and is judged by the page before the Unit closes;
an Assignment fires one to three Units later in the learner's real environment and is judged by
a Grader against the stored Rubric. When, who, what — never difficulty.

**Why:** Checkpoint was rendered by the navigation bar and the manifest from the day they were
written, and defined nowhere. An undefined slot gets filled by whatever the Session felt like
putting there, and "a harder exercise" is the obvious wrong answer: difficulty does not
distinguish instruments, timing and judge do.

**Held from decision 8:** the Assignment stays loosely specified. What is fixed is its place on
the ladder, not its shape.

## 19. Material only some Sessions reach sits behind a pointer

**Decided:** first-run setup moves to `FIRST-RUN.md`; tutor installation, operation and
troubleshooting move to `TUTOR.md`. `SKILL.md` keeps a pointer to each and exactly two tutor
facts inline — that the learner's logged questions are read during the boot sequence, and that a
lesson must stay fully readable with the service stopped.

**Why those two and no others.** They are the only tutor facts that change what the Teacher
*does*. The question log is a teaching judgement: three questions about one paragraph means the
lesson is wrong. The offline constraint binds every page the Teacher authors, and a page written
against a running service is broken in a way nobody notices until the service is down. Everything
else — ports, pids, start commands, the troubleshooting order, why the tutor is stateless — is
read on installation or on failure, and on no other session.

**Why this is a correctness fix rather than tidying.** First-run setup fired on roughly one
session in twenty and occupied about fifty inline lines under a top-level heading. Reference that
should have been disclosed does not merely take up room: it buries the steps beside it, and turns
attending to them into a coin flip. The variance is the defect. This is the same argument
decision 16 made about ordering, applied to volume.

**Rejected:** sibling skills for the disclosed material. The skill is user-invoked (decision 6),
so autonomous discovery buys nothing and would cost permanently resident context. Plain files
reached by pointers are also what a Teacher already knows how to follow.

**Rejected:** keeping the tutor's design rationale inline as orientation. A Teacher that reads
*why* the tutor is stateless behaves no differently from one that does not; it is a maintainer's
question. It lives in decisions 4, 5 and 7, and the skill points at the operating instructions
instead.

**Consequence:** `tests/disclosure.test.js` fails a `SKILL.md` that names the tutor anywhere
outside those two facts and a pointer — so the runbook cannot drift back a paragraph at a time,
which is how it arrived the first time.

**Sharpened by review, which broke the first version of that check.** Classifying a line as "a
pointer" forgives everything else on it, so a claim riding beside a `](./TUTOR.md)` passed — and
a line *budget* did not catch it either, because folding a claim into an existing line leaves the
count unchanged. A line naming the tutor in its own prose must now fit in 90 characters: room to
point, no room to claim. The budget stays, for a different failure — accumulating signposts.

**Found while doing it:** removing eight headings left every `](#anchor)` in the document set
unverified. A link at a disclosed heading still resolves as a *file*, so the existing pointer
check was perfectly happy while the reader landed at the top of a long document. `pointers.test.js`
now resolves the fragment too — and the slug rule that does it was wrong on first writing, in a
way that inverted the check: collapsing a run of spaces rather than hyphenating each one rejects
the correct link at `Tier 4: Retention & Review` and accepts the broken one.

## 20. The main document holds decisions; authoring is reference behind a pointer

**Decided:** Unit authoring — the forms a Lesson, an Exercise, a Checkpoint and an Assignment
take, the page conventions, the Component catalog and the navigation rules — moves to `UNIT.md`.
The four format specifications move into `formats/`. What stays in `SKILL.md` is the Boot
sequence, the judgement criteria every Session uses, the teaching steps, the Session-end
criterion, and the pointers out.

**Why:** the same variance argument as decision 19, applied to the largest block left. Authoring
material is read at one step of the teaching loop, by a Session that has already decided what to
teach; sitting inline, it was read by every Session on the way to the criteria it came for. The
split is by *when the material is reached*, not by subject — which is why the Component catalog
travels with the page conventions rather than staying beside the pedagogy that motivates it.

**Rejected:** a document per artifact — a Lesson document, a Checkpoint document, an Assignment
document. A Session writing a Unit reaches all of them in one sitting, so the split would cost
four pointers and buy no reduction in what anyone reads.

**Also removed: the Workspace file map.** It listed what a Workspace contains, which is the
scaffold's list (decision 17) spelled as destinations rather than as sources, and every file on
it is named where it is used — `RESOURCES.md` under knowledge, `CURRICULUM.md` in the Handoff
floor, `lessons/` in the authoring document. Nothing failed when it drifted, because the check
that forbids restating the scaffold's list reads only the `templates/…` spelling; that gap is
recorded in `docs/agents/tests.md`.

**Consequence:** `SKILL.md` drops by roughly two thirds, to a little over 180 lines. The ticket
asked for around 150, and the gap is worth naming rather than hiding: that target was set against
the document as it stood *before* the pedagogy was absorbed into it, and this ticket's own
criteria keep that pedagogy inline as the judgement criteria every Session uses. What is left is
the Boot sequence, the Unit, the teaching loop, the judgement criteria, the ladder and the
Session-end criterion. Cutting further means cutting one of those, which is a different
decision.

**Found while doing it:** the pointer check could not see a Markdown link whose text wrapped
before its target. Neither raw line is a link — the opening bracket is on one and the parenthesis
on the next — so a renamed heading left a broken anchor and nothing failed. The extractor now
reads logical lines, the way the disclosure checks already did.

## 21. A Session ends on a verifiable outcome

**Decided:** "stop deliberately" is replaced by a criterion the Session can evaluate — *the next
Session can resume from the Workspace alone, without asking the learner anything* — backed by a
floor of Handoff actions: the Learning Record written, the progress marker moved and the next
Unit named, preferences and any Mission change recorded, every file reachable from the Dossier,
and the learner told where the next Session starts.

**Why:** the old bound could not be evaluated by the agent it bound. A Session that stopped for
any reason at all can report that it stopped deliberately, so the instruction constrained
nothing while reading as though it did — and the next Session booted onto whatever state was
left. The replacement is checkable before stopping, by the cheapest possible test: walk the Boot
sequence as if you were the next Session and count the questions you would have to ask.

**Why a floor as well as a criterion.** The criterion alone is a judgement about a hypothetical
Session, and an optimistic Teacher will pass itself. The floor names the artifacts the next Boot
sequence actually reads, so the two halves check each other: the floor is concrete enough to
audit, and the criterion catches whatever the floor did not anticipate.

**Consequence:** `skill-spine.test.js` fails a `SKILL.md` that says "stop deliberately" anywhere,
and fails a Session-end section whose floor does not name the Learning Record, the Curriculum
marker, `NOTES.md` and the Dossier.

## 22. The catalog is indexed by teaching act, and promises only what ships

**Decided:** the Component catalog becomes a selection guide read from the left: a column of
teaching acts — *confront an intuition*, *walk one process through its stages*, *let the learner
run the thing being taught* — each routed to what to reach for and to whether it is shipped or
built here. The four shipped Components keep a table of their own, with their file paths. Nothing
the plugin does not ship is named as a file.

**Why:** the catalog was indexed by underlying library and stacked into five tiers, so a Teacher
arriving from "I need to show how `fork` works" had to read a shelf of tools — GSAP, Rough.js,
vis-network, Pyodide, sql.js, p5.js, Three.js — and work backwards to its own question. Selection
by library is selection by appetite, which is the failure decision 3 exists to resist.

**Why the filenames had to go with it.** Sixteen of the twenty rows named a file — `scrolly.js`,
`flashcard.js`, `network-graph.js` — and none of those files exist. Decision 14 made the bare
filename a *convention* meaning "build this on demand", but a convention that has to be explained
is not what an agent reads: it reads a filename, and a Teacher that believes a file exists does
not write it. A row now names the teaching act and says who provides it, so there is nothing left
to misread.

**Rejected:** keeping the tiers as an interactivity budget. Tier order read as escalation — higher
tier, more impressive — which is the opposite pull from the one the guide should exert. What the
tiers were carrying that was worth keeping, *subjects differ in how much of this they earn*, is
one sentence under the table.

**Rejected:** keeping the CDN quick reference. It was the library index in another form, and the
one version it pinned was `roughjs@latest`, which is a Lesson that breaks on a day nobody chose.
What survives is the rule: pin the version, and wrap the library behind the teaching act.

**Consequence:** `disclosure.test.js` looks for a Component's `Deps:` declaration where it used to
look for `Tier N` — the authoring vocabulary tracks the document, and a pattern the document no
longer uses fails the guard rather than quietly matching nothing.

## 23. The split is "does this vary by subject?", and the Workspace links rather than copies

**Decided:** everything that does not vary by subject — the server, the control script, the role
definition, the in-page widget, the nav bar, the page bootstrap, the shared styles, the four
Components — lives in `skills/explorable-teach/runtime/` and a Workspace holds a **symlink** at
each. What does vary — the subject tuning, the course manifest, the Dossier, subject-specific
Components, every Lesson and record — is copied in once and is the learner's from then on. The
scaffold re-points every link on every run, so a Workspace follows the plugin across an upgrade.

**Why:** twelve Workspaces held twelve forks of the same server, so fixing a Tutor defect fixed it
in none of them — only in Workspaces created afterwards. That is the whole of the defect. Decision
14 had already made the argument for the four Components ("twenty copies of them across twenty
workspaces is twenty places for the same bug to live") and then settled for copying them anyway.
This finishes it.

**Rejected: serving the plugin's copies and putting nothing in the Workspace.** This is the
literal reading of the ticket, and it breaks a rule the project has held since decision 7: a
Lesson must work with the service stopped, and stopped is the normal state. With no files in
`assets/`, double-clicking a Lesson opens unstyled prose with no nav bar — which is precisely
user story 1, the dead-stylesheet defect, arriving by a new route.

**Rejected: copying, but overwriting a plugin-owned file when it differs.** A fix would land at
the next Session's Boot sequence rather than immediately, which is close enough. What ruled it out
is that it keeps N copies on disk and adds a rule about when to clobber them — the "never
overwrites" promise stops being a promise and becomes a promise with a footnote.

**The symlink is not free, and the cost is worth naming.** Writing to
`<workspace>/assets/style.css` follows the link and rewrites the plugin's copy — every other
learner's course with it. It happened during this change: a test wrote a fixture value to
`tutor/ROLE.md` and silently replaced the shipped role prompt. `Workspace.write()` now unlinks
before writing, and `UNIT.md`, `TUTOR.md` and the Tutor's README all state the rule for the
Teacher: never edit a linked file in place, write a new one beside it. Nothing enforces that
mechanically, which `docs/agents/tests.md` records as a known gap.

**The server also falls back.** A static request under `/assets/` that the Workspace cannot answer
is tried against the plugin's `runtime/assets/`, with the same normalisation, containment check
and extension allowlist applied to each root independently. Belt and braces rather than
redundancy: a Workspace copied to another machine has dangling links until the next scaffold run,
and over http it should still render. The rest of the Workspace does not fall back — `lessons/`,
`learning-records/` and submissions are the learner's, and the plugin has nothing to offer there.

**And the server now bounds the bytes, not only the path.** Review caught this and it is the one
place where "the security posture is unchanged" was not quite true. The static check is lexical,
and `stat` and the read stream follow links — which was harmless while no file in a Workspace was
a link, and stopped being harmless the moment escaping links became the design. A file is served
only if its real path is inside the Workspace or inside the plugin's assets, so the scaffold's own
links are followed and any other link out is refused. Unchanged in kind; the guarantee the old
code got for free now has to be asked for.

**The Boot sequence scaffolds every Session, not only a bare Workspace.** Also from review, and
the finding that mattered most: the links are absolute and are re-pointed only when the scaffold
runs, so a step that fired only on an empty directory would have stranded every existing
Workspace on the version of the plugin it was born under — the exact defect this decision exists
to remove, arriving by a new route. The script has been safe to re-run since decision 12; now it
is run.

## 24. One role definition, in two halves

**Decided:** the Tutor's role is one file in the plugin's runtime, linked into the Workspace at
`tutor/ROLE.md`, plus `tutor/TUNING.md`, which is the Workspace's own and is appended after it.
The service composes the two into one system prompt; `.claude/agents/tutor.md` is pointed at the
same two files in the same order and reads them itself.

(Both paths are the scaffold's to name, so this entry does not spell them — `TUTOR.md` is where a
Teacher reads them, and the script is where they are true.)

**Why:** decision 5 said "each workspace tunes its own `ROLE.md`", which made the whole role
subject-specific — so every improvement to how a Tutor answers was stranded in the Workspace it
was written in. Splitting it keeps decision 5's point (a Tutor for Shell and a Tutor for music
theory are not the same role) while moving the nine tenths of that file that are the same for both.

**Why the subagent holds no role text.** It could have carried a copy of the shared definition,
and then there would be two documents to keep in step and one of them would drift — which is the
defect this project keeps finding under different names. It carries a pointer and the one genuine
difference: the service pre-reads `NOTES.md` and `MISSION.md` into the payload, and a subagent has
to read them itself.

**Order matters and is asserted.** Tuning comes after the definition it tunes, so a subject can
sharpen the shared rules rather than being overridden by them.

**Found while doing it:** the server read its role prompt from `__dirname`, which was the
Workspace's `tutor/` directory and is now the plugin's. Everything else it reads — the inlined
context, the question log, the Lessons, the agent's working directory — had to start coming from
an explicit Workspace argument instead. The control script passes it; run by hand, the server
falls back to its working directory, which is what keeps `node tutor/server.js` working from a
Workspace root.

## 25. A Tutor answer is rendered into nodes, by a renderer that takes its nodes as an argument

**Decided:** the in-page drawer renders a Tutor's Markdown as rich text through
`assets/rich-text.js`, which converts source text into a node tree and takes a node factory
rather than reaching for `document`. Both paths that show an answer — the stream, and a pinned
answer read back into the Lesson — go through one function in the drawer, which calls it.

**Why at all:** every answer was inserted as plain text, so a code block, a list and a sentence
arrived as one run of characters. On any subject involving code that is most of the Tutor's
usefulness gone.

**Why no library.** A Markdown library plus a sanitiser is two dependencies for a plugin that
has none, in the one place on the page where generated text is turned into a document. The
renderer is a few hundred lines and its whole security argument is structural: the only nodes
that exist are the ones it builds from a fixed set of tags, so there is no markup-parsing step
to get wrong and no sanitiser to fall behind. A link is the one place the source decides an
attribute, and a destination that is not `http`, `https` or `mailto` stays in the answer as
text.

**Why a node factory.** This is the testability-driven interface choice: taking `{ element,
text }` as an argument is what lets the whole renderer run in a context with no browser in it,
which is where the inertness claims are checked. A renderer that could only be exercised in a
page is a renderer whose guards nobody exercises. It also made the second claim cheap — every
node came from the factory, so a spy sees all of them.

**A rejected alternative:** rendering only the fenced blocks, which is the smallest change that
answers the original complaint. It would have left lists and inline code collapsed, and would
have needed the same "find the fence" scan; the rest is one evening and is the part a learner
notices every answer rather than every third one.

**Found while doing it:** the drawer was untestable and the suite said so — `docs/agents/tests.md`
listed the in-page drawer as covered by nothing. The fixture DOM ran scripts against a
deliberately bare window, which is right for a Component and wrong for a drawer that stores
threads and reads a stream, so `Page.load` grew a `globals` option: named at the call site, so
the default stays bare. Driving it then turned up an ordering fact worth writing down — a thread
only gets an id when the drawer is opened, which a learner always does because the composer is
inside it, but a test that skipped the step found the answer was never persisted.

## 26. The wait is reported in three stages, out of events the service already sent

**Decided:** an in-flight question reports *accepted*, *reading* and *answering*, with an elapsed
clock; the middle stage is driven by the `tool` events `server.js` has always emitted. No line of
the service changed.

**Why:** pressing send produced an empty bubble and a blinking caret for the several seconds the
agent takes to start and read. A caret says "something is happening" and nothing else, so a slow
answer and a hung one looked identical — and the learner's only move was to wait and find out.

**The events were already there.** The service emits one `tool` event per Workspace read, and the
drawer drew them as decorative chips beside the answer. The information the learner needed was on
the page the whole time, in a form that answered a question nobody was asking. The fix was to
read them, not to send more.

**The three are an order a request usually passes through, not one it is held to.** The events do
not arrive in that order: a Tutor writes a sentence, goes and reads another Lesson, then writes
more, which the service emits as `open, delta, tool, delta` — the sequence `tutor-server.test.js`
already pinned. So the row reports what is happening now rather than how far the request has got.
A monotonic version was written first and rejected on the case that matters most: mid-answer, the
text stops growing, and "reading `0002.html`" is the thing that stops a pause from looking like a
stall. The rejected version passed a test that bundled the events into one chunk, which is how it
got as far as being rejected rather than shipped.

**Why the stop button lives in that row.** The row exists exactly as long as the request does, so
putting the stop there makes "an in-flight request can be stopped, a finished one cannot" a
structural fact rather than a rule someone has to maintain. Stopping is just letting the stream
go: the service already kills its agent when the request closes, so there is nothing to tell it.

**Why a failure ends in two buttons.** It used to end in `连接老师服务失败：` plus whatever string
came back, which is a dead end dressed as an explanation. It now ends in the two things a learner
can actually do — ask again, or take the well-formed prompt to another tool, which is the offline
fallback that already existed — with the raw detail kept underneath rather than in place of them.
A transport failure also re-probes health, so the widget's claim about the service matches what
just happened to it.

**Superseding part of 7:** decision 7 said the service is started by hand and the page must work
without it, and that stands. What did not stand is how the page said so: it probed once at mount
and told the learner to start the service *and reload*. Offline was the one state the page could
not get itself out of, which made a design decision look like a defect. It now polls while
offline and stops the moment it is online.

## 27. A Checkpoint is a shipped Component, and it passes only on all of them

**Decided:** a Checkpoint is a page of its own at the end of a Unit — `0003b-checkpoint.html`
beside `0003-fork-exec.html`, carrying the same `data-unit` — built out of ordinary Exercises
and gated by `assets/checkpoint.js`, which the scaffold links into every Workspace like the four
Components that came before it. It passes when **every** question is right, and there is no pass
mark to set.

**Why a Component rather than a page convention.** Decision 18 put the Checkpoint on the ladder:
judged by the page, at the Unit's end, measuring whether the Unit may close. The first two were
already true of a page of Exercises — each one judges itself as it is answered. The third was
not: three green Exercises and a red one is a set of four verdicts, and *may we move on?* is one.
Leaving the Teacher to write that verdict per Unit would have made the gate as good as whichever
Session wrote it, which is the failure mode an undefined slot produces and the reason Checkpoint
was named in the navigation bar and defined nowhere.

**Why all of them, rather than a threshold.** A gate with a pass mark is a score, and a score
answers a different question. The knob would also have been the wrong seam: the decision worth
making is *which questions belong in this gate*, and a threshold lets a Session avoid making it
by adding a question it is willing to see failed. So a question that could be got wrong while the
Unit still closes is one that belongs back in the Lesson as an Exercise.

**Why it reads its questions rather than being told by them.** The Checkpoint listens on its own
container, where an Exercise's own click arrives on its way up, and reads the state the Exercise
has already recorded on itself. Neither file names the other's internals, so the Exercise stays
the same Component it was for a Lesson — which is what the ladder already said it was, an
instrument distinguished by when it fires rather than by what it is made of.

**What review caught, and why it is recorded here.** The check that the unreachable slot stays
*visible* read only the first stylesheet rule naming it — the rule it shares with the links beside
it — and counted that rule's `transition: color` as the colour making it visible. It passed
against a slot styled `display: none`, which is the single thing it exists to catch. A check that
reads the first of several rules is not a weaker check; it is a check of something else.

**Consequence:** the navigation slot that had been rendered since the bar was written finally
resolves, and `nav.test.js` holds both halves of it — a Unit with a Checkpoint links to it and
back, and a Unit without one shows the slot as unreachable rather than dropping it. The fixture
Lesson became a fixture *Unit* of two pages, which is what a Unit was already defined to be.

## 28. A Submission is evidence, and the Grader reads it where it already is

**Decided:** an Assignment page carries a hand-in built by `assets/assignment.js` — a short-answer
box, and a box for paths into `submissions/`. Pressing the button hands the composed Submission to
the in-page drawer, which asks the same `POST /api/ask` in a second role. The Rubric rides in the
page as a `<script type="application/x-rubric">` block, which is never rendered and never sent.
The verdict streams back into the page, can be questioned there, and is written into
`learning-records/` as a numbered record before the page is told the answer.

**Why evidence rather than the work.** The obvious design is an upload: a file input, a multipart
endpoint, a directory the service writes into. Every part of that is a boundary this plugin does
not currently have — the server writes exactly two things today, both inside `learning-records/`,
and the agent it spawns is `--restricted` and read-only. A path into the Workspace buys the same
outcome with none of it: the Grader's working directory *is* the Workspace, so opening
`submissions/0003-pipes/notes.md` is one `Read` away, and a submission of any size costs the same
2000-character request as a one-line answer. Decision 23 already put `submissions/` on the
learner's side of the split; this is the first thing to use it.

**Why the Rubric is stored and not sent.** Both would work on the day they are written. They
differ when the page and the request disagree: a Rubric riding the request is whatever the client
decided on, and a Rubric on disk is what the Session actually wrote. Decision 8 made "the rubric
travels inside the assignment file" the one hard rule about Assignments precisely so that *any*
future Grader can judge without the context that set the task — and a Grader handed its criteria
by a page is being judged-by-proxy by whoever last edited that page. So the payload names the file
and the block to look for, and nothing else. A Grader that finds no Rubric there is told to refuse
rather than improvise, and the Component refuses to render a hand-in at all — a task nobody can
grade should not collect work.

**Why a `<script>` block.** It has to be invisible to the learner and trivially findable by an
agent reading the file. An HTML comment is findable and fragile to delimit; a sibling `.md` file
drifts from the task, which is the thing decision 8 exists to prevent. A `<script>` of an unknown
type is never rendered and never executed, sits inside the element it belongs to, and greps in one
line.

**Why the same transport, and a second role rather than a second service.** Everything around an
answer — the thread, the three stages of the wait, the stop, the retry, the clipboard fallback,
the question log — is the same work whoever wrote it. `ROLES` was written as a map with a
`// Future: grader` comment in it; this is that entry. What is genuinely different is one role
file and one payload, so that is all that is different. A thread now carries its role, which is
what makes a follow-up about a verdict reach the Grader that gave it rather than the Tutor.

**Why the verdict becomes a Learning Record.** The question log is feedback about the *page* —
three questions about one paragraph means that paragraph is wrong. A verdict is evidence about the
*learner*, which is the other file, and the one the Boot sequence plans from. Writing it there is
also the only way the loop closes without the learner: an Assignment is done between Sessions, so
the Session that set it is gone and the Session that would have written the record has not started
yet. The record is written before `done` is sent, which is what lets the page name where it landed
rather than assert that it did. A follow-up writes nothing — it is a conversation about a record,
not a second one.

**Why grading never runs as the Teacher.** The ladder already said so; what makes it structural is
that the Grader composes `tutor/GRADER.md` plus `tutor/GRADER-TUNING.md` and nothing else. The
Tutor's two halves are in the same directory, one file away, and composing either of them in is
exactly how "the Session that wrote the Assignment grades it" would come back by the side door —
so `tutor-server.test.js` asserts their absence, not only the Grader's presence. The tuning files
are separate for the same reason: what a Tutor should say and what counts as done are different
questions, and one file answering both is a Tutor being asked to mark.

**Why `submissions/` is placed rather than merely created.** The acceptance criterion was that
submissions are not excluded from version control, and the instinct it guards against is real —
scratch work looks like something to ignore. But an empty directory is one git never records
either, so the scaffold puts a README in it. The check is run through `git check-ignore` against
real files rather than by reading ignore patterns, with a `.gitignore` written afterwards to prove
the check can see an exclusion when there is one; `*.log` would otherwise have swallowed half of
what a submission is made of, silently.

**A refusal is not a verdict.** The grader is told to refuse when the assignment stores no rubric,
and to open that refusal with a fixed line. The service watches for it and writes no record — the
same arrangement as the transcript heading the tutor's role file promises, a short contract between
two files the plugin owns. Without it the honest refusal `GRADER.md` mandates would land in
`learning-records/` looking like a judgement, and the boot sequence plans from those: a record
asserting a verdict that was never reached is worse than no record. For the same reason the record's
Evidence line states provenance — which page, which submission, when — and no longer claims which
criteria were applied, because nothing here can check that.

**Two things left deliberately loose.** A second hand-in writes a *second* record rather than
replacing the first: what a learner could do in March is what makes a judgement in May mean
anything, and an overwrite would quietly delete the comparison. And the paths box refuses only what
escapes the workspace — absolute paths, `..`, URL schemes — rather than confining evidence to
`submissions/`. That directory is where evidence belongs and every piece of prose says so, but a
learner pointing at a lesson they annotated or a sheet in `reference/` is doing something
reasonable, and the grader could read either of those anyway: its working directory is the
workspace and it is read-only, so confinement would buy no safety and cost a legitimate move.

**What review caught on the way.** The rule that a Component may only hide what it has taken over
was read by a stylesheet reader that took the *first* `{` in a block as the selector. Inside an
at-rule there are two, so it reported `@media print` as the selector and never saw the rule
underneath — which failed the first correctly-scoped print rule a Component ever had. Wrong in the
safe direction, and invisible until a Component needed one: the reader now takes the last `{`, and
is guarded on a scoped rule written inside an at-rule.

Review also caught the offline fallback inviting the one thing this decision forbids. The copied
prompt ended "use the `grader` subagent, *or answer as a grader yourself*" — and the session it is
most likely to be pasted into is the teacher that wrote the assignment. The alternative is gone;
the prompt now names the subagent and says not to grade it yourself. Worth recording because it is
the shape the mistake takes: the rule was enforced everywhere the code runs and then given away in
a sentence addressed to a reader.

## 29. The skill carries the whole pedagogy, rather than pointing at the skill it grew out of

**Decided:** every pedagogical rule this project runs on is stated in this project's own words
inside `skills/explorable-teach/`, and no document under that directory names the project it grew
out of — Matt Pocock's `teach` skill. The acknowledgement moves to the README, where a human reads
it and no agent depends on it. (`242ef11`)

**Numbered here, decided earlier.** This one belongs between decisions 15 and 16 by date — it
landed before the Unit was named — but the entries are numbered in the order they were written
down and a dozen later entries refer to their neighbours by number, so inserting it in its
chronological place would renumber the references that hold the chain together. The record grows
at the end; time is what the commit hash is for.

**Why:** `SKILL.md` had been written as a diff against another author's skill. One heading named
seven pedagogical topics — reference documents, the Mission, the zone of proximal development,
knowledge, skills, wisdom, and recorded learner preferences — and its body said, in full, that the
rules were the same as that skill's. Those seven are the back half of the pedagogy. An agent
running this skill has no way to open the other one: the pointer was a filesystem path into a
plugin cache, with a version number in it that changes on upgrade.

**Why it was invisible.** That plugin was installed on the machine this was written on, so the
Teacher there could stumble into reading it and often did. The plugin therefore worked for exactly
one person and read as though it worked for everyone — which is the same shape as decision 13,
where correct behaviour turned out to depend on whether auto-memory happened to be populated. A
defect that cannot reproduce where it is being worked on is the kind that ships.

**Rejected: keeping the pointer and telling the Teacher to read that document if it is there.**
This is the smallest change and it preserves the defect exactly. Behaviour that varies with what
else the learner happens to have installed is the problem; making the variance conditional and
explicit documents it rather than removing it.

**Rejected: declaring a dependency on the other plugin.** There is no mechanism for one plugin to
require another, and inventing one out of prose — "install this first" in a README — puts a
teaching session's correctness on an install order nobody verifies. It would also tie this
project's upgrades to someone else's release schedule for material that is by now edited well
away from where it started.

**Rejected: vendoring that document into this plugin.** Copying it in would have satisfied the
letter of self-containment in an afternoon and left a second copy of someone else's document to
drift against its original — the defect this project keeps finding under other names (decision 14,
decision 24). Absorbing it means the passages are now *this* project's to edit, which is what the
rest of the rebuild then did to most of them.

**Also removed: the meta-commentary.** Lines like "this deliberately overrides the upstream skill"
are behaviourally inert — a Teacher that reads one behaves exactly like a Teacher that does not,
because the rule beside it already says what to do. They were notes from one author to another,
sitting in a document read by neither.

**This is the expand half of an expand–contract.** The document grew by absorbing what it had been
deferring, and grew past what any one Session should read; decisions 19 and 20 are the contract
half, and they could not have run first. What is disclosed behind a pointer has to exist in this
repo before it can be moved.

**Consequence:** `decoupling.test.js` reads every file under the skill and fails a line that names
that project — by name, by author, by a "same rules as" deferral, or by a path into a plugin cache
— so the decoupling is enforced rather than merely done. The check is guarded from both sides:
every reference this repo actually carried must still be recognised, and sentences naming
`explorable-teach` itself must still be ignored, because `teach` is a verb this repo uses in
almost every paragraph. The README is checked for the opposite thing. What the rebuild removed is
the runtime dependency, not the debt.

## 30. Language is decided by who reads the string, and the page carries the answer

**Decided:** every string this project ships is either Maintainer-facing or Learner-facing, and
the test is whether the Learner would ever see it — not what the string eventually becomes.
Maintainer-facing text (role definitions, prompt scaffolding, the runtime README, comments,
server logs) is English in every Workspace. Learner-facing text (drawer chrome, Component
labels, the Tutor's and Grader's prose, anything a failure puts in front of them) is produced at
run time from `document.documentElement.lang`, against a table the plugin ships for `en` and
`zh-CN` and a Workspace may override at `assets/strings.js`. A Workspace sets the language once,
in `units.js`; `lesson-boot.js` writes that onto the document when a page did not set it itself,
and `wire-lessons.sh` fills it in on the pages it already rewrites. Absent everything, English.

**Why the split is by reader rather than by file.** The obvious line is "role files are English,
the drawer is the Learner's", and it does not survive contact with `server.js`, which holds
English comments and Chinese prompt scaffolding in the same function. Reader is the only cut that
lands cleanly on every string in the repo, including ones nobody has written yet. It settles the
one genuinely ambiguous case — prompt scaffolding — as Maintainer-facing, because what makes an
agent's *answer* Learner-facing is an instruction it is given, not the language the scaffolding
around it happens to be written in. Models are multilingual; the scaffolding is read by whoever
next edits it.

**Why `<html lang>` rather than a config file or the request.** Three candidates. A config file
the service reads is server-authoritative, which is this repo's usual instinct, but it is absent
over `file://` — and `file://` is exactly the path where the drawer has to build a prompt by
itself. The request body is what decision 28 warns against for the Rubric. `lang` was already
mandated on every page by `UNIT.md`, is a standards attribute that has to be correct anyway, and
survives with no service running. The distinction from decision 28 is worth naming: a Rubric
riding the request changes *what a verdict is*, so a client that lies about it corrupts the
record; a language changes only what the client renders, so a client that lies about it
mistranslates its own screen. Those are not the same risk, and only the first earns the
server-authoritative treatment.

**Why the Workspace sets it in `units.js` and not per page.** `<html lang>` stays the authority,
because Components should read one thing and the browser reads it too. But a per-page attribute
is a discipline, and a discipline that is forgotten fails silently: a Chinese Learner would get a
screen of English with nothing erroring. `units.js` is the one file every page already loads —
lessons through `lesson-boot.js` before any Component, the Dossier directly — which makes it the
only place a Workspace-wide default can live without inventing a new load path.

**Why the plugin ships `zh-CN` as well as `en`.** Decision 23 puts what does not vary by subject
in the plugin. What a Submit button is called varies by neither subject nor Workspace — only by
language — so translations belong in the plugin by that rule alone, and a Workspace table is the
fallback for a language the plugin has not collected yet. The payoff is larger than the rule: the
pilot Workspace holds symlinks, so it picks up the rewritten Components the moment the plugin
updates, and shipping `zh-CN` is what makes that a change it never notices. No migration step,
and `assets/strings.js` merely arrives on the next scaffold run.

**Why the offline prompt is the one exception.** With the service down the drawer composes a
prompt for the Learner to copy into Claude Code. By the rule above it is scaffolding and would be
English — but its recipient is not a subprocess, it is the Learner, who reads it, may edit it,
and then sends it. Handing someone a wall of English to check before sending defeats the whole
fallback. The rule is unchanged; this path is what moves the text onto the Learner's screen.

**Why the suite asserts through a pseudolocale.** Scanning shipped files for non-ASCII catches
Chinese creeping back and nothing else — a hardcoded English `'Passed'` breaks the split just as
badly and passes the scan. Mounting every Component under a synthetic `lang` whose table holds
only sentinels, then asserting the rendered tree contains nothing outside the sentinel alphabet,
catches any hardcoded string in any language and never has to be rewritten when a language is
added. Both checks ship: they fail on different things. Per the observer rule, the pseudolocale
check first asserts that sentinels appeared at all.

**Refined while building it (#17).** Two things this decision states turned out to need saying
more precisely, and both are visible in the code rather than only here.

The lookup chain above reads "Workspace override → the plugin's table for the exact tag → the
plugin's table for the base language → `en`", which leaves open which rung a Workspace override
is consulted at. It is consulted at *every* rung: override then plugin for the exact tag, then
override then plugin for the base language, then for `en`. The four steps listed still happen in
the order listed; what is added is that a Workspace supplying `ja` does not have to guess whether
a page declaring `ja-JP` will find it. Truncation is unchanged, and `zh-TW` still reaches English
rather than `zh-CN`.

And the tables the plugin ships live at the head of `lesson-boot.js` rather than in a file of
their own. "No migration" is what forced it: a Workspace holds symlinks, so a file the plugin
*newly adds* does not exist there until the scaffold next runs, while a file already linked
follows the plugin the moment it updates. A shipped table in a new file is therefore a table an
existing Workspace cannot reach — and the drawer, whose own link had updated, rendered its keys
on screen. `assets/strings.js` is unaffected: it is the Workspace's own, placed rather than
linked, and its absence was always the harmless case this decision describes.

**Refined while building it (#18).** Carrying the Components onto the table turned up an
ordering the tracer bullet never met. A Lesson writes its Component tags *above* the one
bootstrap tag — `UNIT.md` has said so since the beginning, and `wire-lessons.sh` puts the
bootstrap last in `<body>` — so every Component runs before `lesson-boot.js` exists, and well
before `assets/strings.js`, which is the last table that can answer. A Component that rendered at
mount would therefore render out of no table at all, and a Workspace supplying a language the
plugin does not ship would meet a page of raw keys: precisely the case `assets/strings.js` exists
for.

So a Component hands its mount over instead of running it, onto a bare global array, and the
bootstrap runs what is waiting one step after `strings.js` — before the bar, the renderer and the
drawer, which it already loads in order. The queue is a bare global rather than something the
bootstrap owns because it has to exist before the file that owns it does. A page with no
bootstrap tag now mounts nothing, which is the same page a Learner with scripting off reads:
plain text, in order, all of it there. That is the promise every Component already made, so
nothing was lost by making the bootstrap load-bearing for mounting as well as for text.

The other thing worth naming is what a Component is *answerable* for. A Checkpoint reveals one of
two verdicts its author wrote — *which* passage to go back and read is a sentence about one Unit
and nothing else, and no table could hold it. It is in the Learner's language because the whole
page is. What the Component adds beside it is the score, and that comes off the table. The
pseudolocale check draws that line by subtracting what the page said before anything ran, so it
never has to name a selector, and a Component that replaced an authored sentence with one of its
own still fails.

**Refined while building it (#19).** Four things the service taught this decision, none of which
change what it decided. Two of them revise the **Consequence** below rather than the decision
itself: the slug's class gained one more category, and three of the four consistency checks that
paragraph names are in place — the fourth, the refusal token, could not land until the role
definition that mandates it was translated, and landed with it under decision 31.

The language rides the request as *one* directive, appended after whatever the role built rather
than woven through it — both roles then get the same sentence from the same place, and a payload
naming the language twice is a payload with two things to keep in step. The tag is bounded to
what BCP-47 may hold before it is interpolated: it is the one field on the request a page decides,
and it reaches a prompt.

A failure divides in two, and only one half is the service's to name. The agent never starting and
the agent never finishing are the service's, and they arrive as `timeout` and `agent-missing` for
the page to render out of the table. What the agent *said* when it failed is evidence about that
run rather than a string anybody chose, so it rides as `message` and is shown as it arrived. Where
the agent says nothing the service used to invent a sentence — `claude exited with code 3` — and
now writes that to its own log instead, because the log is where a maintainer reads and the
learner is told the same thing either way.

`\p{L}\p{N}` — the class the consequence below names — was not enough for the slug on its own. A
Devanagari name kept its consonants and lost
every vowel sign, because those are marks rather than letters — the same collision one rung
quieter, since two names differing only in their matras would land on one slug. Combining marks
are kept with the letters they belong to.

And "matches the documented Learning Record format" had nothing to match: the format document
described records a Session writes and said nothing about the one the service writes. It now
carries that shape — the title, the Evidence field keys, the timestamp — so the check reads the
document rather than a copy of the record made in a test.

**Refined while building it (#21).** Two things, once the scan could finally run over every file
the plugin owns rather than over the scripts alone.

**A seed is a third kind of string, and it needed a name.** The files the scaffold *copies* — the
Dossier, the course manifest's labels, the tuning placeholders, the subagent definitions, the
submissions guidance — are read by a Learner, so by this decision they are Learner-facing and
belong in a table. They are not in one, and should not be: a copied file is the Workspace's from
the moment it is placed, so it has no other Workspace to stay consistent with, and a table would
put a Teacher's own cover behind a lookup they cannot edit. They ship in English because the
plugin cannot know who it is about to be handed to, and the authoring guide says the Teacher may
rewrite them — including the `description:` line on each subagent, which is what a Learner reads
in the agent picker. The body of one of those definitions is prompt scaffolding and stays English
by the rule above. `CONTEXT.md` now carries **Seed** as the term.

**Which makes the scan two rules rather than one**, split on the same question decision 23 splits
a Workspace on: linked or copied. Widening the scan past the scripts was what exposed it — the
strict rule reads the `✅` a Dossier marks a finished Unit with as a finding, on the grounds that a
glyph in shared source is half a label whose other half belongs in a table. True of a linked file,
where the bytes are every Workspace's. Not true of a seed, which has no table and no other
Workspace, and where the only thing that must not arrive is somebody *else's* language. So a file
under `runtime/` keeps the rule exactly as it was, and one under `templates/` answers the narrower
question. Nothing was loosened for shared code, which is what the rule was written to guard.

The other half of the same edit is that nothing had told a first run to *record* the language at
all. `NOTES.md` is where it goes, which is where both role definitions already say to read it
from; the Boot sequence then reconciles `lang` in the course manifest against it, so a Workspace
scaffolded before the setting existed gains one without a migration step.

**Consequence:** the server keeps no Learner-facing string. Its stream errors carry a `code` the
drawer renders; the record it writes for a verdict uses ASCII field keys, because the Boot
sequence reads it. `slugOf`'s character class — `[^a-z0-9\u4e00-\u9fff-]` — was the same defect
without being a string at all: it collapses any Cyrillic, Arabic or Devanagari filename to the
constant `assignment`, so every verdict in such a Workspace would contend for one name. It
becomes `\p{L}\p{N}` under the `u` flag. Four consistency checks land in
`tests/language.test.js`, all *derived* rather than listed, per the rule against restating what a
source already owns: the refusal token out of `GRADER.md`, the error codes out of `server.js`,
the keys out of the Components, and `zh-CN` against `en`. Existing tests split three ways —
assertions that pinned labels move to keys, fixture prose becomes English, and a named handful of
non-ASCII *inputs* stays on purpose, widened to include a non-CJK script, because a pipeline that
mishandles bytes is the class of bug `slugOf` was.

## 31. A Grader refuses with a token, not with a sentence

**Decided:** `GRADER.md` requires a refusal to open with the ASCII line `CANNOT-GRADE:`,
whatever language the explanation after it is in. `server.js` matches that token to keep the
refusal out of `learning-records/`, and the drawer strips the line before rendering, so the
Learner reads clean prose. A test extracts the mandated token from `GRADER.md` and asserts the
server's pattern matches it. Revises the arrangement decision 28 left implicit.

**Why a token rather than a translated sentence.** The contract was `无法判定：`, written out
twice — once as the opening the role file mandates, once as a regex in the server. Translating
the role file without moving the regex in lockstep breaks it *silently*: refusals stop being
recognised as refusals and land in `learning-records/` as verdicts, and the next Boot sequence
plans from them. A record claiming a judgement nobody reached is worse than no record. An ASCII
token is the same contract with the language taken out of it, so a Workspace in a third language
does not get a third copy of the problem.

**Why the role file owns it and the server merely consumes it.** Two files still hold the string,
which is what the issue objected to. What changed is that only one of them is authoritative: the
token lives in `GRADER.md`, the server's pattern is derived from it in the test, and the pair can
no longer drift without going red. This is the same shape as the transcript heading the role
definitions promise they will receive — a short contract between two of the plugin's own files —
and the same shape `pointers.test.js` already enforces between documents and paths.

**Why not structured output.** Asking `claude` for JSON and reading a field would make the
refusal unambiguous and costs the whole SSE path: the answer streams today, and a verdict the
Learner watches arrive is decision 26's three stages working. One reserved line at the top of a
stream is parseable the instant it arrives and changes nothing else.

**Refined while building it (#20).** Three things, none of which changes what was decided.

The token strips as a *prefix* rather than as a whole line. A Grader told to put the explanation
underneath will usually do that, and a Grader that writes it on the same line instead should not
cost the Learner the explanation — so what comes off is the token and the whitespace to the end of
that line, at most one newline.

And the rule is about the first line of *any* answer, not of a Grader's. This paragraph said
"a Grader answer" because that is the only agent that can produce one, and the drawer does not
check: it runs where an answer becomes nodes, which is one function, and every path that shows an
answer goes through it — the stream, a thread restored from storage, a pinned answer read back
into the Lesson. Reaching for the thread's role there would buy nothing (the token is reserved, so
a Tutor opening with it is a Tutor breaking the same contract) and cost the property that makes
the seam trustworthy: that none of those three paths is a degraded version of the others.

**Whitespace before the token counts as opening with it**, and review is what found that. The
definition sets the token off as an indented block, because that is how a document quotes a line
to be reproduced exactly — so a Grader reading "character for character" literally sends the
indentation, and an anchored pattern would call that a verdict. The service survived it by
accident, on a `trim()` two hundred lines from the pattern; the drawer, which reads a stream as it
accumulates, did not. Both now allow the same slack and say so in the same words, which is what
lets one derived check hold both to one rule rather than to two that happen to agree.

The turn kept in the thread is untouched either way: a follow-up replays the refusal to the Grader
that wrote it, and the marker is the clearest thing in that replay saying what happened.

The third is what translating a role definition exposed rather than broke. Decision 30 put the
language directive in the *payload*, which is the service's path only — as a subagent, the Tutor
and the Grader had been answering in the Learner's language by the accident of the definition
being written in it, and English definitions would have quietly made English the answer. Each
definition now says where the language comes from: named outright by the request over the service,
read off `NOTES.md` as a subagent, English where nothing records one. That is a rule about where
to look rather than a second naming of a language, so the payload still names it once.

**Consequence:** the drawer gains a rule about the first line of an answer, which is the first
time it interprets content rather than rendering it. Kept narrow deliberately — it strips
one known token and passes everything else through untouched. Three checks now land on an edit to
the token in `GRADER.md` alone: the derived contract in `language.test.js`, the drawer's, and the
service's.

## 32. The entry point is the Dossier, under every address that names it

**Decided:** the Tutor service resolves a directory to its `index.html` and stops there. The
service root, the Dossier's own filename and every form that normalises to the same file all
return the Dossier. The shortcut that rewrote `/index.html` to the lowest-numbered Lesson is
deleted, and so is the helper that found it — there is no replacement route.

**Why the shortcut had to go rather than move.** `CONTEXT.md` defines the Dossier as *the
Workspace entry point*, and `UNIT.md` promises the Learner never needs to browse the Lessons
directory. The shortcut made that definition true on disk and false over http: the same course,
opened two ways, had two different front doors. It also took the navigation bar down with it.
The bar asks for `../index.html` from inside a Lesson, which is exactly right — and the service
answered with the Lesson the Learner was trying to leave, so the one control that exists to get
back to the Dossier was the one that could not. The report that found this said the *only*
address that worked was `//`, which is the tell: nothing was resolving the Dossier, one form
simply never matched the string being compared against.

**Why one click is the right price.** The shortcut bought a Learner landing on material rather than
on the Dossier. The Dossier already lists every Unit with a link to its Lesson, so what it actually
saved was a single click, and it charged the entry point its meaning to do it. A memorised address
should mean one thing.

**Why the fallback branch is not kept.** The helper returned the Dossier when no Lesson was
written yet, so an empty Workspace already behaved the way every Workspace now does. With the
rewrite gone that branch is unreachable, and an unreachable branch left in place is an invitation
to a future reader to rediscover it and wire it back up. Its test goes with it for the same
reason: it covered a fallback that no longer exists, so adapting it would have been writing a new
test under an old name.

**Consequence:** one test now covers the rule, over four addresses, and it derives the fourth by
mounting the navigation bar rather than restating what the bar asks for — the half that was never
wrong is the half a restated address would stop watching.

---

## 33. A page that cannot reach the Tutor says which of the two it is

**Decided:** both clients gain a third state. The in-page drawer, on a page the service did not
serve, says so in the Learner's language out of the shipped table — and offers no command,
because none would help. The Dossier gains the matching state and stops probing at all from such
a page; served, it probes a relative address. The service's API gains no cross-origin headers.

**Why two states were one too few.** The drawer had *online* and *offline*, and offline's hint
told the Learner to run the command that starts the service. On a Lesson opened from disk that
instruction cannot work, because the drawer talks to the service that served the page: a request
from `file:` names another origin and the browser refuses to make it. The Learner in the
originating report ran the command, twice, and nothing changed — the page had told them the one
thing that could not help. So "not reachable" splits into "not running" and "not reachable from
here", and only the first is waiting for a command.

**Why the Dossier stopped probing rather than started succeeding.** It probed
`http://127.0.0.1:4173/api/health` from a cover opened off the disk. The browser blocked it, the
cover read the block as a refusal from the service, and it reported a *running* service as
stopped — a collapse of "I cannot tell from here" into a false fact. Two ways out: open the API
to other origins, or stop asking a question this page cannot ask. Keeping the service's surface
closed is worth more than making a status message's fallback real, and the status message is
truer for saying it cannot tell. The hard-coded port went with the probe: served, a relative
address is right on every port, which the absolute one never was.

**Why the Dossier's text stays a hard-coded English Seed while the drawer's goes in the table.**
The drawer is linked from the plugin and shared by every Workspace, so a literal in it is one
Learner's language written into all of them — its text goes in the shipped table like every other
label it renders. The cover is copied: it is the Workspace's own from the moment it is placed, it
does not load the page bootstrap that carries the tables, and giving it access to them would make
the entry point depend on page infrastructure it deliberately does not use. That is a larger
architectural change than a status message warrants. `CONTEXT.md` already names this exception —
**Seed** — and the Teacher may rewrite the sentence in the Learner's language along with the
headings beside it.

**Consequence:** the suite grew a seam rather than a reading. The Dossier is mounted and driven in
the fixture DOM, served on a port nobody wrote down and with every request it makes recorded, so
"it asked nothing" and "it asked for an address that works on any port" are claims. It is
deliberately absent from the pseudolocale page set, and a check of its own says why, because an
unexplained absence there reads as an oversight. The API's lack of cross-origin headers is
asserted rather than left as something a later change could quietly undo.

**One line of the cover moved to let that seam exist**, and it is named here rather than left to
be found. The cover assigned its subtitle unconditionally — an empty splice when no subtitle was
written — and now assigns one only when there is one. Behaviour is identical for every Workspace,
because the template ships with the subtitle empty. What it buys is that the fixture DOM, which
refuses markup splicing so that no shipped Component can render text as markup, has nothing to
refuse on a course that has not written a subtitle. Bending shipped code to suit a harness is
worth saying out loud; this is the smallest form of it, and the splice that remains is the
Teacher's own authored HTML, which stays exactly as it was.

## 34. The offline ban becomes a list of what an author types

**Decided:** the authoring reference stops banning a technology — "`file://` compatible by
default, UMD or IIFE, never ES modules" — and carries instead the list of writing patterns that
actually fail when a page is opened from disk, beside the list of the ones that do not. A module
script or a `fetch` aimed at a sibling file, a dynamic import of one, a loader pointed at a
relative asset, a worker built from a relative path: those break. An image, a stylesheet, a
classic script, and anything at all aimed at a pinned https CDN: those do not.

**Why the ban was wrong rather than merely strict.** The boundary is what a URL points at, not
ES-modules-versus-classic and not CDN-versus-local. A page opened from disk has a null origin, so
every fetch it makes is cross-origin; a CDN answers with a permissive CORS header and passes the
check, while the file sitting beside the page answers with no header at all and fails it. The ban
was written to protect a property nobody had measured, and the measurement says it does not buy
it: almost every library a Lesson might want loads fine from disk, and almost nothing the ban
allowed was at risk. What it did buy was the absence of every interaction it forbade — a plotting
library, a layout engine, a physics engine, an in-page Python — so the only Lessons ever built
were the ones the shipped Components already made easy.

**Two consequences are stated because neither follows from the rule.** A local classic script may
carry neither `crossorigin` nor `integrity`, because either attribute opts a fetch that was not
subject to the CORS check into it — which is how adding a security attribute breaks a page. On a
CDN script the same two are worth having, and only as a pair: an integrity check cannot be run
against a response the browser handed back opaque, so `integrity` without `crossorigin` beside it
is a network error rather than a stricter page. And a
worker script may never be cross-origin on any scheme, so a library that spawns one is usable
from a CDN only when the library itself fetches the script and constructs the worker from a blob.
Both are invisible from "a relative URL fails", and both break a page that looks correct.

**The same claim was wrong in three other places, and all three are corrected.** `TUTOR.md` and
the service's own README said serving *lifts the `file://` restrictions* that gate Pyodide, sql.js
and ES modules. It lifts nothing of the sort: what serving buys is the in-page Tutor — the drawer
asks the service that served the page — and an origin, so the page may fetch its own files. The
README's claim that a lesson works from `file://` with no network described the shipped
Components rather than Lessons, and is scoped to them.

**The two rules stay different, and both documents say why.** The shipped Components keep the
no-network constraint, for a reason that is not offline capability: they are the same bytes in
every Workspace, so staying dependency-free is what keeps them small and what lets one fix reach
every learner at once. Only the rule addressed to the author of a Lesson is loosened.
`assets.test.js` is untouched and still holds the six of them to no network, no module syntax and
no fetch.

**Rejected:** keeping the ban and adding an exception for CDNs. That is the same closed list one
row longer, and it still answers the author's question — *may I use this?* — with a technology
rather than with something they can check their own page against. A rule an author cannot apply
is a rule they route around or over-obey, and this one was over-obeyed for the whole life of the
plugin so far.

**Consequence:** the degradation rule splits. A Component made of text goes on writing its
content into the markup and being taken over by script — that is how the shipped six already work
and it costs nothing. A Component that is a picture cannot satisfy that, and carries one
**stand-in sentence** instead: what would be shown and what it demonstrates. That sentence is
three things at once — what a Learner reads when no script ran, the accessible description, and
what the Tutor has to go on when the Learner asks about something it cannot see — which is why it
is worth a glossary entry rather than a line of advice. Alongside it, nothing that depends on the
network or on the service may fail silently: a page that needs one of them names which of the two
is missing, because the two have different fixes and a blank rectangle proposes neither.

**Consequence:** `from-disk.test.js` holds the claim rather than its placement. It is the first
suite here whose subject is whether a document is *right*: the ban may not come back in anything
that instructs, no document may sell serving on a restriction it does not lift, and the
authoring reference has to carry both halves of the list. It cannot check the browser behaviour
underneath — nothing here opens a page from disk — so what it defends is that the documents go on
agreeing with the measurement, and with each other.

## 35. The Teacher looks at the page, and the checks say where they lie

**Decided:** after writing a Lesson, the Teacher opens the served page in a browser and runs a
short set of checks — nothing complained, nothing failed to load, the canvas has something in it,
the animation is moving, nothing sits off the page, no label is covered or overlapping, the text
can be read against what is behind it — and takes a screenshot last, to judge appearance rather
than correctness. They ship as `scripts/page-checks.js`, named from the plugin root and installed
into no Workspace, because they do not vary by subject and they are the Teacher's tool rather than
page content. That is the shape the wiring script already has.

**Why now.** Decision 34 lifted the ban on reaching for a library, which was the thing that kept a
Lesson nearly impossible to break: a page with no dependencies rarely fails, and a Teacher could
hand one over having never opened it. A page that loads a renderer from a CDN and draws into a
canvas fails in ways prose cannot anticipate, and the Learner is the wrong person to find out.

**Deliberately light, and not a gate.** It catches a Lesson that is *broken*. It does not catch a
Lesson that is *wrong*, and it must not grow into something that tries to — every check added
costs every Lesson, and the subtler thing a check would have caught is what the Tutor sitting in
the page is for. The bound is what a browser session can do cheaply.

**The misreads are the deliverable, not a footnote.** Several of these checks report confidently and
wrongly under a condition that is known in advance, and a check trusted while wrong is worse than
no check: it sends the Teacher to fix a defect that does not exist, or signs off a page that is
broken. So the file's head comment carries, per check, the condition, the direction it misleads
in, and the field in its own output that reveals it — following the convention that a Component
documents itself in its head comment. Three are named because the pass was built around them.
A WebGL context created without `preserveDrawingBuffer` — which is the default — is read back
*cleared* once the frame has been composited, so a clear colour with any opacity to it reads
exactly like content and the canvas check passes falsely, while the two identical reads make the
animation check fail falsely: one cause, two directions. An overlay with `pointer-events: none` is
walked straight through by a hit test, so the occlusion check gets back the label underneath,
which is the answer a clear page gives, while the text is genuinely invisible. And a background
nothing in the page declares — a canvas painted underneath, an image, a gradient — leaves the
contrast check assuming white, which misleads in *both* directions and is worst on exactly the
dark-themed and canvas-backed pages decision 34 licensed.

**Two hazards are the browser's rather than the page's**, and are recorded with the checks because
they are read off the same results: `--disable-gpu`, pasted into headless invocations as a matter
of habit, disables the graphics stack so there is no rendering context at all — indistinguishable
from a Lesson that draws nothing — and a browser carrying the operator's own extensions shows
injected requests and mutated markup that are not the Lesson's.

**Every answer is three-valued**, and that is what keeps the pass honest. `ok` is `true`, `false`
or `null`, where `null` means *there was nothing here to judge*: a page with no canvas has not
passed the canvas check, and a check handed no console record has not passed the console check.
An absence reported as a pass is the one answer a Teacher would act on wrongly, so the pass as a
whole is three-valued too — every check declining is not a clean page.

**Rejected:** making it a gate, with a threshold a Lesson has to clear. Three of the seven checks
misread under conditions this file documents, so a threshold would block correct Lessons and
would teach the Teacher to route around the pass rather than read it. Rejected too: writing the
checks into the authoring reference as prose. They do not vary by subject, so prose would be the
same list retyped every Session, drifting a little each time — and a check whose misreads matter
this much has to be one artifact with one place to fix it.

**Consequence:** the file is built the way `rich-text.js` is built, and for the same reason. The
page, the window and the session's own console and network records are arguments rather than
globals, so `page-checks.test.js` runs the whole of it in a context holding nothing at all. What
that suite holds is the contract — one shape, three values, no throw on a page lacking the
subject, and a documented misread for every check the file ships, read off the file's own list so
that a check added without one fails on the day it is added. What it cannot hold is layout: no
browser runs here, the stub page returns the boxes a test wrote into it, and adding a browser is
refused — this suite takes no dependency and needs no install step, which is what makes it
runnable by any agent that has just cloned the repo. The real check is a Teacher opening the real
page, once per Lesson, which is the whole point of the decision.

## 36. Draw the diagram, and borrow only what a drawing would fabricate

**Decided:** the authoring reference gains a policy for imagery. A Teacher **draws by default** —
inline SVG, or a canvas a Component draws into — and **borrows** only when a drawing of the thing
would be a claim about how reality looks: photographs of real apparatus and instruments,
historical documents and artefacts, microscopy and medical imaging, astronomical and
remote-sensing imagery, organisms and mineral specimens, works of art under discussion, and real
instances of a phenomenon. Everything else — a diagram, a schematic, a chart, a model, a process,
a relationship — is something the Teacher can be *right* about, so it is drawn.

**Why this is the costliest of the three assumptions this work replaces.** Nothing forbade an
image; there was simply no guidance, so Lessons contained almost none. An annotated static diagram beside prose
is the most consistently effective format in the whole instructional literature — steadier than
animation, simulation or interactivity, which is where the appetite runs. A rule that is absent is
obeyed by nobody.

**The reason for the default is stated, so it is not read as timidity.** When the Teacher has
drawn the diagram it already knows what the diagram must say, because it wrote the prose beside
it, so the only open question left is whether it rendered legibly — and that is the question the
page pass from decision 35 answers well. A borrowed image poses the opposite question, whether it
depicts what is claimed, and that is the question a look at the page answers badly: an image looks
like something whether or not it is the thing. Drawing converts an unverifiable risk into a
verifiable one. That is the argument, and it is why the default runs towards the thing the Teacher
has to build rather than towards the thing it could find.

**One rule governs both paths: no image ships in a Lesson that has not been rendered and looked
at.** A borrowed image is downloaded into the Workspace first — both so there is something to
look at, and because a local copy is reproduction rather than hotlinking, which makes the credit
obligatory rather than polite. The formats it may be saved in are the ones the service serves,
which is why the check reads them off `server.js` rather than restating them: a `.webp` renders
from disk and 404s the moment the page is served.

**The credit goes into the page beside the image, with the licence as a real link** — not into a
file alongside it, for the reason a Rubric lives inside its Assignment. A credit that *is* part of
the deliverable may not sit where it can be separated from what it credits.

**Four bans, each recorded with its reason**, because a rule whose reason is missing is one a
Session routes around the first time it is inconvenient. Generated imagery in place of an
explanatory diagram: no symbolic representation of the diagram exists, so nothing can check it and
the generator cannot discover it was wrong. Generated decorative art and stock photography:
attractive-but-irrelevant material is a measured negative rather than a neutral. Figures embedded
from paper repositories: the licences do not grant redistribution, so link the paper. Any diagram
service that renders server-side: it sends the Lesson's content to a third party and makes the
page network-dependent for something that could have been bytes in the file.

**A ceiling on hand-drawn diagrams, with the mechanism that makes it memorable: the failure is
geometric rather than semantic.** Past roughly a dozen labelled boxes, or any graph whose edges
route around nodes, a layout engine places things instead. The Teacher knows what the diagram has
to say and cannot know how wide a label renders — that depends on a font it is not looking at — so
it cannot know the label escapes its box, or that two boxes now overlap. Nothing in the markup is
wrong; the geometry is. Six mitigations buy the headroom under the ceiling: snap to a coarse grid,
draw box sizes from a small fixed set, label in monospace so a character count estimates a width,
leave generous padding, cap label length, and mirror the semantic content into the markup so a
later reader — or the Tutor — can verify what the diagram means without rendering it.

**Rejected:** allowing generated imagery for diagrams under review. It reads as the cautious
option and is the opposite: the reviewer would be checking an image against prose with no
symbolic representation in between, which is exactly the unverifiable question the default exists
to avoid, and it would arrive with the confident look of a finished figure.

**Rejected:** a credits file per Lesson, or one per Workspace. Either is tidier and both fail the
same way — the obligation outlives the file, so a page that gets moved, copied or handed over
alone stops carrying its own licence terms.

**Consequence:** the Workspace gains an `images/` directory from the scaffold, since a document
that names a download destination should not also be asking the Teacher to invent it. Naming a
destination is a promise about a Workspace, the same shape as an `assets/…` path, so the suite
holds it from both ends — the destination read out of the document, the directory list read out of
the scaffold, neither restated.

**Consequence:** `imagery.test.js` holds the claim, the way `from-disk.test.js` holds decision
34's. The rule and the reason are read against the part of the section that states them, each ban
has to sit on one logical line with its own reason, the mechanism under the ceiling has to arrive
in one sentence, and the image formats the document offers are checked against the service's own
MIME table in both directions. What it cannot hold is whether a Teacher actually looked — that is
what the page pass is, and what the Learner's Lesson is the evidence of.

---

## Where the full record lives

- **Post-packaging:** `git log` in this repo — commit messages carry the reasoning.
- **Pre-packaging:** no version control. The session transcript is the only record
  (`~/.claude/projects/<workspace-slug>/<session-id>.jsonl`), with a rendered export in the
  pilot workspace under `exports/`.
