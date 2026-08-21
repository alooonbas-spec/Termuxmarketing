#!/data/data/com.termux/files/usr/bin/bash

set -eu
. "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/common.sh"

ensure_termux
ensure_installed
mkdir -p "$STATE_DIR"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "Cloudflare Tunnel не установлен."
  echo "Выполните: bash termux/install-tunnel-termux.sh"
  exit 1
fi

if tunnel_is_running; then
  echo "Cloudflare Tunnel уже запущен. PID: $(sed -n '1p' "$TUNNEL_PID_FILE")"
  bash "$SOURCE_DIR/termux/show-webhook-urls-termux.sh"
  exit 0
fi
rm -f "$TUNNEL_PID_FILE"

mode="$(read_env_value CLOUDFLARE_TUNNEL_MODE)"
if [ -z "$mode" ]; then
  mode="quick"
  set_env_value CLOUDFLARE_TUNNEL_MODE "$mode"
fi

port="$(read_env_value PORT)"
if [ -z "$port" ]; then
  port="8080"
fi

restart_application() {
  if app_is_running; then
    bash "$SOURCE_DIR/termux/stop-termux.sh"
  fi
  bash "$SOURCE_DIR/termux/start-termux.sh"
}

: > "$TUNNEL_LOG_FILE"
rm -f "$TUNNEL_URL_FILE"

case "$mode" in
  quick)
    set_env_value PUBLIC_BASE_URL ""
    restart_application
    nohup cloudflared tunnel --no-autoupdate --protocol auto --url "http://127.0.0.1:${port}" \
      >> "$TUNNEL_LOG_FILE" 2>&1 &
    tunnel_pid="$!"
    printf '%s\n' "$tunnel_pid" > "$TUNNEL_PID_FILE"

    attempt=0
    quick_url=""
    while [ "$attempt" -lt 30 ]; do
      quick_url="$(sed -n 's|.*\(https://[A-Za-z0-9-]*\.trycloudflare\.com\).*|\1|p' "$TUNNEL_LOG_FILE" | tail -n 1)"
      if [ -n "$quick_url" ]; then
        break
      fi
      if ! kill -0 "$tunnel_pid" 2>/dev/null; then
        break
      fi
      attempt=$((attempt + 1))
      sleep 1
    done

    if [ -z "$quick_url" ]; then
      echo "Не удалось получить тестовый HTTPS-адрес. Последние строки журнала:"
      tail -n 40 "$TUNNEL_LOG_FILE" 2>/dev/null || true
      rm -f "$TUNNEL_PID_FILE"
      exit 1
    fi

    printf '%s\n' "$quick_url" > "$TUNNEL_URL_FILE"
    set_env_value PUBLIC_BASE_URL "$quick_url"
    restart_application
    echo "Тестовый Cloudflare Tunnel запущен. PID: $tunnel_pid"
    ;;
  fixed)
    fixed_url="$(read_env_value PUBLIC_BASE_URL)"
    if [ -z "$fixed_url" ]; then
      echo "Не задан PUBLIC_BASE_URL. Выполните: bash termux/configure-tunnel-termux.sh"
      exit 1
    fi
    if [ ! -s "$TUNNEL_TOKEN_FILE" ]; then
      echo "Не найден защищённый токен туннеля."
      echo "Выполните: bash termux/configure-tunnel-termux.sh"
      exit 1
    fi

    restart_application
    printf '%s\n' "${fixed_url%/}" > "$TUNNEL_URL_FILE"
    nohup cloudflared tunnel --no-autoupdate --protocol auto run --token-file "$TUNNEL_TOKEN_FILE" \
      >> "$TUNNEL_LOG_FILE" 2>&1 &
    tunnel_pid="$!"
    printf '%s\n' "$tunnel_pid" > "$TUNNEL_PID_FILE"

    sleep 5
    if ! kill -0 "$tunnel_pid" 2>/dev/null; then
      echo "Cloudflare Tunnel завершился с ошибкой:"
      tail -n 40 "$TUNNEL_LOG_FILE" 2>/dev/null || true
      rm -f "$TUNNEL_PID_FILE"
      exit 1
    fi
    echo "Постоянный Cloudflare Tunnel запущен. PID: $tunnel_pid"
    ;;
  *)
    echo "Неизвестный режим: $mode"
    echo "Выполните: bash termux/configure-tunnel-termux.sh"
    exit 1
    ;;
esac

bash "$SOURCE_DIR/termux/show-webhook-urls-termux.sh"
