# Changelog

## 0.6.0

### Changed

- **The reference says what one Session can realistically build, and shows the evidence for it.**
  One Session, one Lesson file, a pinned library from a CDN permitted, reaches **one screen's worth
  of interactive scene, or one interaction with a single mechanic in it** — and nothing above that.
  The number arrives with its evidence rather than on its own, because the artifacts that appear to
  refute it are exactly the ones a Teacher has in mind while deciding: on inspection they are full
  builds with dozens of commits, hand-written test scripts and megabytes of authored assets behind
  them, a large share of them are not web pages at all, and the practitioner this genre is most
  often named after publishes one to three pieces a year. Stated bare, a ceiling reads as timidity
  and gets applied to somebody else. What it prevents is specific: the Session goes on the
  interaction, and the Unit is handed over with its teaching never written.
- **A description is priced before the building starts, and either outcome is written into
  `CURRICULUM.md`.** The judgement happens at the point the match says **Build** and before a line
  of the thing exists — an overrun is otherwise discovered rather than decided. What will not fit
  takes one of two outcomes, both legitimate: the **cheapest honest version** of the form, which
  every derivation already carries, or the Session **converts into one that builds the tool**,
  naming the Unit it displaced as the next one. Either way the choice lands in `CURRICULUM.md`,
  which is what the next Session's Boot sequence reads. This does not weaken *one Unit per Session*:
  a converted Session delivers the tool **instead of** the Unit, never as well as it, so the bend is
  visible in the Workspace rather than silent. `CURRICULUM.md` gains room for that entry — the
  first run now says that not every entry of it is a Unit — for the reason the `TECH-STACK.md`
  column exists: a requirement to record something into a document with no place for it becomes a
  note at the bottom and then nothing.
- **Reusable plumbing may be handed to a subagent against a written specification; the teaching
  never is.** The specification carries four things — the teaching act it performs, its inputs and
  outputs, its pinned dependency, and the constraints every Component here already carries — because
  a subagent has read none of this document, and what is left out of the brief is simply absent from
  what comes back. Only **plumbing** is eligible, on the plumbing-or-content mark each derivation
  already carries; subject-specific content is the Unit, and the Session is the only thing holding
  what the Learning Records and `NOTES.md` say about this learner. **Verification stays with the
  Teacher**, and for two reasons rather than as a preference: a subagent judging its own result
  checks it against its own reading of the specification, which is the one thing about the work that
  cannot be independent of it — and the record of how each page check *misleads* lives in the head
  comment of the checks file, which the subagent was never sent to read.
- **`budget.test.js` holds the rule, and asserts where it sits.** It is read after the match, since
  it prices a description and the description comes first, and before the procedure for building a
  Component, which is the last moment the choice is still free; the procedure links back, and the
  teaching loop's step 2 links in from the spine, where a Session decides to spend itself. The
  checks hold the ceiling and its evidence as two claims, the judgement with the moment it happens
  at, both outcomes with the file they are recorded in, the specification's four parts, and
  verification with both of its reasons. The authoring vocabulary guard gains *single mechanic*,
  *subagent* and *specification*; the glossary gains the **Session budget**, the **Tool Session**
  and the **Delegated build**; the reasoning is decision 42. Reading a section's parts in the order
  they appear moves into `helpers/docs.js` beside the other document readers — the derivation and
  simulation checks had a copy each, and this would have been the third.
- **A Lesson that depicts something real is checked against a known-good result before it ships,
  and a subject that admits no such check is not simulated.** This is the one defect nothing else
  in this plugin can catch: a page that renders cleanly, passes the page pass and every document
  check, and teaches something **false** — catching that means knowing what the number in the box
  *means*. So a run depicting something real is checked while it is being authored, against one of
  **four kinds** of known-good result: a conserved quantity, a closed-form solution, a published
  worked example with its answer stated, or a reference implementation compared **step by step**.
  The last is the kind most easily overlooked and the one that covers a subject with no equations
  in it — a correct sort, a correct shortest path, a correct checksum — and it is compared step by
  step because two implementations agreeing at the end can disagree about everything in between,
  which is what a Lesson about an algorithm teaches. What the run was checked against is recorded
  in `TECH-STACK.md` beside the Component, which is what makes a skip conspicuous rather than
  silent: an entry that computes something real and names no known-good result is a run nobody
  checked.
- **Reaching for a real engine is not that check, and the reference says why.** An engine buys
  **solver stability** — no tunnelling, no energy injected by a bad integration step — and it does
  not buy **physical truth**: engines are tuned for plausibility, and the mapping from the subject
  to their units, scale and timestep stays the author's. An engine would have caught the kart
  flying off the track; it would not catch a Lesson teaching the wrong orbital period, and the
  most-praised page this genre has produced shipped with a physics defect on the launch page of the
  model being praised for its physics. The reasoning sits in the document rather than only in the
  decisions record, because the reading it prevents is one a Teacher takes *while deciding* — that
  the rule is a dependency choice it has already made well.
- **Where there is no such check, the interaction is pacing.** A sequence of named states — a
  protocol exchange, a biological process — has no quantity to conserve and nothing to run
  against, so nothing can tell a correct sequence from a plausible one. The facts are stated with
  a **citation**, drawn, and the interaction is limited to **stepping, scrubbing, revealing**: the
  Learner moves through *asserted* content rather than *computed* content, the citation carries
  the correctness and the page carries only the explanation. The prohibition and that form arrive
  in the same breath on purpose — told not to build it and shown nothing else, a Teacher builds
  it. And this is the argument for the cheapest version being usually the *correct* one rather
  than the affordable one: a run computed while authoring can be checked while authoring, and a
  recording cannot diverge, blow up or drift in a Learner's browser, because it already happened.
