# Changelog

## Unreleased

### Changed

- **An assignment can be handed in from the page it is written on, and judged there.** It used to
  be a page with a task and no way to answer it, so the loop dead-ended and the learner had to
  switch tools to get anything graded. The page now carries a hand-in — `assets/assignment.js`, a
  sixth shipped component — with a box for a short answer and a box for paths into `submissions/`.
  The verdict streams back into the same page, can be questioned as a follow-up, and reaches the
  teacher on its own.
- **A submission is evidence of the work, not necessarily the work.** Short answers go in the
  page; anything larger goes into `submissions/` and is named by path. The grader opens those
  itself with the read-only tools it already has, so there is no upload path, no multipart
  endpoint and no widening of what the server may touch. The scaffold creates `submissions/` with
  a README in it, so the directory is a real thing in your version control from day one — a
  submission excluded from history is a verdict nobody can look back at, and the suite checks that
  through `git check-ignore` rather than by reading ignore patterns.
- **The rubric travels inside the assignment, in a block nothing renders.** A
  `<script type="application/x-rubric">` element: never displayed, never executed, and never sent
  anywhere. The grader reads it off the file, which is what makes a judgement reproducible from
  the page alone rather than from whatever the page chose to send. An assignment with no rubric
  stored in it offers no hand-in at all — a task nobody can grade should not collect work.
- **Grading is a second role on the service that was already running.** One more entry in the
  `ROLES` map, so streaming, the three stages of the wait, the stop, the retry, the question log
  and the offline fallback all behave exactly as they do for a question. A thread now carries its
  role, which is what makes a follow-up about a verdict reach the grader that gave it.
- **Grading never runs as the teacher that wrote the assignment.** The grader composes
  `tutor/GRADER.md` — the plugin's, linked like the tutor's — plus `tutor/GRADER-TUNING.md`, this
  course's own, and nothing else; there is a `grader` subagent pointed at the same two files in
  the same order. The tutor's two halves sit one file away in the same directory, so the suite
  asserts their *absence* from the grader's prompt rather than only the grader's presence.
- **A verdict is written into `learning-records/` as a record of its own.** The question log is
  feedback about the page; a verdict is evidence about the learner, which is the other file and
  the one the boot sequence plans from. It is also the only way the loop closes without the
  learner: an assignment is done between sessions, so the session that set it is gone and the
  session that would have written the record has not started. The record lands before the page is
  told the answer, so the page names where it went rather than asserting that it did. Questioning
  a verdict writes nothing — that is a conversation about a record, not a second one.
- **With the service stopped, handing in degrades to the same clipboard fallback a question
  does** — and says so, rather than reporting work as judged when it was copied instead. The
  copied prompt puts the submission to the `grader` subagent by name and says not to grade it
  yourself: the session it is most likely to be pasted into is the one that wrote the assignment.
- **A grader that refuses to judge is not recorded as having judged.** Asked to grade an
  assignment storing no rubric, it refuses — and opens the refusal with a line the service watches
  for, so nothing lands in `learning-records/` looking like a verdict. The record's evidence line
  states provenance rather than claiming which criteria were applied.
- **The drawer derives the page it is on instead of assuming `lessons/`.** An assignment does not
  live there, and a grader sent to the wrong path reads nothing. Pinned answers keep their old
  storage keys, so nothing a learner had saved moves.

- **A unit now has a checkpoint, and the navigation slot that always rendered one finally has
  something behind it.** Checkpoint was named by the nav bar and by the course manifest from the
  day both were written, and defined nowhere — not what it is, not when to write one, not how it
  differs from an exercise in a lesson or from an assignment. It is now a page of its own at the
  end of a unit, `0003b-checkpoint.html` beside `0003-fork-exec.html`, built out of ordinary
  exercises and gated by `assets/checkpoint.js` — a fifth shipped component, linked into every
  workspace like the other four. It says how far through the learner is, and once every question
  is answered it says whether the unit may close and what the score was. A wrong answer sends
  them back to the part of the lesson it came from rather than leaving them with a red box.
- **A checkpoint passes only on all of its questions.** There is no pass mark to set: a gate with
  one is a score, and a score does not answer *may we move on?*. The decision worth making is
  which questions belong in the gate, so a question that could be got wrong while the unit still
  closes belongs back in the lesson as an exercise.
