# Authoring a Unit

The [teaching loop](./SKILL.md#the-teaching-loop) reaches here at the point where a Unit stops
being a decision and starts being files. Everything below is consulted while writing: the form
each artifact takes, the conventions a page follows, and the rules that make a Unit reachable
once it exists.

What to teach next, and which instrument verifies it, were settled before you got here — see
[the judgement criteria](./SKILL.md#judging-what-to-teach-next) and [the assessment
ladder](./SKILL.md#the-assessment-ladder).

## The Lesson

A Lesson is one self-contained HTML file in `./lessons/`, numbered `0001-slug.html`. It is the
body of the Unit — where knowledge and skills reach the learner — and it names that body alone,
never the whole Unit.

**Keep it short.** Working memory is small, and a Lesson that overruns it teaches nothing past
the point where it overran. Aim for one tangible win per Unit: tied to the Mission, sitting in
the zone of proximal development, completable quickly, and something the next Unit can build
on.

**Make it beautiful.** Clean readable typography, generous space, nothing decorative that is not
carrying meaning — think Tufte. The learner will come back to these to review.

Every Lesson:

- uses **1-3 interaction patterns** — pick what fits, don't use everything;
- leads with interaction rather than explanation: hook them with the question, not the answer;
- carries a citation on every claim, because a bare claim is untrustworthy even when it is true,
  and recommends **one primary source** — the highest-trust thing you found — to go and read;
- links by HTML anchor to the reference documents and the neighbouring Units it builds on;
- ends with a sandbox or an open challenge;
- keeps working when nothing else is — the constraint [the Unit](./SKILL.md#the-unit) states —
  while still telling the learner they can ask about anything that did not land.

Open the Lesson file for the learner once you have written it.

### The page

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lesson NN: Title</title>
  <link rel="stylesheet" href="../assets/style.css">
  <!-- Only the component CSS this lesson uses, e.g.: -->
  <link rel="stylesheet" href="../assets/predict-reveal.css">
</head>
<body>
  <!-- Content using 1-3 interaction patterns -->

  <!-- CDN deps (only what's needed) -->
  <!-- Component JS for the patterns this lesson uses, e.g.: -->
  <script src="../assets/predict-reveal.js"></script>

  <!-- Page infrastructure. One tag, and never wire its contents individually. -->
  <script src="../assets/lesson-boot.js" data-unit="NNNN"></script>
</body>
</html>
```

`style.css` is linked from `<head>` rather than pulled in by `lesson-boot.js` on purpose: a
Lesson has to be styled whether or not a script ever runs.

## Choosing an interaction pattern

Five moves, inspired by Bret Victor, Nicky Case, and Bartosz Ciechanowski:

1. **Interaction before explanation.** Let the learner *discover* through interaction, then name
   what they found.
2. **Predict, then reveal.** Ask for a prediction before showing how something works. Cognitive
   conflict — a wrong prediction meeting the real answer — is the strongest learning signal.
3. **Show the process, not the result.** Animate *how* something happens, step by step.
4. **Sandbox at the end.** Leave a space for free exploration.
5. **Progressive disclosure.** One concept at a time; each interaction adds one layer.

**The skill is the methodology. The tools are dynamic.**

Teaching shell? Use simulated terminals and process tree diagrams.
Teaching data structures? Use p5.js algorithm visualizations and network graphs.
Teaching music theory? Use Web Audio API and interactive notation.
Teaching a language? Use spaced repetition flashcards and pronunciation exercises.

**Don't default to the full catalog.** Pick what fits. A Unit about philosophy needs good
typography and scrollytelling, not a 3D engine.

**Default to minimal.** If plain text and one Exercise can teach the concept well, don't add a 3D
terrain. Every interactive Component must serve a specific teaching goal — ask *what can the
learner not understand without this interaction?* before adding it. Interactivity solves "static
text can't teach this well enough", never "this page looks too plain". Never add a feature to
show off; add it because you thought hard about what the teaching goal demands.

| Topic type | Level | Suggested patterns |
|-----------|-------|--------------------|
| Abstract process (fork/exec, TCP handshake) | **High** | Step animation, scrollytelling |
| Conceptual model (file descriptors, memory layout) | **Medium-High** | Hand-drawn diagrams, drag-to-rewire, predict-reveal |
| Relationships/architecture (dependency graph, system design) | **Medium-High** | Network graphs, interactive diagrams |
| Sequential/ordered knowledge (pipeline stages, protocol steps) | **Medium** | Drag-to-sort exercises, step animation |
| Vocabulary/terminology (signal names, HTTP methods) | **Medium** | Predict-reveal, drag-to-match, flashcards |
| Hands-on practice (write a pipeline, debug a script) | **High** | Simulated terminal/playground, sandbox |
| Historical/philosophical (Unix philosophy, tech evolution) | **Low-Medium** | Scrollytelling, timeline, a light Exercise |
| Algorithm/mathematical (sorting, searching, recursion) | **High** | p5.js visualization, step animation, code playground |

If the learner asks for more or less interactivity, respect that and record it in `NOTES.md`.

## Component Catalog

This is the **full catalog of available interaction patterns**. Not all are needed for every
Workspace — the first run selects what fits the subject.

**Read the two tables below differently.** The first names files that already exist in the
Workspace: the scaffold installed them, so use them, never rewrite them. Everything after it
names a pattern and a *suggested* filename — nothing is there until you build it.

### Tier 1: Core — ships with the plugin, already in `assets/`

| Pattern | Files | CDN deps | When to use |
|---------|-------|----------|-------------|
| **Shared styles** | `assets/style.css` | None | Always — every page links it from `<head>` |
| **Exercise** | `assets/exercise.js` + `assets/exercise.css` | None | Checking a concept the moment it is taught |
| **Predict-Reveal** | `assets/predict-reveal.js` + `assets/predict-reveal.css` | None | **Most powerful tool.** Anything where intuition can be wrong |
| **Step Animation** | `assets/step-animation.js` + `assets/step-animation.css` | None | Multi-stage processes |
| **Drag Ordering** | `assets/drag-order.js` + `assets/drag-order.css` | None | Sequences where order is the knowledge |

These five do not vary by subject, so they are the plugin's, not the Workspace's. Each file's
head comment holds the markup its author writes — **read that before using one**, and do not
re-derive the markup from this table. All four Components degrade to plain text with scripting
off, and none of them touch the network, so a Lesson works opened from `file://` on a plane.

`style.css` owns the design tokens (`--bg`, `--fg`, `--accent`, …). Everything else reads them
and defines none, so re-theming a Workspace means editing that one file.

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
| **Sandbox Mode** | (expanded terminal or playground) | Varies | End of every Lesson |

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
3. **Wrap it**: Create a high-level Component in `assets/` that hides the library's complexity
4. **Document**: API comment at file top, declare CDN deps needed
5. **Update `TECH-STACK.md`** with the new tool and rationale

Model it on a shipped one — `assets/exercise.js` is the plainest example of the shape — so
that a Component written for one subject still reads like the rest of the Workspace.

### Component Quality Rules

1. **Reuse over reinvention** — always read `assets/` before creating a new Component
2. **Each Component declares its dependencies** in a `Deps:` line at the file head, alongside
   the markup its author is expected to write. That comment is the Component's documentation;
   there is nowhere else to look.
3. **Progressive enhancement** — a Lesson must read as plain text with scripting off. A
   Component hides things only *after* mounting: it marks its own root `is-live`, and every
   hiding rule it writes is scoped to a class only its own script ever sets. A stylesheet that
   hides content outright hides it from the learner whose scripts never ran — and so does
   `hidden` written into the markup by hand, so **never author a `hidden` attribute in a
   Lesson**. Let the Component set it.
4. **Every interaction has a keyboard and a touch path.** Drag-only is unusable on a phone and
   invisible to a keyboard; the shipped drag Component pairs dragging with move buttons.
5. **Retina-aware** — canvas-based Components use `devicePixelRatio`
6. **Mobile-friendly** — touch support, responsive layout
7. **file:// compatible by default** — use UMD/IIFE scripts, not ES modules
8. **Read the tokens, define none** — colours, spacing and fonts come from `style.css`

## Exercises

The tight loop the Lesson is built around: the learner answers, the page judges, and they find
out they misunderstood while the material is still in front of them. They are the reason a
Lesson is interactive rather than a page of prose, and nothing added later may dilute them.

Write them for storage strength, not fluency — see [Storage strength over
fluency](./SKILL.md#storage-strength-over-fluency). Judging happens in the page, so an Exercise
never needs a server or a network.

An Exercise the learner can answer by scrolling up is measuring fluency and teaching nothing.
When writing options, make every one the same length in words and, where you can, in characters:
formatting that singles out the right answer turns a retrieval Exercise into a spotting exercise.

## Checkpoints

The gate at the end of a Unit: a small set of retrieval questions covering what the Unit
claimed to teach, in its own page, judged there the same way an Exercise is. It answers one
question — *may the learner move on?* — and the answer belongs in the Learning Record, because
the next Session plans from it.

A Checkpoint the learner passes by scrolling back into the Lesson has measured nothing.

## Assignments

Shape, difficulty, and verification are yours to design per Assignment — there is no standard
form and there should not be one. Shapes that have worked: a task with an objective pass/fail
check; an artifact to review; a Feynman-style "explain this in your own words"; "find an instance
of this in your own codebase". Treat that as inspiration rather than a menu, and invent better
ones when the material suggests them.

Two things are worth being strict about:

1. **The Rubric travels with the Assignment.** Write the task, what counts as done, and the
   likely failure modes into the same file. A future Session holding none of your context must be
   able to grade it. This is what lets Assignments survive Session boundaries.
2. **Space and interleave them.** An Assignment from Unit 2 is often best given after Unit 4,
   and one task forcing two Units together is worth more than two separate tasks.

One HTML file per Assignment, in `./assignments/`. They are HTML for the same reason Lessons
are: a `.md` file is invisible from the browser the learner is already in. Keep the Rubric inside
that same HTML in a non-rendered block, so the task and its grading criteria never drift apart.

The learner's Submission is whatever evidence they offer for the task, and a Grader holding none
of your context has to be able to read it alongside the task and the Rubric.

Grading is done by a **fresh Grader** reading the stored Rubric, never by recalling the Session
that wrote the Assignment. Standing one up is one more role file — see [TUTOR.md](./TUTOR.md).

## A Unit is navigable, or it does not exist

A Unit is usually more than one file: the Lesson, sometimes a Checkpoint, sometimes an
Assignment. Left unlinked, those become artifacts the learner has to go hunting for, and a file
nobody can find was not worth writing.

Three rules, all mandatory:

1. **Do not wire infrastructure by hand.** One line does it — `<script
   src="../assets/lesson-boot.js" data-unit="0003"></script>`, last in `<body>`. It pulls in
   every piece of page infrastructure, in the right order. Even that line is a safety net
   rather than a chore: `${CLAUDE_PLUGIN_ROOT}/scripts/wire-lessons.sh` injects it into any page
   missing it, so run that after writing a Lesson and forget about it. Your attention belongs on
   the teaching.
2. **`index.html` is the Dossier** — the one page every Unit is reachable from. Update it
   whenever you add a Unit or change a progress marker. The learner should never need to open
   `lessons/` in a file browser.
3. **Siblings link to each other.** A Lesson points at its Checkpoint and its Assignment; they
   point back. The learner should be able to move through a Unit without touching the address
   bar.

Keep files flat (`0001-slug.html`, `0001b-checkpoint.html`). Do not nest Units into folders — it
buys nothing and breaks every relative asset path.

## Reference documents

Lessons are rarely revisited. Reference documents are — so write them as you go, into
`./reference/` and as HTML for the reason Lessons are, and link to them from the Units they came
out of.

A reference document is the compressed essence of what a Unit taught, in a shape built for
lookup rather than for reading: syntax and snippets for a programming language, an algorithm or a
flowchart for a process, poses and sequences for yoga, routines for fitness. They are the raw
units of knowledge that outlive the Lesson that introduced them, so make them beautiful and make
them print well.

**A glossary is the reference document almost every subject earns**, and it is the one with the
longest reach: once the Workspace has one, every Lesson adheres to its terms. Use
[the glossary format](./formats/glossary.md).
