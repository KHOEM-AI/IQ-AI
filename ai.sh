#!/usr/bin/env bash
# IQ-AI launcher: audio / image / video / emotion media service (default :8799).
# Usage: ./ai.sh [start|run|stop|restart|status|logs|test]
#   start    background, waits until healthy (KSV `ai` uses this)
#   run      foreground, Ctrl+C stops it
# env: IQAI_PORT (default: PORT in .env, else 8799), LOG_DIR (default: $HOME), IQAI_TOKEN (else read from .env)
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
LOG_DIR="${LOG_DIR:-$HOME}"
LOG="$LOG_DIR/iqai.log"

env_val() { [ -f "$ROOT/.env" ] && grep -m1 "^$1=" "$ROOT/.env" | cut -d= -f2- | tr -d "\"'"; }
PORT="${IQAI_PORT:-$(env_val PORT)}"
PORT="${PORT:-8799}"

need() { command -v "$1" >/dev/null 2>&1 || { echo "  ✘ missing command: $1" >&2; exit 1; }; }
up() { curl -fsS -o /dev/null -m 2 "http://127.0.0.1:$PORT/api/v1/health" 2>/dev/null; }

# PIDs of IQ-AI servers: matched by working directory, so it never touches other projects.
find_pids() {
  local p
  for p in $(pgrep -f 'src/server/server\.mjs' 2>/dev/null); do
    [ "$(readlink "/proc/$p/cwd" 2>/dev/null)" = "$ROOT" ] && echo "$p"
  done
}

token_source() {
  local t
  if [ -n "${IQAI_TOKEN:-}" ]; then t="$IQAI_TOKEN"; echo "env"
  else
    t="$(env_val IQAI_TOKEN)"
    if [ -z "$t" ]; then echo "missing"; return; fi
    echo ".env"
  fi
  case "$t" in change-me*) echo "placeholder" ;; esac
}

check_server_file() {
  [ -f "$ROOT/src/server/server.mjs" ] || { echo "  ✘ not found: $ROOT/src/server/server.mjs" >&2; exit 1; }
}

start() {
  need node; need curl; check_server_file
  if up; then echo "  • IQ-AI media    :$PORT already running (use restart for new code or token)"; return 0; fi
  case "$(token_source | tr '\n' ' ')" in
    *missing*)     echo "  ! IQAI_TOKEN not set: the server will print a temporary token in $LOG" ;;
    *placeholder*) echo "  ! IQAI_TOKEN is still the placeholder from .env.example: set a real one in .env" ;;
  esac
  ( cd "$ROOT" && exec nohup env PORT="$PORT" node --env-file-if-exists="$ROOT/.env" "$ROOT/src/server/server.mjs" ) >"$LOG" 2>&1 </dev/null &
  local pid=$! i
  for i in $(seq 1 30); do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "  ✘ IQ-AI media stopped at start-up (log: $LOG)"
      tail -n 8 "$LOG" 2>/dev/null | sed 's/^/    | /'
      return 1
    fi
    up && { echo "  ✔ IQ-AI media    :$PORT"; return 0; }
    sleep 1
  done
  echo "  ✘ IQ-AI media not ready after 30s (log: $LOG)"; return 1
}

stop() {
  local pids i
  pids="$(find_pids)"
  if [ -z "$pids" ]; then echo "  • IQ-AI media    not running"; return 0; fi
  kill $pids 2>/dev/null
  for i in $(seq 1 20); do [ -z "$(find_pids)" ] && break; sleep 0.25; done
  pids="$(find_pids)"
  [ -n "$pids" ] && kill -9 $pids 2>/dev/null
  echo "  ✔ IQ-AI media    stopped"
}

run_fg() {
  need node; need curl; check_server_file
  up && { echo "  • already running on :$PORT (ai.sh stop first)"; exit 1; }
  cd "$ROOT" || exit 1
  exec env PORT="$PORT" node --env-file-if-exists="$ROOT/.env" "$ROOT/src/server/server.mjs"
}

status() {
  local pids ff
  pids="$(find_pids | tr '\n' ' ')"
  if up; then echo "  ✔ IQ-AI media    :$PORT running (pid: ${pids:-?})"; else echo "  ✘ IQ-AI media    :$PORT not responding"; fi
  if command -v ffmpeg >/dev/null 2>&1; then ff="yes"; else ff="NO (voice changer needs: pkg install ffmpeg)"; fi
  echo "    ffmpeg: $ff"
  echo "    token:  $(token_source | tr '\n' ' ')"
  echo "    log:    $LOG"
}

case "${1:-start}" in
  start)   start ;;
  run)     run_fg ;;
  stop)    stop ;;
  restart) stop; start ;;
  status)  status ;;
  logs)    tail -n "${2:-40}" "$LOG" ;;
  test)    cd "$ROOT" && npm test ;;
  *) echo "usage: $0 [start|run|stop|restart|status|logs [N]|test]"; exit 1 ;;
esac
