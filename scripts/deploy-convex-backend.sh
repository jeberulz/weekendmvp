#!/usr/bin/env bash
# Deploy the WP44 Convex backend to production, before merging PR #81.
#
#   scripts/deploy-convex-backend.sh             checks, snapshot, dry run, deploy, verify
#   scripts/deploy-convex-backend.sh --backfill  after the deploy: normalize legacy subscription emails
#
# Run on your own machine from a clean checkout of the PR branch. Export a
# deployment-scoped production CONVEX_DEPLOY_KEY for the live site's exact
# target. Snapshots hold member emails, so they are written outside the repo.
# Works with the bash 3.2 that ships on macOS.
set -euo pipefail

BRANCH="claude/wizardly-rubin-a6m2th"
BACKUP_DIR="${BACKUP_DIR:-$HOME/weekendmvp-backups}"
STAMP="$(date -u +%Y%m%d-%H%M)"
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

# The checkout's default --prod deployment is not the site's live target.
case "${CONVEX_DEPLOY_KEY:-}" in
  prod:first-squirrel-244\|*) TARGET="" ;;
  *) fail "Set CONVEX_DEPLOY_KEY for the verified first-squirrel-244 deployment." ;;
esac

in_repo_root() {
  [ -f package.json ] && [ -d convex ] || fail "Run this from the repo root."
}

preflight() {
  step "Preflight"
  in_repo_root
  git fetch --quiet origin main "$BRANCH"
  [ "$(git branch --show-current)" = "$BRANCH" ] || fail "Check out $BRANCH first."
  git diff --quiet && git diff --cached --quiet || fail "Commit or stash local changes first."
  [ -z "$(git status --porcelain -- convex)" ] || fail "Untracked files in convex/."
  [ "$(git rev-parse HEAD)" = "$(git rev-parse "origin/$BRANCH")" ] \
    || fail "Local branch differs from origin/$BRANCH. Pull first."
  # Deploying a branch that lacks main's latest backend would roll that back.
  git merge-base --is-ancestor origin/main HEAD || fail "Merge origin/main into $BRANCH first."
  echo "Deploying commit $(git rev-parse --short HEAD)."
}

check_env_names() {
  step "Production environment variables (names only)"
  local names missing=""
  # Only names that look like variable names are kept. Values never leave node.
  names="$(npx convex env list $TARGET | node -e '
    const lines = require("fs").readFileSync(0, "utf8").split("\n");
    const names = lines.map((l) => l.split("=")[0].trim()).filter((n) => /^[A-Z][A-Z0-9_]*$/.test(n));
    console.log(names.join("\n"));
  ')"
  for name in $REQUIRED_ENV; do
    grep -qx "$name" <<<"$names" || missing="$missing $name"
  done
  if [ -n "$missing" ]; then
    echo "Missing on production:$missing. Members can't sign in until these are set."
    confirm "Deploy anyway?"
  else
    echo "Auth variables are set."
  fi
}

snapshot() {
  mkdir -p "$BACKUP_DIR" && chmod 700 "$BACKUP_DIR"
  SNAPSHOT="$BACKUP_DIR/convex-prod-$1-$(date -u +%Y%m%d-%H%M%S).zip"
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
  if out="$(npx convex run platform/dashboard:offer '{"now":0}' $TARGET 2>&1)"; then
    fail "platform/dashboard:offer answered an anonymous call."
  fi
  grep -q "UNAUTHENTICATED" <<<"$out" || fail "Unexpected error from platform/dashboard:offer: $out"
  echo "Anonymous call refused, as expected."
}

deploy() {
  preflight
  step "Local checks"
  npm ci
  npm run typecheck
  npm run test:convex
  check_env_names
  step "Restore point"
  local tag="platform-pre-production-$STAMP"
  git tag -a "$tag" origin/main -m "Restore point before the WP44 Convex deploy"
  echo "Tagged origin/main as $tag. Push it with: git push origin $tag"
  snapshot pre-wp44
  step "Dry run (schema, index and function changes)"
  npx convex deploy --dry-run --typecheck enable
  confirm "Push this backend to production?"
  step "Deploy"
  npx convex deploy --typecheck enable --message "WP44 dashboard backend $(git rev-parse --short HEAD)"
  verify
  step "Done"
  cat <<EOF
Backend deployed from $(git rev-parse --short HEAD). The live site keeps working:
the old dashboard functions are still there.

Next:
  1. Merge PR #81. Vercel deploys the frontend.
  2. Smoke test: sign in, save an idea, start a weekend plan, copy a prompt.
  3. Run: scripts/deploy-convex-backend.sh --backfill
  4. Record the tag, snapshot and results in docs/wp/backup-restore.md.

If the new frontend misbehaves, roll back the Vercel deployment and leave this
backend in place. Don't redeploy the old backend over new data: its schema
doesn't know the new fields, so Convex will refuse it. Fix forward instead.
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
  local s n u
  read -r s n u < <(backfill_pass true)
  echo "Dry run: scanned $s rows. $n need a normalized email key."
  if [ "$n" -eq 0 ]; then echo "Nothing to do."; return; fi
  confirm "Snapshot production, then write the key on $n rows? Event emails stay unchanged."
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
