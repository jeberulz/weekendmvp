/// <reference types="vite/client" />

import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { WIZARD_STEPS, wizardAnswersSchema, type WizardAnswers } from "../../lib/workspace/contracts/wizard";
import { hydrotrailWizardAnswers } from "../../lib/workspace/contracts/fixtures/hydrotrail";
import { businessIdempotencyKey } from "./business";

const modules = import.meta.glob("/convex/**/*.ts");

type Setup = { workspaceEnabled?: boolean };

const VERIFIED = 1_700_000_000_000;

async function seed(setup: Setup = {}) {
  const { workspaceEnabled = true } = setup;
  const t = convexTest(schema, modules);
  registerRateLimiter(t);
  const ids = await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", { email: "admin@example.test" });
    const users: Record<string, { userId: Id<"users">; sessionId: Id<"authSessions"> }> = {};
    const people: [string, { email?: string; emailVerificationTime?: number }][] = [
      ["owner", { email: "owner@example.test", emailVerificationTime: VERIFIED }],
      ["other", { email: "other@example.test", emailVerificationTime: VERIFIED }],
      ["unverified", { email: "new@example.test" }],
      ["disposable", { email: "burner@mailinator.com", emailVerificationTime: VERIFIED }],
      ["disposableSub", { email: "Burner@Inbox.YOPMAIL.com.", emailVerificationTime: VERIFIED }],
    ];
    for (const [key, fields] of people) {
      const userId = await ctx.db.insert("users", fields);
      const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: 9_999_999_999_999 });
      await ctx.db.insert("workspace_cohort", { ownerId: userId, addedBy: adminId, addedAt: 1 });
      users[key] = { userId, sessionId };
    }
    for (const [slug, title] of [["hydrotrail", "HydroTrail"], ["trail-cafe", "Trail Cafe"]]) {
      await ctx.db.insert("ideas", {
        slug, title, description: "d", publishedAt: 1, category: "c", buildTime: "weekend", revenueGoal: "r",
        applicationCategory: "a", tools: [], audiences: [], bodyMode: "mdx",
      });
    }
    await ctx.db.insert("ops_settings", {
      ownerId: adminId,
      singletonKey: "workspace",
      workspaceEnabled,
      cohortMode: "allowlist",
      freeSignupsOpen: false,
      globalDailyBudgetMicroUsd: 1_000_000n,
      paidGlobalDailyBudgetMicroUsd: 0n,
      killSwitches: { ai: false, studioVideo: true, publish: true, email: true, social: true, ads: true },
      updatedAt: 1,
    });
    return { adminId, users };
  });
  const as = (key: string) => {
    const user = ids.users[key];
    return t.withIdentity({ subject: `${user.userId}|${user.sessionId}`, issuer: "https://local.test" });
  };
  return { t, as, ids };
}

type T = Awaited<ReturnType<typeof seed>>["t"];

/** A finished session, stored the way the wizard stores it: parsed C-WIZARD output. */
async function finishedSession(
  t: T,
  ownerId: Id<"users">,
  overrides: Partial<WizardAnswers> = {},
  fields: { completedAt?: number | null; abandonedAt?: number; rawAnswers?: unknown } = {},
): Promise<Id<"wizard_sessions">> {
  const answers = wizardAnswersSchema.parse({ ...hydrotrailWizardAnswers, ...overrides });
  return await t.run(async (ctx) =>
    await ctx.db.insert("wizard_sessions", {
      ownerId,
      ...(answers.idea.source === "library" ? { ideaSlug: answers.idea.ideaSlug } : { ownIdeaText: answers.idea.text }),
      step: "partner_name",
      answers: (fields.rawAnswers ?? answers) as WizardAnswers,
      startedAt: 1,
      updatedAt: 1,
      ...(fields.completedAt === null ? {} : { completedAt: fields.completedAt ?? 2 }),
      ...(fields.abandonedAt === undefined ? {} : { abandonedAt: fields.abandonedAt }),
    }),
  );
}

async function projectsOf(t: T, ownerId: Id<"users">) {
  return await t.run(async (ctx) =>
    (await ctx.db.query("projects").collect()).filter((project) => project.ownerId === ownerId),
  );
}

async function businessFor(t: T, ownerId: Id<"users">, slug: string, withSite = false) {
  await t.run(async (ctx) => {
    const sessionId = await ctx.db.insert("wizard_sessions", {
      ownerId, step: "partner_name", answers: {}, startedAt: 1, updatedAt: 1,
    });
    const projectId = await ctx.db.insert("projects", {
      ownerId,
      workspace: {
        version: 1, name: slug, slug, platform: "web", commercialModel: "free", goal: "waitlist",
        partner: { personality: "strategist", name: "Wren" }, wizardSessionId: sessionId, createdVia: "wizard",
      },
      source: "own_idea", title: slug, status: "draft", idempotencyKey: `seed:${slug}`, createdAt: 1, updatedAt: 1,
    });
    if (withSite) {
      await ctx.db.insert("site_configs", {
        ownerId, projectId, status: "published", hostname: `${slug}.weekendmvp.app`, createdAt: 1, updatedAt: 1,
      });
    }
  });
}

