import { describe, expect, test } from "vitest";

import { defaultIdeaFilter } from "@/lib/editorial/contracts/commands";
import {
  activeFilterCount,
  ideaFilterQuery,
  parseCursor,
  parseIdeaFilter,
  parseReleaseFilter,
  parseStart,
} from "@/lib/editorial/presentation/filters";
import { blockerSummary, formatAbsolute, formatRelative, revisionSummary } from "@/lib/editorial/presentation/format";

const NOW = Date.parse("2026-09-27T12:00:00Z");

describe("filters from the URL", () => {
  test("known values are parsed; unknown or malformed values are ignored, not errors", () => {
    const filter = parseIdeaFilter("queue", {
      bucket: "needs_research",
      severity: "evidence",
      category: "fintech",
      decision: "hacked",
      age: ["stale", "fresh"],
      run: "run-2026-09-12-3",
      q: "  invoices ",
      sort: "drop table",
    });
    expect(filter.bucket).toBe("needs_research");
    expect(filter.severity).toBe("evidence");
    expect(filter.category).toBe("fintech");
    expect(filter.decision).toBeNull();
    expect(filter.sourceAge).toBe("stale");
    expect(filter.engineRunId).toBe("run-2026-09-12-3");
    expect(filter.sort).toBe("updated_desc");
    expect(parseIdeaFilter("queue", { run: "../../etc" }).engineRunId).toBeNull();
    expect(parseIdeaFilter("library", { bucket: "new" }).bucket).toBeNull();
  });

  test("search is bounded and cursors must be URL-safe tokens", () => {
    expect(parseIdeaFilter("library", { q: "x".repeat(500) }).search?.length).toBe(120);
    expect(parseCursor({ cursor: "eyJhIjoxfQ" })).toBe("eyJhIjoxfQ");
    expect(parseCursor({ cursor: "<script>" })).toBeNull();
    expect(parseStart({ start: "26" })).toBe(26);
    expect(parseStart({ start: "-4" })).toBe(1);
    expect(parseReleaseFilter({ group: "attention" }).group).toBe("attention");
    expect(parseReleaseFilter({ group: "everything" }).group).toBe("all");
  });

  test("query strings omit defaults and round-trip", () => {
    const filter = { ...defaultIdeaFilter("queue"), bucket: "new" as const, severity: "blocking" as const };
    const query = ideaFilterQuery(filter);
    expect(query).toBe("?bucket=new&severity=blocking");
    const parsed = parseIdeaFilter("queue", Object.fromEntries(new URLSearchParams(query)));
    expect(parsed).toEqual(filter);
    expect(ideaFilterQuery(filter, { bucket: null })).toBe("?severity=blocking");
    expect(activeFilterCount(filter)).toBe(1);
  });
});

describe("formatting", () => {
  test("publication and editorial state stay separate", () => {
    const base = { pendingOperation: null };
    expect(
      revisionSummary({
        ...base,
        publication: "live",
        liveRevision: { id: "rev_2", number: 2, releasedAt: "2026-09-26T10:00:00Z" },
        workingRevision: { id: "rev_3", number: 3, kind: "draft", reviewState: "in_review", updatedAt: "2026-09-27T10:00:00Z" },
      }),
    ).toEqual({ publication: "Live v2", working: "Draft v3" });
    expect(
      revisionSummary({
        ...base,
        publication: "never_published",
        liveRevision: null,
        workingRevision: { id: "rev_1", number: 1, kind: "submitted", reviewState: "draft", updatedAt: "2026-09-27T10:00:00Z" },
      }),
    ).toEqual({ publication: "Never published", working: "Submitted v1" });
  });

  test("relative and absolute times", () => {
    expect(formatRelative("2026-09-27T11:59:30Z", NOW)).toBe("just now");
    expect(formatRelative("2026-09-27T11:15:00Z", NOW)).toBe("45 min ago");
    expect(formatRelative("2026-09-27T02:00:00Z", NOW)).toBe("10 h ago");
    expect(formatRelative("2026-09-25T12:00:00Z", NOW)).toBe("2 days ago");
    expect(formatRelative("2026-08-01T12:00:00Z", NOW)).toBe("1 Aug 2026");
    expect(formatAbsolute("2026-09-27T09:05:00Z")).toBe("27 Sep 2026, 09:05 UTC");
  });

  test("blocker summaries are words, not colours", () => {
    expect(blockerSummary({ blocking: 0, warnings: 0, evidence: 0, top: null })).toBe("None");
    expect(blockerSummary({ blocking: 2, warnings: 1, evidence: 1, top: null })).toBe("2 blocking · 1 warning");
  });
});
