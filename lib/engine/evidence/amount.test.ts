import { describe, expect, it } from "vitest";

import {
  amountToCents,
  amountsEqual,
  clauseAround,
  comparePriceTerms,
  findAmounts,
  findPriceExpressions,
  formatAmount,
  formatPriceTerms,
  hasProjectionCue,
  parseAmount,
  parsePriceTerms,
  priceToCents,
  sentenceAround,
  splitSentences,
} from "./amount.ts";
import type { Amount, PriceTerms } from "./contract.ts";

const usd = (value: string, magnitude: Amount["magnitude"] = "none"): Amount => ({
  value,
  magnitude,
  unit: "currency",
  currency: "USD",
});

function must<T>(value: T | null): T {
  if (value === null) throw new Error("expected a value");
  return value;
}

const price = (text: string) => {
  const terms = parsePriceTerms(text);
  return terms ? formatPriceTerms(terms) : null;
};

describe("parseAmount: currencies", () => {
  it("reads every supported currency prefix and ISO suffix", () => {
    const cases: Array<[string, Amount["currency"]]> = [
      ["$30", "USD"],
      ["US$30", "USD"],
      ["USD 30", "USD"],
      ["USD30", "USD"],
      ["30 USD", "USD"],
      ["€30", "EUR"],
      ["EUR 30", "EUR"],
      ["30 EUR", "EUR"],
      ["£30", "GBP"],
      ["GBP 30", "GBP"],
      ["C$30", "CAD"],
      ["CA$30", "CAD"],
      ["CAD 30", "CAD"],
      ["$30 CAD", "CAD"],
      ["A$30", "AUD"],
      ["AU$30", "AUD"],
      ["30 AUD", "AUD"],
    ];
    for (const [text, currency] of cases) {
      expect(parseAmount(text), text).toEqual({ value: "30", magnitude: "none", unit: "currency", currency });
    }
  });

  it("rejects unsupported or contradictory currencies", () => {
    for (const text of ["NZ$30", "R$ 30", "HK$30", "¥3000", "₹500", "CHF 30", "30 CHF", "€30 USD", "US$30 CAD", "$30 EUR"]) {
      expect(parseAmount(text), text).toBeNull();
    }
  });

  it("reads separators, decimals and every magnitude spelling", () => {
    expect(parseAmount("$1,400,000")).toEqual(usd("1400000"));
    expect(parseAmount("$1400000")).toEqual(usd("1400000"));
    expect(parseAmount("$24.99")).toEqual(usd("24.99"));
    const magnitudes: Array<[string, Amount["magnitude"]]> = [
      ["$5k", "thousand"],
      ["$5K", "thousand"],
      ["$5 thousand", "thousand"],
      ["$5m", "million"],
      ["$5M", "million"],
      ["$5mn", "million"],
      ["$5 MM", "million"],
      ["$5 million", "million"],
      ["$5b", "billion"],
      ["$5B", "billion"],
      ["$5bn", "billion"],
      ["$5 billion", "billion"],
      ["$5t", "trillion"],
      ["$5T", "trillion"],
      ["$5tn", "trillion"],
      ["$5 trillion", "trillion"],
    ];
    for (const [text, magnitude] of magnitudes) {
      expect(parseAmount(text), text).toEqual(usd("5", magnitude));
    }
  });

  it("rejects malformed and ambiguous numbers", () => {
    for (const text of ["$1,40,000", "€1.400.000", "$1,4 million", "$ .99", "$1.4 M", "$30mo", "$5kg", "$5%"]) {
      expect(parseAmount(text), text).toBeNull();
    }
  });
});

