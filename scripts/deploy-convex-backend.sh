#!/usr/bin/env bash
# Deploy the Convex backend to the deployment the live site uses.
#
#   scripts/deploy-convex-backend.sh             checks, snapshot, dry run, deploy, verify
#   scripts/deploy-convex-backend.sh --backfill  normalize legacy subscription emails
#
# Run on your own machine from a clean checkout of main (or a branch that
# contains main). Target production with a deploy key from the Convex project
# the site uses:
#
#   export CONVEX_DEPLOY_KEY='prod:...'   # Convex dashboard > Settings > Deploy keys
#   export SITE_CONVEX_URL='https://NAME.convex.cloud'   # Vercel NEXT_PUBLIC_CONVEX_URL (Production)
#
# Without a key the CLI uses the project linked in .env.local, which may not be
# the site's. The script stops unless the target matches SITE_CONVEX_URL (it
# asks for it when unset). Nothing here prints secret values. Snapshots hold
# member emails, so they are written outside the repo. Works with the bash 3.2
# that ships on macOS.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$HOME/weekendmvp-backups}"
STAMP="$(date -u +%Y%m%d-%H%M)"
TARGET_NAME=""
REQUIRED_ENV="SITE_URL JWT_PRIVATE_KEY JWKS"
NEW_FUNCTIONS="platform/dashboard:requireMember platform/dashboard:offer platform/dashboard:savedPage
  platform/weekendPlans:start platform/ideas:dashboardSummary platform/ideas:explore platform/ideas:setIntent"

step() { printf '\n== %s\n' "$1"; }
fail() { printf 'STOP: %s\n' "$1" >&2; exit 1; }
confirm() {
  local answer
  read -r -p "$1 Type yes to continue: " answer
  [ "$answer" = "yes" ] || fail "Not confirmed."
}

# With a deploy key the CLI targets that key's deployment. Otherwise use --prod.
if [ -n "${CONVEX_DEPLOY_KEY:-}" ]; then
  case "$CONVEX_DEPLOY_KEY" in prod:*) ;; *) fail "CONVEX_DEPLOY_KEY is not a production key." ;; esac
  TARGET=""
else
  TARGET="--prod"
fi

in_repo_root() {
  [ -f package.json ] && [ -d convex ] || fail "Run this from the repo root."
}

# "https://first-squirrel-244.eu-west-1.convex.cloud" -> "first-squirrel-244".
deployment_name() {
  printf '%s' "$1" | sed -E 's#^[a-zA-Z]+://##; s#[./:].*$##'
}

# The CLI decides the target from CONVEX_DEPLOY_KEY or .env.local. Ask it, then
# compare with the deployment the site's frontend is built against.
check_target() {
  step "Target deployment"
  local target_url site_url target site
  # shellcheck disable=SC2086
  target_url="$(npx convex function-spec $TARGET | node -e '
    console.log(JSON.parse(require("fs").readFileSync(0, "utf8")).url);
  ')"
  target="$(deployment_name "$target_url")"
  echo "The Convex CLI will act on: $target_url"
  site_url="${SITE_CONVEX_URL:-}"
  if [ -z "$site_url" ]; then
    read -r -p "Paste NEXT_PUBLIC_CONVEX_URL from Vercel (Production): " site_url
  fi
  site="$(deployment_name "$site_url")"
  [ -n "$site" ] || fail "No site deployment given."
  if [ "$target" != "$site" ]; then
    fail "The live site uses $site, but this would act on $target. Export CONVEX_DEPLOY_KEY with a production deploy key from the $site project."
  fi
  echo "Matches the live site ($site)."
  TARGET_NAME="$target"
}

preflight() {
  step "Preflight"
  in_repo_root
  local branch
  branch="$(git branch --show-current)"
  [ -n "$branch" ] || fail "Check out a branch first (main after a merge)."
  git fetch --quiet origin main "$branch" || fail "Could not fetch origin/$branch. Use main, or push the branch."
  git diff --quiet && git diff --cached --quiet || fail "Commit or stash local changes first."
  [ -z "$(git status --porcelain -- convex)" ] || fail "Untracked files in convex/."
  [ "$(git rev-parse HEAD)" = "$(git rev-parse "origin/$branch")" ] \
    || fail "Local $branch differs from origin/$branch. Pull first."
  # Deploying code that lacks main's latest backend would roll that back.
  git merge-base --is-ancestor origin/main HEAD \
    || fail "$branch is missing commits from origin/main. Deploy from main."
  echo "Deploying $branch at $(git rev-parse --short HEAD)."
}

check_env_names() {
  step "Production environment variables (names only)"
  local names missing=""
  # Only names that look like variable names are kept. Values never leave node.
  # shellcheck disable=SC2086
  names="$(npx convex env list $TARGET | node -e '
    const lines = require("fs").readFileSync(0, "utf8").split("\n");
    const names = lines.map((l) => l.split("=")[0].trim()).filter((n) => /^[A-Z][A-Z0-9_]*$/.test(n));
    console.log(names.join("\n"));
  ')"
  for name in $REQUIRED_ENV; do
    grep -qx "$name" <<<"$names" || missing="$missing $name"
  done
  if [ -n "$missing" ]; then
    echo "Missing on $TARGET_NAME:$missing. Members can't sign in until these are set."
    confirm "Deploy anyway?"
  else
    echo "Auth variables are set."
  fi
}

