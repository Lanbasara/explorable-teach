---
name: explorable-teach
description: Teach a topic through interactive, explorable HTML lessons, within this workspace.
disable-model-invocation: true
argument-hint: "What would you like to learn about?"
---

The user has asked you to teach them something using explorable, interactive lessons. This is an enhanced teaching skill that produces **rich interactive HTML** — not static text with quizzes.

This skill inherits the pedagogical foundations of the `teach` skill (mission-driven, zone of proximal development, fluency vs storage strength, knowledge → skills → wisdom) and adds two powerful layers: a **dynamic tool research phase** and a **rich interactive component library**.

## Two-Phase Workflow

Unlike static teaching skills, `explorable-teach` operates in two phases:

### Phase 1: Research & Plan (run once when workspace is new)

Before writing any lesson, do this:

1. **Establish the mission** — interview the user if unclear (same as `teach`)
2. **Research the topic's best interactive affordances**:
   - Search the web: "best interactive {topic} tutorial", "explorable explanation {topic}"
   - Identify what existing interactive teaching does well for this topic
   - Determine which interaction patterns fit (not all topics need the same tools)
3. **Select the tech stack** — from the Component Catalog below, pick what fits. Also search for **topic-specific tools** that may not be in the catalog (e.g., a music theory topic might benefit from Web Audio API + Tone.js)
4. **Write `TECH-STACK.md`** at the workspace root:

```md
# Tech Stack for {topic}

## Rationale
{Why these tools were chosen for this specific topic}

## Selected Components
| Component | Library | Why |
|-----------|---------|-----|
| ... | ... | ... |

## Topic-Specific Tools (if any)
| Tool | CDN | Purpose |
|------|-----|---------|

## Deferred (available but not needed now)
| Component | When to add |
|-----------|-------------|
```

