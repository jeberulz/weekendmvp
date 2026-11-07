/// <reference types="vite/client" />

import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { RESUME_WINDOW } from "./wizard";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { wizardAnswersProgressSchema, wizardAnswersSchema } from "../../lib/workspace/contracts/wizard";

const modules = import.meta.glob("/convex/**/*.ts");

type Setup = { workspaceEnabled?: boolean; ownerInCohort?: boolean; aiEnabled?: boolean };

async function seed(setup: Setup = {}) {
  const { workspaceEnabled = true, ownerInCohort = true, aiEnabled = true } = setup;
  const t = convexTest(schema, modules);
  registerRateLimiter(t);
  const ids = await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", { email: "admin@example.test" });
    const ownerId = await ctx.db.insert("users", { email: "owner@example.test" });
    const otherId = await ctx.db.insert("users", { email: "other@example.test" });
    const ownerSessionId = await ctx.db.insert("authSessions", { userId: ownerId, expirationTime: 9_999_999_999_999 });
    const otherSessionId = await ctx.db.insert("authSessions", { userId: otherId, expirationTime: 9_999_999_999_999 });
    for (const [slug, title] of [
      ["hydrotrail", "HydroTrail"],
      ["meal-planner", "Meal Planner: dinners for busy parents"],
      ["trail-cafe", "Trail Cafe"],
      ["engine-draft-secret", "Secret draft"],
    ]) {
      await ctx.db.insert("ideas", {
        slug,
        title,
        description: "d",
        publishedAt: 1,
        category: "c",
        buildTime: "weekend",
        revenueGoal: "r",
        applicationCategory: "a",
        tools: [],
        audiences: [],
        bodyMode: "mdx",
      });
    }
    await ctx.db.insert("ideas", {
      slug: "gone",
      title: "Gone",
      description: "d",
      publishedAt: 1,
      category: "c",
      buildTime: "weekend",
      revenueGoal: "r",
      applicationCategory: "a",
      tools: [],
      audiences: [],
      bodyMode: "mdx",
      editorialVisibility: "removed",
    });
    await ctx.db.insert("ops_settings", {
      ownerId: adminId,
      singletonKey: "workspace",
      workspaceEnabled,
      cohortMode: "allowlist",
      freeSignupsOpen: false,
      // checkLimit("wizardStart") needs the `ai` feature: switch on and a budget.
      globalDailyBudgetMicroUsd: aiEnabled ? 1_000_000n : 0n,
      paidGlobalDailyBudgetMicroUsd: 0n,
      killSwitches: { ai: !aiEnabled, studioVideo: true, publish: true, email: true, social: true, ads: true },
      updatedAt: 1,
    });
    if (ownerInCohort) {
      await ctx.db.insert("workspace_cohort", { ownerId, addedBy: adminId, addedAt: 1 });
      await ctx.db.insert("workspace_cohort", { ownerId: otherId, addedBy: adminId, addedAt: 1 });
    }
    return { adminId, ownerId, otherId, ownerSessionId, otherSessionId };
  });
  const owner = t.withIdentity({ subject: `${ids.ownerId}|${ids.ownerSessionId}`, issuer: "https://local.test" });
  const other = t.withIdentity({ subject: `${ids.otherId}|${ids.otherSessionId}`, issuer: "https://local.test" });
  return { t, owner, other, ids };
}

const HYDRO = { source: "library" as const, ideaSlug: "hydrotrail" };

async function signalsFor(t: Awaited<ReturnType<typeof seed>>["t"], sessionId: Id<"wizard_sessions">) {
  return await t.run(async (ctx) =>
    (await ctx.db.query("founder_signals").collect()).filter((row) => row.wizardSessionId === sessionId),
  );
}

async function row(t: Awaited<ReturnType<typeof seed>>["t"], sessionId: Id<"wizard_sessions">) {
  const doc = await t.run(async (ctx) => await ctx.db.get("wizard_sessions", sessionId));
  if (doc === null) throw new Error("missing session");
  return doc;
}

