// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  WORKSPACE_EVENT_PROPS,
  daysAwayBucket,
  trackWorkspaceEvent,
  trackWorkspaceEventOnce,
  trackWorkspaceReturn,
} from "@/lib/track";

const DAY = 24 * 60 * 60 * 1000;

describe("WP95 funnel events", () => {
  let gtag: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    gtag = vi.fn();
    window.gtag = gtag;
  });
  afterEach(() => {
    delete window.gtag;
    vi.restoreAllMocks();
  });

  test("sends only allowlisted props, and only plain tokens", () => {
    const sent = trackWorkspaceEvent({
      name: "wizard_step_finished",
      props: { step: "commercial_model", note: "my secret idea", email: "a@b.test" } as { step: string },
    });
    expect(sent).toBe(true);
    expect(gtag).toHaveBeenCalledWith("event", "wizard_step_finished", { step: "commercial_model" });
  });

  test("drops a value that is free text, an email or too long", () => {
    for (const piece of ["Luna's plan for hello@example.com", "UPPER", "x".repeat(40), ""]) {
      gtag.mockClear();
      trackWorkspaceEvent({ name: "review_approved", props: { piece } });
      expect(gtag).toHaveBeenCalledWith("event", "review_approved", {});
    }
  });

  test("with no consent nothing is sent and nothing is remembered", () => {
    delete window.gtag;
    expect(trackWorkspaceEvent({ name: "business_created", props: { source: "library" } })).toBe(false);
    expect(trackWorkspaceEventOnce("p1", { name: "first_wren_message", props: {} })).toBe(false);
    expect(trackWorkspaceReturn(5 * DAY)).toBe(false);
    expect(window.localStorage.length).toBe(0);
    window.gtag = gtag;
    expect(trackWorkspaceEventOnce("p1", { name: "first_wren_message", props: {} })).toBe(true);
  });

  test("once-only events fire once per scope, and launch pieces once per piece", () => {
    expect(trackWorkspaceEventOnce("p1", { name: "first_wren_message", props: {} })).toBe(true);
    expect(trackWorkspaceEventOnce("p1", { name: "first_wren_message", props: {} })).toBe(false);
    expect(trackWorkspaceEventOnce("p2", { name: "first_wren_message", props: {} })).toBe(true);
    expect(trackWorkspaceEventOnce("p1", { name: "launch_piece_waiting", props: { piece: "email_sequence" } })).toBe(true);
    expect(trackWorkspaceEventOnce("p1", { name: "launch_piece_waiting", props: { piece: "brand_kit" } })).toBe(true);
    expect(trackWorkspaceEventOnce("p1", { name: "launch_piece_waiting", props: { piece: "email_sequence" } })).toBe(false);
  });

  test("storage that throws never throws out of the helper", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => trackWorkspaceEventOnce("p1", { name: "first_wren_message", props: {} })).not.toThrow();
    expect(() => trackWorkspaceReturn(DAY)).not.toThrow();
  });

  test("the first visit records the day; a later UTC day sends one return with a bucket", () => {
    expect(trackWorkspaceReturn(10 * DAY + 5)).toBe(false);
    expect(trackWorkspaceReturn(10 * DAY + 9_000)).toBe(false);
    expect(trackWorkspaceReturn(11 * DAY + 1)).toBe(true);
    expect(gtag).toHaveBeenLastCalledWith("event", "workspace_return", { days_away: "1" });
    expect(trackWorkspaceReturn(11 * DAY + 2)).toBe(false);
    expect(trackWorkspaceReturn(14 * DAY)).toBe(true);
    expect(gtag).toHaveBeenLastCalledWith("event", "workspace_return", { days_away: "2_6" });
    expect(trackWorkspaceReturn(30 * DAY)).toBe(true);
    expect(gtag).toHaveBeenLastCalledWith("event", "workspace_return", { days_away: "7_plus" });
  });

  test("day buckets", () => {
    expect([1, 2, 6, 7, 40].map(daysAwayBucket)).toEqual(["1", "2_6", "2_6", "7_plus", "7_plus"]);
  });

  test("every event has an allowlist entry and none lists a free-text key", () => {
    for (const keys of Object.values(WORKSPACE_EVENT_PROPS)) {
      for (const key of keys) expect(["step", "source", "piece", "days_away"]).toContain(key);
    }
  });
});
