# explorable-teach

Teach any topic through **interactive, explorable HTML lessons** — with a stateless AI tutor
living inside the page.

Built on the pedagogy of Matt Pocock's `teach` skill (mission-driven, zone of proximal
development, storage strength over fluency) and the explorable-explanations tradition of Bret
Victor, Nicky Case, and Bartosz Ciechanowski.

## Install

```
/plugin marketplace add Lanbasara/unleash-marketplace
/plugin install explorable-teach@lanbasara
```

## Use

```
mkdir learn-rust && cd learn-rust
/explorable-teach             # deliver the next unit
```

One command, every time. Every run opens by scaffolding — not just the first: nothing you wrote is
ever overwritten, and it is how a workspace already in use catches up with a newer plugin. Then it
reads the workspace back. On the first run there is nothing there to read, so it works out what
you are here for and plans the course; after that it teaches from where you actually are.

## What a workspace looks like

```
index.html            the dossier — the one page every unit is reachable from
MISSION.md            why you are learning this — every lesson traces back here
CURRICULUM.md         the plan, and progress markers on it
RESOURCES.md          high-trust primary sources
NOTES.md              how you want to be taught (the tutor treats this as binding)
TECH-STACK.md         which components this subject actually needs
lessons/              0001-slug.html — the lessons themselves
assignments/          the ones that earn an assignment, with the rubric inside
submissions/          what you hand in when it is too big for the page
reference/            compressed cheat-sheets you will actually revisit
images/               borrowed images, downloaded so they can be looked at and
                      credited in the page that shows them
learning-records/     what you demonstrably know; drives what gets taught next
  questions.jsonl     every question you asked the tutor
assets/               reusable interactive components — the shared ones are links
                      into the plugin; units.js and anything built for this
                      subject are yours
tutor/                the in-page tutor and grader service — links into the
                      plugin, plus the two tuning files, which are this
                      course's own
.claude/agents/       the tutor and grader subagents
```

## Three ideas hold the whole thing together

### The unit is what a session delivers

A unit is one teaching increment: a lesson, its exercises, optionally a checkpoint and an
assignment, plus the learning record and progress marker they produce. *Lesson* names the body
alone — the HTML file you read. Everything else hangs off the unit rather than off a pile of
loose files: components build it, three assessment instruments verify it, the tutor serves you
inside it, and the session boundary is its lifecycle.

The three instruments differ by when they fire, who judges them, and what they measure — an
**exercise** is judged by the page the instant you answer it; a **checkpoint** is judged by the
page at the unit's end and decides whether the unit closes; an **assignment** is done in your
real environment one to three units later and judged by a grader against a stored rubric. Most
units earn exercises and nothing more — a checkpoint is written when a later unit will build on
this one, and every question in it has to be right, because a gate with a pass mark is a score.

### Sessions are disposable; the workspace is the memory

A long learning path must not be one long conversation — quality decays inside a session in a
way that no amount of note-taking fixes. So a session delivers one unit, and then ends: **when
the next session could resume from the workspace alone, without asking you anything.** That is
checkable rather than a matter of taste, and a floor of handoff actions backs it up.

Every session starts by scaffolding whatever is missing, then reading `MISSION.md` →
`CURRICULUM.md` → recent learning records → `questions.jsonl` → `NOTES.md`, and only then
proposes what is next.

This is why the state files are not bookkeeping. They are the handoff.

### Interactivity is a tool, not a decoration

There is no catalog to pick a component off, deliberately: a list read before writing decides the
answer, and a list of interactions is in practice a list of things that are pleasant to build. So
what a passage needs is **derived** from the passage. Say in one sentence what the learner must
leave believing — if prose or an annotated picture can produce that belief, that is the answer.
Then draft the interaction, delete it, and reread the passage: if the argument still stands, what
was deleted was decoration. Most passages come out of those two gates with nothing, which is the
result rather than a failure to find one, and a lesson of good typography, one drawing and one
exercise is a finished lesson.

What survives goes through questions asked of the material — *is there a number here the claim
depends on? does the learner have to know what happens between the start and the end? would
getting these in the wrong order* be *the misunderstanding?* — and each of those comes with the
cheapest version that still does the teaching. That last part is load-bearing rather than a
concession: a static strip of frames often beats a slider, because the comparison is then
simultaneous rather than remembered, and a stepper over a precomputed run preserves what a
simulation teaches at a fraction of its cost. Beside them is a list of the forms that look
impressive and teach nothing, each with the reason it fails.

A lesson's pictures are drawn rather than found, and they are drawn out of ordinary elements and
styles before anything is drawn into a canvas — an element-built diagram is labelled, focusable,
reachable by keyboard and readable by a screen reader, and it is the one a check can look inside,
while a canvas supports exactly one question: was anything drawn at all. Continuous curves,
particles, real three-dimensional geometry and data too large for a node apiece are what a canvas
is still for.

