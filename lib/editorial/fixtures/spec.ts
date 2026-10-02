import type { ClaimKind, ClaimTopic, SourceType } from "../contracts/evidence";
import type { EditorialHighlights, EditorialMetadata } from "../contracts/metadata";
import type { SectionKey } from "../contracts/sections";

/**
 * FICTIONAL DEMO DATA. Every idea, number, quote and source in the fixture
 * set is invented for the local editorial demo. Sources use the reserved
 * `.example` top-level domain so nothing points at a real publisher.
 */
export const FIXTURE_DATA_NOTICE = "Fictional demo data — not research.";

export type SourceSpec = {
  id: string;
  url: string;
  publisher: string | null;
  title: string | null;
  sourceType: SourceType;
  publishedAt: string | null;
  /** Days before the seed time; `null` keeps the retrieval time unknown. */
  retrievedDaysAgo: number | null;
  excerpt: string | null;
  context: string | null;
  verification: "verified" | "unverified" | "unavailable" | "changed" | "provisional";
  verificationReason?: string;
};

export type ClaimSpec = {
  id: string;
  text: string;
  /** Must appear verbatim in the section named below. */
  anchor: string;
  section: SectionKey;
  kind: ClaimKind;
  topic: ClaimTopic;
  material: boolean;
  sourceIds: string[];
  contradictingSourceIds?: string[];
  verification: "verified" | "unverified" | "unavailable" | "changed" | "provisional" | "not_applicable";
  verificationReason?: string;
};

export type ArticleSpec = {
  slug: string;
  title: string;
  buyer: string;
  job: string;
  wedge: string;
  metadata: Omit<EditorialMetadata, "highlights" | "og"> & {
    highlights?: EditorialHighlights | null;
    og?: EditorialMetadata["og"];
  };
  problem: string[];
  solution: string[];
  steps: string[];
  market: string[];
  competitors: { name: string; price: string; positioning: string }[];
  competitionNotes: string[];
  businessModel: string[];
  tiers: { name: string; price: string; includes: string }[];
  stack: string[];
  prompts: { title: string; body: string }[];
  sources: SourceSpec[];
  claims: ClaimSpec[];
};

function table(headers: string[], rows: string[][]): string {
  const line = (cells: string[]) => `| ${cells.join(" | ")} |`;
  return [line(headers), line(headers.map(() => "---")), ...rows.map(line)].join("\n");
}

/** Render a spec in the same shape as `content/ideas/*.mdx`. */
export function buildArticleMarkdown(spec: ArticleSpec): string {
  const parts: string[] = [
    "---",
    `slug: "${spec.slug}"`,
    `title: "${spec.title.replace(/"/g, '\\"')}"`,
    "---",
    "",
    "## The Problem",
    "",
    spec.problem.join("\n\n"),
    "",
    "## The Solution",
    "",
    spec.solution.join("\n\n"),
    "",
    "**How it works:**",
    "",
    spec.steps.map((step, index) => `${index + 1}. ${step}`).join("\n"),
    "",
    "## Market Research",
    "",
    spec.market.join("\n\n"),
    "",
    "## Competitive Landscape",
    "",
    table(
      ["Competitor", "Pricing", "Positioning"],
      spec.competitors.map((competitor) => [competitor.name, competitor.price, competitor.positioning]),
    ),
    "",
    spec.competitionNotes.join("\n\n"),
    "",
    "## Business Model",
    "",
    spec.businessModel.join("\n\n"),
    "",
    table(
      ["Tier", "Price", "Includes"],
      spec.tiers.map((tier) => [tier.name, tier.price, tier.includes]),
    ),
    "",
    "## Recommended Tech Stack",
    "",
    spec.stack.map((item) => `- ${item}`).join("\n"),
    "",
    "## AI Prompts to Build This",
    "",
    spec.prompts.map((prompt) => `### ${prompt.title}\n\n\`\`\`text\n${prompt.body}\n\`\`\``).join("\n\n"),
    "",
    "## Sources",
    "",
    spec.sources
      .filter((source) => source.sourceType !== "search_summary")
      .map((source) => `- [${source.publisher ?? "Source"} — ${source.title ?? source.url}](${source.url})`)
      .join("\n"),
    "",
  ];
  return parts.join("\n");
}
