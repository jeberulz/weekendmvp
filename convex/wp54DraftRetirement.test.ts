/// <reference types="vite/client" />

import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { convexTest, type TestConvex } from "convex-test";
import type { FunctionReturnType } from "convex/server";
import type { Infer } from "convex/values";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import manifest from "../ideas/manifest.json";
import { isEngineDraftSlug } from "../lib/engine-drafts";
import { isRetiredIdea } from "./platform/catalogPolicy";
import { selectLibrary, type RankedCard } from "./platform/libraryResults";
import { capabilityExpiresAt, generateCapabilityToken, hashCapabilityToken } from "./platform/preview/capabilities";
import { normalizePreviewCustomisation, toSiteInput } from "./platform/preview/customisation";
import { SITE_RENDER_SPEC_CONTRACT_VERSION, serializeSiteRenderSpec } from "./platform/preview/renderSpec";
import schema from "./schema";

/**
 * WP54-S5 (review finding F3). Engine drafts seeded on 2026-09-24 stay stored
 * after a reseed without them, so retirement has to happen at read time:
 * no discovery path may return them, no new research/plan entry point may
 * start from them, and member work that references them must survive.
 */

const control = vi.hoisted(() => ({ plan: "free" }));
vi.mock("./platform/planResolver", () => ({ resolvePlan: async () => control.plan }));

// Root-absolute: a relative glob produces module keys convex-test cannot map
// back to function paths (see convex/platform/preview/generate.test.ts).
const modules = import.meta.glob("/convex/**/*.ts");

type SeedItem = Infer<typeof schema.tables.ideas.validator>;
type Member = { userId: Id<"users">; sessionId: Id<"authSessions"> };

const SEPT_24 = Date.parse("2026-09-24");

/**
 * The three engine drafts exactly as `scripts/seed-convex.mjs` built them from
 * the public manifest on 2026-09-24 (`git show 861da53^:ideas/manifest.json`),
 * before PR #71 moved them to engine/drafts/. Production still holds these rows.
 */
const DRAFTS: SeedItem[] = [
  {
    slug: "engine-draft-ai-rfp-response-assistant",
    title: "AI RFP Response Assistant",
    description:
      "RallyRFP helps lean SaaS teams complete RFPs and security questionnaires with approved answers, source evidence, and coordinated review.",
    category: "saas",
    buildTime: "10",
    revenueGoal: "5k-month",
    applicationCategory: "BusinessApplication",
    tools: ["cursor", "claude", "bolt", "windsurf"],
    audiences: ["developers", "solo-founders", "side-hustlers", "small-business-owners"],
    source: "engine:engine-draft-ai-rfp-response-assistant",
    scores: { opportunity: 8, pain: 9, timing: 8, builder_confidence: 7 },
    og: { subject: "RallyRFP product still life, no people, no text", accent: "lime", status: "pending" },
    researchLevel: "deep",
    publishedAt: SEPT_24,
    bodyMode: "mdx",
  },
  {
    slug: "engine-draft-ai-code-reviewer",
    title: "AI Code Reviewer",
    description:
      "A low-noise, repository-aware AI pull-request reviewer built and priced for GitHub teams under 10.",
    category: "developer-tools",
    buildTime: "10",
    revenueGoal: "5k-month",
    applicationCategory: "DeveloperApplication",
    tools: ["cursor", "claude", "windsurf", "replit"],
    audiences: ["developers", "solo-founders"],
    source: "engine:engine-draft-ai-code-reviewer",
    scores: { opportunity: 8, pain: 8, timing: 9, builder_confidence: 7 },
    og: { subject: "AI Code Reviewer product still life, no people, no text", accent: "mint", status: "pending" },
    researchLevel: "deep",
    publishedAt: SEPT_24,
    bodyMode: "mdx",
  },
  {
    slug: "engine-draft-ai-landing-page-generator-ecommerce",
    title: "AI Landing Page Generator for E-commerce",
    description:
      "Turn every Shopify ad into a fast, conversion-focused landing page matched to its creative, audience, and offer.",
    category: "ai-tools",
    buildTime: "10",
    revenueGoal: "5k-month",
    applicationCategory: "BusinessApplication",
    tools: ["cursor", "claude", "windsurf", "v0"],
    audiences: ["developers", "solo-founders", "marketers"],
    source: "engine:engine-draft-ai-landing-page-generator-ecommerce",
    scores: { opportunity: 8, pain: 8, timing: 8, builder_confidence: 8 },
    og: {
      subject: "AI Landing Page Generator for E-commerce product still life, no people, no text",
      accent: "lavender",
      status: "pending",
    },
    researchLevel: "deep",
    publishedAt: SEPT_24,
    bodyMode: "mdx",
  },
];
const [RFP_DRAFT, REVIEWER_DRAFT, LANDING_DRAFT] = DRAFTS.map((draft) => draft.slug);
const DRAFT_SLUGS = new Set(DRAFTS.map((draft) => draft.slug));

