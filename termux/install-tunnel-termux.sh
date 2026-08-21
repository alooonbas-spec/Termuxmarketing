#!/data/data/com.termux/files/usr/bin/bash

set -eu
. "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/common.sh"

ensure_termux
ensure_installed

echo "Устанавливаю Cloudflare Tunnel из репозитория Termux…"
pkg update -y
pkg install -y cloudflared

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "Ошибка: cloudflared не найден после установки."
  exit 1
fi

if ! grep -q '^CLOUDFLARE_TUNNEL_MODE=' "$ENV_FILE"; then
  set_env_value CLOUDFLARE_TUNNEL_MODE quick
fi
if ! grep -q '^PUBLIC_BASE_URL=' "$ENV_FILE"; then
  set_env_value PUBLIC_BASE_URL ""
fi

echo
cloudflared --version
echo "Cloudflare Tunnel установлен."
echo "Следующий шаг: bash termux/configure-tunnel-termux.sh"
