# Design decisions

Why this works the way it does, and what was rejected along the way. `CHANGELOG.md` records
*what* shipped; this records *why*, including the reasoning that never appears in a diff.

**Provenance.** Everything from `b8c4fd6` (2026-09-11 17:42) onward is git-verifiable — the
commit messages carry the reasoning. Everything before that predates packaging and has no
version control; it is reconstructed from the session transcript and from rationale that was
deliberately written into `SKILL.md` and `README.md` at the time. Where the record is thin, it
says so.

---

## 1. Teach mental models, never command lists

**Decided:** commands appear only as illustrations of a deeper concept, never as a lesson's goal.

**Why:** the first lesson produced for the pilot learner was a command table with frontend
analogies. They rejected it outright — "照本宣科" (rote recitation) — on the grounds that
memorising commands is pointless when AI can write any of them. The real gap was structural
knowledge: process model, file descriptors, evaluation order.

**Consequence:** curricula are ordered by dependency between *ideas*, not by any book's table of
contents.

## 2. Two phases, and the tool stack is chosen per subject

**Decided:** Phase 1 researches and plans (mission, sources, curriculum, tech stack); Phase 2
teaches one lesson at a time. The component catalog is a menu, not a manifest.

**Rejected:** a fixed tool set applied to every topic. A philosophy course and an algorithms
course should not end up with the same tooling.

## 3. Default to minimal interactivity

**Decided:** before adding any interactive component, answer *what can the learner not
understand without this?* No answer means don't add it.

**Why:** the catalog grew fast (3D terrain, particle systems, D3 races) and the pull toward
building impressive things rather than necessary ones is strong. The rule exists to resist the
author's own enthusiasm, including a future agent's.

## 4. The tutor holds no process state

**Decided:** every question spawns a fresh headless `claude`. Never `--resume`.

**Rejected:** reusing the authoring session. It carries curriculum-planning state that has no
business leaking into an explanation, and it decays as it grows — which was the learner's
original objection to "just ask the session that wrote it".

**Refined later (`944b41f` onward):** follow-ups replay a capped transcript *inside the request*.
Bounded replay, not a session — state lives in the payload and dies with it. This keeps
multi-turn continuity without reintroducing the decay.

## 5. The tutor ships as a workspace template, not a plugin agent

**Decided:** the plugin carries an inert `templates/agents/tutor.md`; `init` copies it into the
workspace, where it registers project-scoped.

**Rejected:** a top-level `agents/` directory in the plugin, which would be tidier. Claude Code
discovers subagents only in `.claude/agents/`, and a plugin-level agent registers **globally**.
Subagents have no `disable-model-invocation` equivalent, so it would be auto-routable in every
unrelated project. Project scoping is the only invocation control a subagent has.

It also would not want to be global: a tutor for Shell and a tutor for music theory are not the
same role. Each workspace tunes its own `ROLE.md`.

## 6. The skill is manual-only

**Decided:** `disable-model-invocation: true`, and a one-line description.

**Why:** only name and description are permanently resident in context. The original description
was 396 characters of trigger bait written to attract auto-invocation; once invocation is manual
that text is pure overhead. Cut to 96.

## 7. The skill scaffolds; it never silently hosts a process

**Decided:** the skill writes the tutor files. It does not start the server as a side effect of
teaching. It *may* start, restart or stop it on request — always detached, so the process
outlives the conversation. Lessons must work with the server down; that is the normal state.

**Why:** artifacts persist across conversations, processes do not. An 8-hour idle timeout guards
against a forgotten process lingering for days, not against one idle over lunch.

## 8. Assignments are specified loosely, on purpose

**Decided:** whether an assignment exists, its shape, its difficulty and its rubric are all the
agent's judgement. Two things are fixed: the rubric travels inside the assignment file, and
assignments are spaced and interleaved.

**Why:** the pilot learner explicitly warned that over-specifying would make the agent follow the
spec mechanically and turn assignments into a rigid ritual. The listed shapes are labelled
inspiration, not a menu.

**The one hard rule earns its place:** a rubric stored with the task is what lets *any* future
session grade it without the context of the session that wrote it.

## 9. Sessions are disposable; the workspace is the memory

**Decided:** teach one lesson per session, two or three at most, then stop deliberately. Every
session opens with a fixed boot sequence.

**Why:** two different failures hide here. Context *loss* between sessions, which state files
solve; and quality *decay* inside a long session, which they do not. Only ending sessions solves
the second.

## 10. Files stay flat; the fix for "I can't find anything" is an entry point

**Decided:** `index.html` as the dossier cover, a nav bar on every page, `units.js` as the single
manifest. (`944b41f`)

**Rejected:** a folder per teaching unit. It would break every relative asset path across every
existing and future lesson, and the actual complaint was discoverability, not organisation.

## 11. Page infrastructure is injected, not hand-wired

**Decided:** one `lesson-boot.js` tag replaces five boilerplate lines, and
`scripts/wire-lessons.sh` injects even that into any page missing it. (`61e84f5`)

**Why:** requiring the authoring agent to remember five lines spent its attention on boilerplate
and made orphaned pages a matter of whether it remembered. Adding a future page-wide component
now means editing one file instead of every lesson.

**Found while doing it:** `tutor.js` initialised on a bare `DOMContentLoaded` listener, which
never fires for a dynamically loaded script. The widget would have silently failed to mount while
the nav bar — which guards on `document.body` — worked fine.

## 12. `init` sets up a directory and stops

**Decided:** `init` copies files. It does not interview, research, plan, or teach. (`442d587`)

**Why:** its second half had duplicated Phase 1 of the skill outright, giving one responsibility
two homes free to drift apart — and it broke the boundary a command named `init` implies. `git
init` and `npm init` set up a directory; they do not ask what your product is for.

## 13. Interview on evidence, not on a missing file

**Decided:** interview only when the mission is genuinely underdetermined. (`f5446fd`)

**Why:** `teach` triggers its interview when `MISSION.md` is absent — always true in a new
workspace. Inherited wholesale, that meant a learner who opened with their role, their goal and
an explicit list of non-goals still got a questionnaire.

**Worth recording, because the first diagnosis was wrong:** the same prompt had *not* triggered an
interview earlier that day. The initial explanation blamed the rule. It was not the rule — the
spec text was byte-identical across both runs. The difference was auto-memory: the earlier run
sat in a directory whose memory namespace already held the learner's profile and stated
prohibitions, so the mission was already known. The new directory was a fresh namespace.

The deeper defect was therefore that correct behaviour depended on whether memory happened to be
populated. The fix makes the mission readable from the opening request itself. **A missing file
is not evidence of a missing mission.**

---

## Where the full record lives

- **Post-packaging:** `git log` in this repo — commit messages carry the reasoning.
- **Pre-packaging:** no version control. The session transcript is the only record
  (`~/.claude/projects/<workspace-slug>/<session-id>.jsonl`), with a rendered export in the
  pilot workspace under `exports/`.