describe("parseAmount: percents, counts and years", () => {
  it("reads percents", () => {
    for (const text of ["20.2%", "20.2 %", "20.2 percent", "20.2 per cent"]) {
      expect(parseAmount(text), text).toEqual({ value: "20.2", magnitude: "none", unit: "percent" });
    }
  });

  it("reads counts with a noun and up to two modifiers", () => {
    expect(parseAmount("4.2 million users")).toEqual({ value: "4.2", magnitude: "million", unit: "count" });
    expect(parseAmount("10,000 paying customers")).toEqual({ value: "10000", magnitude: "none", unit: "count" });
    expect(parseAmount("2.5M monthly active users")).toEqual({ value: "2.5", magnitude: "million", unit: "count" });
    expect(parseAmount("2,000 developers")).toEqual({ value: "2000", magnitude: "none", unit: "count" });
  });

  it("never reads a bare year (or a bare number) as an amount", () => {
    for (const text of ["2024", "in 2024", "Published in 2024", "2024 users", "By 2030 companies will", "1.4 billion", "47", "1,400"]) {
      expect(parseAmount(text), text).toBeNull();
    }
    expect(parseAmount("$2024 billion")).toEqual(usd("2024", "billion"));
  });

  it("rejects ranges, bounds and negatives", () => {
    for (const text of [
      "$20-$30",
      "$20 – $30",
      "$20–30",
      "20-30%",
      "$20 to $30",
      "between $1M and $2M",
      "up to $30",
      "as much as 40%",
      "more than 10,000 developers",
      "over $1 billion",
      "at least 5%",
      "< $5",
      "1M+ users",
      "$5 billion or more",
      "-5%",
      "−$3",
    ]) {
      expect(parseAmount(text), text).toBeNull();
    }
  });

  it("allows hedges and keeps a year that is not part of a range", () => {
    expect(parseAmount("approximately $1.25 billion")).toEqual(usd("1.25", "billion"));
    expect(parseAmount("~$20,000")).toEqual(usd("20000"));
    expect(parseAmount("$1.4 billion in 2025")).toEqual(usd("1.4", "billion"));
  });

  it("returns null when the text has several amounts", () => {
    expect(parseAmount("$1.4 billion growing to $10.8 billion")).toBeNull();
  });
});

describe("findAmounts", () => {
  it("finds every amount with its span, and none from a year next to a range word", () => {
    const text = "Valued at USD 1.4 billion in 2025, it may grow from 2025 to USD 10.8 billion by 2034 (28.5% CAGR).";
    const found = findAmounts(text);
    expect(found.map((a) => a.raw)).toEqual(["USD 1.4 billion", "USD 10.8 billion", "28.5%"]);
    for (const a of found) expect(text.slice(a.start, a.end)).toBe(a.raw);
  });

  it("excludes both ends of a price range", () => {
    expect(findAmounts("Plans run from $24/month to $30/month.")).toEqual([]);
  });
});

describe("amount equality, display and cents", () => {
  it("treats $1,400,000 and $1.4 million as the same amount", () => {
    expect(amountsEqual(must(parseAmount("$1,400,000")), must(parseAmount("$1.4 million")))).toBe(true);
    expect(amountsEqual(must(parseAmount("$1.40 million")), must(parseAmount("US$1.4M")))).toBe(true);
    expect(amountsEqual(must(parseAmount("$5k")), must(parseAmount("$5,000")))).toBe(true);
  });

  it("distinguishes magnitude, currency and unit", () => {
    expect(amountsEqual(must(parseAmount("$1.4 million")), must(parseAmount("$1.4 billion")))).toBe(false);
    expect(amountsEqual(must(parseAmount("$30")), must(parseAmount("€30")))).toBe(false);
    expect(amountsEqual(must(parseAmount("$30")), must(parseAmount("C$30")))).toBe(false);
    expect(amountsEqual(must(parseAmount("30%")), must(parseAmount("30 users")))).toBe(false);
  });

  it("formats canonically without rounding", () => {
    expect(formatAmount(usd("1.4", "million"))).toBe("$1.4 million");
    expect(formatAmount(usd("20000"))).toBe("$20,000");
    expect(formatAmount(usd("20", "thousand"))).toBe("$20,000");
    expect(formatAmount(usd("1.2345", "thousand"))).toBe("$1,234.5");
    expect(formatAmount({ value: "20.2", magnitude: "none", unit: "percent" })).toBe("20.2%");
    expect(formatAmount({ value: "4.2", magnitude: "million", unit: "count" })).toBe("4.2 million");
    expect(formatAmount({ value: "1400", magnitude: "million", unit: "currency", currency: "EUR" })).toBe("€1,400 million");
    expect(formatAmount({ value: "30", magnitude: "none", unit: "currency", currency: "CAD" })).toBe("C$30");
  });

  it("converts to exact integer cents and rejects sub-cent or unsafe values", () => {
    expect(amountToCents(usd("24.99"))).toBe(2499);
    expect(amountToCents(usd("1.4", "trillion"))).toBe(140_000_000_000_000);
    expect(amountToCents(usd("24.999"))).toBeNull();
    expect(amountToCents(usd("100", "trillion"))).toBeNull();
    expect(amountToCents({ value: "20", magnitude: "none", unit: "percent" })).toBeNull();
    expect(priceToCents(must(parsePriceTerms("$24.99/month")))).toBe(2499);
  });
});