- **`simulation.test.js` holds the rule, and asserts where it sits rather than only that it is
  there.** This is the line in this body of work most likely to be skipped quietly, so the rule is
  placed after the derivations that can output a run — it constrains what they may output — and
  before the match against what the Workspace has, since a run with no known-good result is not a
  description to go shopping with. Both of those derivations link into it, and so does the
  procedure for building a Component, which is the other door in. The checks hold the requirement
  and the moment it happens at on one logical line, the four kinds each with room to say what
  checking against one looks like, the no-check case with its prohibition and its pacing forms in
  one breath, and what an engine buys and does not buy in one sentence — said apart, the first
  half is read as the answer. The authoring vocabulary guard gains *known-good*, *conserved
  quantity* and *pacing*; the glossary gains the **Known-good result** and **Pacing**; the
  reasoning is decision 41. The `TECH-STACK.md` skeleton the first run hands the Teacher gains the
  column the recording goes in — *Checked against* — because a requirement to record something
  into a template with no place for it is a requirement that becomes a note at the bottom and then
  nothing at all. Every derivation whose output is something the page **computes** links to the
  rule, which is three of them rather than the two that say "run": the Learner setting a number
  and watching the claim change computes that claim as much as a simulation does. Reading the
  numbered entries of a part, reading a list of bold-led bullets, and the length floor such a list
  is held to all move into `helpers/docs.js` beside the folding reader — the derivation check and
  this one had a copy each of the first, and one of the copies described itself as being the
  other.
- **A diagram is built from elements before anything is drawn into a canvas.** Where the same
  picture could be made either way, elements win, and that is a rule rather than a preference:
  a diagram made of elements is labelled, focusable, reachable by keyboard, readable by assistive
  technology and **inspectable**, so the page pass can name the label that escaped its box — while
  a canvas is an opaque rectangle whose only supportable check is whether anything was drawn at
  all. There is nothing on the other side of that to weigh, which is why it is not offered as a
  taste. A canvas or a renderer is reached for where elements genuinely cannot express the thing:
  continuous curves, particles in the thousands, real three-dimensional geometry, data too large
  to give a node apiece. And the reference now lists what markup and styles draw **natively**, so
  the rule is actionable rather than aspirational — gradients for dials, sweeps and spectra; grid
  for matrices, boards and layouts, where every cell is a real element; transforms for
  pseudo-three-dimensional views with no renderer; clipping for cutaways and reveals; the native
  disclosure elements for progressive reveal with no script at all; a range input bound to a
  custom property for a draggable value in about three lines; and the semantic elements for
  tables, progress and measured quantities.
- **Motion is sorted into three kinds instead of being covered by one rule.** Motion that *is* the
  explanation is **permitted** — what moves is the causal structure being taught, strongest where
  the subject is itself a procedure. Motion that is **interface feedback** — a panel opening, a
  value changing under a slider, focus shifting to what just appeared — is **explicitly
  permitted**, short, interruptible and behind the reduced-motion preference. Motion competing
  with the content for attention is **removed**, which is Decoration's verdict rather than a taste
  argument: draft it, delete it, reread the passage. The middle kind is named because the evidence
  against decoration is about *content* — mascots, jokes, tangent anecdotes, ornamental art — and
  a Teacher reading that with the distinction left undrawn does not dare put a transition on a
  disclosure, which is the state this plugin was in.
- **The reduced-motion preference is required, not suggested — including of the plugin's own
  files.** Every transition and every animation a Lesson writes sits behind
  `@media (prefers-reduced-motion: reduce)`, and the explanatory kind gets a path rather than an
  exemption: it stops being automatic, the Learner steps it, and what would have tweened jumps.
  Five shipped stylesheets gained a guard — `style.css`, `exercise.css`, `drag-order.css`,
  `nav.css` and `tutor.css`, the last of which also stops the caret blinking — beside
  `step-animation.css`, which already had one. That half is checked against the code rather than
  against a document, because a Teacher models a new Component on a shipped one, so a stylesheet
  that animates unguarded teaches the opposite of the rule beside it.
- **`motion.test.js` holds the sort, and `imagery.test.js` gains the elements rule.** Each kind of
  motion has to arrive on one logical line with its verdict, the four constraints on interface
  feedback in one breath with the permission, and the preference three ways: the media query as
  the thing an author types, a requirement word beside it, and no hedge on any line that names it
  — `suggest` deliberately excluded, since the rule states itself as *required, not suggested*.
  The stylesheet half is held selector by selector rather than file by file — a file-wide read
  passes a seventh animating rule on the strength of the block guarding the other six — and it
  cuts every guard out before it looks, because guards are written as `transition: none` and a
  naive reader would report a file as animating *because* it had already been fixed. Finding the
  one section that owns a subject moves into `helpers/docs.js` beside the folding reader, this
  being the fourth suite to do it and two of the four having already disagreed about whether to
  search a whole document or only the section. The authoring vocabulary guard gains `clip-path`,
  `prefers-reduced-motion` and *interface feedback*; the glossary gains **Explanatory motion**,
  the **Element-built diagram** and **Interface feedback**; the reasoning is decision 40.
