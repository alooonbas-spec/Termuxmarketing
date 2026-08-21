#!/data/data/com.termux/files/usr/bin/bash

set -eu
. "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/common.sh"

ensure_termux
ensure_installed

port="$(read_env_value PORT)"
if [ -z "$port" ]; then
  port="8080"
fi
url="http://127.0.0.1:${port}/dashboard"

if command -v termux-open-url >/dev/null 2>&1; then
  termux-open-url "$url"
else
  echo "Откройте в браузере: $url"
fi