describe("WP74-S1 guards", () => {
  test("signed out is refused on every function", async () => {
    const { t, owner } = await seed();
    const sessionId = await owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO });
    await expect(t.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO })).rejects.toThrow(/UNAUTHENTICATED/);
    await expect(t.query(api.workspace.wizard.getSession, { sessionId })).rejects.toThrow(/UNAUTHENTICATED/);
    await expect(t.mutation(api.workspace.wizard.skipStep, { sessionId, step: "idea" })).rejects.toThrow(/UNAUTHENTICATED/);
    await expect(t.query(api.workspace.wizard.getWizardAccess, {})).resolves.toEqual({ allowed: false });
  });

  test("workspace off refuses every function and the route gate denies", async () => {
    const { owner } = await seed({ workspaceEnabled: false });
    await expect(owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO })).rejects.toThrow(/WORKSPACE_DISABLED/);
    await expect(owner.query(api.workspace.wizard.getWizardAccess, { ideaSlug: "hydrotrail" })).resolves.toEqual({ allowed: false });
  });

  test("an owner outside the cohort is refused", async () => {
    const { owner } = await seed({ ownerInCohort: false });
    await expect(owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO })).rejects.toThrow(/RESOURCE_NOT_FOUND/);
    await expect(owner.query(api.workspace.wizard.getWizardAccess, {})).resolves.toEqual({ allowed: false });
  });

  test("the route gate allows a known idea and own ideas, and denies unknown or removed ideas", async () => {
    const { owner } = await seed();
    await expect(owner.query(api.workspace.wizard.getWizardAccess, { ideaSlug: "hydrotrail" }))
      .resolves.toEqual({ allowed: true, ideaTitle: "HydroTrail", businessLimit: null });
    await expect(owner.query(api.workspace.wizard.getWizardAccess, {})).resolves.toEqual({ allowed: true, ideaTitle: null, businessLimit: null });
    await expect(owner.query(api.workspace.wizard.getWizardAccess, { ideaSlug: "nope" })).resolves.toEqual({ allowed: false });
    await expect(owner.query(api.workspace.wizard.getWizardAccess, { ideaSlug: "gone" })).resolves.toEqual({ allowed: false });
    await expect(owner.mutation(api.workspace.wizard.startOrResume, { idea: { source: "library", ideaSlug: "gone" } }))
      .rejects.toThrow(/RESOURCE_NOT_FOUND/);
  });

  test("another owner's session is indistinguishable from a missing one", async () => {
    const { owner, other } = await seed();
    const sessionId = await owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO });
    await expect(other.query(api.workspace.wizard.getSession, { sessionId })).rejects.toThrow(/RESOURCE_NOT_FOUND/);
    await expect(other.mutation(api.workspace.wizard.saveStep, { sessionId, step: "idea", answer: HYDRO }))
      .rejects.toThrow(/RESOURCE_NOT_FOUND/);
    await expect(other.mutation(api.workspace.wizard.goBack, { sessionId, step: "idea" })).rejects.toThrow(/RESOURCE_NOT_FOUND/);
  });
});

describe("WP74-S1 C-LIMITS and catalogue policy", () => {
  test("a 4th new start in a day is refused, while resuming the first three still works", async () => {
    const { t, owner } = await seed();
    const ideas = [HYDRO, { source: "library" as const, ideaSlug: "meal-planner" }, { source: "own_idea" as const, text: "Trail snack box" }];
    const ids = [];
    for (const idea of ideas) ids.push(await owner.mutation(api.workspace.wizard.startOrResume, { idea }));
    await expect(owner.mutation(api.workspace.wizard.startOrResume, {
      idea: { source: "library", ideaSlug: "trail-cafe" },
    })).rejects.toThrow(/RateLimited/);
    for (const [index, idea] of ideas.entries()) {
      await expect(owner.mutation(api.workspace.wizard.startOrResume, { idea })).resolves.toBe(ids[index]);
    }
    const sessions = await t.run(async (ctx) => await ctx.db.query("wizard_sessions").collect());
    expect(sessions).toHaveLength(3);
  });

  test("with AI off a new start is refused, but an existing session still resumes", async () => {
    const { t, owner, ids } = await seed({ aiEnabled: false });
    await expect(owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO })).rejects.toThrow(/AI_DISABLED/);
    const sessionId = await t.run(async (ctx) => await ctx.db.insert("wizard_sessions", {
      ownerId: ids.ownerId,
      ideaSlug: "hydrotrail",
      step: "platform",
      answers: { idea: HYDRO },
      startedAt: 1,
      updatedAt: 1,
    }));
    await expect(owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO })).resolves.toBe(sessionId);
  });

  test("resume finds the session among the owner's newest RESUME_WINDOW sessions", async () => {
    const { t, owner, ids } = await seed();
    const first = await owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO });
    await t.run(async (ctx) => {
      for (let i = 0; i < 60; i += 1) {
        await ctx.db.insert("wizard_sessions", {
          ownerId: ids.ownerId,
          ownIdeaText: `Idea ${i}`,
          step: "idea",
          answers: { idea: { source: "own_idea", text: `Idea ${i}` } },
          startedAt: 1,
          updatedAt: 9_000_000_000_000 + i,
        });
      }
    });
    await expect(owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO })).resolves.toBe(first);
  });

  test("a match older than the resume window gets a new session", async () => {
    const { t, owner, ids } = await seed();
    const first = await owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO });
    await t.run(async (ctx) => {
      for (let i = 0; i < RESUME_WINDOW; i += 1) {
        await ctx.db.insert("wizard_sessions", {
          ownerId: ids.ownerId,
          ownIdeaText: `Idea ${i}`,
          step: "idea",
          answers: { idea: { source: "own_idea", text: `Idea ${i}` } },
          startedAt: 1,
          updatedAt: 1,
        });
      }
    });
    const second = await owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO });
    expect(second).not.toBe(first);
    await expect(owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO })).resolves.toBe(second);
  });

  test("engine-draft slugs are refused and never leak a title", async () => {
    const { t, owner } = await seed();
    await expect(owner.query(api.workspace.wizard.getWizardAccess, { ideaSlug: "engine-draft-secret" }))
      .resolves.toEqual({ allowed: false });
    await expect(owner.mutation(api.workspace.wizard.startOrResume, {
      idea: { source: "library", ideaSlug: "engine-draft-secret" },
    })).rejects.toThrow(/RESOURCE_NOT_FOUND/);
    expect(await t.run(async (ctx) => await ctx.db.query("wizard_sessions").collect())).toEqual([]);
  });
});

