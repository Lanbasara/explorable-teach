# explorable-teach

A Claude Code plugin that teaches one person one subject over many sessions, producing
interactive HTML lessons in a directory that doubles as the memory between sessions.

## Language

### The workspace

**Learner**:
The one person a Workspace exists for. Every other role is defined by what it does for them, and
the language they are taught in is theirs, recorded in `NOTES.md` rather than assumed from the
plugin.
_Avoid_: student, user

**Workspace**:
A single directory holding everything about one learner studying one subject. It is the memory;
conversations are disposable. What varies by subject lives here; what does not is linked from the
plugin, so it has one home and one fix.
_Avoid_: project, course directory

**Mission**:
The reason this learner is studying this subject. Every Unit traces back to it.
_Avoid_: goal, objective

**Curriculum**:
The ordered plan of Units, carrying a progress marker on each.
_Avoid_: syllabus, roadmap, lesson plan

**Dossier**:
The Workspace entry point (`index.html`) — the one page from which every Unit is reachable,
under both readings: opened from disk, and served, where every address that names it returns it.
_Avoid_: index, home, cover

**Tutor service**:
The local http service that serves a Workspace's pages, and the transport the Tutor and the
Grader reach the Learner on. A page it did not serve cannot reach it, which is why the in-page
drawer is offline by design on a Lesson opened from disk. Serving buys exactly two things: that
drawer, and an origin for the page — without which it may not fetch its own files. It does not
decide whether a module or a library loads, because a pinned https CDN answers a page opened from
disk just as well.
_Avoid_: server, backend, daemon

**Learning Record**:
What one Unit demonstrated the learner can now do, written after they engage with it. Numbered
`0001-slug.md`. It is evidence rather than a diary, and it is what the next Session plans from.
Usually the Teacher writes it; a graded Assignment writes its own.
_Avoid_: log, journal, session notes

**Progress marker**:
The status each Unit carries in the Curriculum. Plan and progress live in one file so that a
fresh Session reads one thing to orient itself.
_Avoid_: status field, checkbox, tracker

### Audience

Every string this project ships has exactly one reader, and that reader decides its language.
The test is *"would the Learner ever see this?"* — not what the string eventually becomes.

**Maintainer-facing**:
Text only someone changing the plugin reads: role definitions, prompt scaffolding, the runtime
README, code comments, server logs. Always English, in every Workspace. Prompt scaffolding counts
as maintainer-facing even though an agent consumes it — what makes the agent's *answer*
Learner-facing is an instruction, not the language the scaffolding is written in.
_Avoid_: internal, dev-facing

**Learner-facing**:
Text that reaches the Learner's screen: drawer chrome, Component labels, the Tutor's and Grader's
prose, anything a failure puts in front of them. Produced in the Learner's language at run time,
falling back to English when none is recorded.
_Avoid_: UI strings, user-facing, i18n strings

**Seed**:
Learner-facing text in a file the scaffold *copies* — the Dossier's chrome, the course manifest's
labels, the description line on a subagent. It is the exception to the rule above: not produced at
run time and not in any table, because a copied file is one Workspace's own from the moment it is
placed and has no other Workspace to stay consistent with. It ships in English, since the plugin
cannot know who it is about to be handed to, and the Teacher may rewrite it.
_Avoid_: default string, placeholder text

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

**Stand-in sentence**:
The one sentence a Component that is a picture carries in its markup: what would be shown, and
what it demonstrates. It is three things at once — what the Learner reads when no script ran, the
picture's accessible description, and what the Tutor has to go on when they ask about something
it cannot see. A Component made of text needs none, because it can write its content into the
markup and let the script take it over; a drawing cannot.
_Avoid_: alt text, caption, fallback, placeholder

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
dropped into `submissions/` and named by path for anything the page cannot hold. Evidence of the
work, not necessarily the work itself, which is why nothing is ever uploaded: the Grader reads
what is already in the Workspace.
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

**Tuning**:
What one Workspace adds to an agent's role definition for its own subject. The definition itself
belongs to the plugin and is shared by every Workspace; the Tuning is appended after it, so it
sharpens the definition rather than replacing it.
_Avoid_: custom prompt, override, local role

**Grader**:
A read-only agent that judges one Assignment submission against its Rubric. Carries no memory of
the session that set the Assignment, and reads the Rubric off the Assignment page rather than
being handed it. Its verdict becomes a Learning Record, so it reaches the next Session.
_Avoid_: marker, reviewer

### Sessions

**Session**:
One conversation with the Teacher, scoped to deliver one Unit and then end. It may end once the
next Session could resume from the workspace alone, without asking the learner anything. Ending
is what prevents quality decay; the workspace is what survives.

**Boot sequence**:
The fixed set of workspace reads a Session performs before proposing anything.
_Avoid_: startup, init, warm-up

**Handoff**:
What a Session writes before ending so the next one resumes without re-interviewing the learner.
_Avoid_: summary, notes