- **The teacher is told when to write one.** A checkpoint is worth the page when a later unit
  will build on this one and a misunderstanding carried out of it would compound instead of
  surfacing; a unit nothing later depends on closes on its exercises. `UNIT.md` carries the form
  — where the file sits, how many questions, both outcomes, and the one link the author writes by
  hand — and the rest of the linking is one `checkpoint:` entry in the course manifest.
- **Both outcomes of a checkpoint carry the way back.** Only one of the two is ever on screen, so
  a way back written into the failing one alone leaves a learner who passed with nothing but the
  nav bar. Both are now required, and a page carrying only one of them makes the component refuse
  to mount rather than count answers and then go quiet on half the learners who reach the end.
- **Every artifact of a unit is now under test for being reachable.** `nav.test.js` mounts the
  bar the way the page bootstrap mounts it and drives it against a manifest holding one unit with
  a checkpoint and one without: the first links to it and back, the second shows the slot greyed
  and labelled rather than dropping it, and nothing in the bar points at a file that was never
  written. The fixture Lesson became a fixture *Unit* of two pages, `tests/helpers/unit.js`,
  which is what a unit was already defined to be. The fixture DOM grew `href`, `title` and
  `page.script(file, attrs)` to carry it — the bar builds every link by assigning the first two,
  so a DOM modelling neither would have reported a working bar as an empty one.
- **A question in flight says what it is waiting for.** Pressing send used to produce an empty
  bubble and a blinking caret for the several seconds the agent takes to start up and read, so a
  slow answer and a hung one looked identical. The wait is now reported in three stages — the
  service has the question, the tutor is reading the workspace (and which file), the answer is
  arriving — with a clock beside it. The middle stage is not new information: the server has
  always sent one event per workspace read, and the drawer drew them as decorative chips. Nothing
  in the server changed.
- **An answer in progress can be stopped.** The stop button sits in the row that reports the
  wait, so it is there for exactly as long as the request is, and whatever had arrived before the
  stop stays on the page. Stopping closes the connection, which is what the server watches to
  kill the agent behind it — a wrong question no longer costs the full 120-second timeout.
- **A failed question ends in something you can do.** It used to end in `连接老师服务失败：` and
  whatever string came back. It now offers a retry and the same clipboard prompt the offline
  composer builds, with the raw detail kept underneath rather than in place of them. A retry asks
  about the passage the question was about, and the thread still shows the question once. Neither
  retry nor regenerate gives up what it is replacing until the replacement is actually going, so
  clicking either while the service is down leaves you with the answer, or with the fallback,
  that you already had.
- **An answer can be copied and regenerated, next to the pin that was already there.** Copy puts
  the answer in the clipboard as the tutor wrote it — Markdown, so another tool can read it back.
  Regenerate replaces the answer rather than adding one below it, and drops the rejected pair
  from the replay, so the next question is not asked in the shadow of an answer you turned down.
  It is offered on the newest answer only.
- **The drawer finds the service when you start it, without a reload.** It used to probe once
  when the page loaded and then sit in the offline state saying "start it and reload" however
  long you looked at it — the one state the page could not get itself out of. It now keeps
  asking while it is offline and stops the moment it is not, so starting the service is the whole
  of the instruction.
- **The tutor's answers render as rich text.** Every answer used to be inserted as plain text, so
  a code block, a bulleted list and a sentence all arrived as one run of characters — most of the
  tutor's usefulness gone on any subject involving code. Headings, lists, inline code, fenced
  code with its language, emphasis and links now render as what they are, in the drawer and in a
  pinned answer alike, so saving an answer no longer degrades it. A half-streamed answer renders
  too: an unterminated fence is still a code block rather than a wall of text. The renderer is
  `assets/rich-text.js`, which the scaffold links into every workspace like any other invariant
  file, and which is loaded before the drawer by the page bootstrap.
- **Nothing in an answer reaches a position the page would execute.** The renderer builds nodes
  from a fixed set of tags and never assigns markup, so `<script>` in an answer is a sentence the
  learner reads; a link whose destination is not `http`, `https` or `mailto` stays in the answer
  as the text it was written as, rather than quietly disappearing. No rendering or sanitising
  dependency was added — the plugin still has none. The renderer takes a node factory rather than
  reaching for `document`, which is what lets the whole of it, including those guards, be tested
  in a context with no browser in it.