describe("WP74-S1 parse rules", () => {
  test("a phone number field is rejected, at start and on any step", async () => {
    const { owner } = await seed();
    await expect(owner.mutation(api.workspace.wizard.startOrResume, {
      idea: { ...HYDRO, phone: "+447700900000" } as unknown as typeof HYDRO,
    })).rejects.toThrow();
    const sessionId = await owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO });
    await owner.mutation(api.workspace.wizard.skipStep, { sessionId, step: "idea" });
    await owner.mutation(api.workspace.wizard.skipStep, { sessionId, step: "blueprint" });
    await expect(owner.mutation(api.workspace.wizard.saveStep, {
      sessionId,
      step: "platform",
      answer: { kind: "web", phone: "+447700900000" } as unknown as { kind: "web" },
    })).rejects.toThrow();
  });

  test("unbounded and multi-line text is rejected and nothing is written", async () => {
    const { t, owner } = await seed();
    await expect(owner.mutation(api.workspace.wizard.startOrResume, {
      idea: { source: "own_idea", text: "x".repeat(241) },
    })).rejects.toThrow(/INVALID_ANSWER/);
    await expect(owner.mutation(api.workspace.wizard.startOrResume, {
      idea: { source: "own_idea", text: "line one\nline two" },
    })).rejects.toThrow(/INVALID_ANSWER/);
    await expect(owner.mutation(api.workspace.wizard.startOrResume, {
      idea: { source: "library", ideaSlug: "Not A Slug" },
    })).rejects.toThrow(/INVALID_ANSWER/);

    const sessionId = await owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO });
    await owner.mutation(api.workspace.wizard.skipStep, { sessionId, step: "idea" });
    await owner.mutation(api.workspace.wizard.skipStep, { sessionId, step: "blueprint" });
    await expect(owner.mutation(api.workspace.wizard.rewriteStep, { sessionId, step: "platform", text: "y".repeat(121) }))
      .rejects.toThrow(/INVALID_ANSWER/);
    await expect(owner.mutation(api.workspace.wizard.saveStep, { sessionId, step: "platform", answer: "free" }))
      .rejects.toThrow(/INVALID_ANSWER/);
    const doc = await row(t, sessionId);
    expect(doc.step).toBe("platform");
    expect(doc.answers.platform).toBeUndefined();
    expect((await signalsFor(t, sessionId)).filter((s) => s.step === "platform")).toEqual([]);
  });

  test("names over the limit and duplicate alternatives are rejected", async () => {
    const { owner } = await seed();
    const sessionId = await owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO });
    for (const step of ["idea", "blueprint", "platform", "commercial_model", "goal"] as const) {
      await owner.mutation(api.workspace.wizard.skipStep, { sessionId, step });
    }
    await expect(owner.mutation(api.workspace.wizard.rewriteStep, { sessionId, step: "name", text: "n".repeat(41) }))
      .rejects.toThrow(/INVALID_ANSWER/);
    await expect(owner.mutation(api.workspace.wizard.saveStep, {
      sessionId,
      step: "name",
      answer: { chosen: "Sip Line", alternatives: ["sip line"] },
    })).rejects.toThrow(/INVALID_ANSWER/);
  });

  test("rewrite refuses steps that only have fixed choices", async () => {
    const { owner } = await seed();
    const sessionId = await owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO });
    for (const step of ["idea", "blueprint", "platform"] as const) {
      await owner.mutation(api.workspace.wizard.skipStep, { sessionId, step });
    }
    await expect(owner.mutation(api.workspace.wizard.rewriteStep, { sessionId, step: "commercial_model", text: "pay what you want" }))
      .rejects.toThrow(/INVALID_STEP/);
  });

  test("the idea step cannot switch to another library idea", async () => {
    const { owner } = await seed();
    const sessionId = await owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO });
    await expect(owner.mutation(api.workspace.wizard.saveStep, {
      sessionId,
      step: "idea",
      answer: { source: "library", ideaSlug: "meal-planner" },
    })).rejects.toThrow(/INVALID_ANSWER/);
  });
});

