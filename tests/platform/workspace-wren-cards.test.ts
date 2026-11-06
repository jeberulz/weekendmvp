/**
 * WP77-S4 — the pure side of Wren's cards: the closed allowlist, the
 * per-tool fields, the per-turn cap, the reply schema and the static copy.
 * The Convex side (subjects, business, approvals) is in
 * `convex/workspace/wrenTools.test.ts`.
 */
import { describe, expect, test } from "vitest";

import { WREN_CARD_PROPOSALS_MAX, wrenReplyOutput, WREN_SYSTEM_RULES } from "@/convex/ai/prompts/wrenShared";
import { APPROVAL_SUBJECT_TABLES } from "@/lib/workspace/contracts/approvals";
import {
  WREN_APPROVAL_SUBJECTS,
  WREN_CARD_TOOLS,
  WREN_CARDS_PER_TURN,
  WREN_EXPLAIN_TOPICS,
  WREN_NAVIGATE_ROUTES,
  wrenToolsInstruction,
  type WrenNavigateRoute,
} from "@/lib/workspace/contracts/wrenTools";
import { WORKSPACE_ROUTES } from "@/lib/workspace/routes";
import {
  APPROVAL_REVIEW_LABELS,
  APPROVAL_REVIEW_ROUTES,
  approvalCardTitle,
  approvalDecisionCopy,
  approvalDecisionErrorCopy,
  approvalReviewRoute,
  approvalSubjectLine,
  checkWrenCardProposals,
  subjectExcerpt,
  navigateRouteSlug,
  WREN_EXPLAIN_COPY,
  WREN_NAVIGATE_LABELS,
  type WrenCardProposal,
} from "@/lib/workspace/wrenCards";

const ID = "000000000000000000000010012site_versions";

function codes(proposals: WrenCardProposal[]) {
  const result = checkWrenCardProposals(proposals);
  return { accepted: result.accepted.map((entry) => entry.card), refused: result.refused.map((entry) => entry.code) };
}

describe("WP77-S4 allowlist shape", () => {
  test("Wren's approval kinds and tables are a strict subset of S1's rules", () => {
    for (const [kind, tables] of Object.entries(WREN_APPROVAL_SUBJECTS)) {
      const allowed: readonly string[] = APPROVAL_SUBJECT_TABLES[kind as keyof typeof APPROVAL_SUBJECT_TABLES];
      for (const table of tables) expect(allowed).toContain(table);
    }
    expect(Object.keys(WREN_APPROVAL_SUBJECTS).sort()).toEqual(["post", "publish", "send"]);
    expect(WREN_APPROVAL_SUBJECTS.send).not.toContain("outbound_messages");
    expect(WREN_APPROVAL_SUBJECTS.send).toEqual(["sequences"]);
  });

  test("every navigate route is a workspace route of this business, with a label", () => {
    const slugs = WORKSPACE_ROUTES.map((route) => route.slug as string);
    for (const route of Object.keys(WREN_NAVIGATE_ROUTES) as WrenNavigateRoute[]) {
      expect(slugs).toContain(navigateRouteSlug(route));
      expect(WREN_NAVIGATE_LABELS[route].length).toBeGreaterThan(0);
      expect(route).toMatch(/^[a-z-]+$/u);
    }
  });

  test("every explain topic has static copy", () => {
    for (const topic of Object.keys(WREN_EXPLAIN_TOPICS) as (keyof typeof WREN_EXPLAIN_TOPICS)[]) {
      expect(WREN_EXPLAIN_COPY[topic].title.length).toBeGreaterThan(0);
      expect(WREN_EXPLAIN_COPY[topic].body.length).toBeGreaterThan(0);
    }
  });

  test("the prompt names every tool and key, and no URL", () => {
    const text = wrenToolsInstruction();
    for (const tool of WREN_CARD_TOOLS) expect(text).toContain(tool);
    for (const key of [...Object.keys(WREN_EXPLAIN_TOPICS), ...Object.keys(WREN_NAVIGATE_ROUTES)]) expect(text).toContain(key);
    expect(text).not.toMatch(/https?:/u);
    expect(WREN_SYSTEM_RULES).toContain(text);
  });

  test("the prompt says explain and navigate cards may not be shown, so the reply never points at one", () => {
    const text = wrenToolsInstruction();
    expect(text).toContain("Explain and navigate cards may not be shown yet");
    expect(text).toContain("never refer to one in your reply");
  });

  test("approval card titles are static copy by kind and table", () => {
    expect(approvalCardTitle("publish", "site_versions")).toBe("Publish this landing page version");
    expect(approvalCardTitle("send", "sequences")).toBe("Start sending this email sequence");
    expect(approvalCardTitle("<script>", "x")).toBe("Approval needed");
  });
});

