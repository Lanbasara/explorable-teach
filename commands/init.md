---
description: Scaffold a teaching workspace in the current directory. Setup only — does not plan or teach.
argument-hint: "(optional) the topic, recorded as a seed"
---

Set up the plumbing for a teaching workspace in the current directory, and stop there.

This command is `git init`, not the first day of class. It creates directories and copies
files. It does **not** interview the learner, research the topic, plan a curriculum, or write
any lesson — all of that belongs to the `explorable-teach` skill, which owns the pedagogy and
must stay its single home.

## Do

Run the scaffold:

```
!`${CLAUDE_PLUGIN_ROOT}/scripts/init-workspace.sh`
```

It copies the parts that are identical for every subject — the tutor service and its control
script, the in-page widget, the nav bar, the dossier cover, the unit manifest, the lesson
bootstrap, the `tutor` subagent, and the shared stylesheet with the core interaction
components. It never overwrites, so it is also the repair tool for a workspace that lost a
file.

Report what it created and what it left alone.

If `$ARGUMENTS` names a topic, write a one-line `MISSION.md` recording just that topic and a
note that the mission is not yet established. A seed, not a mission.

## Do not

Do not ask the learner why they want to learn this. Do not go looking for sources. Do not draft
a curriculum or pick interaction patterns. If you feel the pull to start teaching, that is the
signal to stop and hand off — the skill will do all of it properly, with the formats and the
pedagogy in front of it.

## Finish

Tell them setup is done and what comes next, in one short block:

- `/explorable-teach` — establishes the mission, researches sources, and plans the course on
  first run, then teaches one lesson per session
- `./tutor/tutorctl.sh start` — optional, when they want the in-page tutor
- `index.html` — the dossier cover, empty until there are lessons