describe("WP74-S1 transitions", () => {
  test("start, then starting again resumes the same session for the same idea", async () => {
    const { owner } = await seed();
    const first = await owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO });
    await owner.mutation(api.workspace.wizard.skipStep, { sessionId: first, step: "idea" });
    const again = await owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO });
    expect(again).toBe(first);
    const view = await owner.query(api.workspace.wizard.getSession, { sessionId: again });
    expect(view.step).toBe("blueprint");
    expect(view.stepIndex).toBe(1);
    expect(view.totalSteps).toBe(8);
    const otherIdea = await owner.mutation(api.workspace.wizard.startOrResume, {
      idea: { source: "library", ideaSlug: "meal-planner" },
    });
    expect(otherIdea).not.toBe(first);
  });

  test("the view carries a default for every step and the HydroTrail fixture seed", async () => {
    const { owner } = await seed();
    const sessionId = await owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO });
    const view = await owner.query(api.workspace.wizard.getSession, { sessionId });
    expect(view.seedSource).toBe("fixture_hydrotrail");
    expect(view.blueprint.features).toHaveLength(5);
    expect(view.blueprint.validated).toBe(true);
    expect(view.defaults).toMatchObject({
      idea: HYDRO,
      blueprintDecision: { decision: "looks_good" },
      platform: { kind: "web" },
      commercialModel: "free",
      goal: { kind: "waitlist", timeframe: "weekend" },
      name: { chosen: "HydroTrail", alternatives: ["SipLine", "Trailwater"] },
      partnerPersonality: "strategist",
      partnerName: { kind: "preset", name: "Wren" },
    });
    const generic = await owner.mutation(api.workspace.wizard.startOrResume, {
      idea: { source: "library", ideaSlug: "meal-planner" },
    });
    const genericView = await owner.query(api.workspace.wizard.getSession, { sessionId: generic });
    expect(genericView.seedSource).toBe("fixture_generic");
    expect(genericView.defaults.name?.chosen).toBe("Meal Planner");
  });

  test("back, skip and rewrite move the step as expected; back keeps answers", async () => {
    const { t, owner } = await seed();
    const sessionId = await owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO });
    await expect(owner.mutation(api.workspace.wizard.goBack, { sessionId, step: "idea" }))
      .resolves.toMatchObject({ applied: false, step: "idea" });
    await expect(owner.mutation(api.workspace.wizard.saveStep, { sessionId, step: "idea", answer: HYDRO }))
      .resolves.toMatchObject({ applied: true, step: "blueprint", action: "kept" });
    await expect(owner.mutation(api.workspace.wizard.skipStep, { sessionId, step: "blueprint" }))
      .resolves.toMatchObject({ applied: true, step: "platform", action: "skipped" });
    await expect(owner.mutation(api.workspace.wizard.rewriteStep, { sessionId, step: "platform", text: "Chrome extension" }))
      .resolves.toMatchObject({ applied: true, step: "commercial_model", action: "rewrote" });
    await expect(owner.mutation(api.workspace.wizard.goBack, { sessionId, step: "commercial_model" }))
      .resolves.toMatchObject({ applied: true, step: "platform" });
    const doc = await row(t, sessionId);
    expect(doc.step).toBe("platform");
    expect(doc.answers.platform).toEqual({ kind: "custom", description: "Chrome extension" });
    expect(() => wizardAnswersProgressSchema.parse(doc.answers)).not.toThrow();
  });

  test("a call for a step that is not current changes nothing (double click)", async () => {
    const { t, owner } = await seed();
    const sessionId = await owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO });
    await owner.mutation(api.workspace.wizard.saveStep, { sessionId, step: "idea", answer: HYDRO });
    await expect(owner.mutation(api.workspace.wizard.saveStep, { sessionId, step: "idea", answer: HYDRO }))
      .resolves.toEqual({ applied: false, step: "blueprint", completed: false, action: null });
    expect((await row(t, sessionId)).step).toBe("blueprint");
  });

  test("rework keeps the session on the blueprint step; looks good moves on", async () => {
    const { t, owner } = await seed();
    const sessionId = await owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO });
    await owner.mutation(api.workspace.wizard.skipStep, { sessionId, step: "idea" });
    await expect(owner.mutation(api.workspace.wizard.rewriteStep, { sessionId, step: "blueprint", text: "Drop offline mode" }))
      .resolves.toMatchObject({ applied: true, step: "blueprint", action: "rewrote" });
    expect((await row(t, sessionId)).answers.blueprintDecision).toEqual({ decision: "rework", notes: "Drop offline mode" });
    await expect(owner.mutation(api.workspace.wizard.saveStep, { sessionId, step: "blueprint", answer: { decision: "looks_good" } }))
      .resolves.toMatchObject({ applied: true, step: "platform", action: "kept" });
  });

  test("an own idea starts on the blueprint step with a light, unvalidated outline", async () => {
    const { t, owner } = await seed();
    const sessionId = await owner.mutation(api.workspace.wizard.startOrResume, {
      idea: { source: "own_idea", text: "  a packing list that adapts to the forecast  " },
    });
    const view = await owner.query(api.workspace.wizard.getSession, { sessionId });
    expect(view.step).toBe("blueprint");
    expect(view.seedSource).toBe("fixture_own_idea");
    expect(view.blueprint.validated).toBe(false);
    const doc = await row(t, sessionId);
    expect(doc.ownIdeaText).toBe("a packing list that adapts to the forecast");
    expect(doc.ideaSlug).toBeUndefined();
    const signals = await signalsFor(t, sessionId);
    expect(signals).toMatchObject([{ step: "idea", action: "rewrote", after: "Own idea: a packing list that adapts to the forecast" }]);
    expect(signals[0]?.before).toBeUndefined();
  });

  test("rewriting a library idea as an own idea moves the session to that idea", async () => {
    const { t, owner } = await seed();
    const sessionId = await owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO });
    await owner.mutation(api.workspace.wizard.rewriteStep, { sessionId, step: "idea", text: "Trail water refill map" });
    const doc = await row(t, sessionId);
    expect(doc.ideaSlug).toBeUndefined();
    expect(doc.ownIdeaText).toBe("Trail water refill map");
    expect(doc.answers.idea).toEqual({ source: "own_idea", text: "Trail water refill map" });
  });

  test("rewriting into own-idea text another active session holds abandons that one", async () => {
    const { t, owner } = await seed();
    const own = await owner.mutation(api.workspace.wizard.startOrResume, {
      idea: { source: "own_idea", text: "Trail water refill map" },
    });
    const moved = await owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO });
    await owner.mutation(api.workspace.wizard.rewriteStep, { sessionId: moved, step: "idea", text: "Trail water refill map" });
    expect((await row(t, own)).abandonedAt).toEqual(expect.any(Number));
    expect((await row(t, moved)).abandonedAt).toBeUndefined();
    await expect(owner.query(api.workspace.wizard.getSession, { sessionId: own })).rejects.toThrow(/RESOURCE_NOT_FOUND/);
    await expect(owner.mutation(api.workspace.wizard.startOrResume, {
      idea: { source: "own_idea", text: "Trail water refill map" },
    })).resolves.toBe(moved);
    const active = await t.run(async (ctx) =>
      (await ctx.db.query("wizard_sessions").collect()).filter(
        (session) => session.abandonedAt === undefined && session.ownIdeaText === "Trail water refill map",
      ));
    expect(active.map((session) => session._id)).toEqual([moved]);
  });
});

