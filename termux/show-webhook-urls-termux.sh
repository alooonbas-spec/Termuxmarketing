#!/data/data/com.termux/files/usr/bin/bash

set -eu
. "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/common.sh"

ensure_termux
ensure_installed

if ! base_url="$(public_base_url)" || [ -z "$base_url" ]; then
  echo "Публичный HTTPS-адрес ещё не создан."
  echo "Запустите: bash termux/start-tunnel-termux.sh"
  exit 1
fi

echo "Публичный адрес: $base_url"
echo "Telegram webhook: $base_url/webhooks/telegram"
echo "VK webhook:       $base_url/webhooks/vk"
echo "Meta webhook:     $base_url/webhooks/meta"
echo
echo "Панель управления открывайте только локально: http://127.0.0.1:$(read_env_value PORT)/dashboard"
