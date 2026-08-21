#!/data/data/com.termux/files/usr/bin/bash

set -eu
. "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/common.sh"

ensure_termux
ensure_installed
nano "$ENV_FILE"

echo
echo "Настройки сохранены. Чтобы применить их:"
echo "bash termux/stop-termux.sh"
echo "bash termux/start-termux.sh"