- **What a passage needs is derived from the passage, instead of selected from a table.** Both
  tables leave the authoring reference — the eleven teaching acts each routed to what to reach
  for, and the shipped Components with their file paths. Indexing by teaching act rather than by
  library was the right direction and is not being reversed; what a table cannot fix is that it is
  read *before* writing, so it decides the answer, and the two commonest true answers are not rows
  at all: *this passage needs nothing*, and *this passage needs something nobody has built*. In
  their place the decision runs one way. **Two gates** come first and are expected to stop most
  passages — say in one sentence what the Learner must leave believing and stop if prose or an
  annotated picture can produce it; draft the interaction, delete it, reread the passage, and if
  the argument still stands it was decoration. *Default to minimal* survives as the first of
  those, restated as a question with an answer. That **nothing** is the commonest result is
  written down beside them, because an author who derives nothing has to be able to tell "I found
  nothing" from "I did not look hard enough".
- **Ten derivations, each a question asked of the material.** What survives the gates goes through
  them in order, and each carries its trigger question, the form it outputs, whether that output
  is reusable plumbing or subject-specific content, and **the cheapest version that still does the
  teaching**. That last one is load-bearing rather than a concession: a static strip of frames
  often beats a slider because the comparison is then simultaneous rather than remembered, and a
  stepper over a precomputed run preserves what a simulation teaches at a fraction of the cost.
  What comes out is a **description** of an interaction and never a Component name, and the set
  says it is open — a passage whose need none of the questions asks is one that earns a Component
  written for this subject. The five moves are gone: where one was carrying something real it
  survives as a derivation with a trigger in front of it.
- **The match against what exists happens afterwards, with three named outcomes.** A description
  in hand, the Teacher reads the Workspace's own `assets/` and each Component's head comment —
  the one copy that cannot drift from the code — and lands on **reuse**, **build** or
  **nothing**, all three of them normal. So the reference no longer carries a second list of what
  ships, which was already wrong: the first-run document claimed four Components were installed
  when six were. An **anti-pattern** list accompanies the derivations, each form with the reason
  it fails — a rotatable scene with no variable that changes the claim, a control whose
  consequence is off-screen, an open sandbox before the Learner has a question, a prediction with
  no nameable prior, scroll that only advances time, an abstraction with no way back down to a
  concrete case, and simulating a three-step process.
- **A Lesson can serve its own local assets.** The Tutor service's media-type table admitted ten
  extensions, so a Lesson could reach a renderer on a CDN and not the model it renders: geometry,
  audio, video, typefaces, the modern image formats and a Lesson's own module or dataset were all
  404s on files that were really there. The table now carries `.glb`, `.gltf`, `.obj`, `.stl`,
  `.mp3`, `.m4a`, `.ogg`, `.wav`, `.mp4`, `.webm`, `.vtt`, `.woff`, `.ttf`, `.otf`, `.webp`,
  `.avif`, `.mjs`, `.wasm` and `.csv` beside what it had. It is still an allowlist and
  still the first gate a request meets — nothing else on the resolution path moved, so the
  decoding, the containment check against the Workspace root, the symlink check that catches a
  link the scaffold did not write, the `assets/…` fallback to the plugin and the loopback bind are
  all as they were, and the Workspace's own `private.txt`, `.tutor.pid` and question log are as
  unreachable as before. Each of the three refusals is now re-asked with a newly admitted
  extension in the URL — a path escaping the Workspace in every spelling the suite knows, a link
  the scaffold did not write, and an extension off the list — because an allowlist that refuses
  first is an allowlist the checks behind it had never had to answer for a `.glb`.
- **The authoring reference says what that means for an author.** A Lesson's own local asset is
  fetched, so the Tutor service is what answers for it: it loads at the served address and nowhere
  else, and from disk it is simply not there. A Lesson that has to work both ways either inlines
  the asset or generates the geometry procedurally rather than importing it. The borrowed-image
  formats widen with the table — `.webp` and `.avif` join `.png`, `.jpg`/`.jpeg` and `.svg`,
  which is the pair of lists the imagery check holds to each other in both directions.
- **The authoring reference says what actually breaks a Lesson opened from disk, instead of
  banning a technology.** It required `file://` compatibility by default — UMD or IIFE, never ES
  modules — to buy an offline property nobody had measured, and the measurement says the ban does
  not buy it. The boundary is what a URL points at: a page opened from disk has a null origin, so
  a CDN passes the CORS check with its permissive header while the file sitting beside the page
  does not. So the ban is replaced by the list of things an author *types* that fail — a module
  script or a `fetch` aimed at a sibling file, a dynamic import of one, a loader pointed at a
  relative asset, a worker built from a relative path — beside the list of the ones that do not:
  images, stylesheets, classic scripts, and anything at all aimed at a pinned https CDN. A
  plotting library, a layout engine, an in-page Python or a renderer is now available to a
  Lesson, and was only ever ruled out by a rule measuring the wrong thing. Two consequences are
  stated because neither follows from the rule: a local classic script may carry neither
  `crossorigin` nor `integrity`, either of which opts it into the check it was not subject to,
  and a worker script may never be cross-origin on any scheme, so a CDN library that spawns one
  is usable only if it builds the worker from a blob. On a CDN script the same two attributes are
  worth having and are written as a pair: an integrity check cannot run against a response the
  browser handed back opaque, so `integrity` without `crossorigin` is a network error rather than
  a stricter page.
- **What serving buys is stated correctly in the three documents that oversold it.** The Tutor
  documentation and the service's own README said serving lifts the `file://` restrictions that
  gate Pyodide, sql.js and ES modules. It lifts nothing of the sort: it buys the in-page Tutor —
  the drawer asks the service that served the page — and an origin, without which the page may
  not fetch its own files. The README's claim that a Lesson works from `file://` with no network
  described the **shipped Components** rather than Lessons, and is scoped to them.
