---
description: Set up a teaching workspace in the current directory — scaffold the tutor, then author the curriculum with the learner.
argument-hint: "What do you want to learn?"
---

Set up a new teaching workspace in the current directory. Do not teach anything yet — this
command ends with a plan the learner has agreed to, not with a lesson.

Work in two halves, in this order.

## Half 1 — scaffold (mechanical, no judgement needed)

```
!`${CLAUDE_PLUGIN_ROOT}/scripts/init-workspace.sh`
```

This copies the parts that are identical for every subject: the tutor server, its control
script, the in-page widget, and the `tutor` subagent definition. It never overwrites an existing
file, so it is also the way to repair a workspace that lost one.

Report what it created, then move on.

## Half 2 — author (needs the learner)

The scaffold is deliberately subject-agnostic. Everything that makes this workspace *this*
learner's workspace, you now write. Read the `explorable-teach` skill first — it defines the
formats and the pedagogy — then produce, in this order:

1. **`MISSION.md`** — interview them. Why this topic, why now, what will they do with it that
   they cannot do today? Do not accept "I want to learn X" as a mission; push until there is a
   concrete goal a lesson can be traced back to. This is the one input everything else depends
   on, so spend real effort here.

2. **`RESOURCES.md`** — go find high-trust primary sources for the topic. Never rely on
   parametric knowledge. Note what each source is good for and what it is bad for.

3. **`CURRICULUM.md`** — the lesson plan, ordered by *dependency between ideas*, not by the
   table of contents of any book. Include progress markers. State the one central claim the
   whole course argues for; if you cannot write that sentence, the plan is not ready.

4. **`TECH-STACK.md`** — research which interaction patterns actually fit this subject, and pick
   the minimum that serves the teaching. A philosophy course needs typography and
   scrollytelling, not a 3D engine. Record what you deliberately left out and when it would
   become worth adding.

5. **`NOTES.md`** — how this person wants to be taught. Anything they have already told you
   about pace, analogies that work, things they explicitly do not want. Record prohibitions as
   prohibitions; the tutor reads this file and treats it as non-negotiable.

6. **`tutor/ROLE.md`** — the scaffold installed a generic version. Adjust it for this subject:
   which files are worth reading for this material, what a good answer looks like here, and any
   subject-specific traps. Leave its structure intact.

## Finish

Show the learner the curriculum and get their agreement or corrections before ending. Then tell
them how to start: `/explorable-teach`, and optionally `./tutor/tutorctl.sh start` when they
want the in-page tutor.

If `$ARGUMENTS` names a topic, use it as the starting point for the interview rather than asking
from scratch.
