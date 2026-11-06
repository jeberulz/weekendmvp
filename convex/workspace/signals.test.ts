/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "../schema";
import { founderSignalsSchema } from "../../lib/workspace/contracts/wizard";
import { mirrorSignal, recordFounderSignal } from "./signals";

const modules = import.meta.glob("/convex/**/*.ts");

describe("WP74-S2 recordFounderSignal", () => {
  test("bounds before/after, links the session, and writes once per (session, step, action)", async () => {
    const t = convexTest(schema, modules);
    const rows = await t.run(async (ctx) => {
      const ownerId = await ctx.db.insert("users", { email: "owner@example.test" });
      const sessionId = await ctx.db.insert("wizard_sessions", {
        ownerId,
        ideaSlug: "hydrotrail",
        step: "platform",
        answers: { idea: { source: "library", ideaSlug: "hydrotrail" } },
        startedAt: 1,
        updatedAt: 1,
      });
      const session = await ctx.db.get("wizard_sessions", sessionId);
      if (session === null) throw new Error("missing");
      const long = "😀".repeat(200);
      const input = { ownerId, session, step: "platform" as const, action: "changed" as const, before: long, after: "Web", now: 5 };
      const first = await recordFounderSignal(ctx, input);
      const second = await recordFounderSignal(ctx, input);
      const otherAction = await recordFounderSignal(ctx, { ...input, action: "kept" });
      expect([first, second, otherAction]).toEqual([true, false, true]);
      return await ctx.db.query("founder_signals").collect();
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]?.wizardSessionId).toBeDefined();
    expect(rows[0]?.before?.length).toBeLessThanOrEqual(160);
    expect(rows[0]?.before?.endsWith("…")).toBe(true);
    expect(rows[0]?.after).toBe("Web");
  });
});

describe("WP74-S2 mirrorSignal", () => {
  test("maps the four actions onto the C-WIZARD kept/edited shape", () => {
    const kept = mirrorSignal(undefined, "platform", "kept", "Web", "Web");
    const changed = mirrorSignal(kept, "goal", "changed", "First sale", "First 50 waitlist signups");
    const rewrote = mirrorSignal(changed, "name", "rewrote", "HydroTrail", "Sipwise");
    const skipped = mirrorSignal(rewrote, "partner_name", "skipped", "Wren", "Wren");
    expect(founderSignalsSchema.parse(skipped)).toEqual({
      platform: { signal: "kept", note: "Approved suggested platform: Web" },
      goal: { signal: "edited", note: "Changed goal: First sale → First 50 waitlist signups" },
      name: { signal: "edited", note: "Rewrote name: HydroTrail → Sipwise" },
      partner_name: { signal: "kept", note: "Skipped; used the suggested partner name: Wren" },
    });
  });

  test("a long note is cut to the schema bound", () => {
    const mirrored = mirrorSignal(undefined, "idea", "rewrote", undefined, "x".repeat(400));
    expect(mirrored.idea?.note?.length).toBeLessThanOrEqual(160);
  });
});
