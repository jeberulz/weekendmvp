#!/usr/bin/env bash
# Per-boot web startup for Cloud Agents.
#
# The `convex` terminal runs `npx convex dev` (anonymous agent mode), which
# stands up a local Convex backend on :3210 and writes NEXT_PUBLIC_CONVEX_URL
# to .env.local. This script waits for that backend, seeds it (idempotent
# upserts), then hands off to the Next.js dev server. Seeding is best-effort:
# the ideas grid, articles, and newsletter pages all fall back to the on-disk
# manifests / MDX when Convex is empty or unreachable, so a seed hiccup never
# blocks the dev server.
set -uo pipefail
cd "$(dirname "$0")/.."

echo "[start-web] waiting for Convex local backend on :3210 ..."
for _ in $(seq 1 150); do
  if curl -sf http://127.0.0.1:3210/version >/dev/null 2>&1 \
    && grep -q NEXT_PUBLIC_CONVEX_URL .env.local 2>/dev/null; then
    echo "[start-web] Convex is up."
    break
  fi
  sleep 2
done

echo "[start-web] seeding Convex (idempotent) ..."
CONVEX_AGENT_MODE=anonymous npm run seed:convex \
  || echo "[start-web] seed:convex failed (non-fatal) — grids fall back to manifest/MDX"

echo "[start-web] starting Next.js dev server ..."
exec npm run dev
