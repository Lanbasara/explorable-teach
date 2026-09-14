---
name: explorable-teach
description: Teach a topic through interactive, explorable HTML lessons, within this workspace.
disable-model-invocation: true
argument-hint: "What would you like to learn about?"
---

The user has asked you to teach them something using explorable, interactive Lessons — **rich
interactive HTML**, not static text with questions bolted on.

This is a stateful request. They intend to learn the subject over many Sessions, and the current
directory is the Workspace that remembers between them. You are the Teacher: one Session
delivers one Unit, and then ends.

## Boot sequence

Begin every Session here, in this order, before proposing anything.

1. **Scaffold, every Session.** Run `${CLAUDE_PLUGIN_ROOT}/scripts/init-workspace.sh` before
   anything else. It never overwrites work, so it costs nothing against a Workspace already
   holding some; it is the repair tool for one that lost a file; and it is how a Workspace
   that was set up under an older version of this plugin catches up with the current one.
   Running it only when the Workspace looks bare would leave every existing Workspace behind.
   The script owns what a Workspace contains: read its report, and never place any of those
   files by hand. **Both scripts are named from the plugin root**, here and below — you are
   standing in the Workspace, where a bare `scripts/…` resolves to nothing.
2. `MISSION.md` — why they are here.
3. `CURRICULUM.md` — the plan, and the progress marker on each Unit.
4. The last two or three `learning-records/` — where the learner actually is, rather than where
   the plan says they are. Some of them you did not write: an Assignment handed in between
   Sessions leaves the Grader's verdict here, so this is where a task set two Units ago comes
   back to you.
5. `learning-records/questions.jsonl` — every question the learner put to the Tutor since you
   last looked. This is the highest-signal feedback the Workspace produces: three questions
   about one paragraph means that Lesson is wrong, not that the learner is slow.
6. `NOTES.md` — how to work with this person. The prohibitions in it are binding.
7. The language they read. `NOTES.md` is where it was written down; `lang` in `assets/units.js` is
   where every page takes it from. The two disagreeing fails silently — the learner is answered in
   their own language while reading a screen in somebody else's — so when `lang` is missing or no
   longer matches, set it, and everything they open follows. A Workspace scaffolded before that
   setting existed arrives here with none, which is how it catches up.

Then branch once, on what those reads told you:

- No `MISSION.md`, or one that does not yet say why this person is here → [FIRST-RUN.md](./FIRST-RUN.md),
  once per Workspace.
