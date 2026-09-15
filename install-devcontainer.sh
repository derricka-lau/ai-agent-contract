#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

log() {
	printf '%s\n' "$1"
}

main() {
	local profile="prompt"
	if [[ "${1:-}" == "--profile" ]]; then
		if [[ "$#" -lt 2 ]]; then
			log "ERROR: --profile requires prompt or hardened"
			exit 1
		fi
		profile="$2"
	fi
	if [[ "$profile" != prompt && "$profile" != hardened ]]; then
		log "ERROR: invalid profile: $profile"
		exit 1
	fi

	log "Delegating devcontainer setup to install.sh"
	bash "$SCRIPT_DIR/install.sh" "$@"
}

main "$@"
