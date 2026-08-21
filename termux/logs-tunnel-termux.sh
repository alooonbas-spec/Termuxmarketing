#!/data/data/com.termux/files/usr/bin/bash

set -eu
. "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/common.sh"

ensure_termux
mkdir -p "$STATE_DIR"
touch "$TUNNEL_LOG_FILE"
tail -n 100 -f "$TUNNEL_LOG_FILE"