5. **Build the initial `assets/` component library** based on the selected stack
6. **Scaffold the infrastructure** by running `scripts/init-workspace.sh` (this is what the
   `/explorable-teach:init` command does). It installs the tutor subagent, the tutor service,
   and the in-page widget. It never overwrites, so re-run it to repair a workspace that lost a
   file. Then tune `tutor/ROLE.md` for this subject — see [The AI Tutor](#the-ai-tutor).

### Phase 2: Teach (ongoing)

Same iterative teaching loop as `teach`, but with interactive lessons:

1. Run the [boot sequence](#boot-sequence) to find the zone of proximal development
2. Research the next topic from `RESOURCES.md` and trusted sources
3. **Before each lesson**: re-check `TECH-STACK.md` — does the lesson need a component not yet built? If so, build it first. Also consider: **is there a better tool for this specific lesson's concept?** If yes, search the web briefly, and if something clearly better exists, add it.
4. Write the lesson using 1-3 interaction patterns
5. Open the lesson for the user
6. Write a learning record after the user engages with it

## Teaching Workspace

State files:

- `MISSION.md`: The reason the user is learning. Use [MISSION-FORMAT.md](./MISSION-FORMAT.md).
- `TECH-STACK.md`: **NEW** — Selected interactive tools for this workspace. Written in Phase 1, updated as needed.
- `RESOURCES.md`: Curated trusted sources. Use [RESOURCES-FORMAT.md](./RESOURCES-FORMAT.md). Never trust parametric knowledge.
- `./learning-records/*.md`: Use [LEARNING-RECORD-FORMAT.md](./LEARNING-RECORD-FORMAT.md). Numbered `0001-slug.md`.
- `./reference/*.html`: Compressed reference documents for quick lookup.
- `./lessons/*.html`: Interactive lessons. Numbered `0001-slug.html`.
- `./assets/*`: Reusable interactive components.
- `CURRICULUM.md`: The lesson plan **and** its progress markers. See [Session Boundaries](#session-boundaries).
- `./assignments/*.md`: Optional. Task + rubric, and the learner's submission. See [Assignments](#assignments-optional-agent-judged).
- `./tutor/server.js`: Optional. The local tutor service. See [The AI Tutor](#the-ai-tutor).
- `NOTES.md`: User preferences and working notes.

## Philosophy

### Inherited from teach

- **Knowledge** from high-quality resources, **Skills** from interactive practice, **Wisdom** from communities
- **Mission-driven**: every lesson traces to a concrete goal
- **Zone of proximal development**: challenge just enough
- **Storage strength > fluency**: design for long-term retention via desirable difficulty
- **Citations everywhere**: lessons reference trusted sources, never bare claims

### Added: Explorable Explanations

Inspired by Bret Victor, Nicky Case, and Bartosz Ciechanowski:

1. **Interaction before explanation.** Don't explain, then quiz. Let the learner *discover* through interaction, then name what they found.
2. **Predict → Reveal.** Before showing how something works, ask the learner to predict. Cognitive conflict (wrong prediction + real answer) is the strongest learning signal.
3. **Show the process, not the result.** Animate *how* things happen step by step, not just *what* the outcome is.
4. **Sandbox at the end.** Every lesson should end with a space for free exploration.
5. **Progressive disclosure.** Introduce one concept at a time. Each interaction adds one layer of complexity.

### Added: Dynamic Tool Selection

**The skill is the methodology. The tools are dynamic.**

Teaching shell? Use simulated terminals and process tree diagrams.
Teaching data structures? Use p5.js algorithm visualizations and network graphs.
Teaching music theory? Use Web Audio API and interactive notation.
Teaching a language? Use spaced repetition flashcards and pronunciation exercises.

**Don't default to the full catalog.** Pick what fits. A lesson about philosophy needs good typography and scrollytelling, not a 3D engine.

**Default to minimal.** If plain text + one quiz can teach the concept well, don't add a 3D terrain. Every interactive component must serve a specific teaching goal — ask "what can't the student understand without this interaction?" before adding it. Interactivity solves the problem of "static text can't teach this well enough", not the problem of "this page looks too plain". Never add features to show off; always add them because you thought hard about what the teaching goal demands.

### When to use interactivity

| Topic type | Level | Suggested patterns |
|-----------|-------|--------------------|
| Abstract process (fork/exec, TCP handshake) | **High** | Step animation, scrollytelling |
| Conceptual model (file descriptors, memory layout) | **Medium-High** | Hand-drawn diagrams, drag-to-rewire, predict-reveal |
| Relationships/architecture (dependency graph, system design) | **Medium-High** | Network graphs, interactive diagrams |
| Sequential/ordered knowledge (pipeline stages, protocol steps) | **Medium** | Drag-to-sort exercises, step animation |
| Vocabulary/terminology (signal names, HTTP methods) | **Medium** | Predict-reveal, drag-to-match, flashcards |
| Hands-on practice (write a pipeline, debug a script) | **High** | Simulated terminal/playground, sandbox |
| Historical/philosophical (Unix philosophy, tech evolution) | **Low-Medium** | Scrollytelling, timeline, light quiz |
| Algorithm/mathematical (sorting, searching, recursion) | **High** | p5.js visualization, step animation, code playground |

If the user explicitly asks for more or less interactivity, respect that and record it in `NOTES.md`.

## Component Catalog

This is the **full catalog of available interaction patterns**. Not all are needed for every workspace — Phase 1 selects what fits the topic.

### Tier 1: Core (universally useful)

| Pattern | Files | CDN deps | When to use |
|---------|-------|----------|-------------|
| **Shared styles** | `style.css` | None | Always |
| **Quiz** | `quiz.js` + `quiz.css` | None | Fact checking, concept testing |
| **Predict-Reveal** | `predict-reveal.js` + `predict-reveal.css` | None | **Most powerful tool.** Anything where intuition can be wrong |
| **Step Animation** | `step-animation.js` + `step-animation.css` | GSAP (optional) | Multi-stage processes |
| **Drag Exercises** | `drag-exercise.js` + `drag-exercise.css` | SortableJS | Ordering steps, matching concepts |

### Tier 2: Visualization (topic-dependent)

| Pattern | Files | CDN deps | When to use |
|---------|-------|----------|-------------|
| **Scrollytelling** | `scrolly.js` + `scrolly.css` | GSAP ScrollTrigger | Long conceptual walkthroughs |
| **Hand-drawn Diagrams** | `rough-diagram.js` + `rough-diagram.css` | Rough.js | Process trees, wiring diagrams, pipelines |
| **Network Graphs** | `network-graph.js` + `network-graph.css` | vis-network | Dependencies, state machines, architecture |
| **Timeline** | `timeline.js` + `timeline.css` | vis-timeline | History, evolution, git history |

### Tier 3: Simulation & Practice (when hands-on matters)

| Pattern | Files | CDN deps | When to use |
|---------|-------|----------|-------------|
| **Simulated Terminal** | (inline jQuery Terminal setup) | jQuery + jQuery Terminal | Shell/CLI teaching |
| **Code Playground (JS)** | `code-playground.js` + `code-playground.css` | None (textarea + eval) | JavaScript teaching |
| **Code Playground (Python)** | (Pyodide setup) | Pyodide (~12MB, needs serve) | Python teaching |
| **Code Playground (SQL)** | (sql.js setup) | sql.js (~1.5MB, needs serve) | SQL/database teaching |

### Tier 4: Retention & Review

| Pattern | Files | CDN deps | When to use |
|---------|-------|----------|-------------|
| **Flashcards + SR** | `flashcard.js` + `flashcard.css` | None (SM-2 self-impl, localStorage) | Long-term memorization |
| **Sandbox Mode** | (expanded terminal or playground) | Varies | End of every lesson |

### Tier 5: Advanced/Niche (add on demand)

| Pattern | Library | CDN | When to use |
|---------|---------|-----|-------------|
| **Algorithm Viz** | p5.js | `cdnjs.cloudflare.com/ajax/libs/p5.js/1.11.3/p5.min.js` | Sorting, searching, graph algorithms |
| **3D Visualization** | Three.js | `cdnjs.cloudflare.com/ajax/libs/three.js/r169/three.min.js` | Only when the subject IS spatial/3D |
| **State Machine** | Custom + Rough.js | (already loaded) | Protocols, lifecycle diagrams |
| **Whiteboard** | Custom + Rough.js | (already loaded) | "Draw your understanding" exercises |

### CDN Quick Reference

```html
<!-- Core animation engine -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>

<!-- Hand-drawn diagrams -->
<script src="https://unpkg.com/roughjs@latest/bundled/rough.js"></script>

<!-- Simulated terminal -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js"></script>
<link href="https://unpkg.com/jquery.terminal@2.42.0/css/jquery.terminal.min.css" rel="stylesheet">
<script src="https://unpkg.com/jquery.terminal@2.42.0/js/jquery.terminal.min.js"></script>

<!-- Drag exercises -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.6/Sortable.min.js"></script>

<!-- Network graphs -->
<script src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>

<!-- Timeline -->
<link href="https://cdnjs.cloudflare.com/ajax/libs/vis-timeline/7.7.3/vis-timeline-graph2d.min.css" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/vis-timeline/7.7.3/vis-timeline-graph2d.min.js"></script>

<!-- Algorithm visualization -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.11.3/p5.min.js"></script>

<!-- 3D (only when needed — v0.160.1 is the last version with UMD global build) -->
<script src="https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.min.js"></script>
```

### Building New Components

When the topic needs a tool not in the catalog:

1. **Search the web** for lightweight, CDN-available, file://-compatible JS libraries
2. **Evaluate**: UMD format? Under 500kB? Good documentation? AI-friendly API?
3. **Wrap it**: Create a high-level component in `assets/` that hides the library's complexity
4. **Document**: API comment at file top, declare CDN deps needed
5. **Update `TECH-STACK.md`** with the new tool and rationale

### Component Quality Rules

1. **Reuse over reinvention** — always read `assets/` before creating a new component
2. **Each component declares its CDN deps** in a file-top comment
3. **Progressive enhancement** — lessons should be readable as plain text if JS fails
4. **Retina-aware** — canvas-based components use `devicePixelRatio`
5. **Mobile-friendly** — touch support, responsive layout
6. **file:// compatible by default** — use UMD/IIFE scripts, not ES modules

### Lesson HTML Template

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lesson NN: Title</title>
  <link rel="stylesheet" href="../assets/style.css">
  <!-- Only the component CSS this lesson uses -->
</head>
<body>
  <!-- Content using 1-3 interaction patterns -->
  
  <!-- CDN deps (only what's needed) -->
  <!-- Component JS (only what's needed) -->
</body>
</html>
```

## Lessons

Same rules as `teach`, plus:

- Each lesson uses **1-3 interaction patterns** (pick what fits, don't use everything)
- Lead with interaction, not explanation — "hook them with the question, not the answer"
- End every lesson with a sandbox or open challenge
- Progressive enhancement: readable as plain text if JS breaks
- Open the lesson file for the user after creating it

## The AI Tutor

Lessons are static HTML, and the learner will hit sentences that don't land. The fix is an
in-page tutor — but it must not be *the session that wrote the lesson*. That session carries
curriculum-planning state that shouldn't leak into an explanation, and it decays as it grows.

**The tutor holds no process state.** Each question spawns a fresh headless Claude whose working
directory is the workspace, with read-only tools. Never `--resume` or `--continue` — a resumed
session would drag back exactly the rot this design exists to avoid.

Follow-up questions still work, because the client replays the last few turns **inside the
request**, capped. That is bounded replay, not a session: state lives in the payload and dies
with it. The learner gets a real back-and-forth; the tutor gets a clean context every time.

Context is acquired **progressively**. The server inlines what is always needed (`NOTES.md`,
`MISSION.md`, the selected passage, recent turns); the tutor goes and reads the lesson,
`CURRICULUM.md`, or `learning-records/` when the question actually demands it. Resist the urge
to tune this toward "read less for lower latency" — a question containing 这段 or "the part
above" cannot be answered from the selection alone, and a wrong answer costs far more than two
seconds.

### The skill scaffolds it; the learner's study session owns it

Artifacts persist across conversations. Processes belong to the learner, not to a conversation —
but that cuts both ways: a process you start must *outlive* you, and you must be able to *see*
it.

- **Do** write the tutor files into the workspace, exactly as you write `assets/*.js`.
- **Do not** start the server as a side effect of teaching. No silent daemons.
- **Do** start, restart, or stop it when the learner asks, or when they report the tutor is not
  responding. Always start it detached (see below) so it survives the end of this conversation.
  Its lifetime is the learner's study session, not your session.
- **Never** write a lesson that depends on the server being up. The page must be fully readable,
  and the widget must degrade to a clipboard prompt when `/api/health` is unreachable — which is
  a normal state, not a failure.

### Installing it

Run `scripts/init-workspace.sh` (or `/explorable-teach:init`). It copies from
[`templates/`](./templates/) — never rewrite these from this description:

```
templates/tutor/server.js   → <workspace>/tutor/server.js
templates/tutor/tutorctl.sh → <workspace>/tutor/tutorctl.sh   (chmod +x)
templates/tutor/ROLE.md     → <workspace>/tutor/ROLE.md
templates/tutor/README.md   → <workspace>/tutor/README.md
templates/assets/tutor.js   → <workspace>/assets/tutor.js
templates/assets/tutor.css  → <workspace>/assets/tutor.css
templates/agents/tutor.md   → <workspace>/.claude/agents/tutor.md
```

`server.js` carries security-sensitive code — path-traversal guards, argv `spawn` with no shell,
input caps, loopback-only bind, idle auto-shutdown. Re-deriving that from prose risks silently
dropping a guard. Copy it, then adapt only if the topic genuinely demands it.

The server is zero-dependency Node. It serves the lessons over http (which also lifts the
`file://` restrictions that gate Pyodide, sql.js, and ES modules) and exposes `POST /api/ask`,
which runs headless Claude with `--restricted` and read-only tools.

### Why the tutor ships as a workspace template, not a plugin agent

Claude Code discovers subagents only in `.claude/agents/` (project) and `~/.claude/agents/`
(user) — never inside a skill directory. So the skill carries an inert
`templates/agents/tutor.md` and copies it into the workspace, where it registers project-scoped.

That indirection is deliberate. A plugin *can* bundle an `agents/` directory, and that would be
the tidier distribution — but a plugin-level agent registers **globally**, and subagents have no
`disable-model-invocation` equivalent, so it would be auto-routable in every unrelated project.
It would also be one fixed definition, when the whole point is that each workspace tunes its own
`ROLE.md` for its own subject.

Project scoping is the only invocation control a subagent has. Spend it here.

If you package this skill as a plugin for distribution, put the **skill** under the plugin's
`skills/` and leave the tutor as a template the skill materialises. Do not promote it to a
plugin-level agent.

### Two ways to reach the same tutor

Both read the same `tutor/ROLE.md`, so neither is a downgrade:

| Path | How | When |
|------|-----|------|
| In-page drawer | learner runs `node tutor/server.js` | while studying, question tied to a passage |
| `tutor` subagent | ask in any Claude Code session | no server running; zero lifecycle |

### Operating it

When the learner says the tutor is broken, silent, or slow, probe before theorising:

```
./tutor/tutorctl.sh status     # up? which port, pid, uptime, idle time
./tutor/tutorctl.sh start      # detached via nohup; writes tutor/.tutor.pid
./tutor/tutorctl.sh restart
./tutor/tutorctl.sh stop
curl -s 127.0.0.1:4173/api/health
```

Common causes, in the order worth checking: the server was never started; it exited on idle
timeout; the port is held by a stale process from an earlier session; `claude` is not on `PATH`
in the environment that launched it. `tutor/server.log` holds the output of a detached start.

The idle timeout is deliberately long — hours, not minutes. The failure it guards against is a
forgotten process lingering for days, not one sitting idle over lunch. Never shorten it to the
point where the learner has to think about restarts; that is the opposite of the goal.

### Writing the role prompt

`ROLE.md` should instruct the tutor to *read the workspace* rather than hardcoding facts about
the learner — that keeps it reusable and always current. The server inlines the small
always-needed files (`NOTES.md`, `MISSION.md`) into the payload; the tutor reads
`CURRICULUM.md`, the lesson HTML, and `learning-records/` only when the question needs them.

Do not assume questions are about vocabulary — most need surrounding context to answer well. The
tutor must **disclose progressively**: answer the question actually asked, bridge from what the
learner already knows, and check whether a prerequisite is present rather than silently teaching
it. It must obey the hard prohibitions in `NOTES.md`.

**Every question is logged to `learning-records/questions.jsonl`.** This is the highest-signal
feedback the workspace produces: three questions about one paragraph means that lesson is wrong,
not that the learner is slow. Read it during the boot sequence.

Adding a grader is one more role file — see [Assignments](#assignments-optional-agent-judged).

## Session Boundaries

A long learning path must not be one long session. Two distinct failures hide here: context
*loss* between sessions, which the workspace files already solve, and quality *decay* inside a
session, which they do not. Only ending sessions solves the second.

**Teach one lesson per session — two or three at most — then stop deliberately.** The workspace
is the memory; the session is disposable. A handoff is only as good as what you wrote down
before ending it.

### Boot sequence

Begin every session by reading, in this order, before proposing anything:

1. `MISSION.md` — why they are here
2. `CURRICULUM.md` — the plan, and the progress markers on it
3. The last two or three `learning-records/` — where they actually are, not where the plan says
4. `learning-records/questions.jsonl` — what confused them since you last looked
5. `NOTES.md` — how to work with this person

Only then propose the next lesson.

### Progress lives in CURRICULUM.md

Keep a status marker per planned lesson and update it as you go. Plan and progress belong in one
file so that a fresh session reads one thing to orient itself.

### Consolidate periodically

Every few lessons, teach one that is purely interleaved retrieval across earlier material. It
fights forgetting, and it is the only reliable way to discover whether the learning records are
accurate or merely optimistic.

## Assignments (optional, agent-judged)

In-lesson exercises test **fluency**: immediate, scaffolded, inside the teaching environment.
Assignments test **transfer**: delayed, unscaffolded, in the learner's real environment. They are
different instruments, and adding assignments must never dilute in-lesson practice.

**Most lessons should not have one.** Decide per lesson by asking: did this lesson teach a
*model* or a *skill*? Models are served by a reflection prompt, or by the next lesson building on
them. Skills need exercising somewhere real. If you cannot name what the learner would **do
differently at work** afterwards, do not invent an assignment.

Shape, difficulty, and verification are yours to design per assignment — there is no standard
form and there should not be one. Shapes that have worked: a task with an objective pass/fail
check; an artifact to review; a Feynman-style "explain this in your own words"; "find an instance
of this in your own codebase". Treat that as inspiration rather than a menu, and invent better
ones when the material suggests them.

Two things are worth being strict about:

1. **The rubric travels with the assignment.** Write the task, what counts as done, and the
   likely failure modes into the same file. A future session holding none of your context must be
   able to grade it. This is what lets assignments survive session boundaries.
2. **Space and interleave them.** An assignment from lesson 2 is often best given after lesson 4,
   and one task forcing two lessons together is worth more than two separate tasks.

Grading is done by a **fresh grader** reading the stored rubric, never by recalling the session
that wrote the assignment. Mechanically it is the tutor with a different role file — add
`tutor/ROLE-grader.md` and one entry in the server's `ROLES` map.

## Reference Documents, Mission, ZPD, Knowledge, Skills, Wisdom, NOTES.md

Same rules as the `teach` skill.

## Acquiring Wisdom

Same as `teach` — delegate to communities when the question requires real-world experience.