describe("WP74-S1 completion", () => {
  async function walkToLastStep(owner: Awaited<ReturnType<typeof seed>>["owner"], sessionId: Id<"wizard_sessions">) {
    await owner.mutation(api.workspace.wizard.saveStep, { sessionId, step: "idea", answer: HYDRO });
    await owner.mutation(api.workspace.wizard.saveStep, { sessionId, step: "blueprint", answer: { decision: "looks_good" } });
    await owner.mutation(api.workspace.wizard.saveStep, { sessionId, step: "platform", answer: { kind: "web" } });
    await owner.mutation(api.workspace.wizard.saveStep, { sessionId, step: "commercial_model", answer: "free" });
    await owner.mutation(api.workspace.wizard.saveStep, {
      sessionId,
      step: "goal",
      answer: { kind: "waitlist", timeframe: "weekend", paidPush: { dailyBudgetUsd: 7 } },
    });
    await owner.mutation(api.workspace.wizard.saveStep, {
      sessionId,
      step: "name",
      answer: { chosen: "HydroTrail", alternatives: ["SipLine", "Trailwater"] },
    });
    await owner.mutation(api.workspace.wizard.saveStep, { sessionId, step: "partner_personality", answer: "strategist" });
  }

  test("the last step completes through the strict schema, without creating a business", async () => {
    const { t, owner } = await seed();
    const sessionId = await owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO });
    await walkToLastStep(owner, sessionId);
    await expect(owner.mutation(api.workspace.wizard.saveStep, {
      sessionId,
      step: "partner_name",
      answer: { kind: "preset", name: "Wren" },
    })).resolves.toEqual({ applied: true, step: "partner_name", completed: true, action: "kept" });
    const doc = await row(t, sessionId);
    expect(doc.completedAt).toBeTypeOf("number");
    expect(doc.projectId).toBeUndefined();
    expect(() => wizardAnswersSchema.parse(doc.answers)).not.toThrow();
    expect(doc.answers.goal).toEqual({ kind: "waitlist", timeframe: "weekend", paidPush: { dailyBudgetUsd: 7 } });
    const projects = await t.run(async (ctx) => await ctx.db.query("projects").collect());
    expect(projects).toEqual([]);
    // A completed session refuses further step writes but resumes on start.
    await expect(owner.mutation(api.workspace.wizard.skipStep, { sessionId, step: "partner_name" }))
      .rejects.toThrow(/SESSION_COMPLETE/);
    await expect(owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO })).resolves.toBe(sessionId);
    // Back from the finished screen reopens the last step.
    await expect(owner.mutation(api.workspace.wizard.goBack, { sessionId, step: "partner_name" }))
      .resolves.toMatchObject({ applied: true, step: "partner_name", completed: false });
    expect((await row(t, sessionId)).completedAt).toBeUndefined();
  });

  test("completion requires an accepted blueprint", async () => {
    const { t, owner } = await seed();
    const sessionId = await owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO });
    await walkToLastStep(owner, sessionId);
    // Force a rework decision onto a session sitting on the last step.
    await t.run(async (ctx) => {
      const doc = await ctx.db.get("wizard_sessions", sessionId);
      if (doc === null) throw new Error("missing");
      await ctx.db.patch("wizard_sessions", sessionId, {
        answers: { ...doc.answers, blueprintDecision: { decision: "rework", notes: "Again" } },
      });
    });
    await expect(owner.mutation(api.workspace.wizard.saveStep, {
      sessionId,
      step: "partner_name",
      answer: { kind: "preset", name: "Wren" },
    })).rejects.toThrow(/INVALID_ANSWER/);
    expect((await row(t, sessionId)).completedAt).toBeUndefined();
  });
});

