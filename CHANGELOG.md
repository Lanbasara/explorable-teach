# Changelog

## Unreleased

### Changed

- **The component catalog is now a selection guide, indexed by teaching act.** It was indexed by
  underlying library and stacked into five tiers, so a teacher arriving from "I need to show how
  `fork` works" met a shelf of tools and had to work backwards to its own question. It now reads
  from the left: a column of teaching acts, each routed to what to reach for and to whether it is
  shipped or built for this subject. Sixteen of the twenty old rows named a file that does not
  exist — `scrolly.js`, `flashcard.js`, `network-graph.js` — on a convention that a bare filename
  meant "build this on demand"; a teacher that believes a file exists does not write it, so no
  row names a file the plugin does not ship any more. The CDN quick reference went with the
  library index, leaving the rule it was there to serve: pin the version, wrap the library behind
  the teaching act, declare what it needs in the component's `Deps:` line, and write the content
  into the markup so the lesson reads before the script runs.
- **Unit authoring moved out of the skill, and the format specifications were consolidated.**
  How to write a Unit — the forms a lesson, an exercise, a checkpoint and an assignment take,
  the page conventions, the component catalog and the navigation rules — is now `UNIT.md`,
  reached from the teaching loop step that writes a Unit. The four format specifications live in
  `formats/`. What is left in `SKILL.md` is what a session decides with: the boot sequence, the
  judgement criteria, the teaching steps, the session-end criterion and the pointers out — 534
  lines down to 184. The skill's document set is now one entry point, three documents beside it,
  and one directory of formats.
- **A session ends on a verifiable outcome.** "Stop deliberately" was a bound no agent could
  evaluate — any session that stopped could report that it had stopped deliberately — so it
  constrained nothing while reading as though it did. A session may now end **when the next one
  could resume from the workspace alone, without asking the learner anything**, backed by a floor
  of handoff actions: the learning record written, the progress marker moved and the next unit
  named, preferences and any mission change recorded, every file reachable from the dossier, and
  the learner told where the next session starts.
- **The workspace file map is gone from the skill.** It restated what the scaffold installs,
  spelled as destinations rather than sources, and every file on it is named where it is
  actually used.
- **A hard-wrapped Markdown link is now a pointer.** The integrity check read raw lines, so a
  link whose text wrapped before its target was not a link on either of them — and a renamed
  heading left a broken anchor with nothing failing. Found by writing exactly that link.
- **First-run setup and the tutor runbook moved out of the skill, behind pointers.** Setting up
  a workspace fires on roughly one session in twenty and had fifty inline lines under a
  top-level heading; the tutor's ports, start commands and troubleshooting order were an
  operations runbook sitting between two teaching sections. Both are now documents of their
  own — `FIRST-RUN.md` and `TUTOR.md` — reached by a pointer from the session that actually
  needs them. This is a variance fix rather than tidying: reference that should have been
  disclosed buries the steps beside it, and turns attending to them into a coin flip. Exactly
  two tutor facts stay inline, because exactly two change what the teacher does — the learner's
  logged questions are read at boot, and a lesson must stay fully readable with the service
  stopped.
- **The skill opens on the Boot sequence, and hangs everything off the Unit.** `SKILL.md` used
  to open on a two-phase workflow and reach the Boot sequence four hundred lines later, behind
  a Component catalog and a Tutor runbook — reference material standing in front of the one
  thing every session does first. The Boot sequence is now the opening material, and its first
  step scaffolds a bare workspace by invoking `scripts/init-workspace.sh` rather than
  describing what that script installs. The **Unit** — a lesson, its exercises, optionally a
  checkpoint and an assignment, plus the learning record and progress marker they produce — is
  named as the spine, so Components, the assessment ladder, the Tutor and the Session boundary
  read as four faces of one object instead of four capabilities bolted on in turn. *Lesson* now
  names the body alone.
- **The assessment ladder is defined.** Exercise, checkpoint and assignment are separated by
  when each fires, who judges it and what it measures — not by difficulty. Checkpoint had been
  rendered by the navigation bar and the unit manifest since they were written and defined
  nowhere, so the slot had nothing behind it; it now has a definition, and the choice between
  the three instruments is judged rather than guessed.

### Removed

- **The standalone setup command.** Its whole payload had become a scaffold invocation plus a
  seed file and a report; it could be skipped with no consequence, and its documentation had
  drifted into contradicting its own behaviour. Scaffolding is now the first step of the Boot
  sequence, and `/explorable-teach` is the only name to remember. A workspace that is already
  set up notices and moves on.

### Added

- **Anchors are now under the integrity check.** A link at a heading — `](#the-unit)`, or
  `](./SKILL.md#boot-sequence)` — resolves against the headings of the file it lands on, not
  just against the file. This is the half a restructuring breaks: disclosing a section removes
  its heading, every link at it still resolves as a *file*, and the reader lands at the top of
  a long document with nothing having failed.
