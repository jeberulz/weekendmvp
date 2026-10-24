// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { describe, expect, test } from "vitest";
import { extractIdea, firstPrice, section } from "../../lib/home/extract";
import { clamp, leadSentences, shortNumber, shortTitle, stackChips, tierName } from "../../lib/home/text";

const body = (slug: string) =>
  matter(readFileSync(path.join(process.cwd(), "content/ideas", `${slug}.mdx`), "utf8")).content;

describe("idea extraction", () => {
  test("reads every homepage field from a real idea page", () => {
    const x = extractIdea(body("freelance-scope-creep-detector"));
    expect(x.problem).toMatch(/^Freelancers rarely lose money/);
    expect(x.how).toEqual([
      "Import the scope baseline",
      "Watch client channels",
      "Flag and price the change",
      "Get approval and payment",
    ]);
    expect(x.competitors.map((c) => c.name)).toEqual(["Bonsai", "Harvest", "HoneyBook", "Dubsado", "FreshBooks"]);
    expect(x.competitors[0].price).toBe("$15–$59/mo");
    expect(x.tiers).toEqual([
      { name: "Free", price: "$0" },
      { name: "Solo", price: "$19/mo" },
      { name: "Pro", price: "$39/mo" },
    ]);
    expect(x.market.length).toBeGreaterThanOrEqual(1);
    expect(x.market[0].value).toMatch(/\d/);
    expect(x.stack.length).toBeGreaterThanOrEqual(3);
    expect(x.prompts.length).toBeGreaterThanOrEqual(3);
    expect(x.prompts[0].title).toBe("Project Setup");
    expect(x.prompts[0].lines[0]).toMatch(/ScopeGuard/);
  });

  test("returns empty fields instead of throwing on a thin body", () => {
    const x = extractIdea("## The Problem\n\nOnly a problem.\n");
    expect(x.problem).toBe("Only a problem.");
    expect(x.how).toEqual([]);
    expect(x.market).toEqual([]);
    expect(x.competitors).toEqual([]);
    expect(x.prompts).toEqual([]);
  });

  test("drops fenced prompt bodies that are empty, undefined, or null", () => {
    const x = extractIdea(`## AI Prompts to Build This

**1. Project Setup**

\`\`\`text
undefined
\`\`\`

**2. Core Feature**

\`\`\`text
Build the actual feature.
\`\`\`

**3. Empty**

\`\`\`text

\`\`\`

**4. Nullish**

\`\`\`text
null
\`\`\`
`);
    expect(x.prompts).toEqual([{ title: "Core Feature", lines: ["Build the actual feature."] }]);
  });

  test("reads titles from the generator '**Title. body**' form", () => {
    const x = extractIdea(`## AI Prompts to Build This

**Project Setup. Scaffold the app with Next.js and Supabase.**

\`\`\`text
Scaffold the app with Next.js and Supabase.
\`\`\`
`);
    expect(x.prompts).toEqual([
      { title: "Project Setup", lines: ["Scaffold the app with Next.js and Supabase."] },
    ]);
  });

  test("brake ideas no longer expose undefined prompt bodies", () => {
    for (const slug of [
      "ai-brake-inspection-analyser",
      "brake-repair-cost-estimator",
      "brake-safety-education-platform",
      "mobile-brake-repair-marketplace",
    ]) {
      const x = extractIdea(body(slug));
      expect(x.prompts.length).toBeGreaterThanOrEqual(3);
      for (const prompt of x.prompts) {
        expect(prompt.lines.join("\n").trim().toLowerCase()).not.toBe("undefined");
        expect(prompt.title).not.toMatch(/^Prompt \d+$/);
      }
    }
  });

  test("section() stops at the next heading", () => {
    expect(section("## A\none\n## B\ntwo\n", "A").trim()).toBe("one");
    expect(section("intro\n## B\ntwo\n", "A")).toBe("");
  });

  test("normalises prices", () => {
    expect(firstPrice("from $15 to $59 per user monthly")).toBe("$15–$59/mo");
    expect(firstPrice("priced at $335 per year for Starter")).toBe("$335/yr");
    expect(firstPrice("starts at $0, then $11")).toBe("$0");
    expect(firstPrice("free for everyone")).toBe("Free");
    expect(firstPrice("contact sales")).toBe("");
  });
});

describe("text helpers", () => {
  test("clamps on a word boundary", () => {
    expect(clamp("one two three four", 10)).toBe("one two…");
    expect(clamp("short", 10)).toBe("short");
  });

  test("keeps abbreviations inside a sentence", () => {
    expect(leadSentences("A decision gets made at 11:47 p.m. Nobody writes it down. Then it is lost.", 2, 200)).toBe(
      "A decision gets made at 11:47 p.m. Nobody writes it down.",
    );
  });

  test("short forms", () => {
    expect(shortTitle("SlackToDoc: Turn Team Chatter Into Organized Knowledge")).toBe("SlackToDoc");
    expect(shortTitle("AI Code Reviewer")).toBe("AI Code Reviewer");
    expect(shortNumber("$15.81 billion")).toBe("$15.81B");
    expect(tierName("Free — Algorithm Health Quiz")).toBe("Free");
    expect(stackChips(["Next.js 14 + Vercel", "Postgres via Supabase", "Claude Sonnet (structured output) or GPT-4o"])).toEqual([
      "Next.js 14",
      "Vercel",
      "Supabase",
      "Claude Sonnet",
    ]);
  });
});
