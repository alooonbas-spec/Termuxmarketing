#!/data/data/com.termux/files/usr/bin/bash

set -eu
. "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/common.sh"

ensure_termux
ensure_installed
echo "ADMIN_API_KEY=$(read_env_value ADMIN_API_KEY)"
