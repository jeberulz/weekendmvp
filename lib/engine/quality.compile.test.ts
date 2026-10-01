/**
 * Anti-slop guarantees for the idea engine, compiler side: the compiler
 * never breaks links, keeps evidence out of text surgery and computes the
 * revenue math with finance.ts (WP46-S4). The hygiene tests are unchanged
 * from the WP46-S3 split; the v1 Year-One tests are replaced by contract v2
 * equivalents (exact cents, explicit seats, floor(base/2) downside).
 */

import { describe, expect, it } from "vitest";

import { collapseDuplicateSentences, CompileError, midSentence, yearOneLines } from "./compile.ts";
import type { YearOnePlanV2 } from "./evidence/contract.ts";
import type { PricingTier } from "./research-record.ts";

describe("compiler hygiene", () => {
  it("never splits a markdown link when collapsing duplicate sentences", () => {
    const link =
      "[my reviewer was useless until i made it earn the right to comment. what changed](https://www.reddit.com/r/LLMDevs/comments/1v5dveb/x/)";
    const text = [
      `> "quote one"\n>\n> — ${link}`,
      "",
      `See ${link} for the long version of this whole thread today.`,
      "",
      `- ${link}`,
    ].join("\n");
    const out = collapseDuplicateSentences(text);
    expect(out.split(link).length - 1).toBe(3);
  });

  it("still drops a repeated prose sentence", () => {
    const s = "This exact sentence has more than eight words in it.";
    expect(collapseDuplicateSentences(`${s} ${s}`).trim()).toBe(s);
  });

  it("never touches quote lines, even when a quote repeats a prose sentence", () => {
    const s = "Our bot leaves forty comments per PR and nobody reads any of them anymore.";
    const text = `${s}\n\n> "${s}"\n>\n> — [AI review noise](https://forum.example.com/t/ai-review-noise)`;
    expect(collapseDuplicateSentences(text)).toBe(text);
  });

  it("lowercases audience labels mid-sentence but keeps acronyms", () => {
    expect(midSentence("Indie developers and sub-10 teams")).toBe("indie developers and sub-10 teams");
    expect(midSentence("E-commerce marketers")).toBe("e-commerce marketers");
    expect(midSentence("SMB SaaS sales teams")).toBe("SMB SaaS sales teams");
    expect(midSentence("GitHub maintainers")).toBe("GitHub maintainers");
  });
});

const TIERS: PricingTier[] = [
  { name: "Solo", price: "$24.99/month", includes: "One private repository." },
  { name: "Team", price: "$499/month", includes: "Unlimited repositories." },
  { name: "Crew", price: "$20/developer/month", includes: "Shared rules." },
  { name: "Annual", price: "$1,200/year", includes: "Billed once a year." },
];

function plan(tier: string, payingAccounts: number, seatsPerAccount = 1): YearOnePlanV2 {
  return {
    funnel: [
      { stage: "prospects", count: Math.max(200, payingAccounts) },
      { stage: "paying accounts", count: payingAccounts },
    ],
    tier,
    payingAccounts,
    seatsPerAccount,
  };
}

describe("Year-One Math from finance.ts", () => {
  it("computes ARR and the downside instead of trusting prose", () => {
    const out = yearOneLines(plan("Team", 10), TIERS);
    expect(out).toContain("- **10 × $499/mo = $59,880 ARR** — Team accounts paying by month 12");
    expect(out).toContain("- **5 × $499/mo = $29,940 ARR** — downside if the close rate halves (half of 10 accounts)");
  });

  it("keeps cents exactly instead of rounding the ARR", () => {
    const out = yearOneLines(plan("Solo", 10), TIERS);
    expect(out).toContain("**10 × $24.99/mo = $2,998.80 ARR**");
    expect(out).toContain("**5 × $24.99/mo = $1,499.40 ARR**");
    expect(out).not.toContain("$2,999 ARR");
  });

  it("gives a one-account base a zero-account downside (no minimum-one clamp)", () => {
    const out = yearOneLines(plan("Team", 1), TIERS);
    expect(out).toContain("- **1 × $499/mo = $5,988 ARR** — Team accounts paying by month 12");
    expect(out).toContain("- **0 × $499/mo = $0 ARR** — downside if the close rate halves (half of 1 account, rounded down)");
  });

  it("states the seats: a $20/developer/month tier with 5 seats is $100 per account per month", () => {
    const out = yearOneLines(plan("Crew", 45, 5), TIERS);
    expect(out).toContain(
      "- **45 × $100/mo = $54,000 ARR** — Crew accounts paying by month 12 (5 seats × $20/developer/month)",
    );
    expect(out).toContain("- **22 × $100/mo = $26,400 ARR** — downside if the close rate halves (half of 45 accounts, rounded down)");
  });

  it("uses annual prices as annual revenue, with no monthly conversion", () => {
    const out = yearOneLines(plan("Annual", 45), TIERS);
    expect(out).toContain("- **45 × $1,200/yr = $54,000 ARR** — Annual accounts paying by month 12");
    expect(out).toContain("- **22 × $1,200/yr = $26,400 ARR**");
  });

  it("lists the funnel stages before the totals", () => {
    const out = yearOneLines(plan("Team", 10), TIERS);
    expect(out.split("\n").slice(0, 2)).toEqual(["- **200** — prospects", "- **10** — paying accounts"]);
  });

  it("refuses a plan whose tier is not a pricing tier", () => {
    expect(() => yearOneLines(plan("Enterprise", 10), TIERS)).toThrow(CompileError);
  });
});
