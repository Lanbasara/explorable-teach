# Changelog

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