- **Both documents now say why the two rules differ.** The shipped Components keep their
  no-network constraint for a reason unrelated to offline capability: they are the same bytes in
  every Workspace, so staying dependency-free is what keeps them small and lets one fix reach
  every course at once. Only the rule addressed to the author of a Lesson is loosened, and the
  check holding the Components to no network, no module syntax and no fetch is untouched.
- **The degradation rule splits by what a Component is made of.** One made of text goes on
  writing its content into the markup and being taken over by script, which is how the shipped
  six already work. One that is a picture cannot, and carries a single **stand-in sentence**
  instead — what would be shown and what it demonstrates. That sentence is what a Learner reads
  when no script ran, the picture's accessible description, and what the Tutor has to go on when
  they ask about something it cannot see. Alongside it: nothing that depends on the network or on
  the service may fail silently, so a page that needs one of them says which of the two is
  missing rather than leaving a blank rectangle.
- **The Teacher can look at the page it just wrote.** After writing a Lesson it opens the served
  address in a browser and runs a short pass — nothing complained, nothing failed to load, the
  canvas has something in it, the animation is moving, nothing sits off the page, no label is
  covered or overlapping, the text can be read against what is behind it — with the screenshot
  taken last, to judge appearance rather than correctness. The checks ship as
  `scripts/page-checks.js`, named from the plugin root and installed into no Workspace, because
  they do not vary by subject and they are the Teacher's tool rather than page content. It is
  deliberately light and it is **not a gate**: it catches a Lesson that is broken, not one that is
  wrong, and a learner who hits something subtler has the Tutor sitting in the page to ask. It
  arrives now because lifting the ban above is what made a Lesson breakable in ways prose cannot
  anticipate.
- **Each check says where it lies, which way, and what gives it away.** Every result is the same
  shape and `ok` is three-valued — `null` meaning there was nothing here to judge, because an
  absence reported as a pass is the one answer a Teacher would act on wrongly. Beside that, the
  file's head comment carries for every check the condition under which it reports confidently and
  wrongly, the direction, and the field in its own output that reveals it: a check trusted while
  wrong is worse than no check. Three are named. A WebGL context without `preserveDrawingBuffer`
  is read back cleared, so a flat clear colour makes the canvas check pass falsely and the two
  identical reads make the animation check fail falsely, from one cause. An overlay with
  `pointer-events: none` is walked straight through by the hit test, so the occlusion check passes
  while the text underneath is invisible. And a background nothing in the page declares leaves the
  contrast check assuming white, which misleads in both directions and is worst on exactly the
  dark-themed and canvas-backed pages the change above licenses. Two hazards belong to the browser
  rather than the page and are recorded with them: `--disable-gpu` leaves no rendering context at
  all, and a browser carrying the operator's extensions shows requests and markup that are not the
  Lesson's.
- **`page-checks.test.js` holds the contract, and says what it cannot hold.** One shape, three
  values, no check throwing on a page that lacks its subject, and a documented misread for every
  check the file ships — read off the file's own list, so a check added without one fails on the
  day it is added. Each check is also driven against a page holding its subject, because a check
  answering `null` to everything would satisfy the rest for free. Layout is not covered: no
  browser runs there and the stub page returns the boxes a test wrote into it, and the testing
  documentation records why adding a browser is refused. The reasoning is decision 35; the
  glossary gains the **Page pass** and the **Misread**.
- **The Teacher draws the diagram, and borrows only what a drawing would fabricate.** Lessons
  contained almost no images: nothing forbade them, there was simply no guidance — and this was
  the costliest of the three gaps, because an annotated static diagram beside prose is the most
  consistently effective format in the whole instructional literature, steadier than animation,
  simulation or interactivity. So the authoring reference now says to **draw by default**, and
  gives one test for when to borrow instead: *would a drawing of this be a claim about how reality
  looks?* If yes, borrow — photographs of real apparatus and instruments, historical documents and
  artefacts, microscopy and medical imaging, astronomical and remote-sensing imagery, organisms
  and mineral specimens, works of art under discussion, real instances of a phenomenon. Everything
  else is something the Teacher can be *right* about, so it is drawn.
- **The reason for the default is stated, so it is not read as timidity.** Once the Teacher has
  drawn the diagram it already knows what the diagram must say, because it wrote the prose beside
  it, so the only open question left is whether it rendered legibly — which is exactly what the
  page pass answers well. A borrowed image poses the opposite question, whether it depicts what is
  claimed, and that is the question a look at the page answers badly. Drawing trades an
  unverifiable risk for a verifiable one.
- **No image ships in a Lesson that has not been rendered and looked at.** One rule for both
  paths. A borrowed image is downloaded into the Workspace's new `images/` directory first — both
  so there is something to look at, and because a local copy is reproduction rather than
  hotlinking, which makes the credit obligatory rather than polite — and saved in one of the
  formats the Tutor service serves, since anything else renders from disk and 404s the moment the
  page is served. **The credit goes into the page beside the image**, with the licence as a real
  link, rather than into a file alongside it: for the same reason a Rubric lives inside its
  Assignment, a credit that is part of the deliverable cannot be allowed to get separated from
  what it credits.