function ordinary(slug: string, overrides: Partial<SeedItem> = {}): SeedItem {
  return {
    slug,
    title: `Ordinary ${slug}`,
    description: `An ordinary published idea: ${slug}.`,
    category: "developer-tools",
    buildTime: "10",
    revenueGoal: "5k-month",
    applicationCategory: "BusinessApplication",
    tools: ["cursor", "claude"],
    audiences: ["developers", "solo-founders"],
    publishedAt: Date.parse("2026-09-10"),
    bodyMode: "mdx",
    ...overrides,
  };
}

/** Ordinary manifest ideas that share every hub dimension with a draft. */
const ORDINARY: SeedItem[] = [
  ordinary("ai-code-reviewer", {
    title: "AI Code Reviewer",
    description: "Pull-request review for small teams, with repository context.",
    category: "developer-tools",
    tools: ["cursor", "claude"],
    audiences: ["developers", "solo-founders"],
    publishedAt: Date.parse("2026-09-10"),
    scores: { opportunity: 7, pain: 7, timing: 7, builder_confidence: 7 },
  }),
  ordinary("rfp-desk", {
    title: "RFP Desk",
    description: "Answer security questionnaires from an approved library.",
    category: "saas",
    tools: ["cursor", "bolt"],
    audiences: ["small-business-owners", "developers"],
    publishedAt: Date.parse("2026-09-05"),
  }),
  ordinary("shop-page-builder", {
    title: "Shop Page Builder",
    description: "Landing pages for every ad set in a small store.",
    category: "ai-tools",
    tools: ["v0", "windsurf"],
    audiences: ["marketers", "solo-founders"],
    publishedAt: Date.parse("2026-09-01"),
  }),
];
const ORDINARY_NEWEST_FIRST = ["ai-code-reviewer", "rfp-desk", "shop-page-builder"];

/** What a visitor typed into the anonymous preview form. */
const PREVIEW_CUSTOMISATION = {
  headline: "Review every pull request calmly",
  subheadline: "Repository-aware review for small teams.",
  problemStatement: "Small teams merge risky diffs because review queues pile up.",
  keyBenefits: ["Flags the risky lines first"],
  callToAction: "Get early access",
};

function slugsOf(rows: ReadonlyArray<{ slug: string }>) {
  return rows.map((row) => row.slug);
}

function withoutDrafts(slugs: readonly string[]) {
  return slugs.filter((slug) => !DRAFT_SLUGS.has(slug));
}

async function storedSlugs(t: TestConvex<typeof schema>) {
  return await t.run(async (ctx) =>
    slugsOf(await ctx.db.query("ideas").withIndex("by_slug").take(100)),
  );
}

async function ideaId(t: TestConvex<typeof schema>, slug: string): Promise<Id<"ideas">> {
  const row = await t.run((ctx) =>
    ctx.db
      .query("ideas")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique(),
  );
  if (row === null) throw new Error(`fixture idea ${slug} is missing`);
  return row._id;
}

/** 2026-09-24 publish (drafts + ordinary ideas), then the PR #71 reseed (ordinary only). */
async function seedThenReseedWithoutDrafts(t: TestConvex<typeof schema>) {
  await t.mutation(internal.seed.seedIdeas, { items: [...DRAFTS, ...ORDINARY] });
  const reseed = await t.mutation(internal.seed.seedIdeas, { items: ORDINARY });
  expect(reseed).toEqual({ inserted: 0, updated: ORDINARY.length });
}

async function seedUser(t: TestConvex<typeof schema>, email: string): Promise<Member> {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: 9_999_999_999_999 });
    return { userId, sessionId };
  });
}

function asUser(t: TestConvex<typeof schema>, member: Member) {
  return t.withIdentity({
    subject: `${member.userId}|${member.sessionId}`,
    issuer: "https://local.test",
    tokenIdentifier: `https://local.test|${member.userId}`,
  });
}

async function drainPublicArchive(t: TestConvex<typeof schema>, limit: number) {
  const pages: FunctionReturnType<typeof api.ideas.list>[] = [];
  let cursor: string | null = null;
  for (let call = 0; call < 50; call += 1) {
    const page: FunctionReturnType<typeof api.ideas.list> = await t.query(api.ideas.list, { limit, cursor });
    pages.push(page);
    if (page.isDone) return pages;
    cursor = page.continueCursor;
  }
  throw new Error("public archive pagination did not terminate");
}

async function drainLibrary(
  member: ReturnType<typeof asUser>,
  paginationOpts: { numItems: number; maximumRowsRead?: number },
) {
  const pages: FunctionReturnType<typeof api.platform.ideas.libraryPage>[] = [];
  let cursor: string | null = null;
  for (let call = 0; call < 50; call += 1) {
    const page: FunctionReturnType<typeof api.platform.ideas.libraryPage> = await member.query(
      api.platform.ideas.libraryPage,
      { paginationOpts: { ...paginationOpts, cursor } },
    );
    pages.push(page);
    if (page.isDone) return pages;
    cursor = page.continueCursor;
  }
  throw new Error("library pagination did not terminate");
}