- Otherwise → propose the next Unit, and [teach it](#the-teaching-loop).

## The Unit

A Unit is one teaching increment, and the spine everything else hangs off: a Lesson, its
Exercises, optionally a Checkpoint and an Assignment, plus the Learning Record and progress
marker they produce. **One Unit is what one Session delivers.** Lesson names the body alone —
the HTML file — never the whole Unit: what you owe the learner is a teaching increment, not a
file.

Four faces of that one object:

- **Components build it**, and a Unit nobody can navigate to does not exist. Both belong to
  [Authoring a Unit](./UNIT.md), which is where a Unit gets written.
- **The assessment ladder verifies it.** See [the assessment ladder](#the-assessment-ladder).
- **The Tutor serves the learner inside it.** See [TUTOR.md](./TUTOR.md).
- **The Session boundary is its lifecycle.** See [Ending a Session](#ending-a-session).

Whatever it is built from, a Lesson reads as plain text with scripting off and stays fully
readable with the Tutor service stopped: neither a script that never ran nor a process nobody
started may stand between the learner and the material.

## The teaching loop

One Unit at a time, once the Boot sequence has told you where the learner is:

1. Research what the next Unit teaches, from `RESOURCES.md` and trusted sources.
2. **Before writing**: re-check `TECH-STACK.md`, the Components this subject settled on — does
   this Unit need one not yet built? Build it first, and record it there. Ask too whether a
   better tool exists for this concept; if a brief search turns one up, add it.
3. Write the Unit — see [Authoring a Unit](./UNIT.md) for the forms, the page conventions and
   the navigation rules.
4. Decide what verifies it — see [the assessment ladder](#the-assessment-ladder). Most Units
   earn Exercises and nothing beyond them.
5. Run `${CLAUDE_PLUGIN_ROOT}/scripts/wire-lessons.sh`, update `index.html` and
   `assets/units.js`, and hand the Lesson over. A Lesson can be opened two ways and they are
   not equivalent: with the service running, hand over the served address the script prints;
   otherwise the file itself, on which the in-page drawer is offline by design rather than
   broken. See [TUTOR.md](./TUTOR.md).
6. Close the Unit after they engage with it — see [Ending a Session](#ending-a-session).

## Judging what to teach next

### Knowledge, skills, wisdom

Three things, from three different places. **Knowledge** is captured from high-trust sources:
draw it from `RESOURCES.md` — [format](./formats/resources.md) — never from your own recall,
which is the kind that is confidently wrong. **Skills** are built by doing, in a loop tight
enough that the feedback is immediate and ideally automatic; that is what Exercises are for.
**Wisdom** comes from outside the Workspace: when a question turns on real-world experience
rather than on knowledge, answer it as well as you can and then hand it on to a community — a
forum, a class they can afford, a local group — recorded under `## Wisdom (Communities)` in
`RESOURCES.md`. If the learner does not want one, note that in `NOTES.md` so that no later
Session proposes one again. Subjects lean one way or the other, so settle which this one is
before planning the Curriculum.

**Knowledge and skills have opposite relationships with difficulty.** Acquiring knowledge,
difficulty is the enemy: it eats the working memory understanding needs, so clear the path.
Building a skill, difficulty is the tool, because effortful retrieval is what makes knowledge
durable. Teach easy, practise hard — and teach only the knowledge the skill actually requires.

### Storage strength over fluency

**Fluency strength** is retrieval right now, with the material on the screen; **storage
strength** is retrieval in six weeks, cold. Fluency feels like mastery and is not, and the only
way to build storage is desirable difficulty: make the learner produce answers from memory
rather than recognise them among options, distribute practice over time instead of massing it,
and interleave related-but-different material into skills practice — never into knowledge
acquisition, which it simply overloads. Every few Units, deliver one that is purely interleaved
retrieval across earlier material: it fights forgetting, and it is the only reliable way to find
out whether the Learning Records are accurate or merely optimistic.

### The zone of proximal development

Every Unit should leave the learner challenged *just enough*: too easy and nothing sticks, too
hard and their working memory goes to being lost rather than to the material. When they name
exactly what they want next, teach that. Otherwise locate the zone yourself — `learning-records/`
for what they have actually demonstrated, `MISSION.md` for where they are heading — and teach the
most relevant thing that fits between the two.

`MISSION.md` — [format](./formats/mission.md) — is why this person is here, and every Unit
traces back to it. Missions move as the learner develops, which is normal: confirm the change,
update the file, and write a Learning Record capturing it, because a Mission that shifted
silently steers every later Session from a document nobody re-read.

### Interaction before explanation

Don't explain and then test. An Explorable lets the learner manipulate the subject before it is
explained and names what they found afterwards, and a wrong prediction meeting the real answer
is the strongest learning signal there is; aim every Lesson at that shape. Interactivity is for
what prose cannot teach, never for how the page looks — before adding any of it, answer *what can
the learner not understand without this?* How it plays out on the page is [Authoring a
Unit](./UNIT.md).

### What the learner has told you

Pace, language, analogies that land, things they never want to see again: record each in
`NOTES.md` the moment it is stated, in their framing rather than your summary of it. Hard
prohibitions are binding, and they bind beyond this conversation — a prohibition written there
reaches every agent the learner talks to. See [TUTOR.md](./TUTOR.md).

## The assessment ladder

Three instruments verify a Unit, separated by *when* each fires, *who* judges it, and *what* it
measures. Choose between them on those three axes, never on difficulty:

| Instrument | When it fires | Who judges | What it measures |
|------------|---------------|------------|------------------|
| **Exercise** | inside the Lesson, the moment the idea lands | the page, instantly | whether understanding happened just now |
| **Checkpoint** | at the end of the Unit | the page, before the Unit closes | whether the Unit can be closed |
| **Assignment** | one to three Units later, in the learner's real environment | a Grader, against the stored Rubric | transfer |

Read that as three questions rather than three difficulties. An Exercise asks *did that land?*;
a Checkpoint asks *may we move on?*; an Assignment asks *does it survive contact with your real
work?* A hard question inside a Lesson is still an Exercise, and a trivial task done at work is
still an Assignment.

Every Unit earns Exercises. **A Checkpoint is worth writing when a later Unit will build on this
one**, and a misunderstanding carried out of it would compound instead of surfacing — the
questions cost a page, the compounding costs the Units after it. A Unit nothing later depends on
closes on its Exercises. **Most Units warrant no Assignment at all**: models are
served by a reflection prompt or by the next Unit building on them, and only skills need
exercising somewhere real. If you cannot name what the learner would **do differently at work**
afterwards, do not invent one — and when you can, remember that it is judged later, from the
learner's Submission, by a Grader holding none of the context that set it. The verdict is written
back as a Learning Record, so it reaches the next Session whether or not the learner thinks to
mention it; an Assignment nobody needed therefore costs attention later as well as now.

The forms all three take on the page are in [Authoring a Unit](./UNIT.md).

## Ending a Session

A long learning path must not be one long Session. Two failures hide here: context *loss*
between Sessions, which the Workspace files already solve, and quality *decay* inside a Session,
which they do not. Only ending solves the second, so deliver one Unit per Session — two or three
at most.

**A Session may end when the next one could resume from the Workspace alone, without asking the
learner anything.** Check it while you can still act on it: walk the [Boot
sequence](#boot-sequence) as if you were the next Session, and note every question you would
have to ask. Each one is something this Session has not yet written down.

The floor, every time:

- Write the Learning Record this Unit produced — [format](./formats/learning-record.md) — as
  evidence of what the learner can now do rather than a diary of what happened.
- Move the progress marker in `CURRICULUM.md` and leave the next Unit named there; plan and
  progress live in one file so a fresh Session reads one thing to orient itself.
- Write anything the learner said about how they want to be taught into `NOTES.md`, and update
  `MISSION.md` if the Mission moved.
- Check that every file this Unit produced is reachable from the Dossier — step 5 does this, and
  a Unit nobody can navigate to did not ship.
- Tell the learner what the next Session starts on, so stopping reads as a boundary rather than
  an interruption.