describe("WP77-S4 checkWrenCardProposals", () => {
  test("accepts the three tools with exactly their fields", () => {
    expect(codes([
      { tool: "approval_card", kind: "publish", subjectTable: "site_versions", subjectId: ID },
      { tool: "explain_card", topic: "approvals" },
      { tool: "navigate_card", route: "build-pack" },
    ])).toEqual({
      accepted: [
        { tool: "approval_card", kind: "publish", subjectTable: "site_versions", subjectId: ID },
        { tool: "explain_card", topic: "approvals" },
        { tool: "navigate_card", route: "build-pack" },
      ],
      refused: [],
    });
  });

  test.each([
    ["an unknown tool", { tool: "publish_site" }, "unknown_tool"],
    ["a side-effect tool name", { tool: "decideApproval" }, "unknown_tool"],
    ["a missing field", { tool: "approval_card", kind: "publish", subjectTable: "site_versions" }, "bad_fields"],
    ["an extra field", { tool: "explain_card", topic: "approvals", route: "brand" }, "bad_fields"],
    ["an over-long value", { tool: "navigate_card", route: "a".repeat(65) }, "too_long"],
    ["spend", { tool: "approval_card", kind: "spend", subjectTable: "documents", subjectId: ID }, "kind_not_allowed"],
    ["ad_launch", { tool: "approval_card", kind: "ad_launch", subjectTable: "ad_campaigns", subjectId: ID }, "kind_not_allowed"],
    ["upgrade", { tool: "approval_card", kind: "upgrade", subjectTable: "projects", subjectId: ID }, "kind_not_allowed"],
    ["artifact_review", { tool: "approval_card", kind: "artifact_review", subjectTable: "documents", subjectId: ID }, "kind_not_allowed"],
    ["send to a list", { tool: "approval_card", kind: "send", subjectTable: "outbound_messages", subjectId: ID }, "kind_not_allowed"],
    ["send on one sequence step", { tool: "approval_card", kind: "send", subjectTable: "sequence_steps", subjectId: ID }, "kind_not_allowed"],
    ["a table the kind may not name", { tool: "approval_card", kind: "publish", subjectTable: "documents", subjectId: ID }, "kind_not_allowed"],
    ["a prototype key as kind", { tool: "approval_card", kind: "constructor", subjectTable: "site_versions", subjectId: ID }, "kind_not_allowed"],
    ["markup as id", { tool: "approval_card", kind: "post", subjectTable: "social_posts", subjectId: "<b>x</b>" }, "bad_subject_id"],
    ["a URL as id", { tool: "approval_card", kind: "post", subjectTable: "social_posts", subjectId: "https://evil.example" }, "bad_subject_id"],
    ["an empty id", { tool: "approval_card", kind: "post", subjectTable: "social_posts", subjectId: "" }, "bad_subject_id"],
    ["an unknown topic", { tool: "explain_card", topic: "billing_secrets" }, "topic_not_allowed"],
    ["markup as topic", { tool: "explain_card", topic: "<img src=x onerror=alert(1)>" }, "topic_not_allowed"],
    ["a prototype key as topic", { tool: "explain_card", topic: "__proto__" }, "topic_not_allowed"],
    ["an https URL", { tool: "navigate_card", route: "https://evil.example/login" }, "route_not_allowed"],
    ["a protocol-relative URL", { tool: "navigate_card", route: "//evil.example" }, "route_not_allowed"],
    ["a javascript URL", { tool: "navigate_card", route: "javascript:alert(1)" }, "route_not_allowed"],
    ["a path", { tool: "navigate_card", route: "/dashboard/b/other/settings" }, "route_not_allowed"],
    ["a traversal", { tool: "navigate_card", route: "../settings" }, "route_not_allowed"],
    ["a homoglyph route (Cyrillic а)", { tool: "navigate_card", route: "brаnd" }, "route_not_allowed"],
    ["a homoglyph tool", { tool: "navigate_cаrd", route: "brand" }, "unknown_tool"],
    ["a homoglyph kind (Ukrainian і)", { tool: "approval_card", kind: "publіsh", subjectTable: "site_versions", subjectId: ID }, "kind_not_allowed"],
    ["a padded route", { tool: "navigate_card", route: " brand" }, "route_not_allowed"],
    ["an upper-case route", { tool: "navigate_card", route: "Brand" }, "route_not_allowed"],
    ["a fullwidth route", { tool: "navigate_card", route: "ｂｒａｎｄ" }, "route_not_allowed"],
  ] satisfies [string, WrenCardProposal, string][])("refuses %s", (_label, proposal, code) => {
    expect(codes([proposal])).toEqual({ accepted: [], refused: [code] });
  });

  test("considers at most the per-turn cap and collapses duplicates", () => {
    const explain = (topic: string): WrenCardProposal => ({ tool: "explain_card", topic });
    const result = codes([explain("approvals"), explain("approvals"), explain("credits"), explain("crew"), explain("publishing")]);
    expect(WREN_CARDS_PER_TURN).toBe(3);
    expect(result.accepted).toEqual([explain("approvals"), explain("credits")]);
    expect(result.refused).toEqual(["duplicate", "over_cap", "over_cap"]);
  });
});

