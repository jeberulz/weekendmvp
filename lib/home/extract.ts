/**
 * Pull homepage excerpts out of an idea's MDX body.
 *
 * Idea bodies follow the seven-section contract in `ideas/SECTIONS.md`, so the
 * parts the homepage shows can be read without an LLM. Anything that does not
 * parse comes back empty and the matching tile hides. A curated `highlights`
 * block in the manifest (see `./highlights`) wins over these results.
 */
import type { Competitor, IdeaExtract, MarketStat, Prompt, Tier } from "./types";
import { plainText, splitSentences } from "./text";

/** Body of `## {name}` up to the next `## ` heading, or "" when absent. */
export function section(body: string, name: string): string {
  const start = body.search(new RegExp(`(^|\\n)## ${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n`));
  if (start === -1) return "";
  const rest = body.slice(start).replace(/^\n?## [^\n]*\n/, "");
  const end = rest.search(/\n## /);
  return end === -1 ? rest : rest.slice(0, end);
}

const PRICE_RE =
  /\$[\d,.]+(?:\s*(?:to|-|–)\s*\$[\d,.]+)?(?:\s*(?:per|\/)\s*(?:user\s*|seat\s*)?(?:month|year|mo|yr)|\s*monthly|\s*annually|\s*a month|\s*a year)?/i;

/** First price mentioned in `text`, normalised to "$15–$59/mo" style. */
export function firstPrice(text: string): string {
  const match = text.match(PRICE_RE);
  if (!match) return /\bfree\b/i.test(text) ? "Free" : "";
  let price = match[0];
  price = price.replace(/\s*(?:to|-|–)\s*(?=\$)/, "–");
  price = price.replace(/\s*(?:per|\/)\s*(?:user\s*|seat\s*)?(?:month|mo)\b|\s*monthly|\s*a month/i, "/mo");
  price = price.replace(/\s*(?:per|\/)\s*(?:user\s*|seat\s*)?(?:year|yr)\b|\s*annually|\s*a year/i, "/yr");
  return price.replace(/[.,]+$/, "");
}

const NUMBER_RE = /\$[\d,.]+\s*(?:billion|million|trillion|[BMK]\b)?|[\d,.]+\s*(?:%|million|billion|trillion|x\b)/i;

function marketStats(body: string): MarketStat[] {
  const text = section(body, "Market Research");
  const bullets = [...text.matchAll(/^- (.+)$/gm)].map((m) => plainText(m[1]));
  const candidates = bullets.length > 0 ? bullets : splitSentences(plainText(text));
  const stats: MarketStat[] = [];
  for (const candidate of candidates) {
    const match = candidate.match(NUMBER_RE);
    const value = match?.[0].trim().replace(/[.,]+$/, "");
    if (value && /\d/.test(value)) stats.push({ value, text: candidate.trim() });
    if (stats.length === 3) break;
  }
  return stats;
}

function boldBullets(text: string): { name: string; rest: string }[] {
  return [...text.matchAll(/^- \*\*([^*]+)\*\*\s*[-–—:]?\s*(.*)$/gm)].map((m) => ({
    name: m[1].trim(),
    rest: m[2] ?? "",
  }));
}

function prompts(body: string): Prompt[] {
  const text = section(body, "AI Prompts to Build This");
  const titles = [...text.matchAll(/^\*\*\d+\.\s*([^*]+?)\*\*|^###\s+(?:Prompt\s*\d+[:.]?\s*)?(.+)$/gm)].map(
    (m) => (m[1] ?? m[2] ?? "").trim(),
  );
  const blocks = [...text.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map((m) => m[1].replace(/\n+$/, "").split("\n"));
  return blocks.map((lines, i) => ({ title: titles[i] ?? `Prompt ${i + 1}`, lines }));
}

export function extractIdea(body: string): IdeaExtract {
  const problemParas = section(body, "The Problem")
    .trim()
    .split(/\n{2,}/)
    .filter((p) => p.trim() && !/^[-|>#*]/.test(p.trim()));

  const how = body.includes("**How it works:**") ? body.split("**How it works:**")[1] : "";

  const competitors: Competitor[] = boldBullets(section(body, "Competitive Landscape"))
    .slice(0, 5)
    .map(({ name, rest }) => ({ name, price: firstPrice(rest) }));

  const tiers: Tier[] = [];
  for (const { name, rest } of boldBullets(section(body, "Business Model"))) {
    const price = firstPrice(rest.slice(0, 60));
    if (price) tiers.push({ name, price });
    if (tiers.length === 3) break;
  }

  return {
    problem: problemParas.length > 0 ? plainText(problemParas[0]) : "",
    how: [...how.matchAll(/^\d+\.\s+\*\*([^*]+?)\*\*/gm)].map((m) => m[1].trim()).slice(0, 5),
    market: marketStats(body),
    competitors,
    tiers,
    stack: boldBullets(section(body, "Recommended Tech Stack")).map((b) => b.name).slice(0, 8),
    prompts: prompts(body),
  };
}
