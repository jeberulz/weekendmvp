import { describe, expect, test } from "vitest";

import {
  CANDIDATE_TRANSITIONS,
  RELEASE_STATES,
  REVIEW_TRANSITIONS,
  canTransitionCandidate,
  canTransitionRelease,
  canTransitionReview,
  canTrash,
  isReleaseInFlight,
} from "@/lib/editorial/contracts/states";

describe("candidate decision", () => {
  test("new candidates can be accepted, sent back for research or rejected", () => {
    expect(CANDIDATE_TRANSITIONS.new).toEqual(["accepted", "needs_research", "rejected"]);
  });

  test("a rejection can be reopened, but never jumps straight to accepted", () => {
    expect(canTransitionCandidate("rejected", "new")).toBe(true);
    expect(canTransitionCandidate("rejected", "needs_research")).toBe(true);
    expect(canTransitionCandidate("rejected", "accepted")).toBe(false);
  });

  test("nothing returns to the legacy marker", () => {
    for (const targets of Object.values(CANDIDATE_TRANSITIONS)) expect(targets).not.toContain("legacy");
  });
});

describe("revision review", () => {
  test("an approved revision is frozen; edits fork a new draft", () => {
    expect(REVIEW_TRANSITIONS.approved).toEqual([]);
  });

  test("approval only comes from review in progress", () => {
    expect(canTransitionReview("draft", "approved")).toBe(false);
    expect(canTransitionReview("changes_requested", "approved")).toBe(false);
    expect(canTransitionReview("in_review", "approved")).toBe(true);
  });
});

describe("releases", () => {
  test("live comes only from activation, never from a click", () => {
    const into = RELEASE_STATES.filter((state) => canTransitionRelease("publish", state, "succeeded"));
    expect(into.sort()).toEqual(["activating", "needs_reconciliation", "verifying_public"]);
  });

  test("an uncertain activation is reconciled, not blindly retried", () => {
    expect(canTransitionRelease("publish", "needs_reconciliation", "publish_requested")).toBe(false);
    expect(canTransitionRelease("publish", "activating", "cancelled")).toBe(false);
  });

  test("a failed attempt can be retried or abandoned", () => {
    expect(canTransitionRelease("publish", "failed", "publish_requested")).toBe(true);
    expect(canTransitionRelease("publish", "failed", "cancelled")).toBe(true);
  });

  test("unpublish revokes before it verifies, and cannot deploy content", () => {
    expect(canTransitionRelease("unpublish", "publish_requested", "activating")).toBe(true);
    expect(canTransitionRelease("unpublish", "publish_requested", "deploying")).toBe(false);
    expect(canTransitionRelease("unpublish", "activating", "verifying")).toBe(true);
    expect(canTransitionRelease("unpublish", "verifying", "succeeded")).toBe(true);
  });

  test("legacy baselines never transition", () => {
    for (const from of RELEASE_STATES) {
      for (const to of RELEASE_STATES) expect(canTransitionRelease("legacy_baseline", from, to)).toBe(false);
    }
  });

  test("in-flight means not yet terminal", () => {
    expect(isReleaseInFlight("needs_reconciliation")).toBe(true);
    expect(isReleaseInFlight("preview_ready")).toBe(true);
    expect(isReleaseInFlight("failed")).toBe(false);
    expect(isReleaseInFlight("succeeded")).toBe(false);
  });
});

describe("trash", () => {
  test("only ideas that are not live and have nothing in flight", () => {
    expect(canTrash("live", false)).toBe(false);
    expect(canTrash("unpublished", true)).toBe(false);
    expect(canTrash("unpublished", false)).toBe(true);
    expect(canTrash("never_published", false)).toBe(true);
  });
});