describe("WP74-S2 founder signals", () => {
  test("each decision logs one row with bounded before/after, and mirrors into answers.signals", async () => {
    const { t, owner } = await seed();
    const sessionId = await owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO });
    await owner.mutation(api.workspace.wizard.saveStep, { sessionId, step: "idea", answer: HYDRO });
    await owner.mutation(api.workspace.wizard.skipStep, { sessionId, step: "blueprint" });
    await owner.mutation(api.workspace.wizard.saveStep, { sessionId, step: "platform", answer: { kind: "native" } });
    await owner.mutation(api.workspace.wizard.saveStep, { sessionId, step: "commercial_model", answer: "free" });
    await owner.mutation(api.workspace.wizard.saveStep, { sessionId, step: "goal", answer: { kind: "first_sale", timeframe: "2w" } });
    await owner.mutation(api.workspace.wizard.rewriteStep, { sessionId, step: "name", text: "Ö".repeat(40) });

    const signals = await signalsFor(t, sessionId);
    expect(signals.map((s) => [s.step, s.action])).toEqual([
      ["idea", "kept"],
      ["blueprint", "skipped"],
      ["platform", "changed"],
      ["commercial_model", "kept"],
      ["goal", "changed"],
      ["name", "rewrote"],
    ]);
    const platform = signals.find((s) => s.step === "platform");
    expect(platform).toMatchObject({ before: "Mobile web, installable", after: "iOS and Android app" });
    for (const signal of signals) {
      expect((signal.before ?? "").length).toBeLessThanOrEqual(160);
      expect((signal.after ?? "").length).toBeLessThanOrEqual(160);
    }

    const doc = await row(t, sessionId);
    expect(doc.answers.signals).toMatchObject({
      idea: { signal: "kept" },
      blueprint: { signal: "kept", note: "Skipped; used the suggested blueprint: Looks good" },
      platform: { signal: "edited", note: "Changed platform: Mobile web, installable → iOS and Android app" },
      goal: { signal: "edited" },
      name: { signal: "edited" },
    });
    expect(doc.answers.name?.alternatives).toEqual(["HydroTrail", "SipLine", "Trailwater"]);
  });

  test("a repeated decision is logged once (double click, or back and the same choice again)", async () => {
    const { t, owner } = await seed();
    const sessionId = await owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO });
    await owner.mutation(api.workspace.wizard.saveStep, { sessionId, step: "idea", answer: HYDRO });
    await owner.mutation(api.workspace.wizard.saveStep, { sessionId, step: "idea", answer: HYDRO });
    await owner.mutation(api.workspace.wizard.goBack, { sessionId, step: "blueprint" });
    await owner.mutation(api.workspace.wizard.saveStep, { sessionId, step: "idea", answer: HYDRO });
    await owner.mutation(api.workspace.wizard.goBack, { sessionId, step: "blueprint" });
    await owner.mutation(api.workspace.wizard.skipStep, { sessionId, step: "idea" });
    const signals = await signalsFor(t, sessionId);
    expect(signals.map((s) => [s.step, s.action])).toEqual([
      ["idea", "kept"],
      ["idea", "skipped"],
    ]);
  });

  test("real later decisions on one step are all recorded: kept, changed, rewrote, kept", async () => {
    const { t, owner } = await seed();
    const sessionId = await owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO });
    await owner.mutation(api.workspace.wizard.skipStep, { sessionId, step: "idea" });
    await owner.mutation(api.workspace.wizard.skipStep, { sessionId, step: "blueprint" });
    const back = () => owner.mutation(api.workspace.wizard.goBack, { sessionId, step: "commercial_model" });
    await owner.mutation(api.workspace.wizard.saveStep, { sessionId, step: "platform", answer: { kind: "web" } });
    await back();
    await owner.mutation(api.workspace.wizard.saveStep, { sessionId, step: "platform", answer: { kind: "native" } });
    await back();
    await owner.mutation(api.workspace.wizard.rewriteStep, { sessionId, step: "platform", text: "Chrome extension" });
    await back();
    await owner.mutation(api.workspace.wizard.saveStep, { sessionId, step: "platform", answer: { kind: "web" } });
    const platform = (await signalsFor(t, sessionId)).filter((s) => s.step === "platform");
    expect(platform.map((s) => [s.action, s.after])).toEqual([
      ["kept", "Mobile web, installable"],
      ["changed", "iOS and Android app"],
      ["rewrote", "Custom: Chrome extension"],
      ["kept", "Mobile web, installable"],
    ]);
  });

  test("picking another suggested name is a change, not a rewrite", async () => {
    const { t, owner } = await seed();
    const sessionId = await owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO });
    for (const step of ["idea", "blueprint", "platform", "commercial_model", "goal"] as const) {
      await owner.mutation(api.workspace.wizard.skipStep, { sessionId, step });
    }
    await owner.mutation(api.workspace.wizard.saveStep, {
      sessionId,
      step: "name",
      answer: { chosen: "SipLine", alternatives: ["HydroTrail", "Trailwater"] },
    });
    await owner.mutation(api.workspace.wizard.rewriteStep, { sessionId, step: "partner_personality", text: "x" }).catch(() => null);
    await owner.mutation(api.workspace.wizard.saveStep, { sessionId, step: "partner_personality", answer: "hustler" });
    await owner.mutation(api.workspace.wizard.rewriteStep, { sessionId, step: "partner_name", text: "Captain" });
    const signals = await signalsFor(t, sessionId);
    expect(signals.filter((s) => ["name", "partner_personality", "partner_name"].includes(s.step)).map((s) => [s.step, s.action]))
      .toEqual([["name", "changed"], ["partner_personality", "changed"], ["partner_name", "rewrote"]]);
    expect((await row(t, sessionId)).completedAt).toBeTypeOf("number");
  });
});

