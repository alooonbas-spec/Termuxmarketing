#!/data/data/com.termux/files/usr/bin/bash

set -eu
. "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/common.sh"

ensure_termux
ensure_installed

data_file="$(read_env_value DATA_FILE)"
if [ ! -f "$data_file" ]; then
  echo "База данных ещё не создана: $data_file"
  exit 1
fi

backup_dir="$HOME/storage/downloads/SocialContactCollector-Backups"
if [ ! -d "$HOME/storage/downloads" ]; then
  echo "Сначала выполните termux-setup-storage и разрешите доступ к файлам."
  exit 1
fi
mkdir -p "$backup_dir"
timestamp="$(date +%Y%m%d-%H%M%S)"
destination="$backup_dir/collector-$timestamp.json"
cp "$data_file" "$destination"
echo "Резервная копия создана: $destination"
