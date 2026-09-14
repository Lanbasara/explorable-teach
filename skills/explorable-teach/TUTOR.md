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
to tune this toward "read less for lower latency" — a question containing "this bit" or "the part
above", in whatever language the learner asks it in, cannot be answered from the selection alone,
and a wrong answer costs far more than two seconds.

## How an answer reaches the page

A Tutor writes Markdown — fenced code, bullets, inline code — so the drawer renders it as
rich text through `assets/rich-text.js`, and renders a pinned answer through the same file, so
saving an answer never degrades it.

That renderer is the one piece of security-relevant client code on the page, and it is built to
one rule: **an answer becomes nodes, never markup**. Every node comes from a fixed set of tags,
every piece of the source arrives as text, and a link whose destination is not `http`, `https`
or `mailto` stays in the answer as the text it was written as. An answer is generated text that
has read the learner's Workspace, so a `<script>` in one is a sentence a learner reads rather
than something the Lesson runs.

Anything added here follows that rule. Never assign markup, in this file or in any Component:
the fixture DOM the suite mounts pages in refuses `innerHTML` outright, which is where that rule
is enforced rather than merely stated.

**The answer is in the learner's language; everything around it is English.** The page sends the
language it declares in `<html lang>` with each request, and the payload closes with one
directive naming it — so a Tutor answer and a Grader verdict come back in the learner's language
while the prompt scaffolding, the logs and the comments stay English for whoever maintains them.
The service holds no string a learner could ever see: a failure that is the service's own to name
— it could not start `claude`, or the answer never arrived — travels as a **code**, and the drawer
reads it out of the same table every label on the page comes from. What the agent itself said on
its way out is shown as it arrived, because that is evidence about a run rather than a string
anybody chose. Decision 30 in `docs/DECISIONS.md` argues why the language is the one thing the
page decides and everything else is the service's.

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
- **The drawer connects only on a Lesson the service is serving.** It is the precondition under
  everything here, and the one a first Workspace trips over: a Lesson opened from disk is offline
  *by design*, not a failure to debug. The drawer asks the service that served the page, so on a
  page nothing served there is nothing for it to ask — starting the service cannot change that,
  and the page says so rather than offering a command. So hand the
  learner a served address: `./tutor/tutorctl.sh status` prints one per Lesson, and so does
  `${CLAUDE_PLUGIN_ROOT}/scripts/wire-lessons.sh`, which you run anyway once a Lesson is written.
- **Do not tell the learner to reload after starting it.** True of a served Lesson: the drawer
  keeps asking while it is offline and connects itself, so starting the service is the whole of
  the instruction. On a Lesson opened from disk a reload changes nothing, which is the
  precondition above rather than an exception to it.

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

The service is zero-dependency Node. It serves the Lessons over http and exposes `POST /api/ask`,
which runs headless Claude with `--restricted` and read-only tools.

