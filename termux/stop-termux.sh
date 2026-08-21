#!/data/data/com.termux/files/usr/bin/bash

set -eu
. "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/common.sh"

ensure_termux

if ! app_is_running; then
  echo "Social Contact Collector не запущен."
  rm -f "$PID_FILE"
  exit 0
fi

pid="$(sed -n '1p' "$PID_FILE")"
kill "$pid"

attempt=0
while kill -0 "$pid" 2>/dev/null && [ "$attempt" -lt 10 ]; do
  attempt=$((attempt + 1))
  sleep 1
done

if kill -0 "$pid" 2>/dev/null; then
  echo "Процесс ещё завершает работу. Проверьте: bash termux/status-termux.sh"
  exit 1
fi

rm -f "$PID_FILE"
echo "Social Contact Collector остановлен."