describe("WP74-S4 createBusiness: success", () => {
  test("creates the project, links the session, writes one audit row and opens the workspace", async () => {
    const { t, as, ids } = await seed();
    const owner = ids.users.owner.userId;
    const sessionId = await finishedSession(t, owner);

    const result = await as("owner").mutation(api.workspace.business.createBusiness, { sessionId });
    expect(result).toMatchObject({ name: "HydroTrail", slug: "hydrotrail", created: true });

    const [project] = await projectsOf(t, owner);
    expect(project).toMatchObject({
      _id: result.projectId,
      ownerId: owner,
      source: "repository_idea",
      status: "draft",
      title: "HydroTrail",
      idempotencyKey: businessIdempotencyKey(sessionId),
      workspace: {
        version: 1,
        name: "HydroTrail",
        slug: "hydrotrail",
        ideaSlug: "hydrotrail",
        platform: "web",
        commercialModel: "free",
        goal: "waitlist",
        partner: { personality: "strategist", name: "Wren" },
        wizardSessionId: sessionId,
        createdVia: "wizard",
      },
    });
    expect(project.sourceIdeaId).toBeUndefined();

    const session = await t.run(async (ctx) => await ctx.db.get("wizard_sessions", sessionId));
    expect(session?.projectId).toBe(result.projectId);
    expect(session?.completedAt).toBe(2);

    const audits = await t.run(async (ctx) => await ctx.db.query("audit_events").collect());
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      ownerId: owner, projectId: result.projectId, actorType: "user", actorUserId: owner,
      action: "business.created", subjectType: "project", subjectId: result.projectId,
    });
    expect(audits[0].metadata).not.toContain("@");

    // D12: no business_members row is written here (Codex item h), and the
    // owner still passes requireBusinessAccess through projects.ownerId.
    const members = await t.run(async (ctx) => await ctx.db.query("business_members").collect());
    expect(members).toEqual([]);
    await expect(as("owner").query(api.workspace.access.getWorkspaceAccess, { projectId: result.projectId }))
      .resolves.toEqual({ allowed: true, project: { _id: result.projectId, name: "HydroTrail" } });
    await expect(as("other").query(api.workspace.access.getWorkspaceAccess, { projectId: result.projectId }))
      .resolves.toEqual({ allowed: false });

    const view = await as("owner").query(api.workspace.wizard.getSession, { sessionId });
    expect(view.business).toEqual({ projectId: result.projectId, name: "HydroTrail", slug: "hydrotrail" });
  });

  test("an own idea keeps its text and becomes an own_idea business", async () => {
    const { t, as, ids } = await seed();
    const owner = ids.users.owner.userId;
    const sessionId = await finishedSession(t, owner, {
      idea: { source: "own_idea", text: "Trail water refill map" },
      name: { chosen: "Refill Atlas", alternatives: [] },
    });
    const result = await as("owner").mutation(api.workspace.business.createBusiness, { sessionId });
    const [project] = await projectsOf(t, owner);
    expect(result.slug).toBe("refill-atlas");
    expect(project.source).toBe("own_idea");
    expect(project.workspace?.ownIdeaText).toBe("Trail water refill map");
    expect(project.workspace?.ideaSlug).toBeUndefined();
  });

  test("end to end: a wizard run with every step skipped creates the business from the stored answers", async () => {
    const { t, as, ids } = await seed();
    const owner = as("owner");
    const sessionId = await owner.mutation(api.workspace.wizard.startOrResume, { idea: { source: "library", ideaSlug: "hydrotrail" } });
    for (const step of WIZARD_STEPS) await owner.mutation(api.workspace.wizard.skipStep, { sessionId, step });
    const result = await owner.mutation(api.workspace.business.createBusiness, { sessionId });
    expect(result.created).toBe(true);
    const session = await t.run(async (ctx) => await ctx.db.get("wizard_sessions", sessionId));
    const stored = wizardAnswersSchema.parse(session?.answers);
    const [project] = await projectsOf(t, ids.users.owner.userId);
    expect(project.workspace?.name).toBe(stored.name.chosen);
    expect(project.workspace?.goal).toBe(stored.goal.kind);
    expect(project.workspace?.partner).toEqual({ personality: stored.partnerPersonality, name: stored.partnerName.name });
  });
});

