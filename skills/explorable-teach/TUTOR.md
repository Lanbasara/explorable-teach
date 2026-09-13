# The Tutor

Reached when the Tutor is being installed, tuned, or is not answering — and on no other Session.

Two Tutor facts live in [SKILL.md](./SKILL.md) instead, because they change what the Teacher
does: the learner's logged questions are read during the Boot sequence, and a Lesson must stay
fully readable with the service stopped. Everything else is here.

## What it is

Lessons are static HTML, and the learner will hit sentences that don't land. The fix is an
in-page Tutor — but it must not be *the Session that wrote the Lesson*. That Session carries
curriculum-planning state that shouldn't leak into an explanation, and it decays as it grows.

**It holds no process state.** Each question spawns a fresh headless Claude whose working
directory is the Workspace, with read-only tools. Never `--resume` or `--continue` — a resumed
session would drag back exactly the rot this design exists to avoid.

Follow-up questions still work, because the client replays the last few turns **inside the
request**, capped. That is bounded replay, not a session: state lives in the payload and dies
with it. The learner gets a real back-and-forth; the Tutor gets a clean context every time.

Context is acquired **progressively**. The service inlines what is always needed (`NOTES.md`,
`MISSION.md`, the selected passage, recent turns); the Tutor goes and reads the Lesson,
`CURRICULUM.md`, or `learning-records/` when the question actually demands it. Resist the urge
to tune this toward "read less for lower latency" — a question containing 这段 or "the part
above" cannot be answered from the selection alone, and a wrong answer costs far more than two
seconds.

## The skill scaffolds it; the learner's study session owns it

Artifacts persist across conversations. Processes belong to the learner, not to a conversation —
but that cuts both ways: a process you start must *outlive* you, and you must be able to *see*
it.

- **Do** let the scaffold install the Tutor, exactly as it installs the Components.
- **Do not** start the service as a side effect of teaching. No silent daemons.
- **Do** start, restart, or stop it when the learner asks, or when they report the Tutor is not
  responding. Always start it detached (see below) so it survives the end of this conversation.
  Its lifetime is the learner's study session, not your session.
- **Never** write a Lesson that depends on the service being up. The page must be fully readable,
  and the in-page drawer must degrade to a clipboard prompt when `/api/health` is unreachable — which is
  a normal state, not a failure.

## Installing it

The first step of the [Boot sequence](./SKILL.md#boot-sequence) installs it. There is nothing to
place by hand and nothing here to copy: the only Tutor file this skill authors is
`tutor/TUNING.md`, which it tunes for the subject.

**The Tutor lives in the plugin, and the Workspace points at it.** Everything under `tutor/` that
does not vary by subject is a link rather than a copy — the scaffold's report says which — so
fixing a Tutor defect fixes it for every Workspace at once. Never edit one of them in place: you
would be editing every other learner's Tutor. What this Workspace gets to say goes in
`tutor/TUNING.md`.

`server.js` carries security-sensitive code — path-traversal guards, argv `spawn` with no shell,
input caps, loopback-only bind, idle auto-shutdown. That is exactly why the Workspace links at it
rather than any Session writing it: re-deriving that from prose risks silently dropping a guard.

The service is zero-dependency Node. It serves the Lessons over http — which also lifts the
`file://` restrictions that gate Pyodide, sql.js and ES modules — and exposes `POST /api/ask`,
which runs headless Claude with `--restricted` and read-only tools.

## Two ways to reach the same Tutor

Both read `tutor/ROLE.md` and then `tutor/TUNING.md`, in that order, so neither is a downgrade:

| Path | How | When |
|------|-----|------|
| In-page drawer | learner runs `./tutor/tutorctl.sh start` | while studying, question tied to a passage |
| `tutor` subagent | ask in any Claude Code session | no service running; zero lifecycle |

The service composes the two into one system prompt; the subagent at `.claude/agents/tutor.md` is
pointed at the same two files in the same order and reads them itself. That is the whole of the
arrangement — the subagent definition holds no role text of its own, because a second copy is a
second thing to keep in step.

## Operating it

When the learner says the Tutor is broken, silent, or slow, probe before theorising:

```
./tutor/tutorctl.sh status     # up? which port, pid, uptime, idle time
./tutor/tutorctl.sh start      # detached via nohup; writes tutor/.tutor.pid
./tutor/tutorctl.sh restart
./tutor/tutorctl.sh stop
./tutor/tutorctl.sh log 40     # the last 40 lines of tutor/server.log
curl -s 127.0.0.1:4173/api/health
```

Common causes, in the order worth checking: the service was never started; it exited on idle
timeout; the port is held by a stale process from an earlier session; `claude` is not on `PATH`
in the environment that launched it. `status` reports the pid — look at what is holding the port
before killing anything, and move out of its way with `PORT=5000 ./tutor/tutorctl.sh start` if
the process turns out to belong to something else.

The idle timeout is deliberately long — hours, not minutes. The failure it guards against is a
forgotten process lingering for days, not one sitting idle over lunch. Never shorten it to the
point where the learner has to think about restarts; that is the opposite of the goal.

## Tuning it for the subject

`tutor/ROLE.md` is the plugin's, and it already says the things that are true of every Tutor:
read the Workspace rather than hardcoding facts about the learner, disclose progressively, obey
the hard prohibitions in `NOTES.md`, only ever read. Do not restate any of that.

`tutor/TUNING.md` is this Workspace's, and it is where anything subject-shaped goes — which
terms stay in English, which analogies this course has already built and can reuse, what this
course does and does not cover, which files in `reference/` are worth a second look. It is
appended after the shared definition, so it can sharpen that definition but should not fight it.
An empty tuning file is a normal state on day one, not a gap.

Restart the service after tuning it: `./tutor/tutorctl.sh restart`.

Every question is logged to `learning-records/questions.jsonl`, which the Boot sequence reads.

## Adding the Grader

Grading an Assignment is mechanically the Tutor with a different role file: one more entry in the
service's `ROLES` map, pointing at a role definition beside the server and, if the subject needs
one, a tuning file in the Workspace. It reaches the learner over the same transport, so
streaming, logging and the offline fallback behave identically.

The Grader is a *fresh* agent reading the stored Rubric, never the Session that wrote the
Assignment. See [the assessment ladder](./SKILL.md#the-assessment-ladder).
