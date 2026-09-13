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

- uses **1-3 Components** — pick what fits from [the selection guide](#choosing-a-component),
  don't use everything;
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
  <!-- Content using 1-3 Components -->

  <!-- CDN deps, if a Component needs one — pinned, never @latest -->
  <!-- Component JS for the Components this lesson uses, e.g.: -->
  <script src="../assets/predict-reveal.js"></script>

  <!-- Page infrastructure. One tag, last, and never wire its contents
       individually. It carries the text every Component renders, so it also
       starts them. -->
  <script src="../assets/lesson-boot.js" data-unit="NNNN"></script>
</body>
</html>
```

`style.css` is linked from `<head>` rather than pulled in by `lesson-boot.js` on purpose: a
Lesson has to be styled whether or not a script ever runs.

## Choosing a Component

A Component is named by the teaching act it performs, never by the library underneath it. So the
way into this section is *what am I trying to make the learner do?* — and what the thing is built
out of, if it is built out of anything, is the last question rather than the first.

Five moves, inspired by Bret Victor, Nicky Case, and Bartosz Ciechanowski:

1. **Interaction before explanation.** Let the learner *discover* through interaction, then name
   what they found.
2. **Predict, then reveal.** Ask for a prediction before showing how something works. Cognitive
   conflict — a wrong prediction meeting the real answer — is the strongest learning signal.
3. **Show the process, not the result.** Animate *how* something happens, step by step.
4. **Sandbox at the end.** Leave a space for free exploration.
5. **Progressive disclosure.** One concept at a time; each interaction adds one layer.

**Default to minimal.** Before adding any interactive Component, answer one question: *what can
the learner not understand without this interaction?* No answer means do not add it. Interactivity
is for what prose cannot teach — never for how the page looks, never to demonstrate what you can
build, and never because a page feels too plain. If plain text and one Exercise teach the concept
well, they are the right answer rather than a lesser one, and a Unit about philosophy needs good
typography and a question worth arguing with, not a 3D engine.

### From teaching act to Component

Read the left column first and stop at the row you are actually in. A row you cannot place
yourself in is a Component this Unit does not need.

| What you are trying to do | Reach for | Where it comes from |
|---------------------------|-----------|---------------------|
| Confront an intuition before explaining it — anything where the first guess is usually wrong | Predict-reveal | Shipped |
| Check that an idea landed, the moment it lands | Exercise | Shipped |
| Walk one process through its stages — `fork`/`exec`, a TCP handshake, a request's life | Step animation | Shipped |
| Teach an order that *is* the knowledge — pipeline stages, protocol steps, a proof's line | Drag ordering | Shipped |
| Find out whether a Unit may be closed, once it is over | Checkpoint | Shipped |
| Send a task out into the learner's real work and get it judged | Assignment | Shipped |
| Let the learner run the thing being taught — a shell, a query, a snippet, a synth | A playground for that subject, which unconstrained is also the sandbox a Lesson ends on | You build it |
| Show a structure they have to hold in their head — a process tree, a memory layout | A diagram they can manipulate | You build it |
| Show how a set of things relate — dependencies, a state machine, an architecture | A graph they can rearrange | You build it |
| Carry one argument through a long descent — a history, an evolution, a philosophy | A page that reveals as it scrolls | You build it |
| Make a fact survive to next month — notation, signal names, vocabulary | Scheduled retrieval across later Units — no Component at all | Neither |

The last row is not an oversight. Retention is a property of *when* material is asked for, so it
is bought by interleaving earlier material into later Units — see [storage
strength](./SKILL.md#storage-strength-over-fluency) — and a flashcard box added to one page buys
none of it.

Subjects differ in how much of this they earn. A subject made of processes and structures earns
several of these; a historical or philosophical one earns typography, one good question, and
little else. If the learner asks for more or less interactivity, respect that and record it in
`NOTES.md`.

### Shipped Components — already in every Workspace

These do not vary by subject, so they belong to the plugin rather than to any one Workspace.
A Workspace holds a *link* at each, not a copy — which is what lets one fix reach every Workspace,
and also means **editing one in place edits every other learner's course**. Use them as they are.
When one is nearly right but not right, write a new Component beside it rather than changing it.
If this subject genuinely has to replace one, delete the link and write a real file in its place:
the scaffold reads that as a deliberate override and leaves it alone from then on.

| Component | Files | Use it for |
|-----------|-------|------------|
| **Exercise** | `assets/exercise.js` + `assets/exercise.css` | Checking a concept the moment it is taught |
| **Predict-Reveal** | `assets/predict-reveal.js` + `assets/predict-reveal.css` | **The strongest of them.** Anything where intuition can be wrong |
| **Step Animation** | `assets/step-animation.js` + `assets/step-animation.css` | Multi-stage processes |
| **Drag Ordering** | `assets/drag-order.js` + `assets/drag-order.css` | Sequences where the order is the knowledge |
| **Checkpoint** | `assets/checkpoint.js` + `assets/checkpoint.css` | Gating a Unit at its end — see [Checkpoints](#checkpoints) |
| **Assignment** | `assets/assignment.js` + `assets/assignment.css` | Handing in a task done elsewhere — see [Assignments](#assignments) |

Each file's head comment holds the markup its author writes — **read that before using one**, and
do not re-derive the markup from this table. Every one of them degrades to plain text with
scripting off, and none of them touch the network, so a Lesson works opened from `file://` on a
plane. The first four build a Lesson; the last two have pages of their own, reached once the
Lesson is behind the learner — the Checkpoint gates the Unit, and the Assignment sends a task out
of it. The Assignment is the one whose verdict does not come from the page: it hands what the
learner wrote to the in-page drawer and lets that carry it, so with the service stopped it still
collects a Submission and still hands it over — to the clipboard instead of to a Grader, and it
says which of the two happened rather than reporting work as judged when it was copied.

`assets/style.css` is not a Component: every page links it from `<head>`, and it owns the design
tokens (`--bg`, `--fg`, `--accent`, …). Everything else reads them and defines none. It is linked
from the plugin like the Components above, so re-theming one Workspace means a small stylesheet of your
own in `assets/`, linked after it — not an edit to the one every Workspace shares.

### Building a Component for this subject

Every teaching act above that no shipped Component covers is something **you build**, for this
subject, into this Workspace's `assets/`. Nothing else is sitting there waiting: a music Unit
earns the Web Audio API and interactive notation, an algorithms Unit earns a step-by-step
visualiser, a shell Unit earns a simulated terminal — and each of those exists because a Session
wrote it, not because the plugin shipped it.

1. **Read `assets/` first.** Reuse beats reinvention, and a Component already there has a head
   comment telling you what it expects.
2. **Search for a library only if the teaching act needs one.** What qualifies: a UMD or IIFE
   build, small enough to load from disk, and documented well enough that you can write against it
   without guessing. Pin the version in the URL — `cdn.jsdelivr.net/npm/<pkg>@1.2.3/…`, never
   `@latest` — because a Lesson written today has to still run next year.
3. **Wrap it.** Write a Component in `assets/` that hides the library behind the teaching act, so
   the Lesson author writes markup rather than API calls. Model it on a shipped one —
   `assets/exercise.js` is the plainest example of the shape — so a Component written for one
   subject still reads like the rest of the Workspace.
4. **Declare its dependencies.** A `Deps:` line at the head of the file, naming every script the
   page must load before it — `Deps: none.` when there is nothing — alongside the markup its
   author is expected to write. That comment is the Component's documentation; there is nowhere else for a
   later Session to look.
5. **Degrade gracefully.** The Lesson has to read as plain text before your script runs, and stay
   readable if it never does — because a CDN can be unreachable and scripting can be off. So
   write the content into the markup and let the Component *take it over*: mark the root `is-live`
   on mount, and scope every hiding rule to a class only your own script sets.
6. **Record it in `TECH-STACK.md`** — the Component, the teaching act it serves, and why this tool
   rather than another. That file is what the next Session reads before reaching for a new one.

### What every Component has to hold

Three of those steps are rules rather than advice — reuse before building, declare what it needs,
degrade to text. Four more apply to anything that ends up in `assets/`:

1. **Every interaction has a keyboard and a touch path.** Drag-only is unusable on a phone and
   invisible to a keyboard; the shipped drag Component pairs dragging with move buttons.
2. **Retina-aware and mobile-friendly** — canvas-based Components use `devicePixelRatio`, and
   every Component lays out on a narrow screen.
3. **`file://` compatible by default** — UMD or IIFE scripts, never ES modules.
4. **Read the tokens, define none** — colours, spacing and fonts come from `assets/style.css`.

One rule belongs to the Lesson rather than to the Component: a `hidden` attribute written into
the markup by hand hides content from the learner whose scripts never ran, so **never author a
`hidden` attribute in a Lesson**. Let the Component set it on mount.

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

The gate at the end of a Unit: a small set of retrieval questions covering what the Unit claimed
to teach, on a page of its own, judged there the same way an Exercise is. It answers one question
— *may the learner move on?* — and the answer belongs in the Learning Record, because the next
Session plans from it.

Whether this Unit earns one at all was settled before you got here — see [the assessment
ladder](./SKILL.md#the-assessment-ladder). What is left is the form it takes.

**One page, beside the Lesson it closes.** `lessons/0003b-checkpoint.html` sits next to
`lessons/0003-fork-exec.html` and carries the same `data-unit`, so the two read as one Unit to
every piece of infrastructure that meets them. Two to five questions: more than that is a
Lesson's worth of work arriving at the moment the learner expected to be finishing.

**Built out of Exercises, gated by the Checkpoint Component.** The questions are ordinary
Exercises, each judged as it is answered; `assets/checkpoint.js` counts them and says whether the
Unit may close. Its head comment holds the markup, as every Component's does — read that before
writing one. The page is built like any other — [the page](#the-page) above — with
`assets/exercise.css` and `assets/checkpoint.css` in the head and both scripts before the
bootstrap. Which of the two scripts loads first does not matter: the Checkpoint reads the state
an Exercise records on itself, rather than being told by it.

**Every question has to be right.** A gate with a pass mark is a score, and a score does not
answer *may we move on?* So a question that could be got wrong while the Unit still closes is one
that does not belong here: cut it, or move it back into the Lesson as an Exercise.

**Write both outcomes, and put the way back in each.** Both are required — a page that can say
*you are done* but not *go back* leaves half the learners who reach it with nothing, and the
Component refuses to mount rather than gate on one of them. Pass says the Unit is closed, asks
the learner to tell you the score, and offers the Lesson for review. The other names the part of
the Lesson to reread and links at it **by anchor**, because being sent back without being told
where is what makes a gate read as a verdict on the learner rather than on the page. Only one of
the two is ever on screen, so the way back has to be in whichever one fires — the navigation bar
carries it for the rest of the time, and neither is a reason to leave it out of the other.

**Then the links.** Add `checkpoint:` to this Unit's entry in `assets/units.js`: that is what
lights the slot the navigation bar and the Dossier have always had a place for, and it is what
makes every page of the Unit reachable from every other. Write one link yourself — the Lesson
pointing at its Checkpoint where the Lesson ends — because a bar at the top of the page is not
where a learner is looking when they have just finished reading.

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

Whether this Unit earns one at all was settled before you got here — see [the assessment
ladder](./SKILL.md#the-assessment-ladder). What is left is the form it takes.

**One page of its own, in `./assignments/`.** `assignments/0003-pipe-audit.html`, numbered to the
Unit it draws on, built like any other page — [the page](#the-page) above, with
`assets/assignment.css` in the head and `assets/assignment.js` before the bootstrap — and
carrying the same `data-unit`, so the two read as one Unit to every piece of infrastructure that
meets them. HTML for the reason a Lesson is: a `.md` file is invisible from the browser the
learner is already in.

**The task, and what to do without the page.** Both are required, and the Component refuses to
mount rather than offer a hand-in above half of them. The second is what the hand-in form
replaces, so it is also what a learner whose scripts never ran is left reading: say where to put
the work and to tell you about it next Session. Its head comment holds the markup, as every
Component's does — read that before writing one.

**The Rubric goes in the page, in a block nothing renders.** A `<script type="application/x-rubric">`
element: never displayed, never executed, and read straight off the file by the Grader, which is
what makes a judgement reproducible from the page alone rather than from the Session that set it.
Write what counts as done and the likely failure modes, in the terms you would use to argue the
verdict. **Without one the page offers no hand-in at all** — a Rubric that is not there would have
to be remembered, and remembering is the one thing grading may not do.

**The Submission is evidence of the work, not necessarily the work.** Short answers go in the box
on the page. Anything larger goes into `./submissions/` — one directory per Assignment — and the
learner names the paths beside their answer; the Grader opens them itself, with the read-only
tools it already has. Nothing is uploaded and no boundary moves. Say so in the task when the work
will obviously be too big for a box: *put it in `submissions/0003-pipes/` and write the path in.*

**Then the links.** Add `assignment:` to this Unit's entry in `assets/units.js`, which lights the
third slot the navigation bar and the Dossier have always had a place for. Write one link
yourself, from the Lesson to the Assignment, where the Lesson ends — and remember the two sit in
different directories, so it is `../assignments/…` from a Lesson and `../lessons/…` back.

Grading is done by a **fresh Grader** reading the stored Rubric, never by recalling the Session
that wrote the Assignment. The verdict streams into the page, can be questioned there, and is
written into `learning-records/` as a record of its own — so it reaches you through the [Boot
sequence](./SKILL.md#boot-sequence) rather than through the learner remembering to report it. How
that is wired, and what to tune for this subject, is in [TUTOR.md](./TUTOR.md).

With the service stopped the page says so and puts a well-formed prompt on the clipboard instead
of claiming the work was judged. That is a normal state: never write an Assignment whose task
only makes sense if something is running.

## A Unit is navigable, or it does not exist

A Unit is usually more than one file: the Lesson, sometimes a Checkpoint, sometimes an
Assignment. Left unlinked, those become artifacts the learner has to go hunting for, and a file
nobody can find was not worth writing.

Three rules, all mandatory:

1. **Do not wire infrastructure by hand.** One line does it — `<script
   src="../assets/lesson-boot.js" data-unit="0003"></script>`, **last** in `<body>`, below the
   Component tags. It pulls in every piece of page infrastructure, in the right order, and it is
   also what starts the Components: they wait for it, because the text they render lives in it
   and in the workspace's own `assets/strings.js`, which it loads. A page missing that line
   still reads as prose — it just does not interact. Even the line is a safety net rather than a
   chore: `${CLAUDE_PLUGIN_ROOT}/scripts/wire-lessons.sh` injects it into any page missing it, so
   run that after writing a Lesson and forget about it. Your attention belongs on the
   teaching.
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
