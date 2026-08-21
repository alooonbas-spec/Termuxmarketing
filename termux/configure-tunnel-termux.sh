#!/data/data/com.termux/files/usr/bin/bash

set -eu
. "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/common.sh"

ensure_termux
ensure_installed

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "Сначала установите туннель: bash termux/install-tunnel-termux.sh"
  exit 1
fi

if tunnel_is_running; then
  echo "Останавливаю текущий туннель перед изменением режима…"
  bash "$SOURCE_DIR/termux/stop-tunnel-termux.sh"
fi

echo "Выберите режим Cloudflare Tunnel:"
echo "  1 — быстрый тестовый адрес *.trycloudflare.com"
echo "  2 — постоянный адрес на вашем домене (рекомендуется для webhook)"
printf "Номер режима: "
read -r choice

case "$choice" in
  1)
    set_env_value CLOUDFLARE_TUNNEL_MODE quick
    set_env_value PUBLIC_BASE_URL ""
    rm -f "$TUNNEL_URL_FILE"
    echo "Выбран тестовый режим. Адрес будет меняться при каждом новом запуске."
    ;;
  2)
    printf "Публичный HTTPS-адрес, например https://hooks.example.com: "
    read -r base_url
    base_url="${base_url%/}"
    case "$base_url" in
      https://*) ;;
      *) echo "Ошибка: адрес должен начинаться с https://"; exit 1 ;;
    esac
    hostname_part="${base_url#https://}"
    case "$hostname_part" in
      ''|*/*|*' '*) echo "Ошибка: укажите только домен без пути и пробелов."; exit 1 ;;
    esac

    printf "Вставьте токен созданного Cloudflare Tunnel (ввод скрыт): "
    IFS= read -r -s tunnel_token
    echo
    if [ "${#tunnel_token}" -lt 40 ]; then
      echo "Ошибка: токен выглядит слишком коротким. Скопируйте строку eyJ… из команды Cloudflare."
      exit 1
    fi

    printf '%s\n' "$tunnel_token" > "$TUNNEL_TOKEN_FILE"
    chmod 600 "$TUNNEL_TOKEN_FILE"
    unset tunnel_token
    set_env_value CLOUDFLARE_TUNNEL_MODE fixed
    set_env_value PUBLIC_BASE_URL "$base_url"
    printf '%s\n' "$base_url" > "$TUNNEL_URL_FILE"

    echo "Постоянный туннель настроен для $base_url."
    echo "В Cloudflare его Service URL должен быть: http://127.0.0.1:$(read_env_value PORT)"
    ;;
  *)
    echo "Ошибка: выберите 1 или 2."
    exit 1
    ;;
esac

echo "Запуск: bash termux/start-tunnel-termux.sh"
