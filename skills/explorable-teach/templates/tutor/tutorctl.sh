#!/bin/sh
# Control script for the tutor server.
#
# The server is a dev-server: it belongs to the learner's study session, not to
# any AI conversation. `start` detaches it deliberately so it survives the shell
# (and the conversation) that launched it.
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
  if health >/dev/null 2>&1; then echo "tutor: already up on port $PORT"; return 0; fi
  squatter=$(listener_pid || true)
  if [ -n "$squatter" ]; then
    echo "tutor: port $PORT is already held by pid $squatter — refusing to start." >&2
    echo "       inspect it first:  ps -p $squatter -o pid,ppid,etime,command" >&2
    return 1
  fi
  command -v claude >/dev/null 2>&1 || echo "tutor: WARNING - 'claude' not on PATH; /api/ask will fail" >&2

  # nohup + & : detach on purpose. Must outlive the launching shell.
  cd "$ROOT"
  PORT="$PORT" nohup node "$DIR/server.js" >>"$LOGFILE" 2>&1 &

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
