#!/usr/bin/env node
/**
 * One-shot retag of ideas/manifest.json:
 *   1. Normalize buildTime → canonical hub hour strings
 *   2. Map orphan audiences → allowlisted Ideas For hubs
 *   3. Drop / remap unknown tools
 *   4. Apply explicit overrides for the Aug-12 batch of 10 publishes
 *   5. Ensure every idea ends with ≥2 allowlisted tools and ≥2 audiences
 *
 * Usage:
 *   node scripts/retag-idea-tags.mjs --dry-run
 *   node scripts/retag-idea-tags.mjs --apply
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ALLOWED_AUDIENCES,
  ALLOWED_BUILDTIMES,
  ALLOWED_TOOLS,
  validateIdea,
} from "./validate-idea-tags.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manPath = path.join(root, "ideas/manifest.json");
const apply = process.argv.includes("--apply");
const dryRun = !apply;

/** Map free-form / ranged buildTime strings → canonical hub hour values. */
function normalizeBuildTime(raw) {
  if (raw === undefined || raw === null) return "10";
  const s = String(raw).trim().toLowerCase().replace(/hours?|hrs?/g, "").trim();
  if (ALLOWED_BUILDTIMES.has(s)) return s;
  // Ranges → upper bound that still fits a weekend when possible.
  if (/^6$/.test(s)) return "8";
  if (/^8\s*[-–]\s*10$/.test(s)) return "10";
  if (/^10\s*[-–]\s*12$/.test(s)) return "12";
  if (/^10\s*[-–]\s*14$/.test(s)) return "12";
  if (/^12\s*[-–]\s*16$/.test(s)) return "12";
  if (/^16\s*[-–]\s*24$/.test(s) || /^20\s*[-–]\s*24$/.test(s)) return "24";
  if (/^24\s*[-–]\s*40$/.test(s)) return "40";
  // Bare numbers outside allowlist → nearest.
  const n = Number(s);
  if (Number.isFinite(n)) {
    if (n <= 8) return "8";
    if (n <= 10) return "10";
    if (n <= 14) return "12";
    if (n <= 22) return "20";
    if (n <= 28) return "24";
    if (n <= 35) return "30";
    return "40";
  }
  return "10";
}

/**
 * Map orphan / free-text audience strings onto the 10 Ideas For hubs.
 * Keys are lowercased. Unmapped → dropped (caller may backfill defaults).
 */
const AUDIENCE_MAP = {
  // Already allowlisted (identity)
  developers: "developers",
  designers: "designers",
  "non-technical": "non-technical",
  "solo-founders": "solo-founders",
  "weekend-builders": "weekend-builders",
  "side-hustlers": "side-hustlers",
  marketers: "marketers",
  freelancers: "freelancers",
  creators: "creators",
  "small-business-owners": "small-business-owners",

  // Near-duplicates / Title Case / plurals
  "non-technical-founders": "non-technical",
  "startup-founders": "solo-founders",
  solopreneurs: "solo-founders",
  "smb-founders-operators": "small-business-owners",
  "smb saas founders": "solo-founders",
  "indie app builders": "developers",
  "ai-focused startups": "developers",
  "ai-skilled freelancers": "freelancers",
  "startup founders hiring ai talent": "developers",
  agencies: "freelancers",
  "boutique-agencies": "freelancers",
  "marketing-agencies": "marketers",
  "marketing-teams": "marketers",
  "small-business-marketers": "marketers",
  "ecommerce-founders": "small-business-owners",
  "ecommerce-sellers": "small-business-owners",
  "ecommerce sellers": "small-business-owners",
  "e-commerce entrepreneurs": "small-business-owners",
  "shopify-merchants": "small-business-owners",
  "online resellers": "side-hustlers",
  resellers: "side-hustlers",
  "craft-sellers": "creators",
  "tiktok shop sellers": "creators",
  "online course creators": "creators",
  educators: "creators",
  "youth-sports-coaches": "creators",
  parents: "non-technical",
  "new-mothers": "non-technical",
  "pregnant-women": "non-technical",
  "health-conscious-families": "non-technical",
  "mid-career-professionals": "side-hustlers",
  "burned-out-high-earners": "side-hustlers",
  "young-adults": "side-hustlers",
  "hr-benefits-teams": "small-business-owners",
  "hr-people-ops-leaders": "small-business-owners",
  "real-estate-investors": "side-hustlers",
  "diy-renovators": "side-hustlers",
  "small-wholesalers": "small-business-owners",
  "independent recruiters": "freelancers",
  "small recruiting agencies": "freelancers",
  "adult children of aging parents": "non-technical",
  "senior care professionals": "freelancers",
  "n8n freelancers": "freelancers",
  "small automation agencies": "freelancers",
  "midsize-brand-operations-teams": "marketers",
  "sustainability-and-compliance-directors": "small-business-owners",
  "bookkeepers-and-accountants": "freelancers",
  "local-service-businesses": "small-business-owners",
  "technical-writers": "freelancers",
  "renters-and-tenants": "non-technical",
  "tenant-rights-advocates": "non-technical",
  manufacturers: "small-business-owners",
  "car-enthusiasts": "side-hustlers",
  "restoration-shops": "small-business-owners",
  makers: "creators",
  "market-vendors": "small-business-owners",
  "food-trucks": "small-business-owners",
  "collectible-traders": "side-hustlers",
  marketplaces: "small-business-owners",
};

