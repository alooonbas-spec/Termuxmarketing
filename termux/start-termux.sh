#!/data/data/com.termux/files/usr/bin/bash

set -eu
. "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/common.sh"

ensure_termux
ensure_installed
mkdir -p "$STATE_DIR"

if app_is_running; then
  echo "Social Contact Collector уже запущен. PID: $(sed -n '1p' "$PID_FILE")"
  echo "Панель: http://127.0.0.1:$(read_env_value PORT)/dashboard"
  exit 0
fi

if [ -f "$PID_FILE" ]; then
  rm -f "$PID_FILE"
fi

port="$(read_env_value PORT)"
if [ -z "$port" ]; then
  port="8080"
fi

cd "$RUNTIME_DIR"
nohup env DOTENV_CONFIG_PATH="$ENV_FILE" node dist/server.js >> "$LOG_FILE" 2>&1 &
app_pid="$!"
printf '%s\n' "$app_pid" > "$PID_FILE"

attempt=0
while [ "$attempt" -lt 10 ]; do
  if node -e "fetch('http://127.0.0.1:${port}/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"; then
    echo "Social Contact Collector запущен. PID: $app_pid"
    echo "Панель: http://127.0.0.1:${port}/dashboard"
    exit 0
  fi
  if ! kill -0 "$app_pid" 2>/dev/null; then
    break
  fi
  attempt=$((attempt + 1))
  sleep 1
done

echo "Программа не смогла запуститься. Последние строки журнала:"
tail -n 30 "$LOG_FILE" 2>/dev/null || true
exit 1
