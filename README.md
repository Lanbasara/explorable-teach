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

One command, every time. On the first run in an empty directory it scaffolds the workspace,
works out what you are here for, and plans the course; on every run after that it opens by
reading the workspace back and teaches from where you actually are.

## What a workspace looks like

```
MISSION.md            why you are learning this — every lesson traces back here
CURRICULUM.md         the plan, and progress markers on it
RESOURCES.md          high-trust primary sources
NOTES.md              how you want to be taught (the tutor treats this as binding)
TECH-STACK.md         which interaction patterns this subject actually needs
lessons/              0001-slug.html — the lessons themselves
assignments/          the ones that earn an assignment, with the rubric inside
reference/            compressed cheat-sheets you will actually revisit
learning-records/     what you demonstrably know; drives what gets taught next
  questions.jsonl     every question you asked the tutor
assets/               reusable interactive components
tutor/                the in-page tutor service
.claude/agents/       the tutor subagent
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
units earn exercises and nothing more.

### Sessions are disposable; the workspace is the memory

A long learning path must not be one long conversation — quality decays inside a session in a
way that no amount of note-taking fixes. So deliver one unit per session and stop deliberately.
Every session starts by scaffolding whatever is missing, then reading `MISSION.md` →
`CURRICULUM.md` → recent learning records → `questions.jsonl` → `NOTES.md`, and only then
proposes what is next.

This is why the state files are not bookkeeping. They are the handoff.

### Interactivity is a tool, not a decoration

The component catalog spans predict-reveal, step animations, scrollytelling, hand-drawn
diagrams, network graphs, drag exercises, simulated terminals, and 3D — but the rule is
**default to minimal**. Before adding anything, answer: *what can the learner not understand
without this interaction?* If there is no answer, plain prose and one good question beat a
WebGL scene.

The stack is picked per subject, on the first run. A philosophy course and an algorithms course
should not end up with the same tooling.

Five things do not vary by subject, so they ship with the plugin and land in `assets/` when you
scaffold: the shared stylesheet, and components for **exercises** (judged the instant you
answer), **predict-reveal**, **step animations**, and **drag-to-order**. None of them loads a
library, so a lesson works from `file://` with no network; each one degrades to plain readable
text with scripting off; and every interaction has a keyboard and a touch path, not just a drag.
Everything further down the catalog is built on demand, for the subject that needs it.

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

Two ways in, both reading the same `tutor/ROLE.md`, so neither is a downgrade:

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
exits after 8 hours idle. **Lessons must always work without it** — the widget degrades to a
clipboard prompt when it cannot reach `/api/health`, which is a normal state rather than a
failure.

Security: loopback-only bind, `spawn` with an argv array and no shell, path-traversal guards and
an extension allowlist on static serving, input caps, and the tutor itself runs `--restricted`
with only `Read`/`Glob`/`Grep`.

### Why the tutor is a template, not a plugin agent

Claude Code discovers subagents only in `.claude/agents/`, never inside a skill or a plugin's
skill folder. A plugin *can* ship a top-level `agents/` directory — and that would be tidier —
but a plugin-level agent registers **globally**, and subagents have no `disable-model-invocation`
equivalent, so it would be auto-routable in every unrelated project you open.

It also would not want to be. A tutor for Shell and a tutor for music theory are not the same
role. The scaffold installs a generic `ROLE.md`, and the skill tunes it for your subject.

Project scoping is the only invocation control a subagent has. This spends it where it counts.

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
document resolves, every `assets/…` path a document names exists in a scaffolded workspace,
the scaffold is safe to re-run against a workspace you have already put work into, the
lesson bootstrap tag lands exactly once, and the skill still opens on the boot sequence
rather than on reference material. The shipped components are mounted in a hand-written
DOM and actually driven — answered, stepped, reordered — rather than merely read.
[`docs/agents/tests.md`](docs/agents/tests.md) has the details.

## Design decisions

[`docs/DECISIONS.md`](docs/DECISIONS.md) records why this works the way it does and what was
rejected on the way there — including the reasoning from before the project had version control.
`CHANGELOG.md` records what shipped; that records why.

## License

MIT