- **Four bans, each with the reason it is a ban.** Generated imagery in place of an explanatory
  diagram, because no symbolic representation of the diagram exists, so nothing can check it and
  the generator cannot discover it was wrong. Generated decorative art and stock photography,
  because attractive-but-irrelevant material is a measured negative rather than a neutral.
  Figures embedded from paper repositories, because the licences do not grant redistribution —
  link the paper instead. And any diagram service that renders server-side, because it sends the
  Lesson's content to a third party and makes the page network-dependent for something that could
  have been bytes in the file.
- **A ceiling on hand-drawn diagrams, with the mechanism that makes it memorable.** Past roughly a
  dozen labelled boxes, or any graph whose edges route around nodes, a layout engine places things
  instead — because the failure there is **geometric rather than semantic**: the Teacher knows
  what the diagram has to say and cannot know how wide a label renders, so it cannot know the
  label escapes its box. Six mitigations buy the headroom under the ceiling: snap to a coarse
  grid, draw box sizes from a small fixed set, label in monospace so a character count estimates a
  width, leave generous padding, cap label length, and mirror the semantic content into the markup
  so a later Session — or the Tutor — can verify what the diagram means without rendering it.
- **`imagery.test.js` holds that claim the way `from-disk.test.js` holds the one above it.** The
  rule and its reason are read against the part of the section that states them, each ban has to
  sit on one logical line with its own reason, the mechanism under the ceiling has to arrive in one
  sentence, and the image formats the document offers are checked against the service's own MIME
  table in both directions rather than restated. The Workspace gains an `images/` directory from
  the scaffold, and the suite holds that from both ends — the destination read out of the document,
  the directory list read out of the scaffold. The authoring vocabulary guard gains the three
  words the document now uses. The reasoning is decision 36; the glossary gains the **Borrowed
  image**, the **Credit** and the **Complexity ceiling**.
- **A suite of its own holds the claim.** `from-disk.test.js` is the first check here whose
  subject is whether a document is *right* rather than where its material sits: the ban may not
  come back in anything that instructs, no document may sell serving on a restriction it does not
  lift, and the authoring reference has to carry both halves of the list. The authoring
  vocabulary guard tracks the document as it always has, and now reads the words it actually
  uses. The reasoning is decision 34; the glossary gains the stand-in sentence, and the Tutor
  service entry gains what serving buys.
- **The spine no longer aims every Lesson at discovery; it asks one thing of each question
  instead.** It used to say that an Explorable lets the learner manipulate the subject before it is
  explained and to aim every Lesson at that shape. The technique is sound and stays; the universal
  default is what the evidence does not carry — the same activity wins or loses on whether it is
  scaffolded, and the unscaffolded version loses to plain instruction, so a rule pointing every
  Lesson at the shape points some of them at the losing version. One judgement sentence replaces
  it: **if you cannot write down the wrong answer the learner is likely to give, the question
  collects a guess rather than a confrontation, and should not be asked.** It is applied to one
  question at a time and is deliberately not a classification — not by subject area, not by the
  learner's age, not by kind of skill, each of which would be a category the Teacher could read the
  answer off without looking at the question. The requirement on the other side is untouched: an
  interaction is still followed by naming what was found, and the two rules catch the same defect
  from opposite ends.
- **The Component that asks for a prediction is offered on that same test.** It was described as
  being for *anything where intuition can be wrong*, which is what an author believes about every
  passage it has just written, and as **the strongest of them**, which in a table of Components
  reads as an instruction to reach for it. Both go: all three places the authoring reference offers
  it — the move it comes from, the row a teaching act is chosen on, and the row in the shipped
  table — now name the wrong answer the Teacher has to be able to write down. The list of what
  every Lesson does drops "leads with interaction rather than explanation" for the question rather
  than the answer, and an interaction where the judgement admits one.
- **`skill-spine.test.js` gains both halves as two more claims.** A universal quantifier over
  Lessons and the vocabulary of that shape may not meet in one sentence anywhere in the spine —
  sentence by sentence, because a paragraph folds into one logical line here and a line-level
  conjunction would fail on a paragraph saying each half innocently in a different breath. The
  judgement has to arrive whole on one logical line inside the subsection that states it, and that
  subsection is held against the three classifications it must not have become, each pattern
  carrying the control sentence that proves it can see its own subject. The second half reads
  `UNIT.md`, because the spine's sentence and the Component's description are one claim and a claim
  held in two documents is one that can drift. The sentence reader both checks need moves into the
  shared Markdown module beside the line reader, with the one place it misreads recorded beside it
  — an ordered marker splits off as an entry of its own — because two copies of a reading rule is
  how a reader ends up disagreeing with itself. The reasoning is decision 37.

## 0.5.0

### Added

- **`status` says where each Lesson is served.** With the service up, the control script now lists
  the address of every Lesson, on the port it is actually bound to. The address a teacher hands to
  a learner is one they copied rather than one they assembled, and it stays right after
  `PORT=5000 ./tutor/tutorctl.sh start`. Lessons only: where the course as a whole opens is the
  documents' business.
- **The serving precondition is stated where a teacher reads it, and printed by a tool they
  already run.** The in-page tutor connects only on a Lesson the service served, and nothing in
  the skill said so — while two instructions actively pointed the other way, which cost the
  originating session two confusing round-trips. The runbook now states it beside the instruction
  not to ask the learner to reload: that instruction is true of a served Lesson, false of one
  opened from disk, and exactly the sentence a teacher acts on. The instruction to open a Lesson
  names both readings and says which address to hand over, in both places that carry it — the
  skill spine and the Unit authoring guide. And `scripts/wire-lessons.sh` now prints the served
  address of every Lesson beside the command that starts the service, **whether or not the
  service is running**: it asks nothing about the service, because falling silent while it is
  down would withhold the address at the moment it is most needed. The documentation disclosure
  check holds the precondition, so it cannot be deleted silently later; it cannot hold it against
  being wrong, which stays review's job.
