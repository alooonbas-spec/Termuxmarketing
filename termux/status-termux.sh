#!/data/data/com.termux/files/usr/bin/bash

set -eu
. "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/common.sh"

ensure_termux
ensure_installed

port="$(read_env_value PORT)"
if [ -z "$port" ]; then
  port="8080"
fi

if ! app_is_running; then
  echo "Статус: остановлен"
  exit 1
fi

pid="$(sed -n '1p' "$PID_FILE")"
if node -e "fetch('http://127.0.0.1:${port}/health').then(async r=>{if(!r.ok)process.exit(1);console.log(await r.text())}).catch(()=>process.exit(1))"; then
  echo "Статус: работает, PID: $pid"
  echo "Панель: http://127.0.0.1:${port}/dashboard"
else
  echo "Процесс существует, но HTTP-панель пока не отвечает. PID: $pid"
  exit 1
fi
