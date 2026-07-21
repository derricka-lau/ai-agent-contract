#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

log() {
	printf '%s\n' "$1"
}

install_bubblewrap() {
	if [[ "$(id -u)" -ne 0 ]]; then
		log "Skipping bubblewrap install: root is required inside the devcontainer."
		return
	fi

	if ! command -v apt-get >/dev/null 2>&1; then
		log "Skipping bubblewrap install: apt-get is unavailable in this devcontainer."
		return
	fi

	log "Installing bubblewrap for compatible Codex devcontainer support"
	apt-get update -qq
	apt-get install -y -qq bubblewrap >/dev/null 2>&1
}

main() {
	log "Delegating devcontainer setup to install.sh"
	bash "$SCRIPT_DIR/install.sh" "$@"
	install_bubblewrap
}

main "$@"