describe("WP77-S4 reply schema", () => {
  test("cards are optional, nullable, plain strings, and unknown keys are dropped", () => {
    expect(wrenReplyOutput.safeParse({ reply: "ok" }).success).toBe(true);
    expect(wrenReplyOutput.safeParse({ reply: "ok", cards: null }).success).toBe(true);
    const parsed = wrenReplyOutput.parse({
      reply: "ok",
      cards: [{ tool: "approval_card", kind: "spend", subjectTable: "documents", subjectId: ID, costCredits: "0" }],
    });
    expect(parsed.cards?.[0]).toEqual({ tool: "approval_card", kind: "spend", subjectTable: "documents", subjectId: ID });
  });

  test("one bad card does not fail the reply: missing tool, null fields and a 600-character value all parse", () => {
    const parsed = wrenReplyOutput.safeParse({
      reply: "ok",
      cards: [{ route: "brand" }, { tool: "explain_card", topic: "credits", route: null }, { tool: "x".repeat(600) }],
    });
    expect(parsed.success).toBe(true);
    // The server refuses them per card.
    expect(codes([{ tool: "navigate_card", route: "x".repeat(600) }]).refused).toEqual(["too_long"]);
  });

  test("at most WREN_CARD_PROPOSALS_MAX cards; a non-string value still fails the schema", () => {
    const card = { tool: "explain_card", topic: "credits" };
    expect(wrenReplyOutput.safeParse({ reply: "ok", cards: Array(WREN_CARD_PROPOSALS_MAX).fill(card) }).success).toBe(true);
    expect(wrenReplyOutput.safeParse({ reply: "ok", cards: Array(WREN_CARD_PROPOSALS_MAX + 1).fill(card) }).success).toBe(false);
    expect(wrenReplyOutput.safeParse({ reply: "ok", cards: [{ tool: 7 }] }).success).toBe(false);
  });
});