- **The glossary names the Tutor service.** It is the transport both the tutor and the grader
  reach the learner over, it is argued about in two design decisions, and until now it had no
  name — the runbook called it "the service" throughout. The **Dossier** entry is corrected in
  the same pass, and now holds under both readings rather than only on disk: it is the Workspace
  entry point served as well as opened from a directory. Nothing is named for the two readings
  themselves, because opening a file from disk is an operating system fact rather than a concept
  this project owns.

### Fixed

- **The tutor service outlives the shell that launched it.** `start` gave up the terminal and not
  the process group, so "must outlive the launching shell" was half implemented — a signal sent to
  the group, which is what the end of an agent session sends, still reached it. It now starts in a
  session of its own, through `setsid` where the platform has it and through the `python3` this
  script already parses JSON with where it does not — macOS ships no `setsid`, and `set -m` in a
  subshell is not a substitute, because dash turns job control back off when there is no terminal,
  which is precisely the case being hardened against. This is **hardening rather than a diagnosis**: the
  session that reported a service dying two minutes in did not capture the signal that killed it,
  and no post-start survival check was added, because a check short enough to run would report
  success and prove nothing. The runbook gains the matching line — if it dies immediately after
  being started from inside an agent session, start it from a standalone terminal. The suite can
  now start the service the documented way, through the control script, which until now was the
  one way of running it that nothing tested.
- **The Dossier is the Workspace entry point again, under both readings.** Served, every address
  that names it returned the lowest-numbered Lesson instead: the service root, the Dossier's own
  filename, and — because the navigation bar asks for `../index.html` from inside a Lesson — the
  one control whose job is getting back to the Dossier. Only the double-slash form worked,
  and only because it was the one form that was not the exact string being compared against. A
  directory now resolves to its `index.html` and stops there. The shortcut is deleted rather than
  relocated, along with the helper that found the first Lesson, so nothing is left behind to be
  rediscovered and re-wired; the Dossier already lists every Unit with a link to its Lesson, so
  the affordance survives as one click. Recorded as decision 32, because it changes what a
  memorised address means: the service root used to open the first lesson and now opens the
  dossier, which anyone who wrote that address down will observe — and which is why this ships
  as 0.5.0 rather than as a patch.
- **A page that cannot reach the tutor says which of the two it is.** The in-page drawer had two
  states, and offline's hint told the learner to run the command that starts the service. On a
  lesson opened from disk that instruction cannot work — the drawer talks to the service that
  served the page, so a request from `file:` names another origin and the browser refuses to make
  it. The learner in the originating report ran the command twice and nothing changed. The drawer
  now has a third state, in the learner's language out of the shipped table, naming the cause and
  offering no command; it stops polling there too, because nothing it could wait for would
  change the answer. Its chip is muted rather than warned, since there is nothing here for the
  learner to go and fix.
- **The Dossier reports three states, and stops making a request the browser blocks.** Opened from
  disk it probed `http://127.0.0.1:4173/api/health` across origins, read the block as a refusal
  from the service, and reported a *running* tutor as stopped — while also being wrong whenever
  the port had been overridden. It now asks nothing from a page the service did not serve, and
  says it cannot tell from here; served, it asks a relative address and is right on any port. The
  hard-coded port is gone with the probe, and no cross-origin header was added to the service's
  API to make the old probe work: keeping that surface closed is worth more than making a status
  message's fallback real. The cover's own text stays a seeded English sentence, like every other
  line written out on that page. Recorded as decision 33.

## 0.4.0

### Added

- **A workspace states the learner's language once, and the in-page drawer speaks it.** It used to
  speak the pilot learner's, because that language was written into the plugin — so every future
  learner got it too, whether or not they read it. The language now lives in one place,
  `assets/units.js`, as `window.TEACH_COURSE.lang`. `<html lang>` is the single authority every
  component reads; `assets/lesson-boot.js` writes the workspace's language onto any page that did
  not declare its own, so a forgotten attribute is not a silent fall back to English, and
  `scripts/wire-lessons.sh` fills it into the pages it already rewrites.
- **Learner-facing text comes from a table, looked up at run time.** The tables the plugin ships,
  for `en` and `zh-CN`, sit at the head of `assets/lesson-boot.js`. Not in a file of their own, and
  that is the point: a workspace holds symlinks, so a file the plugin newly adds does not exist
  there until the scaffold next runs, while a file already linked follows the plugin the moment it
  updates — and a table nobody can reach renders raw keys on a learner's screen. Lookup runs the
  workspace's own table, then the plugin's, for the exact tag, then the base language, then
  English, then the key itself. Truncation is the only cleverness, so `zh-TW` reaches English
  rather than sliding into `zh-CN`: handing someone the wrong script is worse than handing them
  English.
- **`assets/strings.js`, placed by the scaffold, is the workspace's own table.** It is where a
  language the plugin has not collected is supplied, or an entry overridden. Its absence degrades
  harmlessly, so an existing workspace needs no migration step: it reads exactly as it did before,
  in its own language, and simply gains the file on its next scaffold run. A workspace scaffolded
  by the previous version is upgraded and read in the suite, which is what holds that.