const TOOL_MAP = {
  cursor: "cursor",
  claude: "claude",
  "claude-code": "claude", // hub aliases to claude for idea membership
  bolt: "bolt",
  v0: "v0",
  lovable: "lovable",
  replit: "replit",
  windsurf: "windsurf",
  "no-code": "no-code",
  // Unknowns → nearest allowlisted tool (or drop)
  shopify: "no-code",
  expo: "replit",
};

/**
 * Explicit overrides for the 10 Aug-12 publishes — chosen for buyer / stack fit
 * so they enrich Build With + Ideas For hubs beyond the default cursor/claude +
 * solo-founders pattern.
 */
const RECENT_OVERRIDES = {
  "ai-slide-deck-maker": {
    tools: ["cursor", "claude", "v0"],
    audiences: ["solo-founders", "marketers", "freelancers"],
    buildTime: "12",
  },
  "book-formatting-for-self-publishers": {
    tools: ["cursor", "claude", "no-code"],
    audiences: ["creators", "solo-founders", "side-hustlers"],
    buildTime: "12",
  },
  "course-completion-nudge-platform": {
    tools: ["cursor", "claude", "bolt"],
    audiences: ["creators", "non-technical", "solo-founders"],
    buildTime: "10",
  },
  "ai-student-support-bot-online-educators": {
    tools: ["cursor", "claude", "bolt"],
    audiences: ["creators", "non-technical", "solo-founders"],
    buildTime: "12",
  },
  "healthsync-personal-health-dashboard": {
    tools: ["cursor", "claude", "replit"],
    audiences: ["solo-founders", "side-hustlers", "non-technical"],
    buildTime: "12",
  },
  "personalized-employee-wellness-platform": {
    tools: ["cursor", "claude", "bolt"],
    audiences: ["small-business-owners", "solo-founders", "marketers"],
    buildTime: "12",
  },
  "ai-tutor-matchmaker": {
    tools: ["cursor", "claude", "lovable"],
    audiences: ["creators", "non-technical", "side-hustlers"],
    buildTime: "12",
  },
  "small-order-wholesale-marketplace": {
    tools: ["cursor", "claude", "no-code"],
    audiences: ["small-business-owners", "creators", "solo-founders"],
    buildTime: "10",
  },
  "workflow-audit-app-for-small-businesses": {
    tools: ["cursor", "claude", "no-code"],
    audiences: ["small-business-owners", "non-technical", "solo-founders"],
    buildTime: "10",
  },
  "shopify-seo-keyword-tool": {
    tools: ["cursor", "claude", "no-code"],
    audiences: ["small-business-owners", "creators", "marketers"],
    buildTime: "12",
  },
};

function uniq(arr) {
  return [...new Set(arr)];
}

function mapAudiences(raw) {
  const out = [];
  const dropped = [];
  for (const a of raw || []) {
    const key = String(a).trim().toLowerCase();
    if (ALLOWED_AUDIENCES.has(key)) {
      out.push(key);
      continue;
    }
    const mapped = AUDIENCE_MAP[key];
    if (mapped && ALLOWED_AUDIENCES.has(mapped)) out.push(mapped);
    else dropped.push(a);
  }
  return { audiences: uniq(out), dropped };
}

function mapTools(raw) {
  const out = [];
  const dropped = [];
  for (const t of raw || []) {
    const key = String(t).trim().toLowerCase();
    const mapped = TOOL_MAP[key];
    if (mapped && ALLOWED_TOOLS.has(mapped)) out.push(mapped);
    else if (ALLOWED_TOOLS.has(key)) out.push(key);
    else dropped.push(t);
  }
  return { tools: uniq(out), dropped };
}

