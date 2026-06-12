/**
 * Display metadata for idea taxonomy slugs (categories, revenue goals,
 * tools, audiences) + the legacy section-id mapping used by both the light
 * MDX component map (h2 ids) and the sidebar TOC builder.
 *
 * Names/icons mirror ideas/manifest.json reference tables (the seed source
 * of truth until U14). Kept as static maps because the manifest is not
 * consumed at runtime by the Next.js app.
 */

import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Building2,
  Cloud,
  Code,
  GraduationCap,
  HeartPulse,
  ShoppingCart,
  Sparkles,
  Store,
  Video,
  Wallet,
  Zap,
} from "lucide-react";

export const CATEGORY_META: Record<string, { name: string; icon: LucideIcon }> =
  {
    saas: { name: "SaaS", icon: Cloud },
    productivity: { name: "Productivity", icon: Zap },
    health: { name: "Health & Wellness", icon: HeartPulse },
    marketplace: { name: "Marketplace", icon: Store },
    "ai-tools": { name: "AI Tools", icon: Sparkles },
    automation: { name: "Automation", icon: Bot },
    education: { name: "Education", icon: GraduationCap },
    b2b: { name: "B2B", icon: Building2 },
    "developer-tools": { name: "Developer Tools", icon: Code },
    ecommerce: { name: "E-commerce", icon: ShoppingCart },
    "creator-tools": { name: "Creator Tools", icon: Video },
    fintech: { name: "Fintech", icon: Wallet },
  };

export const REVENUE_NAMES: Record<string, string> = {
  "1k-month": "$1K/Month",
  "5k-month": "$5K/Month",
  "10k-month": "$10K/Month",
  "passive-income": "Passive Income",
  "quick-wins": "Quick Wins",
};

export const TOOL_NAMES: Record<string, string> = {
  claude: "Claude",
  cursor: "Cursor",
  windsurf: "Windsurf",
  replit: "Replit",
  bolt: "Bolt.new",
  lovable: "Lovable",
  v0: "v0",
  "no-code": "No-Code",
};

export const AUDIENCE_NAMES: Record<string, string> = {
  developers: "Developers",
  designers: "Designers",
  "non-technical": "Non-Technical",
  "solo-founders": "Solo Founders",
  "weekend-builders": "Weekend Builders",
  "side-hustlers": "Side Hustlers",
};

/** "developer-tools" → "Developer Tools" fallback for unmapped slugs. */
export function humanizeSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function categoryName(slug: string): string {
  return CATEGORY_META[slug]?.name ?? humanizeSlug(slug);
}

export function revenueName(slug: string): string {
  return REVENUE_NAMES[slug] ?? humanizeSlug(slug);
}

export function toolName(slug: string): string {
  return TOOL_NAMES[slug] ?? humanizeSlug(slug);
}

export function audienceName(slug: string): string {
  return AUDIENCE_NAMES[slug] ?? humanizeSlug(slug);
}

/* ------------------------------------------------------------------ */
/* Section ids — match the legacy idea-page anchor ids so deep links   */
/* into published pages keep working post-migration.                   */
/* ------------------------------------------------------------------ */

const LEGACY_SECTION_IDS: Record<string, string> = {
  "the problem": "section-problem",
  "the solution": "section-solution",
  "market research": "section-market",
  "competitive landscape": "section-competitive",
  "business model": "section-business",
  "recommended tech stack": "section-tech",
  "ai prompts to build this": "section-prompts",
  sources: "section-sources",
};

/** Short sidebar labels matching the legacy template's TOC. */
const SECTION_LABELS: Record<string, string> = {
  "the problem": "The Problem",
  "the solution": "The Solution",
  "market research": "Market Research",
  "competitive landscape": "Competitive Landscape",
  "business model": "Business Model",
  "recommended tech stack": "Tech Stack",
  "ai prompts to build this": "AI Build Prompts",
  sources: "Sources",
};

/** Legacy sidebar grouping: Overview vs Build Details. */
const OVERVIEW_SECTIONS = new Set([
  "the problem",
  "the solution",
  "market research",
  "competitive landscape",
]);

export function ideaHeadingId(heading: string): string {
  const key = heading.trim().toLowerCase();
  if (LEGACY_SECTION_IDS[key]) return LEGACY_SECTION_IDS[key];
  return (
    "section-" +
    key
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );
}

export type TocSection = {
  id: string;
  label: string;
  group: "overview" | "build";
};

/** Build the sidebar TOC from the raw markdown's `## ` headings. */
export function tocFromMarkdown(markdown: string): TocSection[] {
  const sections: TocSection[] = [];
  for (const match of markdown.matchAll(/^##\s+(.+?)\s*$/gm)) {
    const heading = match[1];
    const key = heading.trim().toLowerCase();
    sections.push({
      id: ideaHeadingId(heading),
      label: SECTION_LABELS[key] ?? heading,
      group: OVERVIEW_SECTIONS.has(key) ? "overview" : "build",
    });
  }
  return sections;
}
