#!/usr/bin/env node
/**
 * Validate idea tagging against the live hub allowlists, plus the optional
 * homepage `highlights` block (WP42).
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

/**
 * Optional `highlights` block read by the homepage (WP42). Required for new
 * `/publish-idea` runs; optional here until existing ideas are backfilled.
 */
export const HIGHLIGHT_LIMITS = {
  problemQuote: 190,
  statValue: 12,
  statLabel: 90,
  statSource: 48,
  maxStats: 3,
  competitorName: 32,
  competitorPrice: 16,
  maxCompetitors: 5,
};

const isText = (v) => typeof v === "string" && v.trim().length > 0;

export function validateHighlights(highlights) {
  const L = HIGHLIGHT_LIMITS;
  const errors = [];
  if (highlights === undefined) return errors;
  if (!highlights || typeof highlights !== "object" || Array.isArray(highlights)) {
    return ["highlights must be an object"];
  }
  const { problemQuote, stats, competitors } = highlights;
  if (!isText(problemQuote)) {
    errors.push("highlights.problemQuote is required");
  } else if (problemQuote.length > L.problemQuote) {
    errors.push(`highlights.problemQuote is ${problemQuote.length} chars (max ${L.problemQuote})`);
  }
  if (!Array.isArray(stats) || stats.length < 1 || stats.length > L.maxStats) {
    errors.push(`highlights.stats needs 1–${L.maxStats} entries`);
  } else {
    stats.forEach((s, i) => {
      if (!s || !isText(s.value) || s.value.length > L.statValue) {
        errors.push(`highlights.stats[${i}].value must be 1–${L.statValue} chars`);
      }
      if (!s || !isText(s.label) || s.label.length > L.statLabel) {
        errors.push(`highlights.stats[${i}].label must be 1–${L.statLabel} chars`);
      }
      if (s && s.source !== undefined && (!isText(s.source) || s.source.length > L.statSource)) {
        errors.push(`highlights.stats[${i}].source must be 1–${L.statSource} chars`);
      }
    });
  }
  if (competitors !== undefined) {
    if (!Array.isArray(competitors) || competitors.length < 3 || competitors.length > L.maxCompetitors) {
      errors.push(`highlights.competitors needs 3–${L.maxCompetitors} entries when present`);
    } else {
      competitors.forEach((c, i) => {
        if (!c || !isText(c.name) || c.name.length > L.competitorName) {
          errors.push(`highlights.competitors[${i}].name must be 1–${L.competitorName} chars`);
        }
        if (!c || !isText(c.price) || c.price.length > L.competitorPrice) {
          errors.push(`highlights.competitors[${i}].price must be 1–${L.competitorPrice} chars`);
        }
      });
    }
  }
  return errors;
}

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
  errors.push(...validateHighlights(idea.highlights));
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
