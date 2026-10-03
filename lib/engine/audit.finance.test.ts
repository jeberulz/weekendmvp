/**
 * Final-artifact Year-One Math audit (WP54-S4, review finding F6; plan §9;
 * ruling R10 for totals outside Business Model and the tier/unit rows).
 *
 * The auditor recomputes the plan with finance.ts from the v2 record and
 * compares the DISPLAYED accounts, per-account price, period, ARR, tier,
 * seats, downside and funnel with it. Business Model holds exactly one base
 * and one downside line; no section states another ARR/MRR/revenue total or
 * a Year-One-style computation; pricing tier rows and unit-economics values
 * print the record's proposals exactly.
 */

import { afterEach, describe, expect, it } from "vitest";

import { auditPage, cleanupTempDirs, compiledPage, pageBody, replaceOnce } from "./__fixtures__/auditHarness.ts";
import { buildFixtureRecord, withEditorial } from "./__fixtures__/recordV2.ts";
import { auditEngineArtifact } from "./artifact-audit.ts";
import type { YearOnePlanV2 } from "./evidence/contract.ts";
import { computeYearOne, yearOneTierTerms } from "./finance.ts";
import { parseYearOneLine } from "./page-format.ts";

afterEach(cleanupTempDirs);

const BASE = "- **45 × $100/mo = $54,000 ARR** — Crew accounts paying by month 12 (5 seats × $20/developer/month)";
const DOWNSIDE = "- **22 × $100/mo = $26,400 ARR** — downside if the close rate halves (half of 45 accounts, rounded down)";

function errorsOf(result: { errors: string[] }): string {
  return result.errors.join("\n");
}

function planOf(funnelLast: number, tier: string, seats = 1): YearOnePlanV2 {
  return {
    funnel: [
      { stage: "GitHub Marketplace and outreach visitors", count: 1200 },
      { stage: "Private-repository trials", count: Math.max(120, funnelLast) },
      { stage: "Paying accounts", count: funnelLast },
    ],
    tier,
    payingAccounts: funnelLast,
    seatsPerAccount: seats,
  };
}