describe("F3 probe (review 2026-10-01)", () => {
  test("reseeding without a draft leaves its stored row but takes it out of the public archive", async () => {
    const t = convexTest(schema, modules);
    // 2026-09-24: the draft shipped through the real seed mutation.
    await t.mutation(internal.seed.seedIdeas, { items: [DRAFTS[1]] });
    // PR #71: the next seed only carries ordinary manifest ideas.
    await t.mutation(internal.seed.seedIdeas, { items: [ordinary("ordinary-idea")] });

    // The seed upserts; it never deletes, so the draft row is still stored.
    expect(await storedSlugs(t)).toEqual(["engine-draft-ai-code-reviewer", "ordinary-idea"]);

    const archive = await t.query(api.ideas.list, { limit: 20 });
    expect(archive.page.map((idea) => idea.slug)).toEqual(["ordinary-idea"]);
  });
});

describe("public discovery after the reseed", () => {
  test("stored drafts survive, but no public discovery query returns them", async () => {
    const t = convexTest(schema, modules);
    await seedThenReseedWithoutDrafts(t);

    // No production mutation: every draft row is still stored, unchanged.
    expect(new Set(await storedSlugs(t))).toEqual(new Set([...DRAFT_SLUGS, ...ORDINARY_NEWEST_FIRST]));
    for (const draft of DRAFTS) {
      const stored = await t.run((ctx) =>
        ctx.db
          .query("ideas")
          .withIndex("by_slug", (q) => q.eq("slug", draft.slug))
          .unique(),
      );
      expect(stored).toMatchObject({ slug: draft.slug, title: draft.title, publishedAt: SEPT_24 });
    }

    // /startup-ideas, /solve/*, collection hubs: the drained archive.
    const archive = await drainPublicArchive(t, 2);
    expect(archive.flatMap((page) => slugsOf(page.page))).toEqual(ORDINARY_NEWEST_FIRST);

    // Category hubs and the revenue hubs.
    expect(slugsOf(await t.query(api.ideas.byCategory, { category: "saas" }))).toEqual(["rfp-desk"]);
    expect(slugsOf(await t.query(api.ideas.byCategory, { category: "developer-tools" }))).toEqual([
      "ai-code-reviewer",
    ]);
    expect(slugsOf(await t.query(api.ideas.byCategory, { category: "ai-tools" }))).toEqual([
      "shop-page-builder",
    ]);
    expect(slugsOf(await t.query(api.ideas.byRevenueGoal, { revenueGoal: "5k-month" }))).toEqual(
      ORDINARY_NEWEST_FIRST,
    );

    // /build-with/{tool}: `replit` was only ever a draft's tool.
    for (const tool of ["cursor", "claude", "bolt", "windsurf", "replit", "v0"]) {
      const rows = slugsOf(await t.query(api.ideas.byTool, { tool }));
      expect(rows, tool).toEqual(withoutDrafts(rows));
    }
    expect(await t.query(api.ideas.byTool, { tool: "replit" })).toEqual([]);

    // /ideas-for/{audience}: `side-hustlers` was only ever a draft's audience.
    for (const audience of ["developers", "solo-founders", "side-hustlers", "small-business-owners", "marketers"]) {
      const rows = slugsOf(await t.query(api.ideas.byAudience, { audience }));
      expect(rows, audience).toEqual(withoutDrafts(rows));
    }
    expect(await t.query(api.ideas.byAudience, { audience: "side-hustlers" })).toEqual([]);

    // /ideas/today: the drafts are the newest rows in the table.
    expect((await t.query(api.ideas.latest, {}))?.slug).toBe("ai-code-reviewer");

    // Related ideas: same category first, then shared audiences.
    expect(slugsOf(await t.query(api.ideas.relatedFor, { slug: "ai-code-reviewer", limit: 4 }))).toEqual([
      "rfp-desk",
      "shop-page-builder",
    ]);
    expect(await t.query(api.ideas.relatedFor, { slug: REVIEWER_DRAFT, limit: 4 })).toEqual([]);

    expect(slugsOf(await t.query(api.ideas.allForSitemap, {}))).toEqual(ORDINARY_NEWEST_FIRST);

    // Public direct lookups (curated hub rails, /build/{slug}, prompt bodies).
    for (const slug of DRAFT_SLUGS) expect(await t.query(api.ideas.bySlug, { slug })).toBeNull();
    expect((await t.query(api.ideas.bySlug, { slug: "ai-code-reviewer" }))?.slug).toBe("ai-code-reviewer");
    expect(await t.query(api.ideas.bySlug, { slug: "not-an-idea" })).toBeNull();
  });
});