describe("parsePriceTerms", () => {
  it("reads every supported period", () => {
    const cases: Array<[string, string]> = [
      ["$24/mo", "$24/month"],
      ["$24/mth", "$24/month"],
      ["$24 per month", "$24/month"],
      ["$24 a month", "$24/month"],
      ["$24 monthly", "$24/month"],
      ["$240/yr", "$240/year"],
      ["$240/year", "$240/year"],
      ["$240 per year", "$240/year"],
      ["$240 annually", "$240/year"],
      ["$240 per annum", "$240/year"],
      ["$240 yearly", "$240/year"],
      ["$5/wk", "$5/week"],
      ["$5/week", "$5/week"],
      ["$1/day", "$1/day"],
      ["$299 one-time", "$299 one-time"],
      ["$299 lifetime", "$299 one-time"],
    ];
    for (const [text, expected] of cases) expect(price(text), text).toBe(expected);
  });

  it("reads per-user and per-workspace bases in either order", () => {
    for (const noun of ["user", "seat", "member", "developer", "dev", "agent", "editor", "license", "person", "contributor"]) {
      expect(price(`$24/${noun}/month`), noun).toBe("$24/user/month");
    }
    for (const noun of ["workspace", "team", "account", "organization", "org", "company", "store", "site", "project", "location"]) {
      expect(price(`$24 per ${noun} per month`), noun).toBe("$24/workspace/month");
    }
    expect(price("$24/month/user")).toBe("$24/user/month");
    expect(price("$10 a seat a month")).toBe("$10/user/month");
    expect(price("$24/month")).toBe("$24/month");
  });

  it("reads qualifiers from the expression's clause", () => {
    expect(price("$24/user/month, billed annually")).toBe("$24/user/month, billed annually");
    expect(price("$24/user/month when paid yearly")).toBe("$24/user/month, billed annually");
    expect(price("$24/month with annual billing")).toBe("$24/month, billed annually");
    expect(price("$30/month, billed monthly")).toBe("$30/month, billed monthly");
    expect(price("Starting at $19/month")).toBe("from $19/month");
    expect(price("Plans start from just $19/month")).toBe("from $19/month");
    expect(price("as low as $9/month")).toBe("from $9/month");
    expect(price("Foundations from ~$20,000/year (10 seats)")).toBe("from $20,000/year");
    expect(price("$19/month for the first 3 months")).toBe("$19/month, introductory");
    expect(price("Launch price: $49/month")).toBe("$49/month, introductory");
    expect(price("$49/month + usage")).toBe("$49/month, plus usage");
    expect(price("$49/month plus overages")).toBe("$49/month, plus usage");
  });

  it("ignores a negated qualifier and a 'from' that is not next to the price", () => {
    expect(price("$24/month, no overage fees")).toBe("$24/month");
    expect(price("Choose from three plans: Pro is $24/month")).toBe("$24/month");
  });

  it("continues a price onto the next line for its unit or qualifier", () => {
    expect(price("$24 /month\nper seat, billed annually")).toBe("$24/user/month, billed annually");
    expect(price("$24/month\nBilled annually")).toBe("$24/month, billed annually");
    expect(price("$24\n/month")).toBe("$24/month");
    expect(price("$24/month\nMonthly reports included")).toBe("$24/month");
  });

  it("continues a price past one sentence end for its unit or qualifier", () => {
    expect(price("Pro is $24/mo. Billed annually.")).toBe("$24/month, billed annually");
    expect(price("Loopio is $20,000/year. Per user pricing is extra.")).toBe("$20,000/year");
    expect(price("Pro is $24/month. A month later we raised it.")).toBe("$24/month");
    expect(price("Pro is $24/month. Per our policy, refunds take a week.")).toBe("$24/month");
  });

  it("rejects ranges, bounds, usage units, missing periods and several prices", () => {
    for (const text of [
      "$20-$30/month",
      "up to $30/month",
      "$0.012 per credit",
      "$2 per 1k tokens",
      "$24/month/year",
      "$24/user/seat/month",
      "$24 per seat, billed annually",
      "$240 billed annually",
      "$20,000",
      "Free",
      "Custom",
      "$24/month or $240/year",
      "$24/month (was $30)",
      "€49/month vs $59/month",
    ]) {
      expect(parsePriceTerms(text), text).toBeNull();
    }
  });

  it("keeps the currency of the expression", () => {
    expect(price("EUR 30/user/month")).toBe("€30/user/month");
    expect(price("$24 USD/month")).toBe("$24/month");
    expect(price("£12 per user per month")).toBe("£12/user/month");
  });

  it("round-trips its canonical format", () => {
    for (const text of [
      "$24/user/month, billed annually",
      "from $99/month",
      "$299 one-time",
      "€1,299/workspace/year, billed annually, introductory, plus usage",
      "$1.4 million/year",
      "from $0.99/user/week, billed monthly",
    ]) {
      const terms = must(parsePriceTerms(text));
      expect(formatPriceTerms(terms)).toBe(text);
      expect(parsePriceTerms(formatPriceTerms(terms))).toEqual(terms);
    }
  });
});

