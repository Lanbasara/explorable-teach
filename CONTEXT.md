# explorable-teach

A Claude Code plugin that teaches one person one subject over many sessions, producing
interactive HTML lessons in a directory that doubles as the memory between sessions.

## Language

### The workspace

**Workspace**:
A single directory holding everything about one learner studying one subject. It is the memory;
conversations are disposable.
_Avoid_: project, course directory

**Mission**:
The reason this learner is studying this subject. Every Unit traces back to it.
_Avoid_: goal, objective

**Curriculum**:
The ordered plan of Units, carrying a progress marker on each.
_Avoid_: syllabus, roadmap, lesson plan

**Dossier**:
The workspace entry point (`index.html`) — the one page from which every Unit is reachable.
_Avoid_: index, home, cover

### Teaching

**Unit**:
One teaching increment and the spine of the domain: a Lesson, its Exercises, optionally a
Checkpoint and an Assignment, plus the Learning Record and progress marker they produce. One
Unit is what one Session delivers.
_Avoid_: module, chapter, topic

**Lesson**:
The prose-and-interaction body of a Unit — one HTML file. Names the body only, never the whole
Unit.
_Avoid_: page, article, tutorial

**Component**:
A reusable interaction pattern a Lesson is built from (predict-reveal, step animation, simulated
terminal). Named by the teaching act it performs, not by the library implementing it.
_Avoid_: widget, plugin, library

**Explorable**:
A Lesson that teaches by letting the learner manipulate the subject before it is explained.
_Avoid_: interactive lesson, demo

**Zone of proximal development**:
The band of difficulty where the learner is challenged but not stalled. Determines which Unit
comes next.

**Storage strength**:
Long-term retention, as opposed to *fluency strength* — in-the-moment recall. Fluency feels like
mastery and is not; the Curriculum optimises for storage strength.

### Assessment

Three instruments, distinguished by when they fire, who judges, and what they measure.

**Exercise**:
An in-Lesson check, judged by the page the instant the learner answers. Measures whether
understanding happened just now.
_Avoid_: quiz, question, practice

**Checkpoint**:
The gate on a Unit, judged by the page at the Unit's end. Measures whether the Unit can be
closed.
_Avoid_: test, review, assessment

**Assignment**:
A task performed in the learner's real environment, judged by a Grader against a Rubric, given
one to three Units after the material it draws on. Measures transfer.
_Avoid_: homework, project, exercise

**Rubric**:
What counts as done for an Assignment, plus its likely failure modes. Stored inside the
Assignment so any future Grader can judge it without the context that wrote it.
_Avoid_: criteria, marking scheme

**Submission**:
The evidence a learner offers for an Assignment — written in the page for short answers, or
dropped into the workspace for anything the page cannot hold. Evidence of the work, not
necessarily the work itself.
_Avoid_: answer, upload, hand-in

### Agents

**Teacher**:
The agent running this skill. Plans the Curriculum and authors Units. Reads and writes the
workspace.
_Avoid_: author, planner

**Tutor**:
A read-only agent that answers a learner's question about a Lesson they are reading. Holds no
state between questions.
_Avoid_: assistant, helper, TA

**Grader**:
A read-only agent that judges one Assignment submission against its Rubric. Carries no memory of
the session that set the Assignment.
_Avoid_: marker, reviewer

### Sessions

**Session**:
One conversation with the Teacher, scoped to deliver one Unit and then end deliberately. Ending
is what prevents quality decay; the workspace is what survives.

**Boot sequence**:
The fixed set of workspace reads a Session performs before proposing anything.
_Avoid_: startup, init, warm-up

**Handoff**:
What a Session writes before ending so the next one resumes without re-interviewing the learner.
_Avoid_: summary, notes
