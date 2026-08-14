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

verify_bubblewrap_sandbox() {
	local diagnostic

	if ! command -v bwrap >/dev/null 2>&1; then
		printf '%s\n' \
			"Codex sandbox preflight failed: bubblewrap is not installed." \
			"Install bubblewrap in the devcontainer image, rebuild the devcontainer, and rerun this installer." >&2
		return 1
	fi

	if diagnostic="$(
		bwrap \
			--unshare-user \
			--unshare-pid \
			--unshare-net \
			--ro-bind / / \
			--proc /proc \
			--dev /dev \
			-- true 2>&1
	)"; then
		log "Codex sandbox preflight passed"
		return
	fi

	cat >&2 <<'EOF'
Codex sandbox preflight failed: bubblewrap cannot create the namespaces required by Codex.
The installer cannot change container runtime security from inside a running devcontainer.

Add these entries to the devcontainer's runArgs, then rebuild the devcontainer:

  "--cap-add=SYS_ADMIN",
  "--security-opt=seccomp=unconfined",
  "--security-opt=apparmor=unconfined"

Use these settings only for a trusted development container. They relax the outer Docker sandbox so Codex can create its own inner sandbox. Do not use Codex dangerous-access flags as a workaround.
If the preflight still fails after rebuilding, follow the current platform guidance at https://learn.chatgpt.com/docs/sandboxing#prerequisites.
EOF
	printf 'Bubblewrap diagnostic: %s\n' "$diagnostic" >&2
	return 1
}

main() {
	install_bubblewrap
	verify_bubblewrap_sandbox
	log "Delegating devcontainer setup to install.sh"
	bash "$SCRIPT_DIR/install.sh" "$@"
}

main "$@"
