#!/bin/sh
# Control script for the tutor server.
#
# The server is a dev-server: it belongs to the learner's study session, not to
# any AI conversation. `start` detaches it deliberately so it survives the shell
# (and the conversation) that launched it.
#
# This script lives in the plugin; a workspace links it in at
# tutor/tutorctl.sh. It works out which workspace it is controlling from the
# path it was invoked through, so run it from the workspace:
#
#   ./tutor/tutorctl.sh status|start|stop|restart|log
#
# Env: PORT (default 4173), IDLE_TIMEOUT_MS (default 8h, set in server.js)

set -eu

DIR=$(cd "$(dirname "$0")" && pwd)
ROOT=$(dirname "$DIR")
PORT=${PORT:-4173}
PIDFILE="$DIR/.tutor.pid"
LOGFILE="$DIR/server.log"

listener_pid() { lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | head -1; }
health()       { curl -fsS --max-time 2 "http://127.0.0.1:$PORT/api/health" 2>/dev/null; }

# Where each lesson is being served. The teacher hands one of these to the
# learner, and an address assembled by hand is where the port gets lost — so it
# is printed rather than described. Lessons only: where the course as a whole
# opens is the documents' business, not this one's.
#
# The port is $PORT because that is the port the service just answered health
# on: a service that answers there is bound there, whether $PORT came from the
# default or from the environment.
lesson_addresses() {
  header=''
  for lesson in "$ROOT"/lessons/*.html; do
    [ -e "$lesson" ] || continue
    if [ -z "$header" ]; then echo "  lessons"; header=1; fi
    echo "    http://127.0.0.1:$PORT/lessons/$(basename "$lesson")"
  done
}

cmd_status() {
  body=$(health || true)
  if [ -n "$body" ]; then
    echo "tutor: UP on http://127.0.0.1:$PORT/"
    printf '%s\n' "$body" | python3 -c 'import json,sys
d = json.load(sys.stdin)
print("  pid     %s" % d["pid"])
print("  uptime  %d min" % (d["uptimeSec"] // 60))
print("  idle    %d min  (exits after %d h idle)" % (d["idleSec"] // 60, d["idleTimeoutSec"] // 3600))
print("  roles   %s" % ", ".join(d["roles"]))
print("  ws      %s" % d["workspace"])' 2>/dev/null || printf '%s\n' "$body"
    lesson_addresses
    return 0
  fi

  squatter=$(listener_pid || true)
  if [ -n "$squatter" ]; then
    echo "tutor: DOWN, but port $PORT is held by pid $squatter (not answering /api/health)"
    echo "       inspect it before killing:  ps -p $squatter -o pid,ppid,etime,command"
    return 1
  fi

  if [ -f "$PIDFILE" ]; then
    echo "tutor: DOWN (stale pidfile, removing)"
    rm -f "$PIDFILE"
  else
    echo "tutor: DOWN"
  fi
  echo "       start with:  ./tutor/tutorctl.sh start"
  return 1
}

cmd_start() {
  # If this is run through the plugin's own copy rather than through a
  # workspace's link, $ROOT is the plugin — and starting would serve the plugin
  # as though it were a course, and drop a pidfile and a log inside it. Every
  # workspace has lessons/, because the scaffold makes one; the plugin does not.
  if [ ! -d "$ROOT/lessons" ]; then
    echo "tutor: $ROOT is not a teaching workspace (no lessons/)." >&2
    echo "       Run this from the workspace root:  ./tutor/tutorctl.sh start" >&2
    return 2
  fi

  if health >/dev/null 2>&1; then echo "tutor: already up on port $PORT"; return 0; fi
  squatter=$(listener_pid || true)
  if [ -n "$squatter" ]; then
    echo "tutor: port $PORT is already held by pid $squatter — refusing to start." >&2
    echo "       inspect it first:  ps -p $squatter -o pid,ppid,etime,command" >&2
    return 1
  fi
  command -v claude >/dev/null 2>&1 || echo "tutor: WARNING - 'claude' not on PATH; /api/ask will fail" >&2

  # Detached on purpose, and from two things rather than one. `nohup` gives up
  # the terminal; setsid(2) gives up the process group, so a signal sent to the
  # group this shell sits in — which is what the end of an agent session sends —
  # no longer reaches the service. Without the second one, "must outlive the
  # launching shell" is half implemented.
  #
  # `setsid` is that call under a name, and macOS does not ship it. `set -m` in
  # a subshell is not a substitute: dash turns job control off again when there
  # is no terminal to open, which is exactly the case being hardened against, so
  # it would be a silent no-op wherever /bin/sh is dash. python3 is this
  # script's JSON parser already, and os.setsid() is the call itself.
  #
  # This is hardening, not a diagnosis: the session that reported a service
  # dying minutes after being started did not capture the signal that killed it.
  if command -v setsid >/dev/null 2>&1; then
    set -- setsid
  else
    # Already a group leader means already out of this shell's group, which is
    # all that was being asked for — so that failure is the goal, not an error.
    set -- python3 -c 'import os, sys
try:
    os.setsid()
except OSError:
    pass
os.execvp(sys.argv[1], sys.argv[1:])'
  fi

  # The server lives in the plugin and is reached through the workspace's own
  # tutor/server.js link, so it has to be told which workspace it is serving.
  cd "$ROOT"
  PORT="$PORT" nohup "$@" node "$DIR/server.js" "$ROOT" </dev/null >>"$LOGFILE" 2>&1 &

  i=0
  while [ "$i" -lt 40 ]; do
    body=$(health || true)
    if [ -n "$body" ]; then
      # $! is nohup's wrapper, not node. Take the pid the server reports itself.
      printf '%s' "$body" | python3 -c 'import json,sys; print(json.load(sys.stdin)["pid"])' > "$PIDFILE" 2>/dev/null || true
      echo "tutor: started (pid $(cat "$PIDFILE" 2>/dev/null || echo '?')) -> http://127.0.0.1:$PORT/"
      echo "       log: tutor/server.log"
      return 0
    fi
    i=$((i+1)); sleep 0.25
  done
  echo "tutor: failed to become healthy within 10s. Last log lines:" >&2
  tail -15 "$LOGFILE" >&2 || true
  return 1
}

cmd_stop() {
  pid=$(listener_pid || true)
  [ -z "$pid" ] && [ -f "$PIDFILE" ] && pid=$(cat "$PIDFILE" 2>/dev/null || true)
  if [ -z "$pid" ]; then echo "tutor: not running"; rm -f "$PIDFILE"; return 0; fi
  kill "$pid" 2>/dev/null || true
  i=0
  while [ "$i" -lt 20 ]; do
    kill -0 "$pid" 2>/dev/null || break
    i=$((i+1)); sleep 0.25
  done
  kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
  rm -f "$PIDFILE"
  echo "tutor: stopped (pid $pid)"
}

case "${1:-status}" in
  status)  cmd_status ;;
  start)   cmd_start ;;
  stop)    cmd_stop ;;
  restart) cmd_stop; cmd_start ;;
  log)     tail -n "${2:-40}" "$LOGFILE" ;;
  *) echo "usage: $0 {status|start|stop|restart|log [n]}" >&2; exit 2 ;;
esac