- **The core Components now ship with the plugin.** Shared styles, plus Exercise,
  Predict-Reveal, Step Animation and Drag Ordering, live in the plugin and are installed by
  the scaffold. Until now the catalog named roughly twenty component files and shipped none,
  and every freshly scaffolded workspace opened on a dead `assets/style.css` link. These five
  are identical for every subject, so they get one home rather than a copy per workspace.
  Each declares its dependencies and its markup at its file head, each stays readable with
  scripting off, each works opened from `file://`, and none of them touches the network —
  the GSAP and SortableJS dependencies the catalog used to list turned out to be a CSS
  transition and six native drag events.
- **`style.css` owns the design tokens.** Colours, spacing and fonts are defined once;
  `nav.css`, `tutor.css`, every Component and the dossier cover read them and define none, so
  re-theming a workspace is one file. It is linked from the page `<head>` rather than injected
  by script, so a lesson is styled whether or not anything ran. Light mode and a print
  stylesheet come with it; printing reveals what the interaction was hiding.
- **A test suite, run with `npm test`.** Node's built-in runner, zero third-party
  dependencies, no install step. It holds the plugin to the thing it keeps failing at:
  documents that promise what is not there. Every relative pointer in an agent-facing
  document — including the file list inside `SKILL.md`'s install block — must resolve; the
  scaffold must be safe to re-run against a workspace you have already put work into; the
  lesson bootstrap tag must land exactly once, and a second wiring run must change nothing.
  `tests/helpers/workspace.js` gives each test a throwaway fixture Workspace, and
  `tests/helpers/dom.js` a DOM small enough to read and real enough to mount a Component in —
  so every shipped Component is answered, stepped and reordered by the suite rather than
  merely read. Naming an `assets/…` path in a document is now a promise the suite enforces:
  it must exist in a scaffolded workspace. `docs/agents/tests.md` explains how to build on
  all of it, and is explicit about what the suite does *not* cover.

## 0.2.1

### Changed

- **Interviewing is now evidence-based, not file-based.** `teach` treats an unpopulated
  `MISSION.md` as a trigger to interview, and that condition is always true in a new
  workspace — so a request that already stated the goal, the constraints and the
  explicit non-goals still got a questionnaire. Inheriting that rule wholesale was the
  bug. The skill now interviews only when the mission is genuinely underdetermined,
  writes `MISSION.md` from the opening request when that request already carries it, and
  confirms in one line instead. The override is stated explicitly so the inherited rule
  cannot quietly reassert itself.

## 0.2.0

Everything here came out of the first real use of 0.1.0.

### Added

- **Dossier cover and unit navigation.** Lesson, checkpoint and assignment were
  disconnected files with no entry point, so the learner had to hunt for them.
  `index.html` is now the cover, `assets/nav.js` a sticky bar every page carries, and
  `assets/units.js` the single manifest both read.
- **Thread history and persistence for the tutor.** Threads survive closing the drawer
  and reloading the page, and any past thread stays reachable from a history list.
- **`assets/lesson-boot.js`** — one tag replaces the five infrastructure lines a lesson
  used to declare. `scripts/wire-lessons.sh` injects it into any page missing it and
  converts the old boilerplate in place.

### Changed

- **`init` no longer plans or teaches.** Its second half duplicated Phase 1 of the skill
  outright — interview, research, curriculum, tech stack — giving one responsibility two
  homes free to drift apart. It now copies files and stops, which is the boundary a
  command named `init` should have. Pedagogy lives in the skill alone.
- **Assignments are HTML, not Markdown.** A `.md` file is invisible from the browser the
  learner is already in. The rubric rides inside the same file in non-rendered blocks, so
  task and grading criteria cannot drift apart.
- Lesson authoring no longer wires page infrastructure by hand.

### Fixed

- **The tutor drawer destroyed conversations.** `open()` started a new thread whenever the
  selection differed, and the floating button passes an empty selection — so asking about
  a passage, closing, then reopening wiped the thread with no way back. Opening now never
  resets; switching passages archives rather than discards.
- **Backdrop click-to-close** was the accidental dismissal learners actually hit. Removed;
  `×` and `Esc` remain. The backdrop needed `pointer-events: none` or it swallowed all page
  interaction once its handler was gone.
- **The tutor widget would have silently failed to mount.** It initialised on a bare
  `DOMContentLoaded` listener, which never fires for a dynamically loaded script because the
  event has already passed. The nav bar, which guards on `document.body`, worked fine — so
  the page would have looked healthy with the tutor simply absent.

## 0.1.0

Initial release. Teaching skill producing interactive HTML lessons, an in-page AI tutor that
holds no process state, and a one-shot workspace initialiser.
