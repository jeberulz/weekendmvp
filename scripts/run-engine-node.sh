#!/usr/bin/env bash
# Portable launcher for Idea Engine Node CLIs (research, compile, audit, …).
# Resolves Node >= 22.6 with strip-types before exec — never masks a Node 20 miss.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/resolve-engine-node.sh
source "$ROOT/scripts/lib/resolve-engine-node.sh"

if ! resolve_engine_node; then
  exit 3
fi

if [[ $# -lt 1 ]]; then
  echo "usage: bash scripts/run-engine-node.sh <script.mjs> [args…]" >&2
  exit 2
fi

SCRIPT="$1"
shift
case "$SCRIPT" in
  /*) ;;
  *) SCRIPT="$ROOT/$SCRIPT" ;;
esac

if [[ ! -f "$SCRIPT" ]]; then
  echo "run-engine-node: script not found: $SCRIPT" >&2
  exit 2
fi

exec "$ENGINE_NODE" \
  --experimental-strip-types \
  --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
  "$SCRIPT" \
  "$@"