describe("WP77-S4 approval card subject line and review link", () => {
  test("subjectExcerpt keeps the first real line as plain text, bounded", () => {
    expect(subjectExcerpt("\n\n# Trail day is Saturday\nBring water.")).toBe("Trail day is Saturday");
    expect(subjectExcerpt("-   spaced\t out\u200b text")).toBe("spaced out text");
    expect(subjectExcerpt("\u202eevil\u202c name")).toBe("evil name");
    expect(subjectExcerpt("")).toBe("");
    expect(subjectExcerpt(undefined)).toBe("");
    const long = subjectExcerpt("word ".repeat(50));
    expect(Array.from(long).length).toBeLessThanOrEqual(80);
    expect(long.endsWith("…")).toBe(true);
    expect(subjectExcerpt("<b>bold</b>")).toBe("<b>bold</b>");
    // Unicode tags, word joiner / invisible operators and the soft hyphen are dropped too.
    expect(subjectExcerpt("ta\u{E0041}\u{E007F}g\u2060\u2061\u2064 soft\u00adhyphen")).toBe("tag softhyphen");
  });

  test("approvalSubjectLine names the version, the sequence or the post", () => {
    expect(approvalSubjectLine({ table: "site_versions", version: 4n })).toBe("Landing page version 4");
    expect(approvalSubjectLine({ table: "site_versions", version: null })).toBe("Landing page version");
    expect(approvalSubjectLine({ table: "sequences", title: "Welcome" })).toBe("Email sequence: Welcome");
    expect(approvalSubjectLine({ table: "sequences", title: null })).toBe("Email sequence");
    expect(approvalSubjectLine({ table: "social_posts", text: "Launch day\nmore" })).toBe("Social post: Launch day");
    expect(approvalSubjectLine({ table: "social_posts", text: "   " })).toBe("Social post");
    expect(approvalSubjectLine({ table: "other" })).toBe("");
  });

  test("every review route is a workspace page with a label", () => {
    const slugs = WORKSPACE_ROUTES.map((route) => route.slug as string);
    for (const route of APPROVAL_REVIEW_ROUTES) {
      expect(slugs).toContain(route);
      expect(APPROVAL_REVIEW_LABELS[route].length).toBeGreaterThan(0);
    }
    expect(approvalReviewRoute("site_versions")).toBe("launch");
    expect(approvalReviewRoute("sequences")).toBe("email");
    expect(approvalReviewRoute("social_posts")).toBe("social");
    expect(approvalReviewRoute("<script>")).toBe("files");
  });
});

describe("WP77-S4 decision copy", () => {
  test("a changed, mismatched or unpublishable subject asks for a fresh card; only transient errors say try again", () => {
    const changed = "This changed since Wren raised it. Ask Wren again for a fresh card.";
    for (const code of [
      "APPROVAL_SUBJECT_CHANGED", "APPROVAL_SUBJECT_MISMATCH", "APPROVAL_SUBJECT_NOT_PUBLISHABLE", "APPROVAL_SUBJECT_NOT_FOUND",
    ]) expect(approvalDecisionErrorCopy(code)).toBe(changed);
    expect(approvalDecisionErrorCopy("APPROVAL_ALREADY_DECIDED")).toBe("This card was already decided.");
    expect(approvalDecisionErrorCopy(null)).toContain("Try again in a moment");
    expect(approvalDecisionErrorCopy("SOMETHING_NEW")).toContain("Try again in a moment");
    expect(approvalDecisionErrorCopy("APPROVAL_SUBJECT_CHANGED")).not.toContain("Try again");
  });

  test("an expired card reads as expired", () => {
    expect(approvalDecisionCopy("expired")).toBe("This card expired.");
    expect(approvalDecisionCopy("approved")).toBe("Approved.");
    expect(approvalDecisionCopy("cancelled")).toBe("Okay, not now.");
  });
});