describe("Year-One Math against finance.ts (F6)", () => {
  it.each(["(billed annually)", "(billed monthly)"])("audits its own compiled seat price with %s", async (qualifier) => {
    const record = buildFixtureRecord((r) => {
      const crew = r.editorial?.pricingTiers?.find((tier) => tier.name === "Crew");
      if (!crew) throw new Error("fixture: Crew tier missing");
      crew.price = `$20/developer/month ${qualifier}`;
    });
    const page = compiledPage(record);
    expect(page).toContain(`5 seats × $20/developer/month ${qualifier}`);
    expect((await auditPage(page, record)).errors).toEqual([]);
  });

  it("45 × $100/month is $54,000 ARR with a downside of 22 × $100 × 12 = $26,400, and the page passes", async () => {
    const record = buildFixtureRecord();
    const tiers = record.editorial?.pricingTiers ?? [];
    const resolved = yearOneTierTerms("Crew", tiers);
    if (!resolved.ok || !record.editorial?.yearOne) throw new Error("fixture: Crew tier missing");
    expect(computeYearOne(record.editorial.yearOne, resolved.terms)).toMatchObject({
      baseAccounts: 45,
      perAccountCents: 100_00,
      arrCents: 54_000_00,
      downsideAccounts: 22,
      downsideArrCents: 26_400_00,
    });
    const page = compiledPage(record);
    expect(page).toContain(BASE);
    expect(page).toContain(DOWNSIDE);
    expect((await auditPage(page, record)).errors).toEqual([]);
  });

  it("keeps cents exactly for a $24.99/month tier", async () => {
    const record = buildFixtureRecord(
      withEditorial({
        pricingTiers: [
          { name: "Starter", price: "$24.99/month", includes: "One private repository." },
          { name: "Crew", price: "$20/developer/month", includes: "Shared rules." },
        ],
        yearOne: planOf(10, "Starter"),
      }),
    );
    const page = compiledPage(record);
    expect(page).toContain("- **10 × $24.99/mo = $2,998.80 ARR** — Starter accounts paying by month 12\n");
    expect(page).toContain("- **5 × $24.99/mo = $1,499.40 ARR** — downside if the close rate halves (half of 10 accounts)");
    expect((await auditPage(page, record)).errors).toEqual([]);
    const rounded = replaceOnce(page, "$2,998.80 ARR", "$2,999 ARR");
    expect(errorsOf(await auditPage(rounded, record))).toMatch(
      /Year-One Math shows \$2,999 ARR; the record computes 10 × \$24\.99\/mo = \$2,998\.80 ARR/,
    );
  });

  it("fails an ARR changed to $5,400,000", async () => {
    const page = replaceOnce(compiledPage(), "= $54,000 ARR**", "= $5,400,000 ARR**");
    expect(errorsOf(await auditPage(page))).toContain(
      "Year-One Math shows $5,400,000 ARR; the record computes 45 × $100/mo = $54,000 ARR",
    );
  });

  it("fails each independent mutation of accounts, price, period, tier and downside", async () => {
    const cases: Array<[string, string, RegExp]> = [
      [BASE, BASE.replace("**45 ×", "**46 ×"), /Year-One Math shows 46 paying accounts; the record's plan has 45/],
      [BASE, BASE.replace("× $100/mo", "× $120/mo"), /Year-One Math shows \$120\/mo per account; the record computes \$100\/mo \(Crew at \$20\/developer\/month × 5 seats\)/],
      [BASE, BASE.replace("$100/mo", "$100/yr"), /Year-One Math prices accounts per year; the Crew tier is priced per month/],
      [BASE, BASE.replace("— Crew accounts", "— Solo accounts"), /Year-One Math lands on tier "Solo"; the record's plan uses "Crew"/],
      [DOWNSIDE, DOWNSIDE.replace("**22 ×", "**23 ×"), /Year-One Math downside shows 23 × \$100\/mo = \$26,400 ARR; the record computes 22 × \$100\/mo = \$26,400 ARR/],
      [DOWNSIDE, DOWNSIDE.replace("$26,400", "$27,000"), /Year-One Math downside shows 22 × \$100\/mo = \$27,000 ARR; the record computes 22 × \$100\/mo = \$26,400 ARR/],
      [DOWNSIDE, DOWNSIDE.replace("half of 45", "half of 50"), /downside says half of 50 accounts; the plan has 45/],
      ["- **1,200** — GitHub", "- **12,000** — GitHub", /Year-One funnel shows \[12000, 120, 45\]; the record's funnel is \[1200, 120, 45\]/],
    ];
    for (const [from, to, expected] of cases) {
      const page = replaceOnce(compiledPage(), from, to);
      expect(errorsOf(await auditPage(page)), to).toMatch(expected);
    }
  });

  it("renders a zero-account downside for a one-account base, and the page passes", async () => {
    const record = buildFixtureRecord(withEditorial({ yearOne: planOf(1, "Crew", 5) }));
    const page = compiledPage(record);
    expect(page).toContain("- **1 × $100/mo = $1,200 ARR** — Crew accounts paying by month 12 (5 seats × $20/developer/month)");
    expect(page).toContain("- **0 × $100/mo = $0 ARR** — downside if the close rate halves (half of 1 account, rounded down)");
    expect((await auditPage(page, record)).errors).toEqual([]);
    const clamped = replaceOnce(page, "**0 × $100/mo = $0 ARR**", "**1 × $100/mo = $1,200 ARR**");
    expect(errorsOf(await auditPage(clamped, record))).toMatch(/downside shows 1 × \$100\/mo = \$1,200 ARR; the record computes 0 × \$100\/mo = \$0 ARR/);
  });

  it("resolves a $20/developer/month tier with 5 seats to $100 per account per month", () => {
    const line = parseYearOneLine("45 × $100/mo = $54,000 ARR — Crew accounts paying by month 12 (5 seats × $20/developer/month)");
    expect(line).toEqual({
      kind: "base",
      accounts: 45,
      perAccountCents: 100_00,
      period: "month",
      arrCents: 54_000_00,
      tier: "Crew",
      seats: { count: 5, priceText: "$20/developer/month" },
    });
  });

  it("fails inconsistent revenue per account: wrong seat price, seat count or a missing seat note", async () => {
    const cases: Array<[string, RegExp]> = [
      [BASE.replace("× $20/developer/month)", "× $24/developer/month)"), /seat price "\$24\/developer\/month" is not the Crew tier price \(\$20\/developer\/month\); revenue per account is inconsistent/],
      [BASE.replace("(5 seats", "(6 seats"), /Year-One Math states 6 seats per account; the record's plan has 5/],
      [BASE.replace(" (5 seats × $20/developer/month)", ""), /Year-One Math must state the 5 seats per account behind \$100\/mo/],
    ];
    for (const [to, expected] of cases) {
      const page = replaceOnce(compiledPage(), BASE, to);
      expect(errorsOf(await auditPage(page)), to).toMatch(expected);
    }
  });

  it("passes the formatting variations the renderer supports", async () => {
    const page = replaceOnce(
      replaceOnce(compiledPage(), BASE, "- 45 x $100 / month = $54,000.00 ARR - Crew accounts paying by month 12 (5 seats x $20/developer/month)."),
      DOWNSIDE,
      "- **22 * $100/mo = $26400 ARR** – downside if the close rate halves",
    );
    expect((await auditPage(page)).errors).toEqual([]);
  });

  it("uses annual tier prices as annual revenue", async () => {
    const record = buildFixtureRecord(
      withEditorial({
        pricingTiers: [
          { name: "Annual", price: "$1,200/year", includes: "Billed once a year." },
          { name: "Crew", price: "$20/developer/month", includes: "Shared rules." },
        ],
        yearOne: planOf(45, "Annual"),
      }),
    );
    const page = compiledPage(record);
    expect(page).toContain("- **45 × $1,200/yr = $54,000 ARR** — Annual accounts paying by month 12\n");
    expect((await auditPage(page, record)).errors).toEqual([]);
  });

  it("fails duplicate or conflicting revenue totals in Business Model", async () => {
    const duplicated = replaceOnce(compiledPage(), BASE, `${BASE}\n${BASE}`);
    expect(errorsOf(await auditPage(duplicated))).toMatch(/Year-One Math has 2 base ARR lines; exactly one is allowed/);

    const twoDownsides = replaceOnce(compiledPage(), DOWNSIDE, `${DOWNSIDE}\n${DOWNSIDE}`);
    expect(errorsOf(await auditPage(twoDownsides))).toMatch(/Year-One Math has 2 downside lines; exactly one is allowed/);

    for (const extra of [
      "- **$54,000 ARR target** — month-12 goal",
      "- **$4,500 MRR** — month-12 run rate",
      "- **$4.5k MRR** — month-12 run rate",
      "- **ARR of $60,000** — stretch goal",
    ]) {
      const page = replaceOnce(compiledPage(), "- **5 developers** — Paid developers", `${extra}\n- **5 developers** — Paid developers`);
      expect(errorsOf(await auditPage(page)), extra).toMatch(/Business Model states another revenue total at line \d+/);
    }
  });

  it("does not mistake a tier that mentions ARR near its price for a revenue total", async () => {
    // Through the record: since ruling R10 a tier row prints the record's tier
    // exactly, so a hand edit of the row now fails (see the tier-row tests).
    const record = buildFixtureRecord((r) => {
      const solo = r.editorial?.pricingTiers?.find((t) => t.name === "Solo");
      if (!solo) throw new Error("fixture: Solo tier missing");
      solo.includes = "ARR and churn dashboards, one private repository for an individual developer.";
    });
    const page = compiledPage(record);
    expect(page).toContain("- **Solo** ($12/month) — ARR and churn dashboards, one private repository");
    expect((await auditPage(page, record)).errors).toEqual([]);
  });

  it("fails a missing base line or downside line", async () => {
    expect(errorsOf(await auditPage(replaceOnce(compiledPage(), `${BASE}\n`, "")))).toMatch(/Year-One Math is missing its computed ARR line/);
    expect(errorsOf(await auditPage(replaceOnce(compiledPage(), `${DOWNSIDE}\n`, "")))).toMatch(/Year-One Math is missing its downside case/);
  });
});

describe("revenue totals and Year-One computations outside Year-One Math (R10, P2-7)", () => {
  const PLANNING = "Planning estimates to verify, not measured results:";

  it("fails a money amount beside revenue wording, with or without ARR/MRR or a currency sign (Y2, Y3)", async () => {
    for (const line of [
      "At this pace SignalPass reaches $5.4 million in annual revenue by month twelve.",
      "Target ARR: 5,400,000 USD by month twelve.",
      "The plan reaches an annual run-rate of $250,000 once the seats fill.",
    ]) {
      const page = replaceOnce(compiledPage(), PLANNING, `${line}\n\n${PLANNING}`);
      expect(errorsOf(await auditPage(page)), line).toMatch(
        /Business Model states another revenue total at line \d+ .*only the Year-One Math base and downside lines may state ARR, MRR or revenue totals/,
      );
    }
  });

  it("still flags another Business Model revenue total when the record is missing (record-independent)", () => {
    const page = replaceOnce(compiledPage(), PLANNING, `Target ARR: $5,400,000 by month twelve.\n\n${PLANNING}`);
    expect(auditEngineArtifact(pageBody(page), null).errors.join("\n")).toMatch(/Business Model states another revenue total at line \d+/);
    expect(auditEngineArtifact(pageBody(compiledPage()), null).errors).toEqual([]);
  });

  it("fails a revenue total in another section", async () => {
    const page = replaceOnce(
      compiledPage(),
      "Everything else stays out of the thread.",
      "Everything else stays out of the thread. Teams like this add up to $54,000 ARR quickly.",
    );
    expect(errorsOf(await auditPage(page))).toMatch(/The Solution states another revenue total at line \d+/);
  });

  it("fails a Year-One-style line outside Year-One Math, in prose or in a build prompt (Y4)", async () => {
    const solution = replaceOnce(
      compiledPage(),
      "**How it works:**",
      "- **150 × $100/mo = $180,000 ARR** — Crew accounts paying by month 12\n\n**How it works:**",
    );
    expect(errorsOf(await auditPage(solution))).toMatch(/The Solution: a Year-One-style computation at line \d+ .* outside Year-One Math/);
    const prompt = replaceOnce(compiledPage(), "Persist state between screens", "Revenue check: 45 × $100/mo = $54,000. Persist state between screens");
    expect(errorsOf(await auditPage(prompt))).toMatch(/AI Prompts to Build This: a Year-One-style computation at line \d+/);
  });
});

describe("pricing tier and unit-economics rows print the record (R10, P2-7)", () => {
  it("fails a displayed tier price, include or name that is not the record's (Y5)", async () => {
    const cases: Array<[string, string, RegExp]> = [
      ["- **Crew** ($20/developer/month)", "- **Crew** ($16/developer/month)", /pricing tier row "Crew" at line \d+ shows "Crew \(\$16\/developer\/month\) — .*"; the record's tier reads "Crew \(\$20\/developer\/month\) — /],
      ["— One private repository for an individual developer", "— Two private repositories for an individual developer", /pricing tier row "Solo" at line \d+ shows/],
      ["- **Solo** ($12/month)", "- **Starter** ($12/month)", /pricing tier row "Starter" at line \d+ is not one of the record's pricing tiers \(Open Source, Solo, Crew\)/],
    ];
    for (const [from, to, expected] of cases) {
      const page = replaceOnce(compiledPage(), from, to);
      expect(errorsOf(await auditPage(page)), to).toMatch(expected);
    }
    const missing = replaceOnce(compiledPage(), "- **Open Source** (Free) — Unlimited public repositories, the full review summary and community support.\n", "");
    expect(errorsOf(await auditPage(missing))).toContain('Business Model has no row for the record\'s pricing tier "Open Source"');
  });

  it("fails a unit-economics value that is not the record's", async () => {
    const page = replaceOnce(compiledPage(), "- **80% gross margin**", "- **95% gross margin**");
    expect(errorsOf(await auditPage(page))).toMatch(
      /unit economics row 2 at line \d+ shows "95% gross margin"; the record's value is "80% gross margin"/,
    );
  });
});
