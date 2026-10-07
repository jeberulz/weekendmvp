import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { findTierMismatches } from "../../scripts/lib/idea-quality.mjs";
import { SETUP_MIN_LINES, STANDARD_TITLES, lintIdeaMdx, lintPrompts, parsePromptBlocks, promptSection } from "../../scripts/lib/prompt-standard.mjs";
import { readEnforcedSlugs } from "../../scripts/lib/prompt-standard-enforced.mjs";

type Block = { title: string; text: string };

const setup = [
  'Build the weekend MVP of "Example Tracker": one screen where a freelancer logs an hour and sees the week.',
  "",
  "Stack: Next.js, TypeScript, Tailwind, shadcn/ui, Supabase (Postgres, Row Level Security, Auth with Google sign-in). Deploy on Vercel.",
  "",
  "Tables (Row Level Security on, each user reads only their own rows):",
  "- clients(id, user_id, name, rate_cents)",
  "- entries(id, user_id, client_id, started_at, minutes, note)",
  "- weeks(id, user_id, week_start, total_minutes)",
  "",
  "Screens: /login, /log, /week.",
  "Env vars (names only): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  "",
  "Do not build: billing or plans, teams, an admin area.",
  "Done when: npm run dev starts, you can sign in with Google, and the three tables exist with Row Level Security on.",
].join("\n");

const core = [
  "Build the one core feature: log an hour in two taps.",
  "1. A form with client, minutes and an optional note.",
  "2. Saving writes one row to entries and updates weeks.total_minutes.",
  "3. /week lists the seven days with a total per day.",
  "4. An empty week shows one sentence and the log button.",
  "Return the week as JSON: { days: [{ date, minutes }], total_minutes }.",
  "Done when: you can log three entries and /week shows the right totals.",
].join("\n");

const landing = [
  "Build a one-page landing site for Example Tracker.",
  'Hero: "Know where your week went." One button: Join the waitlist.',
  "Sections: the problem, how it works in three steps, a sample week, a short FAQ.",
  "Waitlist: store the email in a waitlist table. No other service.",
  "Voice: calm and plain.",
  "Done when: the page renders on a phone and a submitted email appears in the waitlist table.",
].join("\n");

const branding = [
  "Use a design or image tool for this one. A coding agent cannot draw a logo.",
  "Wordmark: Example Tracker in a clean sans, readable at 18px.",
  "Colors: ink #111111, paper #FAF8F5, accent #3366FF.",
  "Deliverables: logo, favicon, empty-state illustration, one launch graphic.",
  "Done when: each deliverable is saved in one folder.",
].join("\n");

const good = (): Block[] => [
  { title: "Project Setup", text: setup },
  { title: "Core Feature", text: core },
  { title: "Landing Page", text: landing },
  { title: "Branding Package", text: branding },
];

const codes = (blocks: Block[]) => lintPrompts(blocks).errors.map((e: { code: string }) => e.code);
const without = (title: string) => good().filter((b) => b.title !== title);
const edit = (title: string, fn: (text: string) => string): Block[] => good().map((b) => (b.title === title ? { ...b, text: fn(b.text) } : b));