- **The in-page drawer is under test for the first time.** It is mounted in the fixture DOM and
  driven the way a learner drives it — open, type, send — against a stub that streams the event
  shapes the server emits. The fixture DOM grew one option for it, `Page.load(html, dir, {
  globals })`, so a drawer that needs storage or a stream can say so at the call site while the
  window every component runs against stays bare.

- **The tutor and the page infrastructure now live in the plugin, and a workspace links at
  them.** Every workspace used to hold its own copy of the server, the control script, the role
  prompt, the in-page widget, the nav bar, the page bootstrap, the shared stylesheet and the four
  components — twelve forks of the same code, so fixing a tutor defect fixed it in none of them,
  only in workspaces created afterwards. The split is now one question, **does this file vary by
  subject?** It does not: it lives in `skills/explorable-teach/runtime/` and the workspace holds a
  symlink at it. It does: it is copied in once and is yours from then on — `tutor/TUNING.md`,
  `assets/units.js`, `index.html`, the subagent definition, and everything you author. The
  scaffold re-points every link on each run, and the boot sequence now runs it **every** session
  rather than only when a workspace looks bare — that is how a workspace follows the plugin
  across an upgrade, and gating it on emptiness would have stranded every existing workspace on
  the version it was born under. **Do not edit a linked file in place** — you would be editing
  every course on the machine; write a new file beside it instead. If one course genuinely has to
  replace a shared file, delete the link and write a real file there: the scaffold reads that as
  a deliberate override and never touches it again.
- **A workspace scaffolded before this change keeps its hand-tuned `tutor/ROLE.md`**, because the
  scaffold will not replace a real file with a link. It is no longer read, though: move anything
  subject-specific out of it into `tutor/TUNING.md`, then delete it so the shared definition
  links in.
- **The tutor's role is one definition plus this course's tuning.** `tutor/ROLE.md` is the
  plugin's, shared by every workspace, and `tutor/TUNING.md` is yours: the terms this subject
  keeps in English, the analogies it has already built, what it does and does not cover. The
  service composes them in that order, and the `tutor` subagent is pointed at the same two files
  in the same order — so it carries no role text of its own, and the two paths cannot drift into
  one being a degraded version of the other. An empty tuning file is a normal day-one state.
  Workspaces scaffolded before this change keep their old `tutor/ROLE.md` content, which the next
  scaffold run replaces with the link; move anything subject-specific in it to `TUNING.md` first.
- **The server takes the workspace it serves as an argument.** It used to infer it from its own
  location, which stops working once it lives in the plugin. `./tutor/tutorctl.sh` passes it;
  run by hand it falls back to the working directory, so `node tutor/server.js` from a workspace
  root still does what it always did. Static requests under `/assets/` that the workspace cannot
  answer fall back to the plugin's copy, with path normalisation, the root check and the
  extension allowlist applied to each root on its own — so a workspace copied to another machine
  still renders over http while its links are dangling. The static check also bounds the bytes
  now and not only the path: a file is served only if it really sits in the workspace or in the
  plugin's assets, so the scaffold's own links are followed and a link pointing anywhere else is
  refused. That was free while no workspace file was a link, and had to be asked for once
  escaping links became the design. Nothing else about the server's security posture changed, and
  it is still driven entirely over HTTP by the test suite.

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

- **The tutor server is now driven over HTTP.** It holds the security-sensitive code in this
  plugin — path-traversal guards, an extension allowlist, argv `spawn` with no shell, input
  caps, a loopback bind, an idle shutdown — and `TUTOR.md` says the scaffold copies it rather
  than any session writing it *because* re-deriving that from prose risks silently dropping a
  guard. Nothing would have noticed if one had been dropped. The service now runs as its own
  process on its own port against a fixture workspace, and every claim is made from outside it:
  the health shape, the extension allowlist refusing a file that is really there, traversal
  refused in six spellings against a file that really exists outside the workspace, a root
  request landing on the first lesson, every rejected shape of a question, the event sequence
  reaching the client, and exactly one question-log line per answered question. History
  trimming is read off the payload the agent was actually handed. `tests/helpers/tutor.js`
  starts the service and puts a stub agent first on `PATH` — the real `claude` is unreachable
  from the suite — which is what makes the streaming shapes observable at all. No line of
  `server.js` changed to make any of it possible.
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
