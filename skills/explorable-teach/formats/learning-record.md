# Learning Record Format

Learning records live in `./learning-records/` and use sequential numbering: `0001-slug.md`, `0002-slug.md`, etc. Create the directory lazily — only when the first record is written.

They are the teaching equivalent of ADRs: they capture non-obvious lessons, key insights, and stated prior knowledge that will steer future sessions. They are used to calculate the zone of proximal development.

## Template

```md
# {Short title of what was learned or established}

{1-3 sentences: what was learned (or what prior knowledge was established), and why it matters for future sessions.}
```

That is the whole format. A learning record can be a single paragraph. The value is recording _that_ this is now known and _why_ it changes what to teach next — not in filling out sections.

## Optional sections

Only include these when they add genuine value. Most records won't need them.

- **Status** frontmatter (`active | superseded by LR-NNNN`) — useful when an earlier understanding turns out to be wrong and is replaced.
- **Evidence** — how the user demonstrated the understanding (a question answered, an exercise completed, prior experience cited). Useful when the claim might be revisited.
- **Implications** — what this unlocks or rules out for future sessions. Worth recording when non-obvious.
- **Handoff** — what they struggled with, which analogy actually landed, the next ZPD step, and any thread left open. Write this whenever a session ends mid-topic: it is what a fresh session reads to resume without re-interviewing the learner.

## The record a verdict writes

One record is written by a machine rather than by a session: when an assignment is handed in and
the grader reaches a verdict, the tutor service writes that verdict into `learning-records/`
before the page is told the answer. The session that set the assignment has ended by then, and
the session that would have written this record has not started — see
[TUTOR.md](../TUTOR.md#the-grader).

It uses the template above, with the optional **Evidence** section filled in, because a verdict is
a claim that may be revisited:

```md
# Assignment verdict: {the assignment page's name, as a slug}

{the grader's verdict, in the learner's language, exactly as it was given}

## Evidence

- Assignment: assignments/0003-pipe-audit.html
- Submission:

  > what the learner handed in, quoted

- Verdict: reached by the Grader, 2026-05-04T09:12:33.104Z
```

The title, the field keys and the timestamp are English and ASCII, because the reader of those is
the next boot sequence and whoever maintains this — not the learner. The verdict between them is
the learner's own language and is never touched.

Evidence says where the verdict came from and not which criteria were applied: nothing at that
point can check the latter. A refusal — a grader that found no rubric to judge against — writes no
record at all.

## Numbering

Scan `./learning-records/` for the highest existing number and increment by one.

## When to write a learning record

Write one when any of these is true:

1. **The user demonstrated genuine understanding of something non-trivial** — not just exposure, but evidence they can use the concept correctly. This sets a new floor for what to teach next.
2. **The user disclosed prior knowledge** — "I already know X." Record it so future sessions don't re-teach it. Also record the _depth_ claimed.
3. **A misconception was corrected** — the user previously believed something wrong and now sees why. These are high-value: they predict future stumbling blocks for related topics.
4. **The mission shifted in response to learning** — the user discovered they cared about something different than they thought. Cross-link to [[MISSION.md]] and update it.

### What does _not_ qualify

- Material that was merely covered. Coverage is not learning. Wait for evidence.
- Anything already captured tersely in [[GLOSSARY.md]] as a term definition. Don't duplicate.
- Session-by-session activity logs. Learning records are not a journal — they are decision-grade insights.

## Supersession

When a later record contradicts an earlier one (the user's understanding deepened or corrected), mark the old record `Status: superseded by LR-NNNN` rather than deleting it. The history of how understanding evolved is itself useful signal.
