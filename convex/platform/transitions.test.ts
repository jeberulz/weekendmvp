import { describe, expect, test } from "vitest";
import {
  assertBriefTransition,
  assertCanArchive,
  assertProjectTransition,
  assertPurchaseTransition,
  assertSiteTransition,
  assertSiteVersionTransition,
  assertStepTransition,
  assertSubmissionTransition,
  assertTaskRefundEligible,
  assertTaskTransition,
  assertWorkflowRunTransition,
} from "./transitions";

describe("platform lifecycle transitions", () => {
  test.each([
    ["project", () => assertProjectTransition("draft", "validating")],
    ["brief", () => assertBriefTransition("draft", "confirmed")],
    ["submission", () => assertSubmissionTransition("submitted", "accepted")],
    ["task", () => assertTaskTransition("running", "succeeded")],
    ["step", () => assertStepTransition("pending", "skipped")],
    ["site", () => assertSiteTransition("ready", "published")],
    ["site version", () => assertSiteVersionTransition("published", "retired")],
    ["purchase", () => assertPurchaseTransition("paid", "refunded")],
    ["workflow run", () => assertWorkflowRunTransition("running", "failed")],
  ])("accepts a valid %s transition", (_family, transition) => {
    expect(transition).not.toThrow();
  });

  test.each([
    ["skipped project state", () => assertProjectTransition("draft", "ready")],
    ["reversed project state", () => assertProjectTransition("ready", "validating")],
    ["project terminal escape", () => assertProjectTransition("published", "building")],
    ["project double finalization", () => assertProjectTransition("published", "published")],
    ["brief terminal escape", () => assertBriefTransition("superseded", "draft")],
    ["submission terminal escape", () => assertSubmissionTransition("accepted", "rejected")],
    ["task terminal escape", () => assertTaskTransition("succeeded", "running")],
    ["step terminal escape", () => assertStepTransition("failed", "running")],
    ["publish before site ready", () => assertSiteTransition("draft", "published")],
    ["publish before version ready", () => assertSiteVersionTransition("draft", "published")],
    ["purchase refund before payment", () => assertPurchaseTransition("pending", "refunded")],
    ["workflow terminal escape", () => assertWorkflowRunTransition("failed", "running")],
  ])("rejects %s", (_case, transition) => {
    expect(transition).toThrow("INVALID_STATE_TRANSITION");
  });

  test("allows task credit refunds only after failure", () => {
    expect(assertTaskRefundEligible("failed")).toBe("failed");
    expect(() => assertTaskRefundEligible("running")).toThrow(
      "TASK_REFUND_NOT_ALLOWED",
    );
    expect(() => assertTaskRefundEligible("succeeded")).toThrow(
      "TASK_REFUND_NOT_ALLOWED",
    );
  });

  test("represents archive as an explicit, single soft-delete operation", () => {
    expect(() => assertCanArchive(undefined)).not.toThrow();
    expect(() => assertCanArchive(1)).toThrow("ALREADY_ARCHIVED");
  });
});