describe("findPriceExpressions", () => {
  it("keeps two vendors' prices in separate clauses of a contrast sentence", () => {
    const text = "Loopio costs $20,000/year while Qvidian costs $30/month.";
    const found = findPriceExpressions(text);
    expect(found.map((e) => [formatPriceTerms(e.terms), e.clause])).toEqual([
      ["$20,000/year", "Loopio costs $20,000/year"],
      ["$30/month", "while Qvidian costs $30/month."],
    ]);
  });

  it("applies a clause's qualifiers to every price in that clause", () => {
    const found = findPriceExpressions("Starter $19/month, Pro $39/month billed annually; Enterprise $99/month.");
    expect(found.map((e) => formatPriceTerms(e.terms))).toEqual([
      "$19/month, billed annually",
      "$39/month, billed annually",
      "$99/month",
    ]);
  });
});

describe("comparePriceTerms", () => {
  const terms = (text: string): PriceTerms => must(parsePriceTerms(text));

  it("returns null only when every field matches", () => {
    expect(comparePriceTerms(terms("$24 per user per month, billed annually"), terms("$24/seat/mo billed yearly"))).toBeNull();
    expect(comparePriceTerms(terms("$1,400,000/year"), terms("$1.4 million/year"))).toBeNull();
  });

  it("reports the first difference in a fixed order", () => {
    expect(comparePriceTerms(terms("€30/user/month"), terms("$30/user/month"))).toBe("currency_mismatch");
    expect(comparePriceTerms(terms("$20,000/month"), terms("$20,000/year"))).toBe("period_mismatch");
    expect(comparePriceTerms(terms("$24/month"), terms("$24/user/month"))).toBe("basis_mismatch");
    expect(comparePriceTerms(terms("$24/user/month"), terms("$24/user/month, billed annually"))).toBe("qualifier_dropped");
    expect(comparePriceTerms(terms("$24/user/month, billed annually"), terms("$24/user/month"))).toBe("qualifier_dropped");
    expect(comparePriceTerms(terms("$25/month"), terms("$24/month"))).toBe("amount_mismatch");
    const percent: PriceTerms = { ...terms("$24/month"), amount: { value: "24", magnitude: "none", unit: "percent" } };
    expect(comparePriceTerms(percent, terms("$24/month"))).toBe("unit_mismatch");
  });
});

describe("sentences, clauses and projection cues", () => {
  const text = "The U.S. market was $1.4B in 2025. It will reach $5B by 2030; analysts agree.\nNew line e.g. this one. Done!";

  it("splits sentences at terminal punctuation and line breaks but not abbreviations or decimals", () => {
    expect(splitSentences(text).map((s) => s.text)).toEqual([
      "The U.S. market was $1.4B in 2025.",
      "It will reach $5B by 2030; analysts agree.",
      "New line e.g. this one.",
      "Done!",
    ]);
    expect(sentenceAround(text, text.indexOf("$5B")).text).toBe("It will reach $5B by 2030; analysts agree.");
  });

  it("ends a sentence after a magnitude letter", () => {
    const s = "Revenue hit $5M. Costs fell.";
    expect(sentenceAround(s, 0).text).toBe("Revenue hit $5M.");
  });

  it("splits clauses at semicolons, pipes, tabs and contrast words", () => {
    expect(clauseAround(text, text.indexOf("$5B")).text).toBe("It will reach $5B by 2030");
    const row = "Loopio | $20,000/year\tQvidian vs. Responsive, compared to Upland";
    expect(clauseAround(row, row.indexOf("$20")).text).toBe("$20,000/year");
    expect(clauseAround(row, row.indexOf("Upland")).text).toBe("compared to Upland");
  });

  it("detects projection cues", () => {
    expect(hasProjectionCue("The market will reach $5B.")).toBe(true);
    expect(hasProjectionCue("It is expected to grow to $5B.")).toBe(true);
    expect(hasProjectionCue("Forecasts put it at $5B by 2030.")).toBe(true);
    expect(hasProjectionCue("The market was valued at $1.4B in 2025.")).toBe(false);
    expect(hasProjectionCue("Growing at a CAGR of 28.5% from 2025 to 2034", 2026)).toBe(true);
    expect(hasProjectionCue("The market was valued at $1.4B in 2025.", 2026)).toBe(false);
  });
});