describe("member discovery after the reseed", () => {
  test("catalogue pages, search, facets and totals describe visible ideas only", async () => {
    control.plan = "free";
    const t = convexTest(schema, modules);
    await seedThenReseedWithoutDrafts(t);
    const member = asUser(t, await seedUser(t, "member@example.test"));

    const cards: RankedCard[] = (await drainLibrary(member, { numItems: 100 })).flatMap((page) => page.page);
    expect(slugsOf(cards)).toEqual(ORDINARY_NEWEST_FIRST);

    const everything = selectLibrary(cards, { view: "all", sort: "newest" });
    expect(everything.total).toBe(3);
    expect(everything.facets.category.reduce((sum, row) => sum + row.count, 0)).toBe(3);
    expect(everything.facets.tools.map((row) => row.value)).not.toContain("replit");
    expect(everything.facets.goal).toEqual([{ value: "5k-month", count: 3 }]);
    expect(slugsOf(selectLibrary(cards, { view: "all", search: "code reviewer" }).items)).toEqual([
      "ai-code-reviewer",
    ]);
    expect(slugsOf(selectLibrary(cards, { view: "for_you" }).items)).toEqual(
      expect.arrayContaining(ORDINARY_NEWEST_FIRST),
    );

    // Compatibility snapshot (pre-WP44 clients).
    const all = await member.query(api.platform.ideas.library, { view: "all", limit: 50 });
    expect(slugsOf(all.items)).toEqual(ORDINARY_NEWEST_FIRST);
    expect(all.total).toBe(3);
    expect(all.facets.category.reduce((sum, row) => sum + row.count, 0)).toBe(3);
    expect(all.facets.tools.map((row) => row.value)).not.toContain("replit");
    const fresh = await member.query(api.platform.ideas.library, {
      view: "new",
      publishedAfter: Date.parse("2026-08-01"),
      limit: 50,
    });
    expect(slugsOf(fresh.items)).toEqual(ORDINARY_NEWEST_FIRST);
    const searched = await member.query(api.platform.ideas.library, {
      view: "all",
      search: "reviewer",
      limit: 50,
    });
    expect(slugsOf(searched.items)).toEqual(["ai-code-reviewer"]);
    expect(searched.total).toBe(1);
    const forYou = await member.query(api.platform.ideas.library, { view: "for_you", limit: 50 });
    expect(withoutDrafts(slugsOf(forYou.items))).toEqual(slugsOf(forYou.items));

    // Legacy explore (rollback window): the discovery views.
    for (const view of ["all", "for_you"] as const) {
      const page = await member.query(api.platform.ideas.explore, {
        view,
        sort: "newest",
        paginationOpts: { numItems: 20, cursor: null },
      });
      expect(slugsOf(page.page), view).toEqual(ORDINARY_NEWEST_FIRST);
    }
    const byCategory = await member.query(api.platform.ideas.explore, {
      view: "all",
      category: "developer-tools",
      sort: "newest",
      paginationOpts: { numItems: 20, cursor: null },
    });
    expect(slugsOf(byCategory.page)).toEqual(["ai-code-reviewer"]);
  });

  test("compare leaves retired drafts out of the side-by-side view", async () => {
    control.plan = "builders_hub";
    const t = convexTest(schema, modules);
    await seedThenReseedWithoutDrafts(t);
    const member = asUser(t, await seedUser(t, "hub@example.test"));
    const rows = await member.query(api.platform.compare.ideas, {
      slugs: [REVIEWER_DRAFT, "ai-code-reviewer", "rfp-desk"],
    });
    expect(slugsOf(rows)).toEqual(["ai-code-reviewer", "rfp-desk"]);
  });
});

describe("the draft prefix boundary (review M34)", () => {
  // A slug that is exactly the prefix sits on the range's lower bound.
  const BARE_PREFIX = "engine-draft-";
  // Just below the range, and just past its upper bound ("engine-draft.").
  const NEIGHBOURS = ["engine-draft", "engine-drafts-x"] as const;

  test("a slug that is exactly the draft prefix is a draft, in the pure rule and in the database filter", async () => {
    expect(isEngineDraftSlug(BARE_PREFIX)).toBe(true);
    for (const slug of NEIGHBOURS) expect(isEngineDraftSlug(slug), slug).toBe(false);

    control.plan = "free";
    const t = convexTest(schema, modules);
    await t.mutation(internal.seed.seedIdeas, {
      items: [
        // Newest, so a leak would lead every list.
        ordinary(BARE_PREFIX, { publishedAt: Date.parse("2026-09-30") }),
        ordinary(NEIGHBOURS[0], { publishedAt: Date.parse("2026-09-20") }),
        ordinary(NEIGHBOURS[1], { publishedAt: Date.parse("2026-09-19") }),
      ],
    });
    expect(await storedSlugs(t)).toContain(BARE_PREFIX);

    expect(slugsOf((await t.query(api.ideas.list, { limit: 20 })).page)).toEqual(NEIGHBOURS);
    expect(slugsOf(await t.query(api.ideas.allForSitemap, {}))).toEqual(NEIGHBOURS);
    expect((await t.query(api.ideas.latest, {}))?.slug).toBe(NEIGHBOURS[0]);
    const member = asUser(t, await seedUser(t, "boundary@example.test"));
    const library = await drainLibrary(member, { numItems: 20 });
    expect(library.flatMap((page) => slugsOf(page.page))).toEqual(NEIGHBOURS);
  });
});

