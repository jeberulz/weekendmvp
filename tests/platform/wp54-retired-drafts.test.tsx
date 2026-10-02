import React, { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { FunctionReturnType } from "convex/server";
import { describe, expect, test, vi } from "vitest";
import type { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { IdeaCard, IdeaRow } from "../../components/platform/explore/IdeaCard";
import { SavedList } from "../../components/platform/home/HomeRail";
import { Shortlist } from "../../components/platform/home/NextStepCard";
import { IdeaNotPlannable } from "../../components/platform/builds/StartPlan";
import { PromptList } from "../../components/platform/builds/PromptList";
import { usePlanPrompts } from "../../components/platform/builds/usePlanPrompts";
import { ProjectCard } from "../../components/platform/projects/ProjectCard";
import { ideaHref } from "../../components/platform/projects/cockpit";

/**
 * WP54-S5 (review F3). Member work can still hold an engine draft whose
 * research page now answers 404. These views keep the idea, mark it retired
 * in text, and render no link to the withheld page and no new-plan entry.
 */

vi.mock("convex/react", () => ({
  usePaginatedQuery: () => ({ results: [], status: "Exhausted", loadMore: vi.fn() }),
  useMutation: () => vi.fn(),
  useQuery: () => undefined,
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
// next/image reads `document` at import time, which the edge test runtime lacks.
// These cards have no art, so the art band never renders anyway.
vi.mock("../../components/home/IdeaArt", () => ({ IdeaArt: () => null }));
// next/font only runs under the Next compiler; the upgrade sheet imports it.
vi.mock("next/font/google", () => ({
  Newsreader: () => ({ className: "font-serif", variable: "--font-serif", style: { fontFamily: "serif" } }),
}));

type Card = FunctionReturnType<typeof api.platform.ideas.library>["items"][number];
type Home = FunctionReturnType<typeof api.platform.dashboard.home>;

const DRAFT = "engine-draft-ai-code-reviewer";
const ORDINARY = "ai-code-reviewer";

function card(slug: string, overrides: Partial<Card> = {}): Card {
  return {
    ideaId: `${slug}-id` as Id<"ideas">,
    slug,
    title: slug === DRAFT ? "AI Code Reviewer (draft)" : "AI Code Reviewer",
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
    ...overrides,
  };
}

function savedRow(slug: string): Home["saved"]["latest"][number] {
  return {
    ideaId: `${slug}-id` as Id<"ideas">,
    slug,
    title: slug === DRAFT ? "AI Code Reviewer (draft)" : `Idea ${slug}`,
    category: "developer-tools",
    buildTime: "10",
    revenueGoal: "5k-month",
    tools: ["cursor"],
    score: 7,
    updatedAt: 1,
  };
}

function home(latest: Home["saved"]["latest"]): Home {
  return {
    firstName: "Ada",
    saved: { count: latest.length, capped: false, latest },
    setupDone: true,
    setupSkipped: false,
    activePlan: null,
    lastFinished: null,
    plan: "free",
  };
}

const draftLink = /href="\/ideas\/engine-draft-/;
const draftPlanStart = /\/dashboard\/builds\/new\?idea=engine-draft-/;

describe("Saved rows and cards", () => {
  test("an ordinary saved idea keeps its research link and plan entry", () => {
    const html = renderToStaticMarkup(<IdeaRow idea={card(ORDINARY)} source="saved" />);
    expect(html).toContain('href="/ideas/ai-code-reviewer"');
    expect(html).toContain("/dashboard/builds/new?idea=ai-code-reviewer");
    expect(html).not.toContain("Research retired");
  });

  test("a saved draft shows its title and a retired label, with no link and no new plan", () => {
    const html = renderToStaticMarkup(<IdeaRow idea={card(DRAFT)} source="saved" meta="Saved 24 Sep" />);
    expect(html).toContain("AI Code Reviewer (draft)");
    expect(html).toContain("Research retired");
    expect(html).toContain("Saved 24 Sep");
    expect(html).not.toMatch(draftLink);
    expect(html).not.toMatch(draftPlanStart);
    expect(html).not.toContain("Plan my weekend");
    // Saving stays possible: the member can still remove it from Saved.
    expect(html).toContain("aria-pressed");
  });

  test("a draft the member is building keeps only the link to their existing plan", () => {
    const html = renderToStaticMarkup(<IdeaRow idea={card(DRAFT, { building: true })} source="saved" />);
    expect(html).toContain("Open your plan");
    expect(html).toContain('href="/dashboard/builds"');
    expect(html).toContain("Building");
    expect(html).not.toMatch(draftPlanStart);
    expect(html).not.toMatch(draftLink);
  });

  test("the grid card follows the same rule", () => {
    const draft = renderToStaticMarkup(<IdeaCard idea={card(DRAFT)} source="ideas" />);
    expect(draft).toContain("Research retired");
    expect(draft).not.toMatch(draftLink);
    expect(draft).not.toMatch(draftPlanStart);
    const ordinary = renderToStaticMarkup(<IdeaCard idea={card(ORDINARY)} source="ideas" />);
    expect(ordinary).toContain('href="/ideas/ai-code-reviewer"');
  });
});

describe("Home", () => {
  test("the Saved rail names a draft without linking to it", () => {
    const html = renderToStaticMarkup(
      <SavedList home={home([savedRow(DRAFT), savedRow("rfp-desk")])} headingRef={createRef<HTMLHeadingElement>()} />,
    );
    expect(html).toContain("AI Code Reviewer (draft)");
    expect(html).toContain("Research retired");
    expect(html).not.toMatch(draftLink);
    expect(html).toContain('href="/ideas/rfp-desk"');
  });

  test("the shortlist offers no radio or plan for a draft and preselects a plannable idea", () => {
    const html = renderToStaticMarkup(<Shortlist home={home([savedRow(DRAFT), savedRow("rfp-desk")])} />);
    expect(html.match(/type="radio"/g)).toHaveLength(1);
    expect(html).toMatch(/type="radio"[^>]*checked=""/);
    expect(html).toContain("<legend");
    expect(html).toContain("Not open for a new plan");
    expect(html).not.toMatch(draftLink);
    expect(html).not.toMatch(draftPlanStart);
    expect(html.match(/\/dashboard\/builds\/new\?idea=rfp-desk/g)?.length).toBeGreaterThanOrEqual(2);
  });

  test("a shortlist of drafts only says why nothing can start", () => {
    const html = renderToStaticMarkup(<Shortlist home={home([savedRow(DRAFT)])} />);
    expect(html).not.toContain('type="radio"');
    // No empty choice group: without a plannable idea the table stands alone.
    expect(html).not.toContain("<fieldset");
    expect(html).not.toContain("/dashboard/builds/new");
    expect(html).toContain("The research behind these saves was retired");
    expect(html).toContain('href="/dashboard/saved"');
  });
});

describe("Plans and projects", () => {
  function PromptsProbe({ slug }: { slug: string | null }) {
    return <output>{usePlanPrompts(slug).status}</output>;
  }

  test("a draft's prompts read as retired at once, ordinary prompts load", () => {
    expect(renderToStaticMarkup(<PromptsProbe slug={DRAFT} />)).toBe("<output>retired</output>");
    expect(renderToStaticMarkup(<PromptsProbe slug={ORDINARY} />)).toBe("<output>loading</output>");
  });

  test("the prompt list explains a retired draft and never links to its page", () => {
    const retired = renderToStaticMarkup(
      <PromptList state={{ status: "retired" }} pick={(all) => all} empty="None" ideaSlug={DRAFT} />,
    );
    expect(retired).toContain("research was retired");
    expect(retired).not.toContain("<a ");
    const failedDraft = renderToStaticMarkup(
      <PromptList state={{ status: "failed" }} pick={(all) => all} empty="None" ideaSlug={DRAFT} />,
    );
    expect(failedDraft).not.toMatch(draftLink);
    const failedOrdinary = renderToStaticMarkup(
      <PromptList state={{ status: "failed" }} pick={(all) => all} empty="None" ideaSlug={ORDINARY} />,
    );
    expect(failedOrdinary).toContain('href="/ideas/ai-code-reviewer"');
  });

  test("the start page says a draft is retired instead of missing", () => {
    const draft = renderToStaticMarkup(<IdeaNotPlannable slug={DRAFT} />);
    expect(draft).toContain("This idea’s research was retired.");
    expect(draft).toContain("stays in Saved and Builds");
    expect(draft).not.toMatch(draftLink);
    expect(renderToStaticMarkup(<IdeaNotPlannable slug="not-an-idea" />)).toContain("We can’t find that idea.");
  });

  test("a project from a draft resumes in the project, not on the withheld page", () => {
    expect(ideaHref(DRAFT)).toBeNull();
    expect(ideaHref(ORDINARY)).toBe("/ideas/ai-code-reviewer");
    const common = {
      projectId: "project-1",
      title: "Review bot",
      source: "repository_idea" as const,
      status: "draft" as const,
      updatedAt: 0,
      nextAction: "resume_brief" as const,
    };
    const draft = renderToStaticMarkup(<ProjectCard {...common} sourceSlug={DRAFT} />);
    expect(draft).toContain('href="/dashboard/projects/project-1"');
    expect(draft).not.toMatch(draftLink);
    const ordinary = renderToStaticMarkup(<ProjectCard {...common} sourceSlug={ORDINARY} />);
    expect(ordinary).toContain('href="/ideas/ai-code-reviewer"');
  });
});
