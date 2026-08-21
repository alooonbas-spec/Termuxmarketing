#!/data/data/com.termux/files/usr/bin/bash

set -eu
. "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/common.sh"

ensure_termux
ensure_installed

if ! tunnel_is_running; then
  echo "Статус туннеля: остановлен"
  exit 1
fi

tunnel_pid="$(sed -n '1p' "$TUNNEL_PID_FILE")"
mode="$(read_env_value CLOUDFLARE_TUNNEL_MODE)"
echo "Статус туннеля: работает"
echo "Режим: ${mode:-quick}"
echo "PID: $tunnel_pid"

if base_url="$(public_base_url)" && [ -n "$base_url" ]; then
  echo "Публичный адрес: $base_url"
  if node -e "fetch(process.argv[1],{signal:AbortSignal.timeout(10000)}).then(r=>{if(!r.ok)process.exit(1);return r.json()}).then(v=>console.log('Внешняя проверка:',JSON.stringify(v))).catch(()=>process.exit(1))" "$base_url/health"; then
    :
  else
    echo "Внешняя проверка пока не прошла. Проверьте маршрут в Cloudflare и журнал туннеля."
    exit 1
  fi
else
  echo "Публичный адрес ещё не определён."
  exit 1
fi