describe("WP74-S3 own-idea light blueprint (interim, no model call)", () => {
  const OWN = { source: "own_idea" as const, text: "Dog walking app for city owners, a $2B market with 500,000 users" };

  test("the preview strips market numbers, keeps the founder's words stored, and spends nothing", async () => {
    const { t, owner } = await seed();
    const sessionId = await owner.mutation(api.workspace.wizard.startOrResume, { idea: OWN });
    const view = await owner.query(api.workspace.wizard.getSession, { sessionId });
    expect(view.blueprint).toMatchObject({
      pitch: "Dog walking app for city owners",
      validated: false,
      origin: "own_fixture",
      removedClaims: 1,
    });
    expect(JSON.stringify(view.blueprint)).not.toMatch(/\$|500,000/u);
    expect((await row(t, sessionId)).answers.idea).toEqual(OWN);
    // A reload reads the same preview and still makes no call.
    expect(await owner.query(api.workspace.wizard.getSession, { sessionId })).toEqual(view);
    expect(await t.run(async (ctx) => await ctx.db.query("ai_usage").collect())).toEqual([]);
  });

  test("an idea made only of market claims shows the fallback outline, and the founder can continue", async () => {
    const { owner } = await seed();
    const sessionId = await owner.mutation(api.workspace.wizard.startOrResume, {
      idea: { source: "own_idea", text: "$5B TAM growing 30% a year" },
    });
    const view = await owner.query(api.workspace.wizard.getSession, { sessionId });
    expect(view.blueprint).toMatchObject({ validated: false, origin: "own_fallback", removedClaims: 0 });
    const result = await owner.mutation(api.workspace.wizard.saveStep, {
      sessionId,
      step: "blueprint",
      answer: { decision: "looks_good" },
    });
    expect(result).toMatchObject({ applied: true, step: "platform" });
  });

  test("another owner cannot read the own-idea preview", async () => {
    const { owner, other } = await seed();
    const sessionId = await owner.mutation(api.workspace.wizard.startOrResume, { idea: OWN });
    await expect(other.query(api.workspace.wizard.getSession, { sessionId })).rejects.toThrow(/RESOURCE_NOT_FOUND/);
  });

  test("with the workspace flag off the preview is refused", async () => {
    const { t, owner } = await seed();
    const sessionId = await owner.mutation(api.workspace.wizard.startOrResume, { idea: OWN });
    await t.run(async (ctx) => {
      const settings = await ctx.db.query("ops_settings").first();
      if (settings !== null) await ctx.db.patch("ops_settings", settings._id, { workspaceEnabled: false });
    });
    await expect(owner.query(api.workspace.wizard.getSession, { sessionId })).rejects.toThrow(/WORKSPACE_DISABLED/);
  });

  test("a library idea keeps its seeded, validated blueprint", async () => {
    const { owner } = await seed();
    const sessionId = await owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO });
    const view = await owner.query(api.workspace.wizard.getSession, { sessionId });
    expect(view.blueprint).toMatchObject({ validated: true, origin: "library", removedClaims: 0 });
    expect(view.seedSource).toBe("fixture_hydrotrail");
  });
});

