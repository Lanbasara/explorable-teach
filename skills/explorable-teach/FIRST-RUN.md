# First run: research and plan

The [Boot sequence](./SKILL.md#boot-sequence) branches here when there is no `MISSION.md`, or
when the one there does not yet say why this person is here. That happens once per Workspace.
Every other Session skips this document entirely.

Work through it before writing anything teachable.

## 1. Establish the Mission

Interview only when it is genuinely underdetermined.

**A missing file is not evidence of a missing Mission.** A new Workspace never has `MISSION.md`,
and that says nothing about whether the learner has already told you why they are here.
Interview on what they said, not on what the directory contains.

If the opening request already carries why they are learning, what they want to be able to do,
and what they do not want, write `MISSION.md` from it — using [the Mission
format](./formats/mission.md) — and confirm in one line: *"this is what I think you're after —
correct me."*

Ask only for what is genuinely absent **and** would change the plan; a question whose every
answer leads to the same first Unit is not worth asking. Interrogating someone who just handed
you a thorough brief reads as not having read it.

## 2. Record the language they read

**Ask, once, and write the answer down.** Every later Session takes the learner's language from
what this one recorded; nothing else in the Workspace knows it, and a Session that guesses teaches
somebody in a language they did not choose.

It goes in `NOTES.md`, as prose, with everything else they have said about how they want to be
taught. That is the record, and it is what an agent invoked outside a page reads, so it is what
decides the language an *answer* comes back in.

`lang` in `assets/units.js` is the other half — a BCP-47 tag (`en`, `zh-CN`, `ja`, `pt-BR`), read
by every page, deciding the language the *screen* is in. Keeping it in step with `NOTES.md` is
[step 7 of the Boot sequence](./SKILL.md#boot-sequence) and belongs to it, but this Session has
already walked past that step — so set it here, once, and every later Session is the one that
reconciles it.

Do not ask if they have already made it plain: someone who opened in their own language has told
you. Ask when the request arrived in one language and names another as the subject, which is the
case where guessing is a coin flip.

## 3. Research the subject's best interactive affordances

- Search the web: "best interactive {subject} tutorial", "explorable explanation {subject}"
- Identify what existing interactive teaching does well for this subject
- Determine what this subject is made of — processes, structures, quantities, things to operate —
  because not all subjects need the same tools

Record the sources worth returning to in `RESOURCES.md`, using
[the Resources format](./formats/resources.md). Until it is well populated, finding good sources
*is* the work.

## 4. Select the tech stack

Take two or three passages this subject will actually have to teach and run each through [the
derivations](./UNIT.md#the-derivations) — the gates first, because most passages come out of them
wanting nothing at all. What survives is a description of an interaction; match those against what
`assets/` already holds, and whatever is left over is what this subject earns. A subject-specific
tool — the Web Audio API for music theory, a step-by-step visualiser for algorithms — is
something you go and search for now rather than expect to be sitting there.

Settle this by subject, not by appetite. A philosophy course and an algorithms course should not
end up with the same tooling, and most subjects earn fewer tools than the first plan gives them.

## 5. Write `TECH-STACK.md`

At the Workspace root:

```md
# Tech Stack for {subject}

## Rationale
{Why these tools were chosen for this specific subject}

## Selected Components
| Teaching act | Component | Shipped, or built here | Why this one | Checked against |
|--------------|-----------|-----------------------|--------------|-----------------|
| ... | ... | ... | ... | ... |

## Subject-Specific Tools (if any)
| Tool | Pinned version | What it is wrapped as |
|------|----------------|-----------------------|

## Deferred (not needed yet)
| Teaching act | When it would earn a Component |
|--------------|-------------------------------|
```

**Checked against** is the column that cannot be left to memory. A Component that computes
something real names there [what it was checked
against](./UNIT.md#simulate-only-what-can-be-checked-against-a-known-good-result), which is where
the kinds that qualify are written down; one that computes nothing real writes `—`. An entry that
computes something real and leaves the column empty is a run nobody checked, and this table is the
only place that shows.

## 6. Plan the Curriculum

An ordered list of Units in `CURRICULUM.md`, each carrying a progress marker, ordered by
dependency between *ideas* rather than by any book's table of contents.

Which way this subject leans changes the shape of every Unit after it, so settle that first —
see [Knowledge, skills, wisdom](./SKILL.md#knowledge-skills-wisdom).

## 7. Build what the first Units need

Whatever Components they call for beyond the ones the scaffold already installed. Do not build
the whole stack up front: a Component nobody has needed yet is a guess.

## 8. Tune the Tutor for this subject

`tutor/TUNING.md` is the one Tutor file this skill authors. See [TUTOR.md](./TUTOR.md).
