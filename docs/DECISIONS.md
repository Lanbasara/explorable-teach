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

**Decided:** the plugin carries an inert `templates/agents/tutor.md`; `init` copies it into the
workspace, where it registers project-scoped.

**Rejected:** a top-level `agents/` directory in the plugin, which would be tidier. Claude Code
discovers subagents only in `.claude/agents/`, and a plugin-level agent registers **globally**.
Subagents have no `disable-model-invocation` equivalent, so it would be auto-routable in every
unrelated project. Project scoping is the only invocation control a subagent has.

It also would not want to be global: a tutor for Shell and a tutor for music theory are not the
same role. Each workspace tunes its own `ROLE.md`.

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
`templates/assets/` and are installed by the scaffold. The rest of the catalog stays a menu.

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

**Consequence:** `skill-spine.test.js` now fails a document that names two or more of the
scaffold's template paths. One is a reference; two is a copy of a list the document does not own.

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

---

## Where the full record lives

- **Post-packaging:** `git log` in this repo — commit messages carry the reasoning.
- **Pre-packaging:** no version control. The session transcript is the only record
  (`~/.claude/projects/<workspace-slug>/<session-id>.jsonl`), with a rendered export in the
  pilot workspace under `exports/`.
