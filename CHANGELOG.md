# Changelog

## Unreleased

### Added

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
