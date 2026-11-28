#!/usr/bin/env bash
# Run a CI job's command inside the CI image on exactly one commit, so local tool or dependency drift cannot fake a pass.
# Usage: ci_in_image.sh <repo> <commit> <image> <command...>
# Example: ci_in_image.sh . "$(snapshot.sh . src tests)" python:3.12-slim 'pip install -q uv && uv sync --frozen && uv run pytest -q'
# The exit status is the command's. Still read the output: some tools report failure on a line while exiting 0.
set -euo pipefail

if [ "$#" -lt 4 ]; then
  echo "usage: ci_in_image.sh <repo> <commit> <image> <command...>" >&2
  exit 2
fi
repo=$1
commit=$2
image=$3
shift 3

git -C "$repo" archive "$commit" | docker run --rm -i "$image" sh -c "mkdir /work && cd /work && tar -x && $*"
