#!/usr/bin/env bash
# Resolve a Node binary that can run the Idea Engine CLIs.
#
# Engine scripts import TypeScript via `node --experimental-strip-types`, which
# exists only on Node >= 22.6. Node 20 fails with:
#   /usr/bin/node: bad option: --experimental-strip-types  (exit 9)
#
# This helper must itself run under bash on Node 20 hosts so it can print a
# clear owner install step instead of that opaque exit 9.
#
# Usage (from other scripts):
#   # shellcheck source=scripts/lib/resolve-engine-node.sh
#   source "$ROOT/scripts/lib/resolve-engine-node.sh"
#   resolve_engine_node || exit $?
#   exec "$ENGINE_NODE" --experimental-strip-types ...
#
# Env:
#   ENGINE_NODE     — if set and valid, used as-is
#   NVM_DIR         — searched for v22+/v24+ installs
#
# Exit: 0 sets ENGINE_NODE; 3 = unsupported runtime (owner action required).

# Minimum: Node 22.6.0 (strip-types). See package.json "engines" and CI.
ENGINE_NODE_MIN_MAJOR=22
ENGINE_NODE_MIN_MINOR=6
ENGINE_NODE_MIN_PATCH=0

engine_node_version_ok() {
  local ver major minor patch
  ver="$1"
  major="${ver%%.*}"
  local rest="${ver#*.}"
  minor="${rest%%.*}"
  patch="${rest#*.}"
  patch="${patch%%[^0-9]*}"
  major="${major:-0}"
  minor="${minor:-0}"
  patch="${patch:-0}"
  if (( major > ENGINE_NODE_MIN_MAJOR )); then return 0; fi
  if (( major < ENGINE_NODE_MIN_MAJOR )); then return 1; fi
  if (( minor > ENGINE_NODE_MIN_MINOR )); then return 0; fi
  if (( minor < ENGINE_NODE_MIN_MINOR )); then return 1; fi
  (( patch >= ENGINE_NODE_MIN_PATCH ))
}

engine_node_supports_strip_types() {
  local bin="$1"
  # Probe the real flag. Do not invent a polyfill — Node 20 cannot run the engine.
  "$bin" --experimental-strip-types -e 'console.log("ok")' >/dev/null 2>&1
}

engine_node_read_version() {
  local bin="$1"
  "$bin" -p 'process.versions.node' 2>/dev/null
}

engine_node_try_candidate() {
  local bin="$1"
  local ver
  if [[ -z "$bin" || ! -x "$bin" ]]; then return 1; fi
  ver="$(engine_node_read_version "$bin")" || return 1
  if ! engine_node_version_ok "$ver"; then return 1; fi
  if ! engine_node_supports_strip_types "$bin"; then return 1; fi
  ENGINE_NODE="$bin"
  ENGINE_NODE_VERSION="$ver"
  return 0
}

engine_node_collect_candidates() {
  local -a out=()
  local p

  if [[ -n "${ENGINE_NODE:-}" ]]; then
    out+=("$ENGINE_NODE")
  fi

  # Prefer PATH order, then common version managers / system paths.
  if command -v node >/dev/null 2>&1; then
    out+=("$(command -v node)")
  fi

  local nvm_dir="${NVM_DIR:-$HOME/.nvm}"
  if [[ -d "$nvm_dir/versions/node" ]]; then
    # Newest first among installed nvm nodes.
    while IFS= read -r p; do
      out+=("$p")
    done < <(find "$nvm_dir/versions/node" -maxdepth 2 -type f -path '*/bin/node' 2>/dev/null | sort -V -r)
  fi

  for p in \
    "$HOME/.local/share/fnm/node-versions"/*/installation/bin/node \
    /usr/local/bin/node \
    /opt/homebrew/bin/node \
    /usr/bin/node
  do
    [[ -e "$p" ]] && out+=("$p")
  done

  # Deduplicate while preserving order.
  local -A seen=()
  ENGINE_NODE_CANDIDATES=()
  for p in "${out[@]}"; do
    if [[ -n "$p" && -z "${seen[$p]:-}" ]]; then
      seen["$p"]=1
      ENGINE_NODE_CANDIDATES+=("$p")
    fi
  done
}

engine_node_install_help() {
  cat <<'EOF'
Idea Engine requires Node.js >= 22.6.0 (recommended: 22.x per CI, or 24.x).

`--experimental-strip-types` (used by engine:research / compile / replay / audit)
does not exist on Node 20 — Node exits 9 with "bad option". Node 20 is not a
supported engine runtime; there is no polyfill.

Owner setup (pick one):

  1) nvm (matches .nvmrc):
       nvm install
       nvm use
       node -v    # expect v22+ or v24+
       npm run engine:replay

  2) Explicit binary for this shell:
       export ENGINE_NODE="$(command -v node)"   # after switching to 22.6+
       npm run engine:research -- --brief … --live

  3) fnm / asdf / system package: install Node 22.6+ or 24.x, ensure it is
     first on PATH, then re-run.

Verify strip-types before spending:
  node --experimental-strip-types -e 'console.log("ok")'

Do not run live research until the probe succeeds. WP46-E7 public release
remains NO-GO independently of this runtime fix.
EOF
}

# Sets ENGINE_NODE and ENGINE_NODE_VERSION, or exits 3 with install help.
resolve_engine_node() {
  local cand ver seen_versions=""
  engine_node_collect_candidates

  for cand in "${ENGINE_NODE_CANDIDATES[@]:-}"; do
    if engine_node_try_candidate "$cand"; then
      return 0
    fi
    ver="$(engine_node_read_version "$cand" 2>/dev/null || true)"
    if [[ -n "$ver" ]]; then
      seen_versions="${seen_versions}  - ${cand} → v${ver}"$'\n'
    fi
  done

  echo "resolve-engine-node: no Node >= ${ENGINE_NODE_MIN_MAJOR}.${ENGINE_NODE_MIN_MINOR}.${ENGINE_NODE_MIN_PATCH} with --experimental-strip-types" >&2
  if [[ -n "$seen_versions" ]]; then
    echo "candidates probed:" >&2
    printf '%s' "$seen_versions" >&2
  else
    echo "no node binary found on PATH or under NVM_DIR" >&2
  fi
  echo >&2
  engine_node_install_help >&2
  return 3
}
