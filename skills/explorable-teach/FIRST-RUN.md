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
and what they do not want, write `MISSION.md` from it — using [MISSION-FORMAT.md](./MISSION-FORMAT.md)
— and confirm in one line: *"this is what I think you're after — correct me."*

Ask only for what is genuinely absent **and** would change the plan; a question whose every
answer leads to the same first Unit is not worth asking. Interrogating someone who just handed
you a thorough brief reads as not having read it.

## 2. Research the subject's best interactive affordances

- Search the web: "best interactive {subject} tutorial", "explorable explanation {subject}"
- Identify what existing interactive teaching does well for this subject
- Determine which interaction patterns fit — not all subjects need the same tools

Record the sources worth returning to in `RESOURCES.md`, using
[RESOURCES-FORMAT.md](./RESOURCES-FORMAT.md). Until it is well populated, finding good sources
*is* the work.

## 3. Select the tech stack

Pick from the [Component Catalog](./SKILL.md#component-catalog) what fits this subject, and
search for **subject-specific tools** that are not in it — music theory might want the Web Audio
API; algorithms might want p5.js.

The catalog is a menu, not a manifest. A philosophy course and an algorithms course should not
end up with the same tooling.

## 4. Write `TECH-STACK.md`

At the Workspace root:

```md
# Tech Stack for {subject}

## Rationale
{Why these tools were chosen for this specific subject}

## Selected Components
| Component | Library | Why |
|-----------|---------|-----|
| ... | ... | ... |

## Subject-Specific Tools (if any)
| Tool | CDN | Purpose |
|------|-----|---------|

## Deferred (available but not needed now)
| Component | When to add |
|-----------|-------------|
```

## 5. Plan the Curriculum

An ordered list of Units in `CURRICULUM.md`, each carrying a progress marker, ordered by
dependency between *ideas* rather than by any book's table of contents.

Which way this subject leans changes the shape of every Unit after it, so settle that first —
see [Knowledge, skills, wisdom](./SKILL.md#knowledge-skills-wisdom).

## 6. Build what the first Units need

Whatever Components they call for beyond the ones the scaffold already installed. Do not build
the whole stack up front: a Component nobody has needed yet is a guess.

## 7. Tune the Tutor for this subject

`tutor/ROLE.md` is the one Tutor file this skill authors. See [TUTOR.md](./TUTOR.md).
