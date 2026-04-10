#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Delegating devcontainer setup to install.sh"
exec bash "$SCRIPT_DIR/install.sh" "$@"
