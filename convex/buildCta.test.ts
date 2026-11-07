/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("/convex/**/*.ts");

type Setup = { workspaceEnabled?: boolean; cohortMode?: "allowlist" | "open"; inCohort?: boolean };

async function seed({ workspaceEnabled = true, cohortMode = "allowlist", inCohort = true }: Setup = {}) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", { email: "admin@example.test" });
    const ownerId = await ctx.db.insert("users", { email: "owner@example.test" });
    const strangerId = await ctx.db.insert("users", { email: "stranger@example.test" });
    const ownerSessionId = await ctx.db.insert("authSessions", { userId: ownerId, expirationTime: 9_999_999_999_999 });
    const strangerSessionId = await ctx.db.insert("authSessions", { userId: strangerId, expirationTime: 9_999_999_999_999 });
    await ctx.db.insert("ops_settings", {
      ownerId: adminId,
      singletonKey: "workspace",
      workspaceEnabled,
      cohortMode,
      freeSignupsOpen: false,
      globalDailyBudgetMicroUsd: 0n,
      paidGlobalDailyBudgetMicroUsd: 0n,
      killSwitches: { ai: true, studioVideo: true, publish: true, email: true, social: true, ads: true },
      updatedAt: 1,
    });
    if (inCohort) await ctx.db.insert("workspace_cohort", { ownerId, addedBy: adminId, addedAt: 1 });
    return { ownerId, strangerId, ownerSessionId, strangerSessionId };
  });
  const owner = t.withIdentity({ subject: `${ids.ownerId}|${ids.ownerSessionId}`, issuer: "https://local.test" });
  const stranger = t.withIdentity({ subject: `${ids.strangerId}|${ids.strangerSessionId}`, issuer: "https://local.test" });
  return { t, owner, stranger };
}

describe("WP74-S5 buildCtaVisible", () => {
  test("no settings row is a closed door", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.buildCta.buildCtaVisible, {})).resolves.toBe(false);
  });

  test("workspace off hides it from everyone, including an allowlisted owner", async () => {
    const { t, owner } = await seed({ workspaceEnabled: false, cohortMode: "open" });
    await expect(t.query(api.buildCta.buildCtaVisible, {})).resolves.toBe(false);
    await expect(owner.query(api.buildCta.buildCtaVisible, {})).resolves.toBe(false);
  });

  // L1-C9 (owner's call, 2026-11-07): an anonymous visitor cannot be matched
  // to the allowlist, so they see the CTA and find out at `/start`.
  test("allowlist: a signed-out visitor and a signed-in allowlisted owner see it, a signed-in stranger does not", async () => {
    const { t, owner, stranger } = await seed();
    await expect(t.query(api.buildCta.buildCtaVisible, {})).resolves.toBe(true);
    await expect(stranger.query(api.buildCta.buildCtaVisible, {})).resolves.toBe(false);
    await expect(owner.query(api.buildCta.buildCtaVisible, {})).resolves.toBe(true);
  });

  test("allowlist with an empty list shows no signed-in owner", async () => {
    const { owner } = await seed({ inCohort: false });
    await expect(owner.query(api.buildCta.buildCtaVisible, {})).resolves.toBe(false);
  });

  test("open cohort shows it to a signed-out visitor too", async () => {
    const { t, stranger } = await seed({ cohortMode: "open", inCohort: false });
    await expect(t.query(api.buildCta.buildCtaVisible, {})).resolves.toBe(true);
    await expect(stranger.query(api.buildCta.buildCtaVisible, {})).resolves.toBe(true);
  });
});

describe("L1-C9 awaitingInvite", () => {
  test("true only for a signed-in owner off the allowlist while the workspace is on", async () => {
    const { t, owner, stranger } = await seed();
    await expect(stranger.query(api.buildCta.awaitingInvite, {})).resolves.toBe(true);
    await expect(owner.query(api.buildCta.awaitingInvite, {})).resolves.toBe(false);
    await expect(t.query(api.buildCta.awaitingInvite, {})).resolves.toBe(false);
  });

  test("false when the workspace is off, the cohort is open, or there are no settings", async () => {
    const off = await seed({ workspaceEnabled: false });
    await expect(off.stranger.query(api.buildCta.awaitingInvite, {})).resolves.toBe(false);
    const open = await seed({ cohortMode: "open" });
    await expect(open.stranger.query(api.buildCta.awaitingInvite, {})).resolves.toBe(false);
    const bare = convexTest(schema, modules);
    await expect(bare.query(api.buildCta.awaitingInvite, {})).resolves.toBe(false);
  });
});
