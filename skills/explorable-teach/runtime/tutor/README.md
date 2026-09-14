# The tutor service

The local service behind the ask-the-tutor button on a lesson page. Zero npm dependencies, Node's
built-in modules only.

This document is for whoever is operating the service — so it is in English, like everything else
under the plugin. What the learner reads is a different question, and the answer to it is further
down.

## Who starts it

**You do, in your own terminal, when you sit down to study.** It is a dev-server-shaped process —
the same relationship `vite` has with a front-end project.

- **No AI conversation owns its lifetime.** The teaching session does not start it for you, and
  closing that conversation does not touch it.
- **A lesson has to work with it stopped.** The page probes for it, and falls back to clipboard
  mode when the probe finds nothing (see the last section).
- **It exits after 8 idle hours**, so a process you forgot about does not sit there for days. The
  length is deliberate: what it guards against is being forgotten, not being idle over lunch.
  To change it: `IDLE_TIMEOUT_MS=3600000 ./tutor/tutorctl.sh restart`

## Running it, and looking into it

```sh
./tutor/tutorctl.sh status     # up? pid / uptime / idle time / where each lesson is served
./tutor/tutorctl.sh start      # in the background; outlives this terminal and this session
./tutor/tutorctl.sh restart
./tutor/tutorctl.sh stop
./tutor/tutorctl.sh log 40     # the last 40 lines of the log
```

`start` **detaches on purpose**: its lifetime should be decided by your study session rather than
by a terminal window or an AI conversation. It gives up the terminal *and* the process group, so a
signal sent to the group the launching shell sits in does not reach it either. The log is written
to `tutor/server.log`. To move it off a busy port: `PORT=5000 ./tutor/tutorctl.sh start`

You can also run `node tutor/server.js` in the foreground and stop it with Ctrl-C — easier to
watch while tuning `TUNING.md`. (The service has to know which workspace it is serving:
`tutorctl.sh` passes that for you, so run it from the workspace root, or name the directory
outright as `node tutor/server.js /path/to/workspace`.)

**When the tutor does not answer, check in this order**: it was never started → it exited on the
idle timeout → the port is held by a stale process from an earlier session (`status` reports the
pid — look at what is holding it before killing anything) → `claude` is not on `PATH` in the
environment that launched it.

**If it dies within minutes of being started from inside an agent session** — serving fine, then
gone, with no exit line in the log — start it from a standalone terminal instead. It is detached
from that session's process group, but the signal that killed the reported one was never captured,
so that detachment is hardening rather than a diagnosis.

## It does three things

1. **Serves the workspace** over http, which lifts the `file://` restrictions a lesson would
   otherwise be under (Pyodide, sql.js and anything else that fetches wasm). A file under
   `assets/` that the workspace does not have falls back to the plugin's copy, so a broken link
   still leaves the page styled.
2. **`POST /api/ask`** — hands the question to `claude` in the background and streams the answer
   back to the page over SSE.
3. **Logs the questions** — one line per exchange, appended to
   `learning-records/questions.jsonl`.

## Why every question is a fresh process

The service **holds no session**. Each question spawns its own `claude -p`, which exits when the
answer is done.

- No session pollution, and no quality decay as a conversation grows
- Context comes from **reading files** rather than from memory: the working directory is the
  workspace, and the tutor goes and reads `NOTES.md`, `MISSION.md`, `CURRICULUM.md`, `lessons/`
  and `learning-records/` itself

State lives in files; the computation is disposable.

## questions.jsonl is the point

The question log is not written for you to read. It is written **for the session that plans the
next lesson**.

"Three questions in a row about backpressure" is the hardest curriculum signal the workspace
produces: either that lesson needs rewriting, or this learner's starting point on concurrency was
lower than the plan assumed. That is what makes the tutor an assessment instrument rather than a
help desk.

Read it while planning.

## The language a learner reads

Everything under the plugin — this file, the role definitions, the prompt the service assembles,
the logs — is English, because its reader is whoever maintains it. The **answer** is not: the page
sends the language it declares in `<html lang>` with each request, and the payload closes with one
directive naming it, so a tutor answer and a grader verdict come back in the learner's own
language. A workspace states that language once, in `assets/units.js`.

Everything the page puts on screen around the answer comes from a table rather than from source —
the plugin ships one per language, and `assets/strings.js` is where a workspace overrides an entry
or supplies a language the plugin has not collected. So the service holds no string a learner
could ever see: a failure that is the service's own to name travels as a **code**, and the page
reads it out of that same table.

## The role prompt is two halves: `ROLE.md` and `TUNING.md`

The tutor's behaviour is defined **outside `server.js`**, in two `.md` files the service
concatenates, in order, when it starts:

| File | Whose | What goes in it |
|------|-------|-----------------|
| `tutor/ROLE.md` | the plugin's (a symlink here) | true of every subject: how to answer, when to go and read, read-only |
| `tutor/TUNING.md` | this course's | true of this subject: which terms to use, analogies worth reusing, where the course stops |

A missing or empty `ROLE.md` makes the service exit with an error rather than fail at the moment
you ask something; a missing `TUNING.md` is skipped, and being empty on day one is normal.

The arrangement exists for **one source of truth**: the subagent at `.claude/agents/tutor.md` is
pointed at those same two files in that same order. Whichever path you take, service or subagent,
you get the same tutor.

To tune the tutor, **edit `TUNING.md`** and restart the service. `ROLE.md` is the plugin's copy,
shared by every workspace — editing it here edits every other learner's course too.

The grader is the same shape one entry along in the service's `ROLES` map, pointing at its own
role definition and its own tuning.

## These files live in the plugin

`server.js`, `tutorctl.sh`, `ROLE.md`, `GRADER.md`, and everything under `assets/` except this
workspace's own manifest and string table, are **symlinks** here. The real files are in the
plugin.

The gain is that fixing the tutor once fixes it for every course you have, rather than only for
the ones created afterwards. The cost is that those files cannot be edited in place — to change
one, write a new file beside it. What is yours is what varies by subject: `TUNING.md`,
`GRADER-TUNING.md`, `assets/units.js`, `assets/strings.js`, `index.html`, the components you
wrote for this course, and every lesson and record in it.

After the plugin is upgraded, run `init-workspace.sh` again and the links are re-pointed at the
new version.

## Why it does not read NOTES.md and MISSION.md itself

An early version had the tutor go and read them, which cost five extra tool round-trips and about
ten seconds per question. The service now splices both files **straight into the prompt** when it
sends the question (4000 characters each, skipped when the file is absent).

The larger files that are only needed **sometimes** — the lesson itself, `CURRICULUM.md`,
`learning-records/` — are still the tutor's own call to read or not.

## Security

- Binds `127.0.0.1` only, never a public interface
- `spawn` with an argv array, never `shell: true`; user input never reaches a command line
- Static serving normalises the path, checks it against the root, and allows only known extensions
- The tutor runs with `--restricted` (no Bash or any other execution tool) and is given `Read` /
  `Glob` / `Grep` — **read-only**
- Caps: 2000 characters per question, 4000 per selection, 128KB per body, 120s per answer

## With the service stopped (which is normal, not a fault)

The page probes `/api/health` on load. When the probe finds nothing — because you opened the file
over `file://`, say — the send button becomes a copy button instead: it puts a well-formed
question on the clipboard, to paste into Claude Code.

Or invoke the `tutor` subagent directly in Claude Code (`.claude/agents/tutor.md`). It reads the
same `ROLE.md`, so it behaves identically; it simply is not inside the page.