describe("L1 business allowance at the start of the wizard", () => {
  async function giveBusiness(t: Awaited<ReturnType<typeof seed>>["t"], ownerId: Id<"users">, archived = false) {
    return await t.run(async (ctx) => {
      const sessionId = await ctx.db.insert("wizard_sessions", {
        ownerId, ideaSlug: "trail-cafe", step: "partner_name", answers: { idea: { source: "library", ideaSlug: "trail-cafe" } },
        startedAt: 1, updatedAt: 1, completedAt: 1,
      });
      const projectId = await ctx.db.insert("projects", {
        ownerId,
        workspace: {
          version: 1, name: "Trail Cafe", slug: "trail-cafe", ideaSlug: "trail-cafe", platform: "web", commercialModel: "free",
          goal: "waitlist", partner: { personality: "strategist", name: "Wren" }, wizardSessionId: sessionId, createdVia: "wizard",
        },
        source: "repository_idea", title: "Trail Cafe", status: "draft", idempotencyKey: `wizard:${sessionId}`,
        createdAt: 1, updatedAt: 1, ...(archived ? { archivedAt: 2 } : {}),
      });
      await ctx.db.patch("wizard_sessions", sessionId, { projectId });
      return projectId;
    });
  }

  test("the route gate says when the free business is used, and links only to the owner's own", async () => {
    const { t, owner, other, ids } = await seed();
    const projectId = await giveBusiness(t, ids.ownerId);
    await expect(owner.query(api.workspace.wizard.getWizardAccess, {}))
      .resolves.toEqual({ allowed: true, ideaTitle: null, businessLimit: { limit: 1, projectId } });
    await expect(owner.query(api.workspace.wizard.getWizardAccess, { ideaSlug: "hydrotrail" }))
      .resolves.toEqual({ allowed: true, ideaTitle: "HydroTrail", businessLimit: { limit: 1, projectId } });
    await expect(other.query(api.workspace.wizard.getWizardAccess, {}))
      .resolves.toEqual({ allowed: true, ideaTitle: null, businessLimit: null });
  });

  test("a new wizard is refused before it starts, spends nothing and writes no session", async () => {
    const { t, owner, ids } = await seed();
    const projectId = await giveBusiness(t, ids.ownerId);
    for (const idea of [HYDRO, { source: "own_idea" as const, text: "A second idea" }]) {
      await expect(owner.mutation(api.workspace.wizard.startOrResume, { idea })).rejects.toThrow(/BUSINESS_LIMIT_REACHED/);
    }
    // Five refusals later the daily wizard-start allowance (3) is untouched: no RateLimited.
    for (let i = 0; i < 3; i += 1) {
      await expect(owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO })).rejects.toThrow(/BUSINESS_LIMIT_REACHED/);
    }
    const sessions = await t.run(async (ctx) => await ctx.db.query("wizard_sessions").collect());
    expect(sessions.filter((s) => s.projectId === undefined)).toHaveLength(0);
    await expect(owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO })).rejects.toMatchObject({
      data: { code: "BUSINESS_LIMIT_REACHED", plan: "free", limit: 1, projectId },
    });
  });

  test("an archived business still uses the allowance, and the refusal links nowhere", async () => {
    const { t, owner, ids } = await seed();
    await giveBusiness(t, ids.ownerId, true);
    await expect(owner.query(api.workspace.wizard.getWizardAccess, {}))
      .resolves.toEqual({ allowed: true, ideaTitle: null, businessLimit: { limit: 1, projectId: null } });
    await expect(owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO })).rejects.toMatchObject({
      data: { code: "BUSINESS_LIMIT_REACHED", plan: "free", limit: 1 },
    });
  });

  test("a session started before the business was made still resumes", async () => {
    const { t, owner, ids } = await seed();
    const sessionId = await owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO });
    await giveBusiness(t, ids.ownerId);
    await expect(owner.mutation(api.workspace.wizard.startOrResume, { idea: HYDRO })).resolves.toBe(sessionId);
  });
});
