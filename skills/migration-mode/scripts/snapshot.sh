#!/usr/bin/env bash
# Record the working-tree state of the given paths as a commit object without touching HEAD, the index or any file.
# Usage: snapshot.sh <repo> <path>...   Prints the snapshot commit SHA (parent: HEAD).
# Later, prove a user's commit matches what you verified: [ "$(git rev-parse HEAD^{tree})" = "$(git rev-parse <sha>^{tree})" ]
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "usage: snapshot.sh <repo> <path>..." >&2
  exit 2
fi
repo=$1
shift

real_index=$(cd "$repo" && realpath "$(git rev-parse --git-path index)")
temporary_index=$(mktemp)
trap 'rm -f "$temporary_index"' EXIT
cp "$real_index" "$temporary_index"

GIT_INDEX_FILE=$temporary_index git -C "$repo" add -A -- "$@"
tree=$(GIT_INDEX_FILE=$temporary_index git -C "$repo" write-tree)
git -C "$repo" commit-tree "$tree" -p HEAD -m "verification snapshot"
