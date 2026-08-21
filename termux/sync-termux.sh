#!/data/data/com.termux/files/usr/bin/bash

set -eu
. "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/common.sh"

ensure_termux
ensure_installed

was_running=0
if app_is_running; then
  was_running=1
  bash "$SOURCE_DIR/termux/stop-termux.sh"
fi

echo "Копирую изменения из Acode в рабочую папку Termux…"
tar -C "$SOURCE_DIR" \
  --exclude='./node_modules' \
  --exclude='./data' \
  --exclude='./.env' \
  --exclude='./*.zip' \
  -cf - . | tar -C "$RUNTIME_DIR" -xf -

new_hash="$(sha256sum "$SOURCE_DIR/package-lock.json" | awk '{print $1}')"
old_hash=""
if [ -f "$STATE_DIR/package-lock.sha256" ]; then
  old_hash="$(sed -n '1p' "$STATE_DIR/package-lock.sha256")"
fi

cd "$RUNTIME_DIR"
if [ "$new_hash" != "$old_hash" ] || [ ! -d node_modules/typescript ]; then
  echo "Обновляю зависимости…"
  npm ci --ignore-scripts
  printf '%s\n' "$new_hash" > "$STATE_DIR/package-lock.sha256"
fi

echo "Проверяю и собираю TypeScript…"
node node_modules/typescript/bin/tsc -p tsconfig.json
echo "Изменения синхронизированы."

if [ "$was_running" -eq 1 ]; then
  bash "$SOURCE_DIR/termux/start-termux.sh"
fi