describe("weekend prompt standard v1", () => {
  test("a compliant set has no errors", () => {
    expect(lintPrompts(good()).errors).toEqual([]);
  });

  test("the four titles, in order, and nothing else", () => {
    expect(STANDARD_TITLES).toEqual(["Project Setup", "Core Feature", "Landing Page", "Branding Package"]);
    expect(codes([...good(), { title: "Extra", text: core }])).toContain("titles");
    expect(codes([good()[1], good()[0], good()[2], good()[3]])).toContain("titles");
    expect(codes(without("Landing Page"))).toContain("titles");
  });

  test("Branding Package is required and opens by naming a design or image tool", () => {
    expect(codes(without("Branding Package"))).toContain("branding-missing");
    expect(codes(edit("Branding Package", (t) => t.replace(/^[^\n]*\n/, "")))).toContain("branding-tool");
  });

  test("Project Setup is structured, one idea per line", () => {
    expect(codes(edit("Project Setup", (t) => t.split("\n").filter((l) => l.trim()).join(" ")))).toContain("setup-structure");
    expect(SETUP_MIN_LINES).toBe(8);
  });

  test("no billing in Project Setup", () => {
    for (const word of ["Stripe", "billing", "subscriptions", "a checkout page", "a checkout flow", "paid plans", "pricing tiers"]) {
      expect(codes(edit("Project Setup", (t) => `${t}\nAlso add ${word}.`)), word).toContain("setup-billing");
    }
  });

  test("a bare 'checkout' is not billing (Shopify calls an abandoned cart an abandoned checkout)", () => {
    expect(codes(edit("Project Setup", (t) => `${t}\nDone when: a test abandoned checkout is stored.`))).not.toContain("setup-billing");
  });

  test("at most three outside services, one login, and no Clerk with Supabase", () => {
    expect(codes(edit("Project Setup", (t) => `${t}\nUse Resend, Twilio and OpenAI too.`))).toContain("setup-services");
    expect(codes(edit("Project Setup", (t) => `${t}\nSign in with Clerk.`))).toEqual(expect.arrayContaining(["setup-auth-rls"]));
    expect(codes(edit("Project Setup", (t) => `${t}\nAlso Auth0.`))).toContain("setup-auth");
  });

  test("a product named Catalog Clerk is not the Clerk login", () => {
    const named = edit("Project Setup", (t) => t.replace("Example Tracker", "Catalog Clerk"));
    expect(codes(named)).not.toContain("setup-auth");
    expect(codes(named)).not.toContain("setup-auth-rls");
    expect(codes(edit("Project Setup", (t) => `${t}\nUse Catalog Clerk and also sign in with Clerk.`))).toContain("setup-auth-rls");
  });

  test("three tables declared as `- name(columns)` lines, not counting the engine's generic ones", () => {
    expect(codes(edit("Project Setup", (t) => t.replace(/^- weeks\(.*\n/m, "")))).toContain("setup-tables");
    const generic = edit("Project Setup", (t) => t.replace(/^- (clients|weeks)\(/gm, "- members(").replace(/^- entries\(/m, "- workspaces("));
    expect(codes(generic)).toContain("setup-tables");
  });

  test("Project Setup fences scope with a `Do not build:` line", () => {
    expect(codes(edit("Project Setup", (t) => t.replace(/^Do not build:.*\n/m, "")))).toContain("setup-fence");
  });

  test("every prompt has a `Done when:` line", () => {
    for (const title of STANDARD_TITLES) {
      const broken = edit(title, (t) => t.replace(/^Done when:.*$/m, ""));
      expect(lintPrompts(broken).errors.filter((e: { code: string; message: string }) => e.code === "done-when" && e.message.startsWith(title))).toHaveLength(1);
    }
  });

  test("no prompt pins a Next.js major version", () => {
    for (const pin of ["Next.js 14", "Next.js 15", "nextjs 15", "Next.js v16"]) {
      expect(codes(edit("Core Feature", (t) => `${t}\nUse ${pin}.`)), pin).toContain("next-pin");
    }
    expect(codes(edit("Core Feature", (t) => `${t}\nUse Next.js.`))).not.toContain("next-pin");
    // Prose about "next" is not a version.
    expect(codes(edit("Core Feature", (t) => `${t}\nShow the next 7 days and the next 2 steps.`))).not.toContain("next-pin");
  });

  test("a prompt cannot hold a code fence, which would end its block early", () => {
    expect(codes(edit("Core Feature", (t) => `${t}\n\`\`\`js`))).toContain("fence");
  });

  test("short Core Feature and Landing Page prompts are warnings, not errors", () => {
    const short = edit("Core Feature", () => "Build it.\nDone when: it works.");
    expect(lintPrompts(short).errors.filter((e: { code: string }) => e.code !== "done-when")).toEqual([]);
    expect(lintPrompts(short).warnings.map((w: { code: string }) => w.code)).toContain("short");
  });

  test("an empty set is one clear error", () => {
    expect(lintPrompts([]).errors.map((e: { code: string }) => e.code)).toEqual(["no-prompts"]);
  });
});

describe("reading prompts from a page", () => {
  const page = (blocks: Block[]) =>
    `## The Problem\n\ntext\n\n## AI Prompts to Build This\n\nCopy and paste these.\n\n${blocks
      .map((b, i) => `**${i + 1}. ${b.title}**\n\n\`\`\`text\n${b.text}\n\`\`\`\n`)
      .join("\n")}\n## Sources\n\n- [x](https://example.com)\n`;

  test("a compliant page lints clean", () => {
    expect(lintIdeaMdx(page(good())).errors).toEqual([]);
  });

  test("the section stops at the next heading", () => {
    expect(promptSection(page(good()))).not.toContain("Sources");
  });

  test("a page with no prompts section is an error", () => {
    expect(lintIdeaMdx("## The Problem\n\ntext\n").errors[0].code).toBe("no-section");
  });

  test("legacy headings and fences still parse", () => {
    const legacy = "### Prompt 1: Project Setup\n\n```md\nBuild it.\n```\n\n**2. Core Feature**\n\n```text\nMore.\n```\n";
    expect(parsePromptBlocks(legacy).map((b: Block) => b.title)).toEqual(["Project Setup", "Core Feature"]);
    expect(parsePromptBlocks("```text\nNo title.\n```").map((b: Block) => b.title)).toEqual(["Prompt 1"]);
  });
});

describe("tier names in Project Setup (relaxed by WP61)", () => {
  const business = "- **Personal** ($9/mo) — a\n- **Team** ($49/seat/mo) — b\n";
  test("a Setup with no billing owes no tier names", () => {
    expect(findTierMismatches(business, `**1. Project Setup**\n\n\`\`\`text\n${setup}\n\`\`\`\n`)).toEqual([]);
  });
  test("a Setup that mentions billing must still name the tiers", () => {
    const withBilling = `**1. Project Setup**\n\n\`\`\`text\n${setup}\nAdd Stripe.\n\`\`\`\n`;
    expect(findTierMismatches(business, withBilling).length).toBeGreaterThan(0);
  });
});

describe("the ratchet: every idea on ideas/prompt-standard.json keeps passing", () => {
  const root = process.cwd();
  const enforced: Set<string> = readEnforcedSlugs(root);

  test("the list is sorted and has no duplicates", () => {
    const list = JSON.parse(readFileSync(path.join(root, "ideas/prompt-standard.json"), "utf8")).enforced as string[];
    expect(list).toEqual([...new Set(list)].sort());
  });

  test("each enforced idea exists, is live, and passes the standard", () => {
    const manifest = JSON.parse(readFileSync(path.join(root, "ideas/manifest.json"), "utf8")).ideas as { slug: string; _retiredAt?: string }[];
    const live = new Set(manifest.filter((i) => !i._retiredAt).map((i) => i.slug));
    for (const slug of enforced) {
      expect(live.has(slug), `${slug} is not a live idea`).toBe(true);
      const body = readFileSync(path.join(root, "content/ideas", `${slug}.mdx`), "utf8");
      expect(lintIdeaMdx(body).errors, slug).toEqual([]);
    }
  });
});