snapshot() {
  mkdir -p "$BACKUP_DIR" && chmod 700 "$BACKUP_DIR"
  SNAPSHOT="$BACKUP_DIR/convex-$TARGET_NAME-$1-$(date -u +%Y%m%d-%H%M%S).zip"
  # shellcheck disable=SC2086
  npx convex export $TARGET --include-file-storage --path "$SNAPSHOT"
  chmod 600 "$SNAPSHOT"
  echo "Snapshot saved to $SNAPSHOT"
}

verify() {
  step "Verify"
  # shellcheck disable=SC2086
  npx convex function-spec $TARGET | node -e '
    const spec = JSON.parse(require("fs").readFileSync(0, "utf8"));
    const ids = new Set(spec.functions.map((f) => String(f.identifier).replace(/\.js:/, ":")));
    let missing = 0;
    for (const want of process.argv.slice(1)) {
      const ok = ids.has(want);
      if (!ok) missing += 1;
      console.log(`${ok ? "ok     " : "MISSING"} ${want}`);
    }
    process.exit(missing ? 1 : 0);
  ' $NEW_FUNCTIONS || fail "Some functions are missing. Check the deploy output above."
  # An anonymous call must be refused. That proves the new code is live and guarded.
  local out
  # shellcheck disable=SC2086
  if out="$(npx convex run platform/dashboard:offer '{"now":0}' $TARGET 2>&1)"; then
    fail "platform/dashboard:offer answered an anonymous call."
  fi
  grep -q "UNAUTHENTICATED" <<<"$out" || fail "Unexpected error from platform/dashboard:offer: $out"
  echo "Anonymous call refused, as expected."
}

deploy() {
  preflight
  check_target
  step "Local checks"
  npm ci
  npm run typecheck
  npm run test:convex
  check_env_names
  step "Snapshot (restore point)"
  snapshot pre-deploy
  step "Dry run (schema, index and function changes)"
  npx convex deploy --dry-run --verbose --typecheck enable
  confirm "Push this backend to $TARGET_NAME?"
  step "Deploy"
  local sha tag
  sha="$(git rev-parse --short HEAD)"
  npx convex deploy --typecheck enable --message "Backend $sha"
  verify
  tag="convex-$TARGET_NAME-$STAMP"
  git tag -a "$tag" HEAD -m "Convex backend deployed to $TARGET_NAME"
  step "Done"
  cat <<EOF
Backend $sha is live on $TARGET_NAME. Tagged it as $tag
(push the tag with: git push origin $tag).

Next:
  1. If the matching frontend isn't live yet, deploy it now (merge to main).
  2. Smoke test: sign in, save an idea, start a weekend plan, copy a prompt.
  3. Run: scripts/deploy-convex-backend.sh --backfill
  4. Record the tag, snapshot and results in docs/wp/backup-restore.md.

If the new frontend misbehaves, roll back the Vercel deployment and leave this
backend in place. Don't redeploy an older backend over new data: its schema
may not know the new fields, so Convex will refuse it. Fix forward instead.
The snapshot is for disaster recovery: $SNAPSHOT
EOF
}

# One pass over every subscription row. Prints "scanned needsUpdate updated".
backfill_pass() {
  local dry="$1" cursor="null" scanned=0 needs=0 updated=0 args out s n u done_ next
  while :; do
    args="$(node -e 'console.log(JSON.stringify({
      cursor: process.argv[1] === "null" ? null : process.argv[1],
      dryRun: process.argv[2] === "true",
    }))' "$cursor" "$dry")"
    # shellcheck disable=SC2086
    out="$(npx convex run subscriptions:backfillNormalizedEmail "$args" $TARGET)"
    read -r s n u done_ next < <(node -e '
      const r = JSON.parse(require("fs").readFileSync(0, "utf8"));
      console.log(r.scanned, r.needsUpdate, r.updated, r.isDone, r.continueCursor);
    ' <<<"$out")
    scanned=$((scanned + s)); needs=$((needs + n)); updated=$((updated + u))
    [ "$done_" = "true" ] && break
    cursor="$next"
  done
  echo "$scanned $needs $updated"
}

backfill() {
  step "Legacy subscription backfill"
  in_repo_root
  check_target
  local s n u
  read -r s n u < <(backfill_pass true)
  echo "Dry run on $TARGET_NAME: scanned $s rows. $n need a normalized email key."
  if [ "$n" -eq 0 ]; then echo "Nothing to do."; return; fi
  confirm "Snapshot $TARGET_NAME, then write the key on $n rows? Event emails stay unchanged."
  snapshot pre-backfill
  read -r s n u < <(backfill_pass false)
  echo "Updated $u rows."
  read -r s n u < <(backfill_pass true)
  [ "$n" -eq 0 ] || fail "$n rows still need a key. Run --backfill again."
  echo "Verified: every row has its normalized key. Home now skips the legacy scan."
}

case "${1:-}" in
  "") deploy ;;
  --backfill) backfill ;;
  *) fail "Unknown option: $1" ;;
esac