- **A pseudolocale check, which fails on a hardcoded string in any language.** The drawer is
  mounted under a made-up language whose table holds nothing but sentinels, and the rendered tree
  is asserted to contain no character outside that alphabet. A hardcoded English `'Passed'` breaks
  the split exactly as badly as a Chinese one, and no scan of the bytes can see it. A non-ASCII
  scan over the drawer's source ships alongside it, because the two fail on different things.
- **The pseudolocale check now mounts a whole unit, not just the drawer.** All three of its pages,
  every component on them and the navigation bar, driven through every state each one has — a
  guess nudged and then revealed, a question answered wrong, a gate part way through and then
  judged, an order checked wrong and then right, a hand-in refused every way it can be refused and accepted once.
  Nothing in it names a component: the pages come from the fixture unit, which says what each is
  built from and carries each component's own drive beside its selector — so a component added
  there is mounted, driven and read without the check being edited, and the check that every
  class a component reaches is styled drives it through the same states. The non-ASCII scan reads
  every script the plugin puts on a page, found by listing the directory for the same reason, and
  the key-completeness check reads its sources the same way — down to which prefixes count as
  keys, which it reads off the table. The bar is mounted twice, first in the curriculum and then
  last in it, because its neighbour slots each have two states and one placement shows one of
  each; every entry under `nav.` has to have reached a screen across the two.

- **The scaffold hands a new workspace a generic starting point, in English.** The seed dossier
  carried the pilot learner's own course title; it keeps its structure and loses that content, the
  way the course manifest already treats its own fields. The manifest's labels, the dossier's
  headings and status legend, the subagent definitions, the two tuning placeholders and the
  submissions guidance all ship in English — seeds rather than translations, because the plugin
  cannot know who it is about to be handed to. A placed file is the workspace's from the moment it
  is placed, so `UNIT.md` says to rewrite them in the learner's language, and says outright that
  the `description:` line on each subagent — what the learner reads in the agent picker — is one
  of them.
- **The first run records the learner's language, and the boot sequence writes it into the course
  manifest.** Nothing had told it to record one at all, so a teacher was left to guess. It goes
  into `NOTES.md`, which is where both role definitions already say to read it from, and the boot
  sequence then reconciles `lang` in `assets/units.js` against it — so a workspace scaffolded
  before the setting existed gains one with nothing to run.
- **The non-ASCII scan reads every file the plugin owns, not the scripts alone.** Walked, the way
  the script list is, so a document added and forgotten is covered the day it arrives. The same
  claim is then made from the other end, over a workspace one scaffold run produces — the copies
  and the links together, which is the only place the split stops being an arrangement and
  becomes a directory somebody is handed. One thing sits beside them that no scan of the bytes
  can see: the page skeleton in `UNIT.md` mandated a language, which is how the pilot's got copied
  into every page written from it, and its `lang` is now asserted to be a placeholder rather than
  a tag.

### Changed

- **The drawer holds no learner-facing string at all.** Its chrome, its statuses, its history
  panel, its failures, and the prompt it composes for you to copy when the service is not running
  all come from the table. The prompt is the one piece of scaffolding that is deliberately in the
  learner's language: its reader is the learner, who has to read and may edit it before sending.
- **Nor does any component, nor the navigation bar.** Predict-reveal's nudge and its buttons, the
  step controls and their count, drag-order's move buttons and its verdict, an exercise's right
  and wrong, a checkpoint's progress and its score, and the whole of the hand-in on an assignment
  page — its two labels, its two placeholders, its note, its button, the five things it says back
  and every path it refuses — all come from the table now, in `en` and `zh-CN`. The bar's dossier
  link, its three artifact slots, the slot for an artifact that does not exist yet and both
  neighbour links go with them. A lesson has no untranslated island left in it.
- **A component waits for the bootstrap before it mounts.** A lesson writes its component tags
  above the one `lesson-boot.js` tag, so a component runs before the tables exist and well before
  the workspace's own `assets/strings.js` — and a component that rendered at once would have
  rendered raw keys in exactly the workspace `strings.js` is for. Each one hands its mount over
  instead; the bootstrap runs what is waiting once the last table has had its chance to load. A
  page with no bootstrap tag now mounts nothing, which is the page a learner with scripting off
  already reads: plain text, in order, all of it there.
- **A checkpoint's two verdicts stay the author's own prose.** *Which* passage to go back and read
  is a sentence about one unit and nothing else, so no table could hold it — it is in the
  learner's language because the whole page is. What comes off the table is the score beside it.
  The pseudolocale check tells the two apart by subtracting what the page said before anything
  ran, so it never has to name a selector.
- **The dossier cover takes its language from the manifest too**, rather than declaring one of its
  own. An existing workspace's cover is its own file and is untouched.
- **Assertions across the suite stopped pinning words and started pinning keys**, so that adding a
  language needs no test rewritten. The drawer's fixture moved to `tests/helpers/drawer.js`, where
  the language suite can drive it too, and the fixture Unit's pages are now built *for* a language
  rather than *in* one.
- **The tutor service holds no learner-facing string, and names the language an answer must be
  in.** The language travels with each request — the page's own `<html lang>`, which is the same
  authority every label on it is looked up against — and the payload closes with a single
  directive naming it, so a tutor's answer and a grader's verdict reach the learner in their own
  language. Everything the service itself writes is English: its logs, its comments and the
  prompt scaffolding around the question. What makes an answer the learner's is the instruction
  the agent is given, not the language of the scaffolding around it, and a request naming no
  language is an English one.
