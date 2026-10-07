/**
 * Weekend prompt standard v1 (WP61). Pure and dependency-free, so the audit
 * scripts and the tests share it.
 *
 * An idea ships four build prompts: Project Setup, Core Feature, Landing Page
 * and Branding Package. The standard keeps each one runnable in a weekend:
 *
 * - Project Setup is structured (8+ lines), names one auth path and at most
 *   three outside services, declares 3+ tables as `- name(columns)` lines, has
 *   no billing, has a one-line `Do not build:` fence (which may name billing, a
 *   service or a login without counting as using it) and a `Done when:` check.
 * - Every prompt ends with a `Done when:` line.
 * - No prompt pins a Next.js major version, which ages within a year.
 * - Branding Package says to use a design or image tool. A coding agent
 *   cannot draw a logo.
 *
 * `lintPrompts` returns errors (a standard violation) and warnings (worth a
 * look). The backfill gate is zero errors.
 */

export const PROMPT_STANDARD_VERSION = 1;

/** The four titles, in order. Matches `PROMPT_TITLES` in `lib/engine/page-format.ts`. */
export const STANDARD_TITLES = ["Project Setup", "Core Feature", "Landing Page", "Branding Package"];

export const SETUP_MIN_LINES = 8;
export const OTHER_MIN_LINES = 6;
export const SETUP_MAX_SERVICES = 3;
export const SETUP_MIN_TABLES = 3;

/** Tables the idea engine adds to every Setup prompt. They do not count as idea-specific. */
const GENERIC_TABLES = new Set(["workspaces", "members", "usage_events", "documents", "jobs"]);

/** Outside services a prompt can pull in. Hosting (Vercel, Cloudflare) is not counted. */
const SERVICES = [
  ["stripe", /\bstripe\b/i],
  ["clerk", /\bclerk\b/i],
  ["supabase", /\bsupabase\b/i],
  ["firebase", /\bfirebase\b/i],
  ["auth0", /\bauth0\b/i],
  ["resend", /\bresend\b/i],
  ["sendgrid", /\bsendgrid\b/i],
  ["postmark", /\bpostmark\b/i],
  ["mailgun", /\bmailgun\b/i],
  ["twilio", /\btwilio\b/i],
  ["openai", /\bopenai\b/i],
  ["anthropic", /\banthropic\b|\bclaude api\b/i],
  ["plaid", /\bplaid\b/i],
  ["google", /\bgoogle (oauth|calendar|sheets|drive|maps|places|business|analytics|search console)\b/i],
  ["microsoft", /\bmicrosoft (graph|365)\b/i],
  ["slack", /\bslack\b/i],
  ["notion", /\bnotion (api|database)\b/i],
  ["shopify", /\bshopify\b/i],
  ["hubspot", /\bhubspot\b/i],
  ["airtable", /\bairtable\b/i],
  ["zapier", /\bzapier\b/i],
  ["upstash", /\bupstash\b|\bredis\b/i],
  ["pinecone", /\bpinecone\b/i],
  ["algolia", /\balgolia\b/i],
  ["mapbox", /\bmapbox\b/i],
  ["twitter", /\b(twitter|x) api\b/i],
  ["reddit", /\breddit api\b/i],
  ["github", /\bgithub (api|app|oauth)\b/i],
];

/** Two logins in one prompt, or a login that does not work with the database's row rules. */
const AUTH_PROVIDERS = [
  ["clerk", /\bclerk\b/i],
  ["auth0", /\bauth0\b/i],
  ["nextauth", /\bnext-?auth\b|\bauth\.js\b/i],
  ["firebase-auth", /\bfirebase auth/i],
  ["supabase-auth", /\bsupabase\b[^.\n]{0,80}\bauth\b/i],
];

// A bare "checkout" is not billing: Shopify calls an abandoned cart an abandoned checkout.
const BILLING = /\b(stripe|paddle|lemon ?squeezy|billing|subscriptions?|checkout (?:flow|page|session)s?|paid plans?|pricing tiers?|pricing plans?)\b/i;
// Only `Next.js 15` / `nextjs 15`. A bare "next 7 days" is prose, not a pin.
const NEXT_PIN = /\bnext\.?js\s*v?\d+/i;
const DONE_WHEN = /^\s*done when\b/im;
const DO_NOT_BUILD = /^\s*do not build\b/im;
const DESIGN_TOOL_LINE = /design or image tool/i;

const nonEmptyLines = (text) => String(text).split("\n").filter((l) => l.trim() !== "");

/**
 * The text a prompt asks the tool to build. The `Do not build:` line names what
 * is left out, so it must not count as using billing, a service or a login.
 */
export const withoutFence = (text) =>
  String(text)
    .split("\n")
    .filter((line) => !DO_NOT_BUILD.test(line))
    .join("\n");

/** True when a Project Setup prompt asks for billing (its `Do not build:` line does not count). */
export const setupMentionsBilling = (setupText) => BILLING.test(withoutFence(setupText));