function ensureMinimums(idea) {
  let tools = idea.tools;
  let audiences = idea.audiences;
  // Prefer keeping cursor+claude as the AI-builder baseline when under-tagged.
  if (tools.length < 2) {
    for (const t of ["cursor", "claude", "bolt"]) {
      if (tools.length >= 2) break;
      if (!tools.includes(t)) tools = [...tools, t];
    }
  }
  if (audiences.length < 2) {
    for (const a of ["solo-founders", "weekend-builders", "side-hustlers"]) {
      if (audiences.length >= 2) break;
      if (!audiences.includes(a)) audiences = [...audiences, a];
    }
  }
  return { tools, audiences };
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(manPath, "utf8"));
  const stats = {
    buildTimeChanged: 0,
    audiencesChanged: 0,
    toolsChanged: 0,
    overridesApplied: 0,
    orphanAudiencesDropped: {},
    unknownToolsDropped: {},
  };

  for (const idea of manifest.ideas) {
    const before = {
      buildTime: idea.buildTime,
      tools: [...(idea.tools || [])],
      audiences: [...(idea.audiences || [])],
    };

    // 1. buildTime
    const bt = normalizeBuildTime(idea.buildTime);
    if (String(idea.buildTime) !== bt) stats.buildTimeChanged++;
    idea.buildTime = bt;

    // 2/3. audiences + tools (generic map)
    const { audiences, dropped: droppedAud } = mapAudiences(idea.audiences);
    const { tools, dropped: droppedTools } = mapTools(idea.tools);
    for (const d of droppedAud) {
      stats.orphanAudiencesDropped[d] =
        (stats.orphanAudiencesDropped[d] || 0) + 1;
    }
    for (const d of droppedTools) {
      stats.unknownToolsDropped[d] = (stats.unknownToolsDropped[d] || 0) + 1;
    }
    idea.audiences = audiences;
    idea.tools = tools;

    // 4. explicit overrides for the Aug-12 batch
    const override = RECENT_OVERRIDES[idea.slug];
    if (override) {
      idea.tools = [...override.tools];
      idea.audiences = [...override.audiences];
      idea.buildTime = override.buildTime;
      stats.overridesApplied++;
    }

    // 5. ensure ≥2/≥2
    const ensured = ensureMinimums(idea);
    idea.tools = ensured.tools;
    idea.audiences = ensured.audiences;

    if (JSON.stringify(before.tools) !== JSON.stringify(idea.tools)) {
      stats.toolsChanged++;
    }
    if (JSON.stringify(before.audiences) !== JSON.stringify(idea.audiences)) {
      stats.audiencesChanged++;
    }
  }

  // Report
  console.log("Retag summary:");
  console.log(`  buildTime normalized: ${stats.buildTimeChanged}`);
  console.log(`  tools[] changed:      ${stats.toolsChanged}`);
  console.log(`  audiences[] changed:  ${stats.audiencesChanged}`);
  console.log(`  recent overrides:     ${stats.overridesApplied}`);
  console.log("  orphan audiences dropped/unmapped:");
  for (const [k, v] of Object.entries(stats.orphanAudiencesDropped).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`    ${String(v).padStart(3)}  ${k}`);
  }
  console.log("  unknown tools dropped/unmapped:");
  for (const [k, v] of Object.entries(stats.unknownToolsDropped)) {
    console.log(`    ${String(v).padStart(3)}  ${k}`);
  }

  // Validate
  let fail = 0;
  for (const idea of manifest.ideas) {
    const errors = validateIdea(idea);
    if (errors.length) {
      fail++;
      if (fail <= 15) {
        console.log(`FAIL ${idea.slug}: ${errors.join("; ")}`);
      }
    }
  }
  console.log(
    `\nPost-retag validation: ${manifest.ideas.length - fail}/${manifest.ideas.length} pass`,
  );

  // Hub membership preview
  const weekend = manifest.ideas.filter((i) =>
    ["8", "10", "12"].includes(String(i.buildTime)),
  ).length;
  const eight = manifest.ideas.filter((i) => String(i.buildTime) === "8").length;
  const week = manifest.ideas.filter((i) =>
    ["20", "24", "30", "40"].includes(String(i.buildTime)),
  ).length;
  console.log(
    `Hub preview — build-in-weekend: ${weekend}, build-in-8-hours: ${eight}, build-in-1-week: ${week}`,
  );

  const audCounts = {};
  for (const a of ALLOWED_AUDIENCES) audCounts[a] = 0;
  for (const idea of manifest.ideas) {
    for (const a of idea.audiences) audCounts[a] = (audCounts[a] || 0) + 1;
  }
  console.log("Audience hub counts:");
  for (const [k, v] of Object.entries(audCounts).sort((a, b) => a[1] - b[1])) {
    console.log(`  ${String(v).padStart(4)}  ${k}`);
  }

  if (dryRun) {
    console.log("\n(dry run — pass --apply to write ideas/manifest.json)");
    process.exit(fail ? 1 : 0);
  }

  if (fail) {
    console.error("Refusing to write: validation failures remain.");
    process.exit(1);
  }

  fs.writeFileSync(manPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`\nWrote ${manPath}`);
}

main();