- **A stream failure carries a code rather than a sentence.** A timeout and a missing `claude`
  binary are the two failures the service names for itself, and the page reads them out of the
  same table everything else on it comes from. What the agent said on its way out is still shown
  as it arrived — that is evidence about a run rather than a string anybody chose — and where the
  agent says nothing at all the service writes that to its own log instead of inventing a sentence
  for the learner to read. A check reads the codes out of the service, the key each is read as out
  of the drawer, and holds the table to having words behind every one.
- **A graded submission's record is written in the shape the format documents, with ASCII field
  keys**, because the next boot sequence reads it and plans from it. The format document now
  carries that shape — the title, the Evidence fields, the timestamp — so the two are held to each
  other rather than agreeing by hand. The verdict inside the record is the learner's own language,
  written by the grader, and is untouched.
- **Both role definitions are English, and each says where the learner's language comes from.**
  `tutor/ROLE.md` and `tutor/GRADER.md` are linked into every workspace, so the pilot learner's
  language in them was every future learner's. They are now maintainer-facing prose like every
  other document the plugin ships, and each opens by saying that the answer goes back in the
  learner's language — named outright by the request over the service, and read off `NOTES.md` on
  the subagent path, which nothing had been telling it. Both still compose with this course's
  tuning, in that order, on both paths.
- **A grader refuses with an ASCII token rather than with a sentence.** Finding no rubric stored in
  an assignment, a grader is told to open with `CANNOT-GRADE:` on a line of its own and to explain
  underneath it in the learner's language. That opening is how the service keeps a refusal out of
  `learning-records/` — a record claiming a verdict nobody reached is worse than no record, and the
  next boot sequence plans from these. The token is the same in every language, so a workspace in a
  third one does not need a third pattern; the role definition owns it and the service consumes it;
  and the drawer strips that line before rendering, so the learner reads the explanation rather
  than a marker addressed to a service. Whitespace before the token still counts as opening with
  it, because the definition quotes it as an indented block and a grader reproducing it exactly
  sends that indentation. A check reads the token out of the role definition and holds both
  readers to it — in all three shapes a refusal can arrive in — so editing one file alone turns
  the suite red instead of breaking the contract in silence.

- **Everything a maintainer reads is English.** The runtime `README.md` — the document whoever is
  operating the tutor service reads — and the last comments still in one learner's language. With
  the role definitions already English, the scan could finally run over the whole of what the
  plugin owns rather than a subset, which is what stops any of this drifting back.
- **The scan asks a linked file and a copied one different questions.** A file under `runtime/` is
  the same bytes in every workspace, so it keeps the rule exactly as it was: typographic
  punctuation and nothing else above ASCII, because a glyph in shared source is half a label whose
  other half belongs in a table. A seed under `templates/` has no table and no other workspace to
  stay consistent with — the `✅` a dossier marks a finished unit with is that workspace's business
  — so the only thing it may not arrive carrying is somebody else's language. The split is the one
  the whole workspace is built on, read off the directory. `CONTEXT.md` gains **Seed** as the term
  for the third kind of string this turned up.

### Fixed

- **A verdict's filename survives an assignment named in any script.** The slug was sanitised
  against a character class with Latin and CJK written into it, so a Cyrillic, Arabic or
  Devanagari name lost every character it had and collapsed to one constant: every verdict in such
  a workspace then contended for a single filename, with nothing erroring — the same defect a
  hardcoded string is, without being a string. It is any letter, any digit, and the combining
  marks that belong to them, so two assignments named in scripts nobody anticipated get two
  records. The suite hands in one Cyrillic and one Devanagari assignment, and says in
  `docs/agents/tests.md` why those inputs are there.

## 0.3.0

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
- **The skill now carries the whole pedagogy in its own words, and needs nothing else
  installed.** `SKILL.md` had been written as a diff against Matt Pocock's `teach` skill: one
  heading named seven pedagogical topics — reference documents, the mission, the zone of proximal
  development, knowledge, skills, wisdom, and the learner's recorded preferences — and its body
  said only that the rules were the same as that skill's. That is the back half of the pedagogy,
  and the teacher running this skill cannot open the document it pointed at: the pointer was a
  path into a plugin cache, with a version number in it that changes on upgrade. It looked fine
  because that plugin happened to be installed on the machine this was written on, so the defect
  reproduced nowhere near the person who could fix it. All seven are now stated in the skill in
  this project's own words, no
  document under the skill names that project, and the notes one author had left another about
  which passages override it are gone — a teacher that reads "this deliberately overrides X"
  behaves exactly like one that does not. The acknowledgement stays in the README, where a human
  reads it and nothing at runtime depends on it, and `tests/decoupling.test.js` fails any line
  under the skill that reaches for that project again.

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
- **A glossary, and a record of why any of this works the way it does.** `CONTEXT.md` fixes the
  words — workspace, unit, lesson, exercise, checkpoint, assignment, rubric, submission, teacher,
  tutor, grader, session, handoff — each with the near-synonyms it is *not*, because two names for
  one thing is how a document starts disagreeing with itself. `docs/DECISIONS.md` is the other
  half: what was decided, what was rejected, and why, including the reasoning from before this
  project had version control, reconstructed from the session transcript and labelled as such
  where it is thin. It is one narrative rather than numbered decision records, because these
  decisions are chained — later ones revise earlier ones — and splitting them would cut the chain.
  `AGENTS.md` points at both, so an agent arriving cold finds the vocabulary before it writes in
  it.
- **A release check.** `tests/release.test.js` holds `.claude-plugin/plugin.json` to the
  changelog: the version the plugin declares is the newest one the changelog records, releases
  read newest-first and appear once, and a version heading with nothing under it fails — that is a
  record that something shipped without a record of what.

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
