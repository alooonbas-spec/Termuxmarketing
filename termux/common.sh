#!/data/data/com.termux/files/usr/bin/bash

set -eu

APP_SLUG="social-contact-collector"
RUNTIME_DIR="${SCC_RUNTIME_DIR:-$HOME/apps/$APP_SLUG}"
CONFIG_DIR="${SCC_CONFIG_DIR:-$HOME/.config/$APP_SLUG}"
DATA_DIR="${SCC_DATA_DIR:-$HOME/.local/share/$APP_SLUG}"
STATE_DIR="${SCC_STATE_DIR:-$HOME/.local/state/$APP_SLUG}"
ENV_FILE="$CONFIG_DIR/.env"
PID_FILE="$STATE_DIR/app.pid"
LOG_FILE="$STATE_DIR/app.log"
TUNNEL_PID_FILE="$STATE_DIR/tunnel.pid"
TUNNEL_LOG_FILE="$STATE_DIR/tunnel.log"
TUNNEL_URL_FILE="$STATE_DIR/tunnel-url.txt"
TUNNEL_TOKEN_FILE="$CONFIG_DIR/cloudflare-tunnel.token"
SOURCE_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

ensure_termux() {
  if [ -z "${PREFIX:-}" ] || [ ! -x "${PREFIX:-}/bin/pkg" ]; then
    echo "Ошибка: эту команду нужно запускать в приложении Termux."
    exit 1
  fi
}

ensure_installed() {
  if [ ! -f "$RUNTIME_DIR/dist/server.js" ] || [ ! -f "$ENV_FILE" ]; then
    echo "Приложение ещё не установлено."
    echo "Выполните: bash termux/install-termux.sh"
    exit 1
  fi
}

read_env_value() {
  key="$1"
  value="$(sed -n "s/^${key}=//p" "$ENV_FILE" | tail -n 1)"
  printf '%s' "$value"
}

set_env_value() {
  key="$1"
  value="$2"
  temporary_file="${ENV_FILE}.tmp.$$"

  awk -v key="$key" -v value="$value" '
    BEGIN { found = 0 }
    $0 ~ "^" key "=" {
      if (!found) print key "=" value
      found = 1
      next
    }
    { print }
    END { if (!found) print key "=" value }
  ' "$ENV_FILE" > "$temporary_file"

  chmod 600 "$temporary_file"
  mv "$temporary_file" "$ENV_FILE"
}

generate_secret() {
  node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
}

app_is_running() {
  if [ ! -f "$PID_FILE" ]; then
    return 1
  fi
  pid="$(sed -n '1p' "$PID_FILE")"
  case "$pid" in
    ''|*[!0-9]*) return 1 ;;
  esac
  kill -0 "$pid" 2>/dev/null
}

tunnel_is_running() {
  if [ ! -f "$TUNNEL_PID_FILE" ]; then
    return 1
  fi
  tunnel_pid="$(sed -n '1p' "$TUNNEL_PID_FILE")"
  case "$tunnel_pid" in
    ''|*[!0-9]*) return 1 ;;
  esac
  kill -0 "$tunnel_pid" 2>/dev/null
}

public_base_url() {
  configured_url="$(read_env_value PUBLIC_BASE_URL)"
  if [ -n "$configured_url" ]; then
    printf '%s' "${configured_url%/}"
    return 0
  fi
  if [ -f "$TUNNEL_URL_FILE" ]; then
    sed -n '1p' "$TUNNEL_URL_FILE" | sed 's:/*$::'
    return 0
  fi
  return 1
}
