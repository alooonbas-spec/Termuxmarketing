#!/data/data/com.termux/files/usr/bin/bash

set -eu
. "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/common.sh"

ensure_termux
boot_file="$HOME/.termux/boot/30-social-contact-collector"
if [ -f "$boot_file" ]; then
  rm -f "$boot_file"
  echo "Автозапуск отключён."
else
  echo "Файл автозапуска не найден."
fi
