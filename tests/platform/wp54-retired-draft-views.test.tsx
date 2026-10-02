import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { FunctionReference, FunctionReturnType } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { PlanDetail } from "../../components/platform/builds/PlanDetail";
import { SavedIdeas } from "../../components/platform/explore/SavedIdeas";
import { isComparable } from "../../components/platform/explore/saved-compare";
import { NextStepCard } from "../../components/platform/home/NextStepCard";
import { PendingSaveRunner } from "../../components/platform/shell/PendingSaveRunner";
import { PENDING_SAVE_KEY, PENDING_SAVE_MAX_ATTEMPTS } from "../../lib/pending-save";

/**
 * WP54-S5, review P3-12. A member's plan, Home card, pending save and Saved
 * page can still hold an engine draft whose research page answers 404. Each
 * view is rendered whole from the data its queries return, for a draft and
 * for an ordinary idea, so removing or inverting a draft branch changes
 * what the member sees and fails here. Saved's compare mode needs a click,
 * so its per-row rule is tested directly; see that block.
 */

const convex = vi.hoisted(() => ({
  /** Query results by function name, e.g. "platform/weekendPlans:get". */
  queries: new Map<string, unknown>(),
  saved: [] as unknown[],
}));

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useQuery: (query: FunctionReference<"query">, args?: unknown) =>
      args === "skip" ? undefined : convex.queries.get(getFunctionName(query)),
    usePaginatedQuery: () => ({ results: convex.saved, status: "Exhausted", loadMore: vi.fn() }),
    useMutation: () => Object.assign(vi.fn(), { withOptimisticUpdate: () => vi.fn() }),
    useConvex: () => ({ query: vi.fn() }),
    useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  };
});
// The browser-only gate never opens in a static render (its server snapshot
// is "not mounted"), and every view under test sits behind it.
vi.mock("../../components/platform/client-gates", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../components/platform/client-gates")>()),
  WhenConvexReady: ({ children }: { children: ReactNode }) => children,
}));
// Builder's Hub on, so "Export prompt pack" renders wherever a view offers it.
vi.mock("../../components/platform/plan/flag", () => ({
  BUILDERS_HUB_UI: true,
  UPGRADE_HREF: "/dashboard/billing#builders-hub",
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
// next/image reads `document` at import time, which the edge test runtime lacks.
vi.mock("../../components/home/IdeaArt", () => ({ IdeaArt: () => null }));
// next/font only runs under the Next compiler; the upgrade sheet imports it.
vi.mock("next/font/google", () => ({
  Newsreader: () => ({ className: "font-serif", variable: "--font-serif", style: { fontFamily: "serif" } }),
}));

type PlanData = FunctionReturnType<typeof api.platform.weekendPlans.get>;
type Home = FunctionReturnType<typeof api.platform.dashboard.home>;
type SavedItem = FunctionReturnType<typeof api.platform.dashboard.savedPage>["page"][number];

const DRAFT = "engine-draft-ai-code-reviewer";
const ORDINARY = "ai-code-reviewer";
const TITLE = "AI Code Reviewer";
const PLAN_ID = "plan-1" as Id<"weekend_plans">;

const draftLink = /href="\/ideas\/engine-draft-/;
const ordinaryLink = 'href="/ideas/ai-code-reviewer"';
const RETIRED_LABEL = "Research retired";
const EXPORT = "Export prompt pack";

function plan(slug: string): PlanData["plan"] {
  return {
    planId: PLAN_ID,
    status: "active",
    slug,
    title: TITLE,
    doneKeys: ["fri-research", "fri-scope"],
    coreFeature: "Comment on one risky diff",
    liveUrl: null,
    startedAt: 0,
    completedAt: null,
  };
}

function home(activePlan: Home["activePlan"]): Home {
  return {
    firstName: "Ada",
    saved: { count: 1, capped: false, latest: [] },
    setupDone: true,
    setupSkipped: false,
    activePlan,
    lastFinished: null,
    plan: "builders_hub",
  };
}

function savedItem(slug: string): SavedItem {
  return {
    card: {
      ideaId: `${slug}-id` as Id<"ideas">,
      slug,
      title: slug === DRAFT ? `${TITLE} (draft)` : TITLE,
      description: "Pull-request review for small teams.",
      category: "developer-tools",
      buildTime: 10,
      revenueGoal: "5k-month",
      tools: ["cursor", "claude"],
      scores: null,
      score: null,
      hasArt: false,
      publishedAt: 0,
      saved: true,
    },
    savedAt: Date.UTC(2026, 8, 24),
    note: null,
  };
}

beforeEach(() => {
  convex.queries.clear();
  convex.saved = [];
});

describe("the weekend plan page", () => {
  function renderPlan(slug: string) {
    convex.queries.set("platform/weekendPlans:get", {
      plan: plan(slug),
      idea: { slug, title: TITLE, category: "developer-tools", buildTime: 10 },
    } satisfies PlanData);
    return renderToStaticMarkup(<PlanDetail planId={PLAN_ID} />);
  }

  test("a draft's plan says its research was retired, with no research link and no prompt pack", () => {
    const html = renderPlan(DRAFT);
    expect(html).toContain(RETIRED_LABEL);
    expect(html).toContain("Your plan and progress stay here. The research is no longer published.");
    expect(html).not.toMatch(draftLink);
    expect(html).not.toContain(EXPORT);
    // The plan itself stays usable: its steps and the archive action are there.
    expect(html).toContain('aria-label="Your weekend"');
    expect(html).toContain("Archive this plan");
  });

  test("an ordinary plan keeps its research link and prompt pack", () => {
    const html = renderPlan(ORDINARY);
    expect(html).toMatch(/<a [^>]*href="\/ideas\/ai-code-reviewer"[^>]*>Read the research<\/a>/);
    expect(html).toContain(EXPORT);
    expect(html).not.toContain(RETIRED_LABEL);
  });
});

describe("Home's building card", () => {
  function renderBuilding(slug: string) {
    convex.queries.set("platform/dashboard:home", home(plan(slug)));
    return renderToStaticMarkup(<NextStepCard weekly={null} total={12} />);
  }

  test("a draft being built says its research and prompts were retired, with no prompt pack", () => {
    const html = renderBuilding(DRAFT);
    expect(html).toContain("Building now");
    expect(html).toContain(RETIRED_LABEL);
    expect(html).toContain("The research and its prompts are no longer published.");
    expect(html).not.toContain(EXPORT);
    expect(html).not.toMatch(draftLink);
    // The way back into the member's own plan stays.
    expect(html).toMatch(/<a [^>]*href="\/dashboard\/builds\/plan-1"[^>]*>Open plan<\/a>/);
  });

  test("an ordinary idea being built keeps its prompt pack and no retired label", () => {
    const html = renderBuilding(ORDINARY);
    expect(html).toContain("Building now");
    expect(html).toContain(EXPORT);
    expect(html).not.toContain(RETIRED_LABEL);
  });
});

describe("the pending save notice", () => {
  /** A save started on the idea page before sign-up, already tried once. */
  function renderPendingSave(slug: string) {
    const stored = JSON.stringify({ slug, title: TITLE, at: Date.now(), attempts: PENDING_SAVE_MAX_ATTEMPTS });
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => (key === PENDING_SAVE_KEY ? stored : null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
    });
    return renderToStaticMarkup(<PendingSaveRunner />);
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("for a draft, it says the research was retired instead of linking to the withheld page", () => {
    const html = renderPendingSave(DRAFT);
    expect(html).toContain(`We couldn’t save “${TITLE}”.`);
    expect(html).toContain("Its research was retired, so there is no page to open.");
    expect(html).not.toMatch(draftLink);
    expect(html).not.toContain("Open it and try again");
    // Saving a draft is still allowed, so the retry stays.
    expect(html).toContain("Save to this account");
  });

  test("for an ordinary idea, it links back to the idea", () => {
    const html = renderPendingSave(ORDINARY);
    expect(html).toMatch(/<a [^>]*href="\/ideas\/ai-code-reviewer"[^>]*>Open it and try again<\/a>/);
    expect(html).not.toContain("Its research was retired");
  });
});

describe("the Saved page", () => {
  type Entitlements = FunctionReturnType<typeof api.platform.entitlements.mine>;
  const free: Entitlements = {
    plan: "free",
    limits: { activeWeekendPlans: 1, collections: false, promptPack: false, compareMax: 0 },
    usage: { activeWeekendPlans: 0, activeWeekendPlansCapped: false },
    joinedAt: 0,
  };
  const hub: Entitlements = {
    plan: "builders_hub",
    limits: { activeWeekendPlans: null, collections: true, promptPack: true, compareMax: 4 },
    usage: { activeWeekendPlans: 0, activeWeekendPlansCapped: false },
    joinedAt: 0,
  };

  // Free rows are plain idea rows; Builder's Hub rows add collections and notes.
  test.each([
    { member: "free", entitlements: free, hubRows: false },
    { member: "Builder's Hub", entitlements: hub, hubRows: true },
  ])("a $member member sees a saved draft as retired and unlinked, beside a linked ordinary idea", ({
    entitlements,
    hubRows,
  }) => {
    convex.queries.set("currentUser:requireCurrent", { id: "user-1" as Id<"users"> });
    convex.queries.set("platform/entitlements:mine", entitlements);
    convex.saved = [savedItem(DRAFT), savedItem(ORDINARY)];

    const html = renderToStaticMarkup(<SavedIdeas />);
    expect(html).toContain("2 saved ideas");
    expect(html.includes('title="Add a note"')).toBe(hubRows);
    expect(html).toContain(`${TITLE} (draft)`);
    expect(html).toContain(RETIRED_LABEL);
    expect(html).not.toMatch(draftLink);
    expect(html).not.toMatch(/\/dashboard\/builds\/new\?idea=engine-draft-/);
    expect(html).toContain(ordinaryLink);
    expect(html).toContain("/dashboard/builds/new?idea=ai-code-reviewer");
  });

  // Compare mode starts only from a click on the toolbar's Compare button,
  // which a static render cannot make, so the per-row rule SavedIdeas uses
  // is tested directly. The compare query also drops drafts on the server
  // (convex/wp54DraftRetirement.test.ts).
  test("in compare mode an ordinary row gets a compare checkbox and a retired draft never does", () => {
    expect(isComparable(ORDINARY, true)).toBe(true);
    expect(isComparable(DRAFT, true)).toBe(false);
    expect(isComparable("engine-draft-", true)).toBe(false);
  });

  test("outside compare mode no row gets a compare checkbox", () => {
    expect(isComparable(ORDINARY, false)).toBe(false);
    expect(isComparable(DRAFT, false)).toBe(false);
  });
});