describe("WP74-S4 createBusiness: idempotency and races", () => {
  test("a double click returns the same business and never makes two", async () => {
    const { t, as, ids } = await seed();
    const sessionId = await finishedSession(t, ids.users.owner.userId);
    const first = await as("owner").mutation(api.workspace.business.createBusiness, { sessionId });
    const second = await as("owner").mutation(api.workspace.business.createBusiness, { sessionId });
    expect(second).toEqual({ ...first, created: false });
    expect(await projectsOf(t, ids.users.owner.userId)).toHaveLength(1);
    expect(await t.run(async (ctx) => (await ctx.db.query("audit_events").collect()).length)).toBe(1);
  });

  test("two concurrent calls make one business", async () => {
    const { t, as, ids } = await seed();
    const sessionId = await finishedSession(t, ids.users.owner.userId);
    const results = await Promise.all([
      as("owner").mutation(api.workspace.business.createBusiness, { sessionId }),
      as("owner").mutation(api.workspace.business.createBusiness, { sessionId }),
    ]);
    expect(new Set(results.map((result) => result.projectId)).size).toBe(1);
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(await projectsOf(t, ids.users.owner.userId)).toHaveLength(1);
  });

  test("a keyed project whose session link is missing is returned and relinked, not duplicated", async () => {
    const { t, as, ids } = await seed();
    const owner = ids.users.owner.userId;
    const sessionId = await finishedSession(t, owner);
    const first = await as("owner").mutation(api.workspace.business.createBusiness, { sessionId });
    await t.run(async (ctx) => ctx.db.patch("wizard_sessions", sessionId, { projectId: undefined }));
    const again = await as("owner").mutation(api.workspace.business.createBusiness, { sessionId });
    expect(again).toEqual({ ...first, created: false });
    expect(await projectsOf(t, owner)).toHaveLength(1);
    const session = await t.run(async (ctx) => await ctx.db.get("wizard_sessions", sessionId));
    expect(session?.projectId).toBe(first.projectId);
  });

  test("a linked session can no longer be edited", async () => {
    const { t, as, ids } = await seed();
    const sessionId = await finishedSession(t, ids.users.owner.userId);
    await as("owner").mutation(api.workspace.business.createBusiness, { sessionId });
    await expect(as("owner").mutation(api.workspace.wizard.goBack, { sessionId, step: "partner_name" }))
      .rejects.toThrow(/RESOURCE_NOT_FOUND/);
  });
});

describe("WP74-S4 createBusiness: one free business", () => {
  test("a second free business is refused, with nothing written", async () => {
    const { t, as, ids } = await seed();
    const owner = ids.users.owner.userId;
    const first = await finishedSession(t, owner);
    const second = await finishedSession(t, owner, {
      idea: { source: "library", ideaSlug: "trail-cafe" },
      name: { chosen: "Trail Cafe", alternatives: [] },
    });
    await as("owner").mutation(api.workspace.business.createBusiness, { sessionId: first });
    await expect(as("owner").mutation(api.workspace.business.createBusiness, { sessionId: second }))
      .rejects.toThrow(/BUSINESS_LIMIT_REACHED/);
    expect(await projectsOf(t, owner)).toHaveLength(1);
    const session = await t.run(async (ctx) => await ctx.db.get("wizard_sessions", second));
    expect(session?.projectId).toBeUndefined();
  });

  test("an archived business still counts toward the allowance", async () => {
    const { t, as, ids } = await seed();
    const owner = ids.users.owner.userId;
    const first = await finishedSession(t, owner);
    const second = await finishedSession(t, owner, {
      idea: { source: "library", ideaSlug: "trail-cafe" },
      name: { chosen: "Trail Cafe", alternatives: [] },
    });
    const created = await as("owner").mutation(api.workspace.business.createBusiness, { sessionId: first });
    await t.run(async (ctx) => ctx.db.patch("projects", created.projectId, { archivedAt: 5 }));
    await expect(as("owner").mutation(api.workspace.business.createBusiness, { sessionId: second }))
      .rejects.toThrow(/BUSINESS_LIMIT_REACHED/);
  });

  test("legacy projects without a workspace do not count", async () => {
    const { t, as, ids } = await seed();
    const owner = ids.users.owner.userId;
    await t.run(async (ctx) => ctx.db.insert("projects", {
      ownerId: owner, source: "own_idea", title: "Legacy", status: "draft", idempotencyKey: "legacy", createdAt: 1, updatedAt: 1,
    }));
    const sessionId = await finishedSession(t, owner);
    await expect(as("owner").mutation(api.workspace.business.createBusiness, { sessionId }))
      .resolves.toMatchObject({ created: true });
  });
});

