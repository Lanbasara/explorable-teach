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
/explorable-teach:init        # scaffold the workspace, author the curriculum with you
/explorable-teach             # teach the next lesson
```

`init` runs once per workspace. `/explorable-teach` is the loop you come back to.

## What a workspace looks like

```
MISSION.md            why you are learning this — every lesson traces back here
CURRICULUM.md         the plan, and progress markers on it
RESOURCES.md          high-trust primary sources
NOTES.md              how you want to be taught (the tutor treats this as binding)
TECH-STACK.md         which interaction patterns this subject actually needs
lessons/              0001-slug.html — the lessons themselves
reference/            compressed cheat-sheets you will actually revisit
learning-records/     what you demonstrably know; drives what gets taught next
  questions.jsonl     every question you asked the tutor
assets/               reusable interactive components
tutor/                the in-page tutor service
.claude/agents/       the tutor subagent
```

## Two ideas hold the whole thing together

### Sessions are disposable; the workspace is the memory

A long learning path must not be one long conversation — quality decays inside a session in a
way that no amount of note-taking fixes. So teach one lesson per session and stop deliberately.
Every session starts by reading `MISSION.md` → `CURRICULUM.md` → recent learning records →
`questions.jsonl` → `NOTES.md`, and only then proposes what is next.

This is why the state files are not bookkeeping. They are the handoff.

### Interactivity is a tool, not a decoration

The component catalog spans predict-reveal, step animations, scrollytelling, hand-drawn
diagrams, network graphs, drag exercises, simulated terminals, and 3D — but the rule is
**default to minimal**. Before adding anything, answer: *what can the learner not understand
without this interaction?* If there is no answer, plain prose and one good question beat a
WebGL scene.

`init` picks the stack per subject. A philosophy course and an algorithms course should not end
up with the same tooling.

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
role. `init` installs a generic `ROLE.md` and then tunes it for your subject.

Project scoping is the only invocation control a subagent has. This spends it where it counts.

## `questions.jsonl` is the point

Every tutor exchange is logged with a thread id. It is the highest-signal feedback the workspace
produces: three questions about one paragraph means that lesson is wrong, not that the learner is
slow — and one question probed three times means something different again from three separate
confusions.

Read it before planning the next lesson.

## License

MIT