**What serving buys is two things, and neither is what this document used to claim.** It buys the
in-page Tutor, which works only on a page the service served — the drawer asks the service that
served it, so a page nothing served has nothing to ask. And it gives the page an origin, so a
Lesson may fetch its own files by relative path, load a module of its own, or point a library at
an asset beside it — every one of which is refused on a page opened from disk, for want of an
origin to fetch from. What it does **not** buy
is a module script or an in-page runtime as such: Pyodide, sql.js and anything else loaded from a
pinned https CDN run on a page opened from disk, because the CDN answers with the CORS header
that a file beside the page does not. [Authoring a Unit](./UNIT.md#what-breaks-when-a-page-is-opened-from-disk)
lists what an author types that needs serving. The shipped Components need none of it, and stay
that way for a reason unrelated to being usable offline — they are the same bytes in every
Workspace, so staying dependency-free is what keeps them small and lets one fix reach all of
them.

## Two ways to reach the same Tutor

Both read `tutor/ROLE.md` and then `tutor/TUNING.md`, in that order, so neither is a downgrade:

| Path | How | When |
|------|-----|------|
| In-page drawer | learner runs `./tutor/tutorctl.sh start` | while studying, question tied to a passage |
| `tutor` subagent | ask in any Claude Code session | no service running; zero lifecycle |

The service composes the two into one system prompt; the subagent at `.claude/agents/tutor.md` is
pointed at the same two files in the same order and reads them itself. That is the whole of the
arrangement — the subagent definition holds no role text of its own, because a second copy is a
second thing to keep in step. [The Grader](#the-grader) is the same arrangement over its own two
files.

## Operating it

When the learner says the Tutor is broken, silent, or slow, probe before theorising:

```
./tutor/tutorctl.sh status     # up? which port, pid, uptime, idle time, where each Lesson is served
./tutor/tutorctl.sh start      # detached from the terminal and the process group both
./tutor/tutorctl.sh restart
./tutor/tutorctl.sh stop
./tutor/tutorctl.sh log 40     # the last 40 lines of tutor/server.log
curl -s 127.0.0.1:4173/api/health
```

A Lesson left open picks the service up on its own within a few seconds of it starting, so
"start it and reload" is one step too many.

Common causes, in the order worth checking: the service was never started; it exited on idle
timeout; the port is held by a stale process from an earlier session; `claude` is not on `PATH`
in the environment that launched it. `status` reports the pid — look at what is holding the port
before killing anything, and move out of its way with `PORT=5000 ./tutor/tutorctl.sh start` if
the process turns out to belong to something else.

One failure has a shape rather than a cause: the service comes up, serves for a few minutes, and
is then gone, with no exit line in `tutor/server.log` — killed rather than shut down, and too soon
to be the idle timeout. If that happens to a service started from inside an agent session, start it
again from a standalone terminal. `start` leaves the launching shell's process group as well as its
terminal, which is the half of "outlives the shell that launched it" that used to be missing; the
signal that did the killing was never captured, so that is hardening rather than a known fix.

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

## The Grader

Grading an Assignment is mechanically this service with a different role file: a second entry in
its `ROLES` map. It reaches the learner over the same transport, so streaming, the wait, the
question log and the offline fallback behave identically — and there is nothing to install or
start beyond what is already running.

The Grader is a *fresh* agent reading the stored Rubric, never the Session that wrote the
Assignment. See [the assessment ladder](./SKILL.md#the-assessment-ladder).

**Same shape, four files along.** `tutor/GRADER.md` is the plugin's definition, linked like
`ROLE.md`; `tutor/GRADER-TUNING.md` is this Workspace's, and empty is a normal state; the
subagent at `.claude/agents/grader.md` is pointed at those two, in that order. The two paths
compose the same prompt, so neither is a downgrade — and the tuning files are separate on purpose:
what a Tutor should say and what counts as done are different questions, and one file answering
both would be a Tutor being asked to mark.

**Where a verdict goes.** A submission's verdict is written into `learning-records/` as a
numbered record of its own, beside the ones you write, before the page is told the answer. That
is what makes grading reach the next Session through the [Boot
sequence](./SKILL.md#boot-sequence) rather than through the learner remembering to mention it.
A follow-up about a verdict is a conversation about a record rather than a second one, so nothing
is written for it.

**What it is never handed.** The Rubric. It is stored in the Assignment page, and the payload
does no more than name that page and say what block to look for — so what the Grader judges is
what is on disk, not what a page chose to send. A Grader that finds no Rubric there is told to
refuse rather than to improvise, and to open that refusal with a fixed ASCII token — that token is
how the service tells a refusal from a verdict and keeps it out of `learning-records/`, and the
drawer strips it so the learner reads the explanation under it rather than a marker. `tutor/GRADER.md`
is where it is written down, and the only place it is: a tuning file must not restate or redefine
it.

Tuning the Grader is the same loop as tuning the Tutor, and takes the same restart.