describe("WP74-S4 createBusiness: account checks", () => {
  test("an unverified account is refused", async () => {
    const { t, as, ids } = await seed();
    const sessionId = await finishedSession(t, ids.users.unverified.userId);
    await expect(as("unverified").mutation(api.workspace.business.createBusiness, { sessionId }))
      .rejects.toThrow(/EMAIL_NOT_VERIFIED/);
    expect(await projectsOf(t, ids.users.unverified.userId)).toEqual([]);
  });

  test("a disposable email domain is refused, including a subdomain written in capitals", async () => {
    const { t, as, ids } = await seed();
    for (const key of ["disposable", "disposableSub"]) {
      const sessionId = await finishedSession(t, ids.users[key].userId);
      await expect(as(key).mutation(api.workspace.business.createBusiness, { sessionId })).rejects.toThrow(/DISPOSABLE_EMAIL/);
      expect(await projectsOf(t, ids.users[key].userId)).toEqual([]);
    }
  });
});

describe("WP74-S4 createBusiness: tenant slug", () => {
  test.each([
    ["Café Ünïcode!!", "cafe-unicode"],
    ["AI", "ai-business"],
    ["水の道", "business"],
    ["Support", "support-2"],
    ["The Very Long Weekend Trail Water Club!!", "the-very-long-weekend-trail-water-club"],
  ])("%s becomes %s", async (name, slug) => {
    const { t, as, ids } = await seed();
    const sessionId = await finishedSession(t, ids.users.owner.userId, { name: { chosen: name, alternatives: [] } });
    await expect(as("owner").mutation(api.workspace.business.createBusiness, { sessionId }))
      .resolves.toMatchObject({ slug });
  });

  test("a live hostname collision is suffixed in order", async () => {
    const { t, as, ids } = await seed();
    await businessFor(t, ids.users.other.userId, "hydrotrail", true);
    await businessFor(t, ids.adminId, "hydrotrail-2", true);
    const sessionId = await finishedSession(t, ids.users.owner.userId);
    await expect(as("owner").mutation(api.workspace.business.createBusiness, { sessionId }))
      .resolves.toMatchObject({ slug: "hydrotrail-3" });
  });

  test("known gap (g): another owner's unpublished business with the same slug is not detected yet", async () => {
    const { t, as, ids } = await seed();
    await businessFor(t, ids.users.other.userId, "hydrotrail", false);
    const sessionId = await finishedSession(t, ids.users.owner.userId);
    await expect(as("owner").mutation(api.workspace.business.createBusiness, { sessionId }))
      .resolves.toMatchObject({ slug: "hydrotrail" });
  });
});

describe("WP74-S4 createBusiness: guards", () => {
  test("signed out, flag off and another owner are refused", async () => {
    const { t, as, ids } = await seed();
    const sessionId = await finishedSession(t, ids.users.owner.userId);
    await expect(t.mutation(api.workspace.business.createBusiness, { sessionId })).rejects.toThrow(/UNAUTHENTICATED/);
    await expect(as("other").mutation(api.workspace.business.createBusiness, { sessionId })).rejects.toThrow(/RESOURCE_NOT_FOUND/);

    const off = await seed({ workspaceEnabled: false });
    const offSession = await finishedSession(off.t, off.ids.users.owner.userId);
    await expect(off.as("owner").mutation(api.workspace.business.createBusiness, { sessionId: offSession }))
      .rejects.toThrow(/WORKSPACE_DISABLED/);
    expect(await projectsOf(off.t, off.ids.users.owner.userId)).toEqual([]);
  });

  test("an unfinished, reworked, unparseable or abandoned session is refused", async () => {
    const { t, as, ids } = await seed();
    const owner = ids.users.owner.userId;
    const unfinished = await finishedSession(t, owner, {}, { completedAt: null });
    await expect(as("owner").mutation(api.workspace.business.createBusiness, { sessionId: unfinished }))
      .rejects.toThrow(/SESSION_INCOMPLETE/);

    const reworked = await finishedSession(t, owner, {}, {
      rawAnswers: { ...hydrotrailWizardAnswers, blueprintDecision: { decision: "rework", notes: "Narrower" } },
    });
    await expect(as("owner").mutation(api.workspace.business.createBusiness, { sessionId: reworked }))
      .rejects.toThrow(/SESSION_INCOMPLETE/);

    const unparsed = await finishedSession(t, owner, {}, {
      rawAnswers: { ...hydrotrailWizardAnswers, name: { chosen: "Two\nlines", alternatives: [] } },
    });
    await expect(as("owner").mutation(api.workspace.business.createBusiness, { sessionId: unparsed }))
      .rejects.toThrow(/SESSION_INCOMPLETE/);

    const abandoned = await finishedSession(t, owner, {}, { abandonedAt: 3 });
    await expect(as("owner").mutation(api.workspace.business.createBusiness, { sessionId: abandoned }))
      .rejects.toThrow(/RESOURCE_NOT_FOUND/);

    expect(await projectsOf(t, owner)).toEqual([]);
  });
});
