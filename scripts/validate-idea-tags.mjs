#!/usr/bin/env node
/**
 * Validate idea tagging against the live hub allowlists.
 *
 * Allowlists mirror:
 *   ideas/manifest.json → categories / tools / audiences / revenueGoals
 *   app/ideas/[slug]/collection.tsx → buildTimeValues on build-time hubs
 *   app/build-with/[tool]/page.tsx → TOOL_PAGES (minus claude-code alias)
 *   app/ideas-for/[audience]/page.tsx → AUDIENCE_PAGES
 *
 * Usage:
 *   node scripts/validate-idea-tags.mjs
 *   node scripts/validate-idea-tags.mjs --slug ai-slide-deck-maker
 * Exit 0 on pass, 1 on any violation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "ideas/manifest.json"), "utf8"),
);

export const ALLOWED_CATEGORIES = new Set(
  (manifest.categories || []).map((c) => c.slug ?? c),
);
export const ALLOWED_TOOLS = new Set([
  "cursor",
  "claude",
  "bolt",
  "v0",
  "lovable",
  "replit",
  "windsurf",
  "no-code",
]);
export const ALLOWED_AUDIENCES = new Set([
  "developers",
  "designers",
  "non-technical",
  "solo-founders",
  "weekend-builders",
  "side-hustlers",
  "marketers",
  "freelancers",
  "creators",
  "small-business-owners",
]);
export const ALLOWED_REVENUE = new Set([
  "1k-month",
  "5k-month",
  "10k-month",
  "passive-income",
  "quick-wins",
]);
/** Canonical hour strings that match COLLECTIONS buildTimeValues. */
export const ALLOWED_BUILDTIMES = new Set([
  "8",
  "10",
  "12",
  "20",
  "24",
  "30",
  "40",
]);

const MIN_TOOLS = 2;
const MIN_AUDIENCES = 2;

const argv = process.argv.slice(2);
const slugIdx = argv.indexOf("--slug");
const onlySlug = slugIdx !== -1 ? argv[slugIdx + 1] : null;

export function validateIdea(idea) {
  const errors = [];
  if (!idea.category || !ALLOWED_CATEGORIES.has(idea.category)) {
    errors.push(`category '${idea.category}' not in allowlist`);
  }
  if (!idea.revenueGoal || !ALLOWED_REVENUE.has(idea.revenueGoal)) {
    errors.push(`revenueGoal '${idea.revenueGoal}' not in allowlist`);
  }
  if (!idea.buildTime || !ALLOWED_BUILDTIMES.has(String(idea.buildTime))) {
    errors.push(
      `buildTime '${idea.buildTime}' not canonical (want ${[...ALLOWED_BUILDTIMES].join("|")})`,
    );
  }
  const tools = Array.isArray(idea.tools) ? idea.tools : [];
  if (tools.length < MIN_TOOLS) {
    errors.push(`tools[] has ${tools.length} entries (need ≥${MIN_TOOLS})`);
  }
  for (const t of tools) {
    if (!ALLOWED_TOOLS.has(t)) errors.push(`tool '${t}' not in allowlist`);
  }
  const audiences = Array.isArray(idea.audiences) ? idea.audiences : [];
  if (audiences.length < MIN_AUDIENCES) {
    errors.push(
      `audiences[] has ${audiences.length} entries (need ≥${MIN_AUDIENCES})`,
    );
  }
  for (const a of audiences) {
    if (!ALLOWED_AUDIENCES.has(a)) {
      errors.push(`audience '${a}' not in allowlist`);
    }
  }
  return errors;
}

function main() {
  let ideas = manifest.ideas || [];
  if (onlySlug) ideas = ideas.filter((i) => i.slug === onlySlug);
  if (onlySlug && ideas.length === 0) {
    console.error(`No idea with slug '${onlySlug}'`);
    process.exit(1);
  }

  let failed = 0;
  for (const idea of ideas) {
    const errors = validateIdea(idea);
    if (errors.length) {
      failed++;
      console.log(`FAIL ${idea.slug}`);
      for (const e of errors) console.log(`  - ${e}`);
    }
  }

  const total = ideas.length;
  const passed = total - failed;
  console.log(
    `\n${passed}/${total} ideas pass tagging contract (${failed} fail)`,
  );
  process.exit(failed ? 1 : 0);
}

const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("validate-idea-tags.mjs");
if (isMain) main();
