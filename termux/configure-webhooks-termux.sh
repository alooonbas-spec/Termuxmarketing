#!/data/data/com.termux/files/usr/bin/bash

set -eu
. "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/common.sh"

ensure_termux
ensure_installed

if ! base_url="$(public_base_url)" || [ -z "$base_url" ]; then
  echo "Сначала запустите HTTPS-туннель: bash termux/start-tunnel-termux.sh"
  exit 1
fi

ensure_generated_secret() {
  secret_key="$1"
  current_value="$(read_env_value "$secret_key")"
  if [ -z "$current_value" ]; then
    set_env_value "$secret_key" "$(generate_secret)"
    echo "Создан секрет: $secret_key"
  fi
}

ensure_generated_secret TELEGRAM_WEBHOOK_SECRET
ensure_generated_secret VK_CALLBACK_SECRET
ensure_generated_secret META_VERIFY_TOKEN

if app_is_running; then
  bash "$SOURCE_DIR/termux/stop-termux.sh"
  bash "$SOURCE_DIR/termux/start-termux.sh"
fi

telegram_url="$base_url/webhooks/telegram"
vk_url="$base_url/webhooks/vk"
meta_url="$base_url/webhooks/meta"
telegram_token="$(read_env_value TELEGRAM_BOT_TOKEN)"
telegram_secret="$(read_env_value TELEGRAM_WEBHOOK_SECRET)"

echo
echo "=== Telegram ==="
echo "Callback URL: $telegram_url"
if [ -n "$telegram_token" ]; then
  SCC_TELEGRAM_TOKEN="$telegram_token" \
  SCC_TELEGRAM_SECRET="$telegram_secret" \
  SCC_TELEGRAM_URL="$telegram_url" \
  node <<'NODE'
const token = process.env.SCC_TELEGRAM_TOKEN;
const secret = process.env.SCC_TELEGRAM_SECRET;
const url = process.env.SCC_TELEGRAM_URL;
const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ url, secret_token: secret, allowed_updates: ["message"] }),
  signal: AbortSignal.timeout(15000),
});
const body = await response.json();
if (!response.ok || !body.ok) {
  console.error("Telegram не принял webhook:", JSON.stringify(body));
  process.exit(1);
}
console.log("Telegram webhook установлен:", body.description ?? "ok");
NODE
else
  echo "TELEGRAM_BOT_TOKEN не заполнен — автоматическая регистрация пропущена."
fi

echo
echo "=== VK ==="
echo "Адрес сервера: $vk_url"
echo "Секретный ключ: $(read_env_value VK_CALLBACK_SECRET)"
if [ -n "$(read_env_value VK_CONFIRMATION_CODE)" ]; then
  echo "Код подтверждения уже записан в настройках."
else
  echo "Скопируйте код подтверждения из VK в VK_CONFIRMATION_CODE, перезапустите приложение и нажмите «Подтвердить» в VK."
fi

echo
echo "=== Meta: Instagram и Facebook ==="
echo "Callback URL: $meta_url"
echo "Verify token: $(read_env_value META_VERIFY_TOKEN)"
if [ -n "$(read_env_value META_APP_SECRET)" ]; then
  echo "META_APP_SECRET заполнен."
else
  echo "Добавьте App Secret приложения Meta в META_APP_SECRET перед включением событий."
fi

echo
echo "Подробные шаги находятся в TERMUX_ACODE_GUIDE_RU.md."