/** The prompts section body: after `## AI Prompts to Build This`, up to the next `## `. */
export function promptSection(body) {
  const text = String(body);
  const start = text.search(/(^|\n)## AI Prompts to Build This[ \t]*\n/);
  if (start === -1) return null;
  const rest = text.slice(start).replace(/^\n?## [^\n]*\n/, "");
  const end = rest.search(/\n## /);
  return end === -1 ? rest : rest.slice(0, end);
}

/**
 * Prompt blocks from a section body. Lenient on purpose, so legacy pages parse:
 * a title is the nearest `**N. Title**` or `### Title` line above a fence, and a
 * fence is any ``` block.
 */
export function parsePromptBlocks(section) {
  const text = String(section ?? "");
  const blocks = [];
  const fence = /```[a-zA-Z]*\n([\s\S]*?)```/g;
  let previousEnd = 0;
  let match;
  while ((match = fence.exec(text)) !== null) {
    const gap = text.slice(previousEnd, match.index);
    const titles = [...gap.matchAll(/^\*\*\s*\d+\.\s*([^*\n]+?)\s*:?\*\*\s*$|^###\s+(?:Prompt\s*\d+[:.]?\s*)?(.+?)\s*$/gm)];
    const last = titles.at(-1);
    const title = (last?.[1] ?? last?.[2] ?? "").trim() || `Prompt ${blocks.length + 1}`;
    blocks.push({ title, text: match[1].replace(/\n+$/, "") });
    previousEnd = match.index + match[0].length;
  }
  return blocks;
}

function tableNames(text) {
  return [...String(text).matchAll(/^[^\S\n]*[-*]\s*([a-z][a-z0-9_]*)\s*\(/gm)].map((m) => m[1]);
}

function servicesIn(text) {
  return SERVICES.filter(([, re]) => re.test(text)).map(([name]) => name);
}

/** Lint one idea's prompt blocks against standard v1. */
export function lintPrompts(blocks) {
  const errors = [];
  const warnings = [];
  const error = (code, message) => errors.push({ code, message });
  const warn = (code, message) => warnings.push({ code, message });

  if (blocks.length === 0) {
    error("no-prompts", "no prompt blocks found");
    return { errors, warnings };
  }

  const titles = blocks.map((b) => b.title);
  if (blocks.length !== STANDARD_TITLES.length || STANDARD_TITLES.some((t, i) => titles[i]?.toLowerCase() !== t.toLowerCase())) {
    error("titles", `prompts must be exactly ${STANDARD_TITLES.join(", ")} (got ${titles.join(", ")})`);
  }

  const byTitle = (title) => blocks.find((b) => b.title.toLowerCase() === title.toLowerCase());
  const setup = byTitle("Project Setup");
  const core = byTitle("Core Feature");
  const landing = byTitle("Landing Page");
  const branding = byTitle("Branding Package");

  if (setup) {
    const built = withoutFence(setup.text);
    const lines = nonEmptyLines(setup.text).length;
    if (lines < SETUP_MIN_LINES) error("setup-structure", `Project Setup has ${lines} lines (need ${SETUP_MIN_LINES}+, one idea per line)`);

    if (BILLING.test(built)) error("setup-billing", "Project Setup mentions billing (no billing in prompts)");

    const services = servicesIn(built);
    if (services.length > SETUP_MAX_SERVICES) {
      error("setup-services", `Project Setup names ${services.length} outside services (${services.join(", ")}; max ${SETUP_MAX_SERVICES})`);
    }

    const auth = AUTH_PROVIDERS.filter(([, re]) => re.test(built)).map(([name]) => name);
    if (auth.length > 1) error("setup-auth", `Project Setup names ${auth.length} login providers (${auth.join(", ")}; use one)`);
    if (/\bclerk\b/i.test(built) && /\bsupabase\b/i.test(built)) {
      error("setup-auth-rls", "Project Setup pairs Clerk with Supabase; row rules need the database to trust the login. Use Supabase Auth");
    }

    const tables = tableNames(setup.text).filter((t) => !GENERIC_TABLES.has(t));
    if (tables.length < SETUP_MIN_TABLES) error("setup-tables", `Project Setup declares ${tables.length} table(s) as \`- name(columns)\` lines (need ${SETUP_MIN_TABLES}+)`);

    if (!DO_NOT_BUILD.test(setup.text)) error("setup-fence", "Project Setup needs a `Do not build:` line");
  }

  for (const b of blocks) {
    if (NEXT_PIN.test(b.text)) error("next-pin", `${b.title} pins a Next.js major version (say "Next.js")`);
    if (!DONE_WHEN.test(b.text)) error("done-when", `${b.title} needs a \`Done when:\` line`);
    if (b.text.includes("```")) error("fence", `${b.title} contains a code fence`);
  }

  if (branding) {
    const first = nonEmptyLines(branding.text)[0] ?? "";
    if (!DESIGN_TOOL_LINE.test(first)) error("branding-tool", "Branding Package must open by saying to use a design or image tool");
  } else {
    error("branding-missing", "Branding Package prompt is required");
  }

  for (const [label, block] of [["Core Feature", core], ["Landing Page", landing]]) {
    if (!block) continue;
    const lines = nonEmptyLines(block.text).length;
    if (lines < OTHER_MIN_LINES) warn("short", `${label} has ${lines} lines (aim for ${OTHER_MIN_LINES}+)`);
  }
  if (landing && BILLING.test(landing.text)) warn("landing-billing", "Landing Page mentions billing or checkout (a waitlist is enough)");
  if (core && /\b(stripe|billing|subscriptions?)\b/i.test(core.text)) warn("core-billing", "Core Feature mentions billing: fine only if payments are the product's own function");

  return { errors, warnings };
}

/** Lint an idea's MDX body. A page with no prompts section is an error. */
export function lintIdeaMdx(body) {
  const section = promptSection(body);
  if (section === null) return { errors: [{ code: "no-section", message: "no `## AI Prompts to Build This` section" }], warnings: [], blocks: [] };
  const blocks = parsePromptBlocks(section);
  return { ...lintPrompts(blocks), blocks };
}
