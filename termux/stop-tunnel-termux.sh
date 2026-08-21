#!/data/data/com.termux/files/usr/bin/bash

set -eu
. "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/common.sh"

ensure_termux

if ! tunnel_is_running; then
  echo "Cloudflare Tunnel не запущен."
  rm -f "$TUNNEL_PID_FILE"
  exit 0
fi

tunnel_pid="$(sed -n '1p' "$TUNNEL_PID_FILE")"
kill "$tunnel_pid"

attempt=0
while kill -0 "$tunnel_pid" 2>/dev/null && [ "$attempt" -lt 10 ]; do
  attempt=$((attempt + 1))
  sleep 1
done

if kill -0 "$tunnel_pid" 2>/dev/null; then
  echo "Процесс туннеля ещё завершает работу. PID: $tunnel_pid"
  exit 1
fi

rm -f "$TUNNEL_PID_FILE"
echo "Cloudflare Tunnel остановлен."
