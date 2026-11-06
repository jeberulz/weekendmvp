#!/usr/bin/env bash
# Portable no-cost engine replay entrypoint for agent hosts (Grok/Claude/Codex).
#
#   bash scripts/engine-replay.sh --work-root /tmp/wmvp-engine-replay
#
# Resolves Node >= 22.6 before invoking scripts/engine-replay.mjs. On an
# unsupported runtime (e.g. system Node 20) exits 3 with install steps — does
# not forward Node's opaque "bad option" exit 9.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/resolve-engine-node.sh
source "$ROOT/scripts/lib/resolve-engine-node.sh"

WORK_ROOT=""
EXTRA=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --work-root)
      WORK_ROOT="${2:-}"
      if [[ -z "$WORK_ROOT" || "$WORK_ROOT" == --* ]]; then
        echo "engine-replay.sh: --work-root needs a directory" >&2
        exit 2
      fi
      shift 2
      ;;
    --help|-h)
      echo "Usage: bash scripts/engine-replay.sh [--work-root DIR]"
      echo "Runs fixture research → compile → deep audit (no provider spend)."
      echo "Requires Node >= 22.6 (see .nvmrc / package.json engines)."
      exit 0
      ;;
    *)
      EXTRA+=("$1")
      shift
      ;;
  esac
done

if [[ -n "$WORK_ROOT" ]]; then
  mkdir -p "$WORK_ROOT"
  WORK_ROOT="$(cd "$WORK_ROOT" && pwd)"
fi

STAMP="$(date -u +%Y%m%dT%H%M%S)"
REV="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo nogit)"
LOG_DIR="${WORK_ROOT:-$ROOT/tmp/engine-replay}"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/engine-replay-${STAMP}-${REV}.log"
COMPLETE_FILE="$LOG_DIR/engine-replay-complete"

rm -f "$COMPLETE_FILE"

log() {
  # shellcheck disable=SC2312
  printf '%s\n' "$*" | tee -a "$LOG_FILE"
}

log "engine-replay.sh: starting"
log "cwd=$ROOT"
log "log=$LOG_FILE"

if ! resolve_engine_node; then
  # resolve_engine_node already printed install help on stderr; capture to log.
  {
    echo "engine-replay.sh: FAIL runtime (exit 3)"
    engine_node_install_help
  } | tee -a "$LOG_FILE" >&2
  exit 3
fi

log "ENGINE_NODE=$ENGINE_NODE"
log "ENGINE_NODE_VERSION=$ENGINE_NODE_VERSION"

ARGS=()
if [[ -n "$WORK_ROOT" ]]; then
  ARGS+=(--work-root "$WORK_ROOT")
fi
if [[ ${#EXTRA[@]} -gt 0 ]]; then
  ARGS+=("${EXTRA[@]}")
fi

set +e
"$ENGINE_NODE" "$ROOT/scripts/engine-replay.mjs" "${ARGS[@]}" 2>&1 | tee -a "$LOG_FILE"
STATUS=${PIPESTATUS[0]}
set -e

if [[ $STATUS -eq 0 ]]; then
  echo "engine-replay-complete" >"$COMPLETE_FILE"
  log "engine-replay.sh: PASS (marker $COMPLETE_FILE)"
else
  log "engine-replay.sh: FAIL exit $STATUS"
fi
exit "$STATUS"