Motion is sorted rather than banned. Motion that *is* the explanation is allowed, and so is
interface feedback — a panel opening, a value changing, focus moving — as long as it is short,
interruptible, and behind the reduced-motion preference, which is required and not a nicety. What
goes is motion competing with the prose for attention. The middle kind is spelled out because the
case against decoration is a case about *content*, and a lesson whose author does not dare animate
a disclosure is harder to follow, not purer.

The stack is picked per subject, on the first run. A philosophy course and an algorithms course
should not end up with the same tooling.

What does not vary by subject ships with the plugin and lands in `assets/` when you
scaffold: the shared stylesheet, and components for **exercises** (judged the instant you
answer), **predict-reveal**, **step animations**, **drag-to-order**, the **checkpoint** that
gates a unit at its end — built out of the exercises it counts — and the **assignment** hand-in,
the one whose verdict does not come from the page. None of them loads a library and none of them
touches the network — and the reason is not offline capability: they are the same bytes in every
workspace, so staying dependency-free is what keeps them small and what lets one fix reach every
course at once. **Your lessons are not held to that rule.** A lesson may load a pinned library
from an https CDN, module or not, because what breaks a page opened from disk is a short list of
things an author types — a module script or a `fetch` aimed at a sibling file, a worker built
from a relative path — and a CDN is on none of it. Each shipped component degrades to plain
readable text with scripting off; and every interaction has a keyboard and a touch path, not just
a drag.
Anything else is built on demand, for the subject that needs it — and no document lists what a
course has, because the course's own `assets/` is that list and it cannot be out of date.

## The tutor

Static lessons cannot answer questions. So each lesson can summon a tutor — but not the
conversation that wrote the lesson, which carries curriculum-planning state that has no business
leaking into an explanation.

**It holds no process state.** Every question spawns a fresh headless `claude` with read-only
tools, rooted in the workspace. Never `--resume`.

**Follow-ups still work**, because the client replays the last few turns *inside the request*,
capped at 6 turns / 6000 chars. Bounded replay, not a session: the state lives in the payload
and dies with it. You get a real back-and-forth; the tutor gets a clean context every time.

**Context is acquired progressively.** `NOTES.md`, `MISSION.md` and the selected passage are
inlined; the tutor goes and reads the lesson, the curriculum, or your learning records when the
question actually demands it. A question containing "this bit" cannot be answered from the
selection alone.

**Answers render as rich text.** Code blocks, lists and inline code arrive as what they are
rather than as one run of characters. The renderer builds nodes from a fixed set of tags and
never assigns markup, so anything script-shaped in an answer reaches the page as text you read
rather than as something the page runs.

Two ways in, both reading `tutor/ROLE.md` and then `tutor/TUNING.md`, in that order, so neither
is a downgrade:

| | How | When |
|---|---|---|
| In-page drawer | `./tutor/tutorctl.sh start` | studying, question tied to a passage |
| `tutor` subagent | ask in any Claude Code session | no server running, zero setup |

### Running it

```sh
./tutor/tutorctl.sh status    # up? pid, uptime, how long idle
./tutor/tutorctl.sh start     # detached — outlives the terminal and the conversation
./tutor/tutorctl.sh restart
./tutor/tutorctl.sh stop
```

It is a dev-server. You start it when you sit down to study; no AI conversation owns it. It
exits after 8 hours idle. **Open lessons at the address it serves them on** — `status` prints
one per lesson, and so does `scripts/wire-lessons.sh`. A lesson opened from the disk instead is
one the drawer cannot reach, by design rather than by failure, and it says so on the page.
**Lessons must always work without it** — the widget degrades to a clipboard prompt when it
cannot reach `/api/health`, which is a normal state rather than a failure.

Security: loopback-only bind, `spawn` with an argv array and no shell, path-traversal guards and
an extension allowlist on static serving, input caps, answers rendered into nodes rather than
markup, and the tutor itself runs `--restricted` with only `Read`/`Glob`/`Grep`.

### The tutor lives in the plugin; your workspace points at it

One question decides where a file lives: **does it vary by subject?** If it does not — the
server, the control script, the tutor's role, the in-page widget, the nav bar, the page
bootstrap, the shared stylesheet, every shipped component — it lives in the plugin and your workspace
holds a **link** at it. A tutor fix therefore reaches every workspace you have, rather than only
the ones you create afterwards. The flip side is the rule: don't edit one of those in place —
you'd be editing every course at once. Write a new file beside it. (If a course genuinely has to
replace one, delete the link and put a real file there; the scaffold reads that as deliberate and
leaves it alone.)