describe("pagination with hidden drafts ahead of visible ideas", () => {
  const hidden = Array.from({ length: 7 }, (_, index) =>
    ordinary(`engine-draft-hidden-${index}`, { publishedAt: Date.parse("2026-09-30") - index }),
  );
  const visible = [
    ordinary("visible-a", { publishedAt: Date.parse("2026-09-20") }),
    ordinary("visible-b", { publishedAt: Date.parse("2026-09-19") }),
    ordinary("visible-c", { publishedAt: Date.parse("2026-09-18") }),
  ];

  async function seeded() {
    const t = convexTest(schema, modules);
    await t.mutation(internal.seed.seedIdeas, { items: [...hidden, ...visible] });
    await t.mutation(internal.seed.seedIdeas, { items: visible });
    return t;
  }

  test("the public archive reaches every visible idea once, in order, and terminates", async () => {
    const t = await seeded();
    for (const limit of [1, 2, 3, 20]) {
      const pages = await drainPublicArchive(t, limit);
      const slugs = pages.flatMap((page) => slugsOf(page.page));
      expect(slugs, `limit ${limit}`).toEqual(["visible-a", "visible-b", "visible-c"]);
      expect(pages.at(-1)?.isDone).toBe(true);
      expect(pages.slice(0, -1).every((page) => !page.isDone)).toBe(true);
    }
  });

  test("a bounded member scan returns empty pages with isDone false and the cursor still reaches the rest", async () => {
    control.plan = "free";
    const t = await seeded();
    const member = asUser(t, await seedUser(t, "pager@example.test"));

    const bounded = await drainLibrary(member, { numItems: 2, maximumRowsRead: 2 });
    // The first underlying pages hold nothing but hidden drafts.
    expect(bounded[0]).toMatchObject({ page: [], isDone: false });
    expect(bounded.filter((page) => page.page.length === 0 && !page.isDone).length).toBeGreaterThanOrEqual(3);
    const slugs = bounded.flatMap((page) => slugsOf(page.page));
    expect(slugs).toEqual(["visible-a", "visible-b", "visible-c"]);
    expect(bounded.at(-1)?.isDone).toBe(true);

    for (const numItems of [1, 2, 100]) {
      const pages = await drainLibrary(member, { numItems });
      expect(pages.flatMap((page) => slugsOf(page.page)), `numItems ${numItems}`).toEqual([
        "visible-a",
        "visible-b",
        "visible-c",
      ]);
    }
  });

  test("the legacy explore view continues through a draft-only underlying page", async () => {
    control.plan = "free";
    const t = await seeded();
    const member = asUser(t, await seedUser(t, "legacy@example.test"));
    const slugs: string[] = [];
    let cursor: string | null = null;
    let sawEmptyContinuation = false;
    for (let call = 0; call < 50; call += 1) {
      const page: FunctionReturnType<typeof api.platform.ideas.explore> = await member.query(
        api.platform.ideas.explore,
        { view: "all", sort: "newest", paginationOpts: { numItems: 2, cursor, maximumRowsRead: 2 } },
      );
      slugs.push(...slugsOf(page.page));
      if (page.page.length === 0 && !page.isDone) sawEmptyContinuation = true;
      if (page.isDone) break;
      cursor = page.continueCursor;
    }
    expect(sawEmptyContinuation).toBe(true);
    expect(slugs).toEqual(["visible-a", "visible-b", "visible-c"]);
  });
});

