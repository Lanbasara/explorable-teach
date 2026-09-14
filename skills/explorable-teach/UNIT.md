# Authoring a Unit

The [teaching loop](./SKILL.md#the-teaching-loop) reaches here at the point where a Unit stops
being a decision and starts being files. Everything below is consulted while writing: the form
each artifact takes, the conventions a page follows, and the rules that make a Unit reachable
once it exists.

What to teach next, and which instrument verifies it, were settled before you got here — see
[the judgement criteria](./SKILL.md#judging-what-to-teach-next) and [the assessment
ladder](./SKILL.md#the-assessment-ladder).

## The Lesson

A Lesson is one self-contained HTML file in `./lessons/`, numbered `0001-slug.html`. It is the
body of the Unit — where knowledge and skills reach the learner — and it names that body alone,
never the whole Unit.

**Keep it short.** Working memory is small, and a Lesson that overruns it teaches nothing past
the point where it overran. Aim for one tangible win per Unit: tied to the Mission, sitting in
the zone of proximal development, completable quickly, and something the next Unit can build
on.

**Make it beautiful.** Clean readable typography, generous space, nothing decorative that is not
carrying meaning — think Tufte. The learner will come back to these to review.

Every Lesson:

- uses **no more than three Components, and often none** — what a passage earns is [derived from
  the material](#deriving-the-interaction-from-the-material) rather than picked off a list;
- **shows** what it can rather than describing all of it — [draw the
  diagram](#draw-the-diagram-borrow-only-what-a-drawing-would-fabricate) beside the prose, and
  reach for that before reaching for an interaction;
- leads with the question rather than the answer, and with an interaction where [the
  judgement](./SKILL.md#interaction-before-explanation) admits one;
- carries a citation on every claim, because a bare claim is untrustworthy even when it is true,
  and recommends **one primary source** — the highest-trust thing you found — to go and read;
- links by HTML anchor to the reference documents and the neighbouring Units it builds on;
- ends with a sandbox or an open challenge;
- keeps working when nothing else is — the constraint [the Unit](./SKILL.md#the-unit) states —
  while still telling the learner they can ask about anything that did not land.

Hand the Lesson to the learner once you have written it — after [looking at
it](#look-at-the-page-before-handing-it-over) — and mind which of the two you hand
over. With the Tutor service running, it is the served address
`${CLAUDE_PLUGIN_ROOT}/scripts/wire-lessons.sh` prints for that page; with the service stopped,
the file itself — on which the in-page drawer is offline by design, because it can only reach
the service that served the page. [TUTOR.md](./TUTOR.md) states that precondition.

### The page

```html
<!DOCTYPE html>
<html lang="LANG">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lesson NN: Title</title>
  <link rel="stylesheet" href="../assets/style.css">
  <!-- Only the component CSS this lesson uses, e.g.: -->
  <link rel="stylesheet" href="../assets/predict-reveal.css">
</head>
<body>
  <!-- Content, using whatever Components this Lesson earned — often none -->

  <!-- Library deps, if a Component needs one — an https CDN, pinned, never @latest -->
  <!-- Component JS for the Components this lesson uses, e.g.: -->
  <script src="../assets/predict-reveal.js"></script>

  <!-- Page infrastructure. One tag, last, and never wire its contents
       individually. It carries the text every Component renders, so it also
       starts them. -->
  <script src="../assets/lesson-boot.js" data-unit="NNNN"></script>
</body>
</html>
```

`LANG` is the learner's language, not this document's — write the tag the Workspace states, and
see [the language the learner reads](#the-language-the-learner-reads) below for where it is stated.

`style.css` is linked from `<head>` rather than pulled in by `lesson-boot.js` on purpose: a
Lesson has to be styled whether or not a script ever runs.

### What breaks when a page is opened from disk

A Lesson is authored to be **served** — that is the address you hand over, and it is the only
reading the in-page Tutor works on. It gets opened from disk anyway: by a learner who clicked the
file, and by you when you check your own work. So it is worth knowing exactly what stops working
there, because it is not what a rule of thumb would tell you.

The boundary is **what a URL points at** — not ES-modules-versus-classic, and not
CDN-versus-local. A page opened from disk has a **null origin**, so every fetch the browser makes
for it is a cross-origin one, and anything subject to the CORS check is refused. A CDN answers with a
permissive CORS header and passes; the file sitting beside the page answers with no header at all
and does not.

Stated as things you type. **These break:**

| What you write | Why it fails |
|----------------|--------------|
| `<script type="module" src="./orbit.js">` | a module script is fetched under CORS, and a file beside the page cannot pass it |
| `import('./physics.js')` — a dynamic import of a sibling file | the same fetch, refused the same way |
| `fetch('./data.json')`, and `XMLHttpRequest` with it | the same again, and this is the common one |
| a loader aimed at a relative asset — a `.wasm`, a font, a model, a dataset | the loader fetches, so it is the row above wearing a library's name |
| `new Worker('./worker.js')` | a worker script is fetched, and a null origin cannot fetch one |

**These do not:**

| What you write | Why it is fine |
|----------------|----------------|
| `<img src="../images/pipeline.svg">`, `<link rel="stylesheet" href="../assets/style.css">` | ordinary elements with relative paths are not subject to the check |
| `<script src="../assets/predict-reveal.js"></script>` — a classic script | neither is this one |
| `<script type="module" src="https://cdn.jsdelivr.net/npm/pkg@1.2.3/+esm">`, and any `fetch` or `import` at the same host | the CDN answers with the header the check asks for |

So a plotting library, a layout engine, an in-page Python, a renderer — pinned, from a CDN — are
all available to a Lesson, and were only ever ruled out by a rule that was measuring the wrong
thing.

Two consequences ride along, and neither follows from the rule above:

- **A local classic script carries neither `crossorigin` nor `integrity`.** Either attribute opts
  that fetch into the CORS check the plain form is not subject to, so adding one to
  `../assets/exercise.js` is how a page that looks more careful stops working. On a CDN script the
  same two are worth having — but only **together**: `integrity` is checked against a response the
  browser will not let it read unless `crossorigin="anonymous"` is there too, so
  `integrity` on its own turns a working CDN script into a network error. Write the pair or
  neither.
- **A worker script may never be cross-origin — on any scheme, served or not.** So a library that
  spawns a worker is usable from a CDN only if the library itself fetches the script and
  constructs the worker from a blob. Its own documentation is where that is answered; check
  before choosing it, because serving the page does not fix it.

**A Lesson's own local assets are that rule wearing a friendlier face.** A model, an audio clip, a
video, a dataset, a typeface sitting in the Workspace beside the page is *fetched* — so the Tutor
service is what answers for it, and it loads at the served address and nowhere else. From disk it
is simply not there. That is the ordinary case and it is fine, because served is the address you
hand over. If one particular Lesson has to work both ways, there are two ways round it and no
third: **inline the asset** into the page, or **generate the geometry procedurally** in the script
instead of importing it — which is often the better Lesson anyway, since the code that builds the
shape is something the Learner can be shown.

And one rule about failure, which starts to matter the moment a page reaches for either:
**nothing that depends on the network or on the Tutor service may fail silently.** A CDN that did
not answer and a service that is not running are different problems with different fixes, so a
page that needs one of them says which of the two is missing, in the place the thing would have
been.

## Look at the page before handing it over

A Lesson is handed over having been opened, and the **page pass** is what opening it means. Start
the service, open the served address in a browser, and run the pass that ships as
`${CLAUDE_PLUGIN_ROOT}/scripts/page-checks.js`: evaluate
the file in the page, then `await PageChecks.run({ messages, requests })`, handing it the console
and network records the browser session collected. Seven checks — nothing complained, nothing
failed to load, the canvas has something in it, the animation is moving, nothing sits off the
page, no label is covered or overlapping, and the text can be read against what is behind it.
Take the screenshot **last**, and judge *appearance* from it rather than correctness.

**It is deliberately light, and it is not a gate.** It catches a Lesson that is *broken*. It does
not catch a Lesson that is *wrong*, and it should not grow into something that tries to: a learner
who hits something subtler has the Tutor sitting in the page to ask, which is what the Tutor is
for. The checks do not vary by subject, which is why they are a file in the plugin rather than a
list you retype — and why they are named from the plugin root and never installed into a
Workspace, the same way the wiring script is.

**Read `ok`, then every `findings` entry, then the field each check names as the one that reveals
it misreading — and read those from the file rather than from here.** Several of these checks
report confidently and wrongly under a condition that is known in advance, and a check trusted
while wrong is worse than no check: it sends you off to fix a defect that is not there, or signs
off a page that is broken. The head comment carries, for every check, the condition, the direction
it misleads in, and the field in its own output that gives it away — three of them named, because
they are the cases the pass was built around, and two hazards that belong to the browser rather
than to the page. That is one list with one place to fix it, so read it there before you trust a
verdict; a copy of it in this document would be the same list drifting.

## The language the learner reads

Every page the learner opens is written in their language, and the Workspace says which that is in
exactly one place: `lang` in `assets/units.js`. The skeleton above carries it on `<html lang>`,
`${CLAUDE_PLUGIN_ROOT}/scripts/wire-lessons.sh` fills it into any page that left it out, and every
Component takes its own labels from there — so the prose you write is the only part of a page you
put into that language by hand.

**The plugin's files are English and stay English.** The Components, the two role definitions and
the service's own documents are the same bytes in every Workspace, so a sentence of this learner's
language in one of them is every other learner's too. What a Component *says* is not in those files
anyway: it comes from a table keyed by language, which is why translating a Component is never the
way to change a label.

**What the scaffold placed is yours, and it arrives in English.** The Dossier's headings and its
status legend, the labels beside each document in `assets/units.js`, and the `description:` line on
each subagent under `.claude/agents/` — the line the learner reads in the agent picker when they
reach for the Tutor outside a page. Those are seeds rather than translations: English because the
plugin cannot know who it is about to be handed to, and **yours to rewrite in the learner's
language** if you judge it worth it, because a placed file is the Workspace's from the moment it is
placed. None of it is mandatory — a Workspace left as seeded still works. The body of a subagent
definition is a different matter: it is prompt scaffolding and stays English, so the description
line is the only part of one there is ever a reason to translate.

## Draw the diagram; borrow only what a drawing would fabricate

An annotated static diagram beside the prose is the most consistently effective format in the
whole instructional literature — steadier than animation, simulation or interactivity, which is
where the appetite runs. So a Lesson that explains a structure and shows none has left the
cheapest thing it could have had on the table. Reach for a picture early, and before reaching for
an interaction.

**Default to drawing.** Write the diagram yourself — elements and styles, an inline `<svg>`, or a
canvas a Component draws into when neither of those can. The test for when to **borrow** one
instead is a single question: *would a drawing of this be a claim about how reality looks?* If
yes, borrow, because a drawing there is a fabrication. If no, draw.

So borrow for: photographs of real apparatus and instruments; historical documents and artefacts;
microscopy and medical imaging; astronomical and remote-sensing imagery; organisms and mineral
specimens; works of art under discussion; and real instances of a phenomenon — the eclipse, the
fracture, the rash. Everything else is something you can be *right* about — a diagram, a
schematic, a chart, a model, a process, a relationship — so draw it.

**The default is not timidity, and its reason is worth having in front of you.** Once you have
drawn the diagram you already know what it has to say, because you wrote the prose beside it, so
the only open question left is whether it rendered legibly — and that is precisely the question
[the page pass](#look-at-the-page-before-handing-it-over) answers well, because a label escaping
its box is visible in a screenshot. A borrowed image poses the opposite question — *does this
depict what the sentence beside it claims?* — and that is the question a look at the page answers
badly, since an image looks like something whether or not it is the thing. Drawing trades an
unverifiable risk for a verifiable one, and that trade is the whole of the argument.

### Build it from elements before you reach for a canvas

Where the same diagram could be built either from ordinary elements and styles or by drawing into
a canvas, **elements win — and that is a rule rather than a preference**, because of what the two
are worth once they exist. A diagram made of elements is **labelled**, **focusable**, reachable by
**keyboard** and readable by **assistive technology**, and it is **inspectable**: the [page
pass](#look-at-the-page-before-handing-it-over) reads real boxes, so it can tell you which label
escaped which box. A canvas is an opaque rectangle with a picture inside it, and the only check it
can ever support is `canvasHasContent` — whether anything was drawn at all. So the rule buys
accessibility and checkability at once, for no cost: it is the same picture, written in markup.

**Reach for a canvas, or for a renderer, when elements genuinely cannot express the thing.**
Continuous curves — a field, a flow, an isoline; particles in the thousands; real
three-dimensional geometry that has to be projected rather than faked; and data too large to give
a node apiece. Those are the cases, and they are not the common one. A Component that draws into a
canvas still owes its [stand-in sentence](#building-a-component-for-this-subject) — which is the
accessibility the markup would have given you, written out by hand.

What markup and styles draw natively, so the rule is actionable rather than aspirational:

- **Gradients** — `conic-gradient()` for a dial, a sweep or a share of a whole;
  `linear-gradient()` for a spectrum, a scale or a legend; `radial-gradient()` for a falloff. The
  colour stops are the data.
- **Grid** — `display: grid` for a matrix, a board, a lattice, a timetable, a layout of cells,
  where every cell is a real element you can label, colour, focus and write a value into.
- **Transforms** — `perspective` with `rotate3d()` and `translateZ()` for a
  pseudo-three-dimensional view: an exploded stack, a layered model, a card that turns over. No
  renderer, and no library.
- **Clipping** — `clip-path` for a cutaway, a cross-section or a reveal, over a picture that is
  all there underneath and merely not all shown.
- **Native disclosure** — `<details>` and `<summary>` for progressive reveal with no script at
  all, which is the one form still standing when nothing else on the page is.
- **A range bound to a custom property** — an `<input type="range">` whose handler sets one custom
  property the styles read, `--t` say, which is a draggable value for three lines of script and no
  Component at all.
- **The semantic elements** — `<table>` for tabular data, `<progress>` for a task underway,
  `<meter>` for a measured quantity in a known range. Each of those is the picture and its
  accessible description in one element.

An inline `<svg>` counts as elements and is the usual answer where a diagram has real geometry in
it: its shapes are nodes, they take `<title>` and `<desc>`, and everything above reaches them —
which is why the default names it beside markup rather than beside the canvas.

### No image ships in a Lesson that has not been rendered and looked at

One rule governs both paths, and it is what makes the choice above safe rather than merely
reasoned. A drawing is rendered and looked at as part of [the page
pass](#look-at-the-page-before-handing-it-over). A borrowed image is **downloaded into
`./images/` first** and looked at there: you cannot look at what you have not fetched, and a local
copy is reproduction rather than hotlinking, which is what makes the credit obligatory rather than
polite. That is the Workspace's own `./images/`, which the scaffold makes — written `../images/…`
from inside a Lesson, as the example below writes it. Save it as `.png`, `.jpg`/`.jpeg`, `.svg`,
`.webp` or `.avif` — those are the formats the Tutor service serves, and anything else renders
from disk and 404s the moment the page is served.

Read the licence before you download, and take only what permits reproduction. A licence you
cannot find is not a licence you have.

**The credit is written into the page, beside the image** — rather than into a file alongside it,
for the same reason [a Rubric lives inside its Assignment](#assignments): a credit that *is* part
of the deliverable cannot be allowed to get separated from the thing it credits. It names what the
image is, who made it, where it came from, and the licence as a real link:

```html
<figure>
  <img src="../images/eclipse-1919.jpg"
       alt="A photographic plate of the 1919 eclipse, two stars marked beside the corona">
  <figcaption>
    Plate from the 1919 Eddington expedition — Royal Astronomical Society.
    Licence: <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>
  </figcaption>
</figure>
```

That `alt` carries the same three-way obligation a drawing's [stand-in
sentence](#building-a-component-for-this-subject) carries: what the Learner reads when the image
does not load, the accessible description, and the only thing the Tutor has to go on when they ask
about something it cannot see. Both it and the credit are read by the Learner, so both are written
in [their language](#the-language-the-learner-reads) — the example is English because this
document is. A proper name and a licence's own title stay as their holder writes them.

### Imagery that is banned outright

Four of them, each with the reason it is a ban — because a rule whose reason is missing is one a
Session routes around the first time it is inconvenient.

- **Generated imagery in place of an explanatory diagram.** No symbolic representation of the
  diagram exists anywhere, so nothing can check it against what the prose claims, and the
  generator cannot discover that it got it wrong — it never held the claim to begin with.
- **Generated decorative art, and stock photography.** Attractive-but-irrelevant material is a
  measured negative rather than a neutral: it competes for the attention the explanation needs —
  the seductive-details effect — so the Lesson pays for it in the one currency it is short of.
- **Figures embedded from paper repositories** — arXiv, a publisher's PDF, a preprint server. The
  licences do not grant redistribution, and a local copy is redistribution. Link the paper
  instead; a Lesson already owes the learner one primary source to go and read.
- **Any diagram service that renders server-side** — a URL you hand a description to and get a
  rendered chart back from. It sends the Lesson's content to a third party, and it makes the page
  network-dependent for something that could have been bytes in the file.

### How complex a hand-drawn diagram may get

There is a **ceiling**, and it is low: roughly a dozen labelled boxes, or any graph whose edges
have to route around a node to get where they are going. Past it, hand-placed coordinates stop
being reliable and a **layout engine** takes over — a layout library, pinned, from a CDN computes
the positions and your Component draws what it hands back.

**The mechanism is worth stating, because it is what makes the ceiling memorable: the failure is
geometric rather than semantic.** You know what the diagram has to say; you wrote the prose. What
you cannot know is how wide a label renders, because that depends on a font you are not looking
at — so you cannot know that the label escapes its box, that two boxes now overlap, or that an
edge runs under a caption. Nothing in the markup is wrong. The geometry is.

Six mitigations, all cheap, each removing one way for a label to be wider than you guessed:

- **snap every coordinate to a coarse grid** — 20 units, say — so nothing is ever nearly-aligned;
- **draw box sizes from a small fixed set** rather than fitting each box to its own content;
- **label in a monospace font**, so a character count estimates a width;
- **leave generous padding** inside every box, because a label is wider than it looks in source;
- **cap label length** at a few words, and put the sentence in the prose where it belongs;
- **mirror the semantic content into the markup** — `<title>` and `<desc>` on the `<svg>`, a name
  on every group — so a later Session, and the Tutor, can verify what the diagram *means* without
  rendering it.

Then look at it. Three of the page pass's checks are about exactly this class of failure — nothing
sits off the page, no label is covered or overlapping, the text can be read against what is behind
it — and each of those three carries a documented misread, so read them off the file before
trusting a verdict.

## Motion, in three kinds

Motion is not one thing, and one rule laid over all of it gets the middle case wrong in whichever
direction it was written. Sort what you are about to animate into one of these three before you
write it, because the verdicts differ.

**Motion that is the explanation.** *Permitted*, and sometimes the only honest form: what moves
**is** the causal structure being taught — the pointer walking the list, the wavefront arriving,
the queue draining while the server stays busy. It is strongest where the subject is itself a
procedure, because then what has to be learned is an ordering in time, and a static picture has to
encode that as arrows the Learner decodes back. It is an interaction like any other, so it comes
out of [the derivations](#the-derivations) and passes the two gates before anything is built.

**Motion that is interface feedback.** A panel opening, a value changing under a slider, an
element moving to where it now belongs, focus shifting to the thing that just appeared.
**Explicitly permitted** — and it is called out by name because the evidence against **decoration**
is about *content*: mascots, jokes, tangent anecdotes, ornamental art beside the prose. None of
that evidence is about an interface affordance, and a Teacher reading the coherence material with
the distinction left undrawn does not dare put a transition on a disclosure. A change that happens
instantly is one the Learner has to notice and then go and find; a change they watched happen is
one whose new position they already know.

Three constraints, all of them cheap: **short** — the shipped Components sit between 140 and 260
ms, and nothing is ever long enough to be watched for its own sake; **interruptible** — a second
click during the transition is obeyed rather than queued, and nothing waits for an animation to
end before it will accept input; and **it honours the reduced-motion preference**, which is the
rule below rather than a footnote to this one.

**Motion competing with the content for attention.** *Removed.* A looping background, an element
that keeps drifting while the prose is being read, a transition slow enough to be watched. This is
[Decoration](#the-two-gates--most-passages-stop-here) wearing motion, so it takes Decoration's
verdict rather than a taste argument: draft it, delete it, reread the passage, and if the argument
still stands then what was deleted was spending the attention the explanation needed.

**The reduced-motion preference is required, not suggested.** A Learner who has asked their system
for less motion has a reason you do not get to see — vestibular disorder, migraine, nausea — so
every transition and every animation a Lesson writes sits behind a
`@media (prefers-reduced-motion: reduce)` block that takes it back off:

```css
@media (prefers-reduced-motion: reduce) {
  .orbit { transition: none; animation: none; }
}
```

Interface feedback simply goes, and the state change it was reporting still happens, at once.
Motion that *is* the explanation is the one case where removing the motion removes the teaching,
so its reduced-motion path is not removal: it stops being automatic, the Learner **steps** it, and
what would have tweened jumps instead. `assets/style.css` and every shipped Component that moves
already carry the block, so what a page inherits is guarded before you touch it; what you write on
top of them carries its own.

## Deriving the interaction from the material

What a passage needs is **derived** from the passage, never selected from a list. A list read
before writing decides the answer: you scan it, find the row this material most nearly fits, and
build that — which is how a genre whose reputation is decorative interactivity earned the
reputation. A list is also, in practice, a list of things that are pleasant to build.

So what follows is an interrogation of the material, and it runs in one direction: two gates,
then a set of questions asked *of the passage*, then — and only then — a look at what already
exists. What comes out is a **description** of an interaction, or nothing at all.

### The two gates — most passages stop here

Both run before anything is built, and both exist to stop you.

1. **Say what the Learner must leave believing**, in one sentence. Then ask what would produce
   that belief. If prose can produce it, or an annotated picture can — [draw the
   diagram](#draw-the-diagram-borrow-only-what-a-drawing-would-fabricate) — then **stop**: you
   have your answer, and it is cheaper, steadier and likelier to be right than anything
   interactive. This is *default to minimal* as a question you can actually answer: *what can the
   Learner not understand without this interaction?* No answer means there is nothing to build.
2. **Draft the interaction, delete it, and reread the passage.** A sentence describing it is
   draft enough. If the argument still stands without it, what you deleted was decoration — it
   was spending the Learner's attention rather than carrying meaning, and attention is the one
   currency a Lesson is short of. Keep it deleted.

**Most passages come out of the two gates with nothing, and nothing is the result rather than a
failure to find one.** Prose and a static picture teach most things better than an interaction
does, and a Lesson made of good typography, one drawing and one Exercise is a finished Lesson
rather than a thin one. A Unit about philosophy needs a question worth arguing with, not a 3D
engine. Subjects differ in how much of this they earn, so if the learner asks for more or less
interactivity, respect that and record it in `NOTES.md`.

### The derivations

What survives the gates goes through these. Each one is a question asked of the passage rather
than a thing you might like to build, and what it yields is a description of an interaction:
what the Learner does, what changes on screen, and what they are meant to conclude from the
change. No Component is named here, because naming one is what turns a derivation back into a
lookup. The last of them is the exception that shows the direction these run in: its answer is
that no interaction is what this passage needs, and where the need goes instead.

Run them over **one passage at a time**, in the order they are written: the earlier ones are what
most surviving passages need, so a passage that fires on one of those has usually found its answer
and can stop there. A Lesson has several passages, so two of them each earning something is
ordinary, and the ceiling on how many a page carries is [the Lesson](#the-lesson)'s rather than
this list's. And the set is **open** by construction: a passage whose need none of these questions
asks is not a passage with no need, it is one that earns [a Component written for this
subject](#building-a-component-for-this-subject).

The last line of each is load-bearing rather than a concession. A static strip of frames often
beats a slider, because the comparison is then simultaneous rather than remembered; a stepper
over a precomputed run preserves what a simulation teaches at a fraction of its cost.

1. **The prediction worth asking for.** *Ask:* can I write down the answer this Learner is
   likely to give, and is it wrong?
   - *It produces:* the question put before the explanation, with the real answer arriving beside
     the Learner's own.
   - *Plumbing or content:* plumbing — asking and revealing does not vary by subject; the
     question and the wrong belief it confronts are this subject's.
   - *Cheapest that still teaches:* one question, one revealed answer, and nothing animated
     between them.
2. **The claim that could have been misread.** *Ask:* if the Learner has just misunderstood this
   sentence, what would they answer?
   - *It produces:* one question judged the instant it is answered, while the sentence is still
     on the screen above it.
   - *Plumbing or content:* plumbing — judging an answer in the page does not vary by subject;
     the question and its distractors are the content, and writing those is the work. See
     [Exercises](#exercises).
   - *Cheapest that still teaches:* one question where the idea lands, rather than a set of them
     collected at the end where it has stopped being the moment of understanding.
3. **The shape the prose is walking around.** *Ask:* is there a structure here — a tree, a
   layout, a set of relations — that the sentences are describing instead of showing?
   - *It produces:* an annotated picture of it beside the prose; where the edges rather than the
     boxes carry the argument, a picture the Learner can rearrange.
   - *Plumbing or content:* content, almost entirely — the drawing is about this subject. Only
     the *placement* of a large one is generic, which is what the [complexity
     ceiling](#how-complex-a-hand-drawn-diagram-may-get) is about.
   - *Cheapest that still teaches:* the static annotated drawing, which is also the most
     consistently effective format there is. Reach past it only when a position has to change
     while the Learner watches.
4. **The quantity whose value changes the conclusion.** *Ask:* is there a number this passage's
   claim depends on, and does the claim read differently at two of its values?
   - *It produces:* the Learner setting that number, the claim changing on screen, and the
     reading they should take away written where the change lands.
   - *Plumbing or content:* plumbing for the control, content for what it drives.
   - *Cheapest that still teaches:* three frames at three values, side by side and labelled —
     a comparison you can see at once beats one you have to hold in your head.
5. **The stages that are themselves the knowledge.** *Ask:* does the Learner have to know what
   happens *between* the start and the end?
   - *It produces:* the stages, one at a time, advanced by the Learner rather than by a clock.
   - *Plumbing or content:* plumbing — stepping does not vary by subject; the stages are this
     subject's.
   - *Cheapest that still teaches:* a stepper over a precomputed run. A simulation computing the
     same stages live teaches the same thing at an order of magnitude more cost.
6. **The order that is the mistake.** *Ask:* would getting these in the wrong order *be* the
   misunderstanding, rather than a symptom of one?
   - *It produces:* the steps out of order, put back by the Learner, with what goes wrong at
     each misordering there to read.
   - *Plumbing or content:* plumbing — reordering does not vary by subject; the steps are this
     subject's.
   - *Cheapest that still teaches:* four or five items and a pair of move buttons. Dragging is
     an affordance rather than the teaching, and it needs the keyboard path anyway.
7. **The outcome nobody can read off the rules.** *Ask:* can the result be derived by reading
   the rules? If it can, there is nothing to run.
   - *It produces:* a run the Learner steers, with the rules it is obeying visible beside it.
   - *Plumbing or content:* content — the rules *are* the subject, and they are what a Learner
     is being asked to believe.
   - *Cheapest that still teaches:* one precomputed run stepped through, and a second from a
     different starting point beside it.
8. **The thing the Learner will actually operate.** *Ask:* is what is being taught something
   they will type at, drive or play — a shell, a query, a synth?
   - *It produces:* a constrained place to run it inside the Lesson; unconstrained, the same
     thing is the sandbox the Lesson ends on.
   - *Plumbing or content:* content, and this is the derivation most likely to earn a library.
   - *Cheapest that still teaches:* a handful of prepared inputs and a run button. An empty box
     is the slowest thing in a Lesson to be handed.
9. **The argument that needs its last picture still on screen.** *Ask:* does each step of this
   argument depend on the state the step before it left the picture in?
   - *It produces:* a page that reveals as the Learner moves down it, each step changing the one
     figure rather than introducing another.
   - *Plumbing or content:* plumbing for the reveal, content for the figure.
   - *Cheapest that still teaches:* the sections in order, each with its own figure. Reading is
     already sequential, so scrolling buys nothing until the *same* figure has to change.
10. **The fact that has to survive to next month.** *Ask:* is the risk that they will not
    understand this, or that they will not remember it?
    - *It produces:* no interaction at all, and an entry in the plan: the fact is asked for
      again in a later Unit. Retention is a property of *when* material is asked for — see
      [storage strength](./SKILL.md#storage-strength-over-fluency).
    - *Plumbing or content:* neither. It is a Curriculum decision, and a flashcard box added to
      one page buys none of it.
    - *Cheapest that still teaches:* one retrieval question in the Unit after next, written into
      that Unit when you plan it.

### Then look at what exists: reuse, build, or nothing

With a description in hand, go and look — and look at the Workspace rather than at this document.
**Read `assets/`.** That directory is what this course actually has, and it is the only list that
cannot be wrong; a second copy of it here would be a list going stale while the code moved. Every
Component in it documents itself in its own **head comment**: what it expects, the markup its
author writes, and what has to be loaded before it. Read the comment of anything that looks
close, because the markup is not derivable from the outside.

Three outcomes — **Reuse**, **Build**, or **Nothing** — and all three of them are normal:

- **Reuse.** Something there already does what the description says. Use it as it is. What the
  scaffold linked from the plugin does not vary by subject — a Workspace holds a *link* at each,
  not a copy, which is what lets one fix reach every Workspace and also means **editing one in
  place edits every other learner's course**. When one is nearly right but not right, write a
  new Component beside it rather than changing it. If this subject genuinely has to replace one,
  delete the link and write a real file in its place: the scaffold reads that as a deliberate
  override and leaves it alone from then on.
- **Build.** Nothing there fits, and the description is worth what the page costs — [building a
  Component for this subject](#building-a-component-for-this-subject) is the procedure.
- **Nothing.** The description survived both gates and a derivation, and then you priced it
  against what the passage is actually claiming and it is not worth it. That is not the gates
  having failed to catch it: a description is the first point at which the cost is visible at
  all. Write the prose and the picture, and move on.

**Nothing linked from the plugin touches the network, and that constraint is the plugin's rather
than a Lesson's.** Those files are the same bytes in every Workspace, so keeping them free of any
dependency is what keeps them small and what lets one fix reach every learner at once — a reason
that has nothing to do with being usable offline. Only the rule addressed to a Lesson you write
is loosened, and [what breaks when a page is opened from
disk](#what-breaks-when-a-page-is-opened-from-disk) is the whole of it: a pinned library from a
CDN is allowed by it, and is how anything you build here gets built.

`assets/style.css` is not a Component: every page links it from `<head>`, and it owns the design
tokens (`--bg`, `--fg`, `--accent`, …). Everything else reads them and defines none. It is linked
from the plugin like the Components beside it, so re-theming one Workspace means a small
stylesheet of your own in `assets/`, linked after it — not an edit to the one every Workspace
shares.

### Anti-patterns: forms that look impressive and teach nothing

Each of these is something a Session reaches for because it is pleasant to build, and each is
written with the reason it fails, because a named shape with no reason attached is one that gets
routed around the first time it is inconvenient.

- **A rotatable scene with no variable that changes the claim.** Rotating is not a variable: what
  the Learner explores is where the camera is, and they can leave having moved it for a minute
  without meeting a single thing the passage claims.
- **A control whose consequence is off-screen.** If moving the slider changes something the
  Learner cannot see while they are moving it, they are being asked to believe a link they never
  observe — and the more responsive the control feels, the more convincing the nothing is.
- **An open sandbox before the Learner has a question.** A blank box is the most expensive thing
  you can hand someone with nothing to ask of it; it reads as being abandoned rather than
  trusted. A sandbox is what a Lesson *ends* on, once the material has given them something to
  try.
- **A prediction with no nameable prior.** If you cannot write down the wrong answer the Learner
  is likely to give, what comes back is a guess, and a guess meeting the right answer confronts
  nothing — there was no belief in the way to be corrected.
- **Scroll that only advances time.** Tying an animation's clock to the scrollbar makes the
  Learner the transport rather than the operator; they get a video with a worse control surface,
  and they cannot go back to one frame and ask why it followed the last.
- **An abstraction with no way back down to a concrete case.** A general form nobody can
  instantiate is unfalsifiable to the Learner: they cannot tell whether they understood it, and
  neither can you, so both of you read the nodding as comprehension.
- **Simulating a three-step process.** Anything a Learner can hold in working memory is something
  they can already hold; a simulation of it teaches the simulation. Say it in the prose, draw it
  if it has a shape, and spend the page on something that does not fit in their head.

### Building a Component for this subject

A description the Workspace has nothing for is something **you build**, for this subject, into
this Workspace's `assets/`. Nothing else is sitting there waiting: a music Unit earns the Web
Audio API and interactive notation, an algorithms Unit earns a step-by-step visualiser, a shell
Unit earns a simulated terminal — and each of those exists because a Session wrote it, not
because the plugin shipped it.

**Name it after the teaching act it performs, never after the library underneath it.** A name the
Lesson author can write markup against is one that survives replacing the library; a name that
carries the library's is an implementation detail in every page that used it.

1. **Read `assets/` first.** Reuse beats reinvention, and a Component already there has a head
   comment telling you what it expects.
2. **Search for a library only if the description needs one.** What qualifies: it loads from an
   https CDN; it is documented well enough that you can write against it without guessing; and if
   it spawns a worker, it builds that worker from a blob rather than from a URL of its own. A
   module build is fine and so is a classic one — [what breaks when a page is opened from
   disk](#what-breaks-when-a-page-is-opened-from-disk) is the rest of the test. Pin the version in
   the URL — `https://cdn.jsdelivr.net/npm/<pkg>@1.2.3/…`, never `@latest` — because a Lesson
   written today has to still run next year.
3. **Wrap it.** Write a Component in `assets/` that hides the library behind the teaching act, so
   the Lesson author writes markup rather than API calls. Model it on a shipped one —
   `assets/exercise.js` is the plainest example of the shape — so a Component written for one
   subject still reads like the rest of the Workspace.
4. **Declare its dependencies.** A `Deps:` line at the head of the file, naming every script the
   page must load before it — `Deps: none.` when there is nothing — alongside the markup its
   author is expected to write. That comment is the Component's documentation; there is nowhere else for a
   later Session to look.
5. **Degrade gracefully, and never in silence.** The Lesson has to read as plain text before your
   script runs, and stay readable if it never does — because a CDN can be unreachable and
   scripting can be off. What that takes depends on what the Component is made of:
   - **Made of text** — write the content into the markup and let the Component *take it over*:
     mark the root `is-live` on mount, and scope every hiding rule to a class only your own script
     sets. That is how every shipped Component works, and it costs nothing.
   - **A picture** — a drawing, a plot, a simulation, a rendered scene — cannot satisfy that, so
     it carries one **stand-in sentence** in its markup instead: what would be shown, and what it
     demonstrates. That sentence stands in when no script ran, it is the picture's **accessible
     description**, and it is the only thing the Tutor has to go on when the learner asks about
     something it cannot see.
   - **Say which is missing.** A Component that needs the network or the Tutor service names the
     one that is not there, where the thing would have been — the two have different fixes, and a
     blank rectangle proposes neither.
6. **Record it in `TECH-STACK.md`** — the Component, the teaching act it serves, and why this tool
   rather than another. That file is what the next Session reads before reaching for a new one.

### What every Component has to hold

Three of those steps are rules rather than advice — reuse before building, declare what it needs,
degrade to something the learner can still read. Five more apply to anything that ends up in `assets/`:

1. **Every interaction has a keyboard and a touch path.** Drag-only is unusable on a phone and
   invisible to a keyboard; the shipped drag Component pairs dragging with move buttons.
2. **Retina-aware and mobile-friendly** — canvas-based Components use `devicePixelRatio`, and
   every Component lays out on a narrow screen.
3. **It opens both ways** — served, and from disk. That rules out a short list of things you
   type rather than any technology: [what breaks when a page is opened from
   disk](#what-breaks-when-a-page-is-opened-from-disk).
4. **Read the tokens, define none** — colours, spacing and fonts come from `assets/style.css`.
5. **Anything that moves is guarded** — a transition or an animation a Component declares sits
   behind `@media (prefers-reduced-motion: reduce)`, and what it is allowed to move in the first
   place is [motion, in three kinds](#motion-in-three-kinds).

One rule belongs to the Lesson rather than to the Component: a `hidden` attribute written into
the markup by hand hides content from the learner whose scripts never ran, so **never author a
`hidden` attribute in a Lesson**. Let the Component set it on mount.

## Exercises

The tight loop the Lesson is built around: the learner answers, the page judges, and they find
out they misunderstood while the material is still in front of them. They are the reason a
Lesson is interactive rather than a page of prose, and nothing added later may dilute them.

Write them for storage strength, not fluency — see [Storage strength over
fluency](./SKILL.md#storage-strength-over-fluency). Judging happens in the page, so an Exercise
never needs a server or a network.

An Exercise the learner can answer by scrolling up is measuring fluency and teaching nothing.
When writing options, make every one the same length in words and, where you can, in characters:
formatting that singles out the right answer turns a retrieval Exercise into a spotting exercise.

## Checkpoints

The gate at the end of a Unit: a small set of retrieval questions covering what the Unit claimed
to teach, on a page of its own, judged there the same way an Exercise is. It answers one question
— *may the learner move on?* — and the answer belongs in the Learning Record, because the next
Session plans from it.

Whether this Unit earns one at all was settled before you got here — see [the assessment
ladder](./SKILL.md#the-assessment-ladder). What is left is the form it takes.

**One page, beside the Lesson it closes.** `lessons/0003b-checkpoint.html` sits next to
`lessons/0003-fork-exec.html` and carries the same `data-unit`, so the two read as one Unit to
every piece of infrastructure that meets them. Two to five questions: more than that is a
Lesson's worth of work arriving at the moment the learner expected to be finishing.

**Built out of Exercises, gated by the Checkpoint Component.** The questions are ordinary
Exercises, each judged as it is answered; `assets/checkpoint.js` counts them and says whether the
Unit may close. Its head comment holds the markup, as every Component's does — read that before
writing one. The page is built like any other — [the page](#the-page) above — with
`assets/exercise.css` and `assets/checkpoint.css` in the head and both scripts before the
bootstrap. Which of the two scripts loads first does not matter: the Checkpoint reads the state
an Exercise records on itself, rather than being told by it.

**Every question has to be right.** A gate with a pass mark is a score, and a score does not
answer *may we move on?* So a question that could be got wrong while the Unit still closes is one
that does not belong here: cut it, or move it back into the Lesson as an Exercise.

**Write both outcomes, and put the way back in each.** Both are required — a page that can say
*you are done* but not *go back* leaves half the learners who reach it with nothing, and the
Component refuses to mount rather than gate on one of them. Pass says the Unit is closed, asks
the learner to tell you the score, and offers the Lesson for review. The other names the part of
the Lesson to reread and links at it **by anchor**, because being sent back without being told
where is what makes a gate read as a verdict on the learner rather than on the page. Only one of
the two is ever on screen, so the way back has to be in whichever one fires — the navigation bar
carries it for the rest of the time, and neither is a reason to leave it out of the other.

**Then the links.** Add `checkpoint:` to this Unit's entry in `assets/units.js`: that is what
lights the slot the navigation bar and the Dossier have always had a place for, and it is what
makes every page of the Unit reachable from every other. Write one link yourself — the Lesson
pointing at its Checkpoint where the Lesson ends — because a bar at the top of the page is not
where a learner is looking when they have just finished reading.

A Checkpoint the learner passes by scrolling back into the Lesson has measured nothing.

## Assignments

Shape, difficulty, and verification are yours to design per Assignment — there is no standard
form and there should not be one. Shapes that have worked: a task with an objective pass/fail
check; an artifact to review; a Feynman-style "explain this in your own words"; "find an instance
of this in your own codebase". Treat that as inspiration rather than a menu, and invent better
ones when the material suggests them.

Two things are worth being strict about:

1. **The Rubric travels with the Assignment.** Write the task, what counts as done, and the
   likely failure modes into the same file. A future Session holding none of your context must be
   able to grade it. This is what lets Assignments survive Session boundaries.
2. **Space and interleave them.** An Assignment from Unit 2 is often best given after Unit 4,
   and one task forcing two Units together is worth more than two separate tasks.

Whether this Unit earns one at all was settled before you got here — see [the assessment
ladder](./SKILL.md#the-assessment-ladder). What is left is the form it takes.

**One page of its own, in `./assignments/`.** `assignments/0003-pipe-audit.html`, numbered to the
Unit it draws on, built like any other page — [the page](#the-page) above, with
`assets/assignment.css` in the head and `assets/assignment.js` before the bootstrap — and
carrying the same `data-unit`, so the two read as one Unit to every piece of infrastructure that
meets them. HTML for the reason a Lesson is: a `.md` file is invisible from the browser the
learner is already in.

**The task, and what to do without the page.** Both are required, and the Component refuses to
mount rather than offer a hand-in above half of them. The second is what the hand-in form
replaces, so it is also what a learner whose scripts never ran is left reading: say where to put
the work and to tell you about it next Session. Its head comment holds the markup, as every
Component's does — read that before writing one.

**The Rubric goes in the page, in a block nothing renders.** A `<script type="application/x-rubric">`
element: never displayed, never executed, and read straight off the file by the Grader, which is
what makes a judgement reproducible from the page alone rather than from the Session that set it.
Write what counts as done and the likely failure modes, in the terms you would use to argue the
verdict. **Without one the page offers no hand-in at all** — a Rubric that is not there would have
to be remembered, and remembering is the one thing grading may not do.

**The Submission is evidence of the work, not necessarily the work.** Short answers go in the box
on the page. Anything larger goes into `./submissions/` — one directory per Assignment — and the
learner names the paths beside their answer; the Grader opens them itself, with the read-only
tools it already has. Nothing is uploaded and no boundary moves. Say so in the task when the work
will obviously be too big for a box: *put it in `submissions/0003-pipes/` and write the path in.*

**Then the links.** Add `assignment:` to this Unit's entry in `assets/units.js`, which lights the
third slot the navigation bar and the Dossier have always had a place for. Write one link
yourself, from the Lesson to the Assignment, where the Lesson ends — and remember the two sit in
different directories, so it is `../assignments/…` from a Lesson and `../lessons/…` back.

Grading is done by a **fresh Grader** reading the stored Rubric, never by recalling the Session
that wrote the Assignment. The verdict streams into the page, can be questioned there, and is
written into `learning-records/` as a record of its own — so it reaches you through the [Boot
sequence](./SKILL.md#boot-sequence) rather than through the learner remembering to report it. How
that is wired, and what to tune for this subject, is in [TUTOR.md](./TUTOR.md).

With the service stopped the page says so and puts a well-formed prompt on the clipboard instead
of claiming the work was judged. That is a normal state: never write an Assignment whose task
only makes sense if something is running.

## A Unit is navigable, or it does not exist

A Unit is usually more than one file: the Lesson, sometimes a Checkpoint, sometimes an
Assignment. Left unlinked, those become artifacts the learner has to go hunting for, and a file
nobody can find was not worth writing.

Three rules, all mandatory:

1. **Do not wire infrastructure by hand.** One line does it — `<script
   src="../assets/lesson-boot.js" data-unit="0003"></script>`, **last** in `<body>`, below the
   Component tags. It pulls in every piece of page infrastructure, in the right order, and it is
   also what starts the Components: they wait for it, because the text they render lives in it
   and in the workspace's own `assets/strings.js`, which it loads. A page missing that line
   still reads as prose — it just does not interact. Even the line is a safety net rather than a
   chore: `${CLAUDE_PLUGIN_ROOT}/scripts/wire-lessons.sh` injects it into any page missing it, so
   run that after writing a Lesson and forget about it. Your attention belongs on the
   teaching.
2. **`index.html` is the Dossier** — the one page every Unit is reachable from. Update it
   whenever you add a Unit or change a progress marker. The learner should never need to open
   `lessons/` in a file browser.
3. **Siblings link to each other.** A Lesson points at its Checkpoint and its Assignment; they
   point back. The learner should be able to move through a Unit without touching the address
   bar.

Keep files flat (`0001-slug.html`, `0001b-checkpoint.html`). Do not nest Units into folders — it
buys nothing and breaks every relative asset path.

## Reference documents

Lessons are rarely revisited. Reference documents are — so write them as you go, into
`./reference/` and as HTML for the reason Lessons are, and link to them from the Units they came
out of.

A reference document is the compressed essence of what a Unit taught, in a shape built for
lookup rather than for reading: syntax and snippets for a programming language, an algorithm or a
flowchart for a process, poses and sequences for yoga, routines for fitness. They are the raw
units of knowledge that outlive the Lesson that introduced them, so make them beautiful and make
them print well.

**A glossary is the reference document almost every subject earns**, and it is the one with the
longest reach: once the Workspace has one, every Lesson adheres to its terms. Use
[the glossary format](./formats/glossary.md).