What stays yours is what varies: this course's tutor tuning (a tutor for Shell and a tutor for
music theory are not the same role), the course manifest, the dossier, any component you build
for this subject, and every lesson, record and submission. The scaffold's report names them, and
it re-points every link each time it runs — which is how a workspace follows the plugin across an
upgrade, and why the boot sequence runs it every session.

The one thing the scaffold still *copies* into `.claude/agents/` is the subagent definition, and
it holds no role text of its own — it is a pointer at those same two files. Claude Code discovers
subagents only in `.claude/agents/`, never inside a skill or a plugin's skill folder. A plugin
*can* ship a top-level `agents/` directory, and that would be tidier, but a plugin-level agent
registers **globally**, and subagents have no `disable-model-invocation` equivalent, so it would
be auto-routable in every unrelated project you open. Project scoping is the only invocation
control a subagent has. This spends it where it counts.

## Handing in an assignment

An assignment is a page with a task on it and a hand-in under the task: a box for a short answer,
and a box for paths to anything too big for a box. Press the button and the verdict streams into
the same page, where you can argue with it.

**What crosses is evidence, not the work.** Put the real thing in `submissions/0003-pipes/` and
write the path in. Nothing is uploaded — the grader's working directory is the workspace, so it
opens the file itself, with the same read-only tools the tutor has. A submission of any size costs
the same request as a one-line answer.

**The rubric is stored in the assignment page**, in a `<script type="application/x-rubric">` block
that is never rendered, never executed and never sent. The grader reads it off the file, so the
judgement is reproducible from the page alone rather than from the session that set the task — and
an assignment with no rubric in it offers no hand-in at all, because a task nobody can grade should
not collect work.

**The grader is never the teacher that wrote the assignment.** It is the same service in a second
role, composed from `tutor/GRADER.md` plus this course's `tutor/GRADER-TUNING.md` and nothing else,
with a `grader` subagent pointed at the same two files for when the server is down.

**The verdict becomes a learning record.** `questions.jsonl` is feedback about the page; a verdict
is evidence about you, which is the file the next session plans from. That is also the only way
the loop closes without you: an assignment is done between sessions, so nobody is around to write
it down. Questioning a verdict writes nothing — that is a conversation about a record, not another
one.

## The language you learn in is yours

The project is in English. What *you* read is in your language, and you say which once:

```js
// assets/units.js
window.TEACH_COURSE = { lang: 'zh-CN', title: '…' };
```

Every page in the workspace takes it from there — the bootstrap writes it onto any page that did
not declare one, and `scripts/wire-lessons.sh` fills it into the pages it rewrites — so
`<html lang>` is the one thing any component reads. Everything a lesson puts on screen goes
through it: the tutor drawer, the navigation bar, and every component — the guess box, the step
controls, the verdict on a question, the gate at the end of a unit, the form you hand an
assignment in on. The plugin ships text for `en` and `zh-CN`. For a language it has not
collected, or an entry you disagree with, `assets/strings.js` is your own table; anything it does
not cover falls back to the plugin's, and then to English.

Your browser's setting is deliberately not consulted. What decides is the preference recorded for
the learner, so the workspace reads the same wherever it is opened.

## `questions.jsonl` is the point

Every tutor exchange is logged with a thread id. It is the highest-signal feedback the workspace
produces: three questions about one paragraph means that lesson is wrong, not that the learner is
slow — and one question probed three times means something different again from three separate
confusions.

Read it before planning the next lesson.

## Tests

```
npm test
```

Node's built-in test runner, no dependencies and no install step. The suite checks that the
plugin's documents and scripts still describe reality: every pointer in an agent-facing
document resolves — including the heading it names — every `assets/…` path a document names
exists in a scaffolded workspace, the scaffold is safe to re-run against a workspace you have
already put work into, the lesson bootstrap tag lands exactly once, and the skill still opens
on the boot sequence with its reference material behind pointers rather than in front of the
steps, and the version the plugin declares is the one the changelog most recently shipped. The
shipped components are mounted in a hand-written
DOM and actually driven — answered, stepped, reordered — rather than merely read, and every
artifact of a unit is checked to be reachable from every other one. One of them mounts a whole
unit — the drawer, the bar and every component on all three of its pages — under a made-up
language whose text is nothing but sentinels, drives each one through every state it has, and
fails if a single character outside that alphabet reaches the screen. That is how a string
hardcoded in *any* language, English included, gets caught.
[`docs/agents/tests.md`](docs/agents/tests.md) has the details.

## Design decisions

[`docs/DECISIONS.md`](docs/DECISIONS.md) records why this works the way it does and what was
rejected on the way there — including the reasoning from before the project had version control.
`CHANGELOG.md` records what shipped; that records why.

## License

MIT