describe("member work that references a retired draft", () => {
  async function memberWithDraftWork() {
    control.plan = "free";
    const t = convexTest(schema, modules);
    registerRateLimiter(t);
    await seedThenReseedWithoutDrafts(t);
    const owner = await seedUser(t, "owner@example.test");
    const other = await seedUser(t, "other@example.test");
    const reviewerDraft = await ideaId(t, REVIEWER_DRAFT);
    const rfpDraft = await ideaId(t, RFP_DRAFT);
    const ordinaryId = await ideaId(t, "rfp-desk");
    const work = await t.run(async (ctx) => {
      // Written while the drafts were public (2026-09-24 to the PR #71 merge).
      await ctx.db.insert("idea_intents", {
        ownerId: owner.userId,
        ideaId: reviewerDraft,
        saved: true,
        interested: false,
        saveVersion: 1,
        updatedAt: 300,
      });
      await ctx.db.insert("idea_intents", {
        ownerId: owner.userId,
        ideaId: rfpDraft,
        saved: false,
        interested: true,
        updatedAt: 200,
      });
      await ctx.db.insert("idea_intents", {
        ownerId: owner.userId,
        ideaId: ordinaryId,
        saved: true,
        interested: false,
        updatedAt: 100,
      });
      await ctx.db.insert("idea_notes", {
        ownerId: owner.userId,
        ideaId: reviewerDraft,
        body: "Ask three teams about review noise.",
        updatedAt: 300,
      });
      const collectionId = await ctx.db.insert("collections", {
        ownerId: owner.userId,
        name: "Dev tools",
        itemCount: 1,
        updatedAt: 300,
      });
      await ctx.db.insert("collection_items", {
        ownerId: owner.userId,
        collectionId,
        ideaId: reviewerDraft,
        addedAt: 300,
      });
      const planId = await ctx.db.insert("weekend_plans", {
        ownerId: owner.userId,
        ideaId: reviewerDraft,
        status: "active",
        steps: [{ key: "fri-scope", doneAt: 310 }],
        coreFeature: "Comment on one risky diff",
        startedAt: 300,
        updatedAt: 310,
      });
      return { collectionId, planId };
    });
    return { t, owner: asUser(t, owner), other: asUser(t, other), ...work };
  }

  test("saves, notes, collections and plans stay readable by their owner", async () => {
    const { owner, collectionId, planId } = await memberWithDraftWork();

    const saved = await owner.query(api.platform.dashboard.savedPage, {
      paginationOpts: { numItems: 20, cursor: null },
    });
    expect(saved.page.map((item) => item.card.slug)).toEqual([REVIEWER_DRAFT, RFP_DRAFT, "rfp-desk"]);
    expect(saved.page[0].note).toBe("Ask three teams about review noise.");
    expect(saved.page[0].card.building).toBe(true);

    const list = await owner.query(api.platform.dashboard.savedList, { limit: 50 });
    expect(list.total).toBe(3);
    expect(list.items.map((item) => item.card.slug)).toEqual([REVIEWER_DRAFT, RFP_DRAFT, "rfp-desk"]);

    // Member-work counts describe the member's own records, drafts included:
    // the Saved page lists every one of them, marked retired.
    const home = await owner.query(api.platform.dashboard.home, {});
    expect(home.saved.count).toBe(3);
    expect(home.saved.latest.map((idea) => idea.slug)).toEqual([REVIEWER_DRAFT, RFP_DRAFT, "rfp-desk"]);
    expect(home.activePlan?.slug).toBe(REVIEWER_DRAFT);

    expect(await owner.query(api.platform.dashboard.savedState, { slug: REVIEWER_DRAFT })).toEqual({
      saved: true,
      version: 1,
    });
    expect(await owner.query(api.platform.notes.get, { slug: REVIEWER_DRAFT })).toMatchObject({
      body: "Ask three teams about review noise.",
    });
    const collection = await owner.query(api.platform.collections.items, { collectionId });
    expect(collection.items.map((item) => item.card.slug)).toEqual([REVIEWER_DRAFT]);
    expect(await owner.query(api.platform.collections.forIdea, { slug: REVIEWER_DRAFT })).toEqual([collectionId]);

    const plan = await owner.query(api.platform.weekendPlans.get, { planId });
    expect(plan).toMatchObject({
      plan: { slug: REVIEWER_DRAFT, status: "active", coreFeature: "Comment on one risky diff" },
      idea: { slug: REVIEWER_DRAFT, title: "AI Code Reviewer" },
    });
    expect((await owner.query(api.platform.weekendPlans.list, {})).active.map((p) => p.slug)).toEqual([
      REVIEWER_DRAFT,
    ]);
    const history = await owner.query(api.platform.weekendPlans.history, {
      status: "active",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(history.page.map((p) => p.planId)).toEqual([planId]);

    // The owner can still change their own work: progress, and removing the save.
    await owner.mutation(api.platform.weekendPlans.toggleStep, { planId, key: "sat-core", done: true });
    expect((await owner.query(api.platform.weekendPlans.get, { planId })).plan.doneKeys).toContain("sat-core");
    expect(
      await owner.mutation(api.platform.dashboard.setSaved, { slug: REVIEWER_DRAFT, saved: false, expectedVersion: 1 }),
    ).toEqual({ saved: false, version: 2 });
  });

  test("another member stays denied", async () => {
    const { other, collectionId, planId } = await memberWithDraftWork();
    await expect(other.query(api.platform.weekendPlans.get, { planId })).rejects.toThrow("RESOURCE_NOT_FOUND");
    await expect(other.query(api.platform.collections.items, { collectionId })).rejects.toThrow(
      "RESOURCE_NOT_FOUND",
    );
    await expect(other.mutation(api.platform.weekendPlans.archive, { planId })).rejects.toThrow(
      "RESOURCE_NOT_FOUND",
    );
    expect(await other.query(api.platform.notes.get, { slug: REVIEWER_DRAFT })).toBeNull();
    expect(
      (await other.query(api.platform.dashboard.savedPage, { paginationOpts: { numItems: 20, cursor: null } })).page,
    ).toEqual([]);
    expect((await other.query(api.platform.dashboard.home, {})).saved.count).toBe(0);
  });

  test("no new plan, project, preview or prompt export starts from a draft", async () => {
    const { t, owner } = await memberWithDraftWork();

    await expect(owner.mutation(api.platform.weekendPlans.start, { slug: RFP_DRAFT })).rejects.toThrow(
      "RESOURCE_NOT_FOUND",
    );
    expect((await owner.query(api.platform.weekendPlans.startPreview, { slug: LANDING_DRAFT })).idea).toBeNull();
    expect((await owner.query(api.platform.weekendPlans.startPreview, { slug: "rfp-desk" })).idea?.slug).toBe(
      "rfp-desk",
    );

    await expect(
      owner.mutation(api.platform.intake.startRepositoryIdea, {
        idempotencyKey: "wp54-draft-start-0001",
        slug: LANDING_DRAFT,
      }),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
    expect(await t.run((ctx) => ctx.db.query("projects").take(10))).toEqual([]);

    control.plan = "builders_hub";
    await expect(owner.query(api.platform.promptPack.source, { slug: REVIEWER_DRAFT })).rejects.toThrow(
      "RESOURCE_NOT_FOUND",
    );
    expect((await owner.query(api.platform.promptPack.source, { slug: "rfp-desk" })).slug).toBe("rfp-desk");
    expect(await t.run((ctx) => ctx.db.query("weekend_plans").take(10))).toHaveLength(1);
  });

  test("a repeated repository start stays idempotent after its idea retires, but no new one begins", async () => {
    const { t, owner } = await memberWithDraftWork();
    const shopId = await ideaId(t, "shop-page-builder");
    const created = await owner.mutation(api.platform.intake.startRepositoryIdea, {
      idempotencyKey: "wp54-repository-0001",
      slug: "shop-page-builder",
    });
    // The idea later turns out to be an engine draft (same row, draft slug).
    await t.run((ctx) => ctx.db.patch("ideas", shopId, { slug: "engine-draft-shop-page-builder" }));
    const replay = await owner.mutation(api.platform.intake.startRepositoryIdea, {
      idempotencyKey: "wp54-repository-0001",
      slug: "engine-draft-shop-page-builder",
    });
    expect(replay.projectId).toBe(created.projectId);
    await expect(
      owner.mutation(api.platform.intake.startRepositoryIdea, {
        idempotencyKey: "wp54-repository-0002",
        slug: "engine-draft-shop-page-builder",
      }),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
    expect(await t.run((ctx) => ctx.db.query("projects").take(10))).toHaveLength(1);
  });
});

describe("anonymous preview generation", () => {
  const SECRET = "a-secure-test-only-preview-bridge-secret-wp54";
  beforeEach(() => {
    process.env.PLATFORM_PREVIEW_BRIDGE_SECRET = SECRET;
  });
  afterEach(() => {
    delete process.env.PLATFORM_PREVIEW_BRIDGE_SECRET;
  });

  async function sign(payload: object) {
    const serialized = JSON.stringify(payload);
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(serialized));
    const signature = btoa(String.fromCharCode(...new Uint8Array(mac)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    return { payload: serialized, signature };
  }

  test("a retired draft is not eligible for a new preview", async () => {
    const t = convexTest(schema, modules);
    registerRateLimiter(t);
    await seedThenReseedWithoutDrafts(t);
    const body = (slug: string) => ({
      slug,
      templateId: "editorial",
      clientKey: "ip:203.0.113.7",
      customisation: PREVIEW_CUSTOMISATION,
    });
    await expect(
      t.mutation(api.platform.preview.generate.generateFromBridge, await sign(body(REVIEWER_DRAFT))),
    ).rejects.toThrow("IDEA_NOT_FOUND");
    expect(await t.run((ctx) => ctx.db.query("preview_capabilities").take(10))).toEqual([]);
    const { token } = await t.mutation(
      api.platform.preview.generate.generateFromBridge,
      await sign(body("ai-code-reviewer")),
    );
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("claiming a preview minted before the drafts retired (review P3-13)", () => {
  /**
   * A capability exactly as `generateFromBridge` stored one before the
   * backend deploy. That bridge had no draft guard and a capability lives
   * 7 days, so one minted for a draft can still be live after the deploy.
   */
  async function mintPreview(t: TestConvex<typeof schema>, sourceIdeaId: Id<"ideas">) {
    const token = generateCapabilityToken();
    const tokenHash = await hashCapabilityToken(token);
    const now = Date.now();
    const capabilityId = await t.run((ctx) =>
      ctx.db.insert("preview_capabilities", {
        tokenHash,
        sourceIdeaId,
        templateId: "editorial",
        renderSpec: serializeSiteRenderSpec({
          contractVersion: SITE_RENDER_SPEC_CONTRACT_VERSION,
          templateId: "editorial",
          siteInput: toSiteInput(normalizePreviewCustomisation(PREVIEW_CUSTOMISATION)),
        }),
        expiresAt: capabilityExpiresAt(now),
        createdAt: now,
      }),
    );
    return { token, capabilityId };
  }

  /** The claim's error message, or "claimed" when it went through. */
  async function claimOutcome(member: ReturnType<typeof asUser>, token: string): Promise<string> {
    try {
      await member.mutation(api.platform.preview.claim.claim, { token });
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
    return "claimed";
  }

  async function ownedGraphRows(t: TestConvex<typeof schema>) {
    return await t.run(async (ctx) => ({
      projects: (await ctx.db.query("projects").take(10)).length,
      documents: (await ctx.db.query("documents").take(10)).length,
      siteConfigs: (await ctx.db.query("site_configs").take(10)).length,
      siteVersions: (await ctx.db.query("site_versions").take(10)).length,
    }));
  }

  test("a draft's preview is refused like an unknown token and its capability is left untouched", async () => {
    const t = convexTest(schema, modules);
    await seedThenReseedWithoutDrafts(t);
    const member = asUser(t, await seedUser(t, "claimer@example.test"));
    const { token, capabilityId } = await mintPreview(t, await ideaId(t, REVIEWER_DRAFT));
    const before = await t.run((ctx) => ctx.db.get("preview_capabilities", capabilityId));

    const refused = await claimOutcome(member, token);
    expect(refused).toContain("RESOURCE_NOT_FOUND");
    // One shape for every refusal: a draft reads exactly like a token that never existed.
    expect(refused).toBe(await claimOutcome(member, generateCapabilityToken()));

    expect(await ownedGraphRows(t)).toEqual({ projects: 0, documents: 0, siteConfigs: 0, siteVersions: 0 });
    // Not claimed, deleted or rewritten: the row is exactly as it was.
    expect(await t.run((ctx) => ctx.db.get("preview_capabilities", capabilityId))).toEqual(before);
    // Refusing again is stable, and still writes nothing.
    expect(await claimOutcome(member, token)).toBe(refused);
    expect((await ownedGraphRows(t)).projects).toBe(0);
  });

  test("an ordinary idea's in-flight preview still claims into a new project (WP44 R5)", async () => {
    const t = convexTest(schema, modules);
    await seedThenReseedWithoutDrafts(t);
    const member = asUser(t, await seedUser(t, "claimer@example.test"));
    const ordinaryId = await ideaId(t, "ai-code-reviewer");
    const { token, capabilityId } = await mintPreview(t, ordinaryId);

    const graph = await member.mutation(api.platform.preview.claim.claim, { token });
    expect(graph.created).toBe(true);
    expect(await t.run((ctx) => ctx.db.get("projects", graph.projectId))).toMatchObject({
      source: "repository_idea",
      sourceIdeaId: ordinaryId,
      status: "draft",
    });
    expect(await t.run((ctx) => ctx.db.get("preview_capabilities", capabilityId))).toMatchObject({
      claimedProjectId: graph.projectId,
    });
    expect(await ownedGraphRows(t)).toEqual({ projects: 1, documents: 1, siteConfigs: 1, siteVersions: 1 });
  });

  test("a claim made before the retirement replays to the same project, but no new claim starts", async () => {
    const t = convexTest(schema, modules);
    await seedThenReseedWithoutDrafts(t);
    const owner = asUser(t, await seedUser(t, "owner@example.test"));
    const other = asUser(t, await seedUser(t, "other@example.test"));
    const shopId = await ideaId(t, "shop-page-builder");
    const { token } = await mintPreview(t, shopId);
    const claimed = await owner.mutation(api.platform.preview.claim.claim, { token });
    // The idea later turns out to be an engine draft (same row, draft slug).
    await t.run((ctx) => ctx.db.patch("ideas", shopId, { slug: "engine-draft-shop-page-builder" }));

    // The member's existing project is their work: a retried claim still finds it.
    expect(await owner.mutation(api.platform.preview.claim.claim, { token })).toEqual({ ...claimed, created: false });
    expect(await claimOutcome(other, token)).toContain("RESOURCE_NOT_FOUND");
    // A second, unclaimed preview of the same idea starts nothing for anyone.
    const { token: second } = await mintPreview(t, shopId);
    expect(await claimOutcome(owner, second)).toContain("RESOURCE_NOT_FOUND");
    expect(await claimOutcome(other, second)).toContain("RESOURCE_NOT_FOUND");
    expect(await ownedGraphRows(t)).toEqual({ projects: 1, documents: 1, siteConfigs: 1, siteVersions: 1 });
  });

  /**
   * An idea WP44 retired through the manifest (`_retiredAt`). It left the
   * member catalogue, but its page still renders and, unlike an engine draft,
   * an in-flight preview of it can still be kept (WP44 R5).
   */
  function wp44RetiredSlug(): string {
    const idea = manifest.ideas.find((entry) => "_retiredAt" in entry && entry._retiredAt);
    if (idea === undefined) throw new Error("the manifest has no WP44-retired idea to test with");
    return idea.slug;
  }

  test("a WP44-retired idea's in-flight preview still claims into a new project (review MC5)", async () => {
    const retiredSlug = wp44RetiredSlug();
    expect(isRetiredIdea(retiredSlug)).toBe(true);
    expect(isEngineDraftSlug(retiredSlug)).toBe(false);
    const t = convexTest(schema, modules);
    await t.mutation(internal.seed.seedIdeas, { items: [ordinary(retiredSlug)] });
    const member = asUser(t, await seedUser(t, "claimer@example.test"));
    const retiredId = await ideaId(t, retiredSlug);
    const { token } = await mintPreview(t, retiredId);

    const graph = await member.mutation(api.platform.preview.claim.claim, { token });
    expect(graph.created).toBe(true);
    expect(await t.run((ctx) => ctx.db.get("projects", graph.projectId))).toMatchObject({
      source: "repository_idea",
      sourceIdeaId: retiredId,
    });
  });

  test("the preview page is told when a preview's idea is a retired draft, and only then", async () => {
    const t = convexTest(schema, modules);
    await seedThenReseedWithoutDrafts(t);
    const retiredSlug = wp44RetiredSlug();
    await t.mutation(internal.seed.seedIdeas, { items: [ordinary(retiredSlug)] });
    async function viewOf(slug: string) {
      const { token } = await mintPreview(t, await ideaId(t, slug));
      return await t.action(api.platform.preview.read.view, { token });
    }

    // Still viewable until it expires; it just can't be kept.
    expect(await viewOf(REVIEWER_DRAFT)).toMatchObject({ claimed: false, researchWithheld: true });
    expect(await viewOf("ai-code-reviewer")).toMatchObject({ claimed: false, researchWithheld: false });
    expect(await viewOf(retiredSlug)).toMatchObject({ claimed: false, researchWithheld: false });
  });
});
