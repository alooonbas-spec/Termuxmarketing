#!/data/data/com.termux/files/usr/bin/bash

set -eu
. "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/common.sh"

ensure_termux

echo "[1/6] Проверяю Node.js и служебные пакеты…"
pkg update -y
pkg install -y nano tar coreutils
if ! command -v node >/dev/null 2>&1; then
  if ! pkg install -y nodejs-lts; then
    pkg install -y nodejs
  fi
fi

node_major="$(node -p "Number(process.versions.node.split('.')[0])")"
if [ "$node_major" -lt 22 ]; then
  echo "Ошибка: требуется Node.js 22 или новее, установлена версия $(node --version)."
  echo "Выполните pkg upgrade и повторите установку."
  exit 1
fi

echo "[2/6] Создаю защищённые папки Termux…"
mkdir -p "$RUNTIME_DIR" "$CONFIG_DIR" "$DATA_DIR" "$STATE_DIR"
chmod 700 "$RUNTIME_DIR" "$CONFIG_DIR" "$DATA_DIR" "$STATE_DIR"

echo "[3/6] Копирую приложение…"
tar -C "$SOURCE_DIR" \
  --exclude='./node_modules' \
  --exclude='./data' \
  --exclude='./.env' \
  --exclude='./*.zip' \
  -cf - . | tar -C "$RUNTIME_DIR" -xf -

echo "[4/6] Создаю настройки…"
if [ ! -f "$ENV_FILE" ]; then
  admin_key="$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")"
  vk_callback_secret="$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")"
  telegram_webhook_secret="$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")"
  meta_verify_token="$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")"
  data_file="$DATA_DIR/collector.json"
  sed \
    -e "s|__TERMUX_DATA_FILE__|$data_file|" \
    -e "s|__GENERATE_ON_INSTALL__|$admin_key|" \
    -e "s|__GENERATE_VK_CALLBACK_SECRET__|$vk_callback_secret|" \
    -e "s|__GENERATE_TELEGRAM_WEBHOOK_SECRET__|$telegram_webhook_secret|" \
    -e "s|__GENERATE_META_VERIFY_TOKEN__|$meta_verify_token|" \
    "$SOURCE_DIR/.env.termux.example" > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
else
  admin_key="$(read_env_value ADMIN_API_KEY)"
  echo "Существующий файл настроек сохранён без изменений."
fi

echo "[5/6] Устанавливаю зависимости…"
cd "$RUNTIME_DIR"
npm ci --ignore-scripts

echo "[6/6] Собираю программу…"
node node_modules/typescript/bin/tsc -p tsconfig.json
sha256sum package-lock.json | awk '{print $1}' > "$STATE_DIR/package-lock.sha256"

echo
echo "Установка завершена."
echo "ADMIN_API_KEY: $admin_key"
echo
echo "Запуск:    bash termux/start-termux.sh"
echo "Настройки: bash termux/settings-termux.sh"
echo "Панель:    http://127.0.0.1:8080/dashboard"
