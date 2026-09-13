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

---

## Where the full record lives

- **Post-packaging:** `git log` in this repo — commit messages carry the reasoning.
- **Pre-packaging:** no version control. The session transcript is the only record
  (`~/.claude/projects/<workspace-slug>/<session-id>.jsonl`), with a rendered export in the
  pilot workspace under `exports/`.
