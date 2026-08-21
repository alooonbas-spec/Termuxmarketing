#!/data/data/com.termux/files/usr/bin/bash

set -eu
. "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/common.sh"

ensure_termux
ensure_installed

mode="$(read_env_value CLOUDFLARE_TUNNEL_MODE)"
if [ "$mode" != "fixed" ]; then
  echo "Автозапуск webhook разрешён только для постоянного туннеля."
  echo "Сначала выберите режим 2: bash termux/configure-tunnel-termux.sh"
  exit 1
fi

boot_dir="$HOME/.termux/boot"
boot_file="$boot_dir/30-social-contact-collector"
mkdir -p "$boot_dir"

{
  printf '%s\n' '#!/data/data/com.termux/files/usr/bin/bash'
  printf '%s\n' 'termux-wake-lock'
  printf '%s\n' 'sleep 15'
  printf '%s\n' 'bash "$HOME/apps/social-contact-collector/termux/start-tunnel-termux.sh" >> "$HOME/.local/state/social-contact-collector/boot.log" 2>&1'
} > "$boot_file"
chmod 700 "$boot_file"

echo "Автозапуск настроен: $boot_file"
echo "Установите Termux:Boot из того же источника, что и Termux, и один раз откройте его значок."
echo "Также отключите жёсткую оптимизацию батареи для Termux и Termux:Boot."
