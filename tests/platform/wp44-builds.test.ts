/// <reference types="vite/client" />

import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import promptsRouteSource from "../../app/api/ideas/prompts/route.ts?raw";
import buildsPageSource from "../../app/dashboard/builds/page.tsx?raw";
import planPageSource from "../../app/dashboard/builds/[planId]/page.tsx?raw";
import newPlanPageSource from "../../app/dashboard/builds/new/page.tsx?raw";
import buildsListSource from "../../components/platform/builds/BuildsList.tsx?raw";
import copyPromptSource from "../../components/platform/builds/CopyPrompt.tsx?raw";
import planDetailSource from "../../components/platform/builds/PlanDetail.tsx?raw";
import planLinkSource from "../../components/platform/builds/PlanLink.tsx?raw";
import promptListSource from "../../components/platform/builds/PromptList.tsx?raw";
import startPlanSource from "../../components/platform/builds/StartPlan.tsx?raw";
import ideaCardSource from "../../components/platform/explore/IdeaCard.tsx?raw";
import nextStepSource from "../../components/platform/home/NextStepCard.tsx?raw";
import ideaPageSaveSource from "../../components/ideas/SaveIdeaButton.tsx?raw";
import buildsCountSource from "../../components/platform/shell/BuildsCount.tsx?raw";
import { WEEKEND_PLAN } from "../../components/home/content";
import {
  STAGE_COPY,
  completesStage,
  dayName,
  displayUrl,
  finishedRecently,
  planSource,
  progressLine,
  stageStatus,
  startPlanHref,
} from "../../components/platform/builds/plan-copy";
import { STAGES } from "../../convex/platform/weekendSteps";
import { extractIdea } from "../../lib/home/extract";
import { promptForStage, stagePrompts } from "../../lib/dashboard/weekend-prompts";

const nextConfigSource = readFileSync("next.config.ts", "utf8");

const prompt = (title: string) => ({ title, lines: [`Build ${title}`] });

describe("WP44-S9 prompts by day", () => {
  test("Saturday builds, Sunday launches", () => {
    const prompts = [prompt("Project Setup"), prompt("Core Feature"), prompt("Landing Page"), prompt("Branding Package")];
    expect(stagePrompts(prompts).sat.map((p) => p.title)).toEqual(["Project Setup", "Core Feature"]);
    expect(stagePrompts(prompts).sun.map((p) => p.title)).toEqual(["Landing Page", "Branding Package"]);
    expect(promptForStage(prompts, "sat")?.title).toBe("Project Setup");
    expect(promptForStage(prompts, "sun")?.title).toBe("Landing Page");
    expect(promptForStage(prompts, "fri")).toBeNull();
    expect(promptForStage([prompt("Project Setup")], "sun")).toBeNull();
  });

  test("a real idea's prompts split the same way", () => {
    const body = readFileSync("content/ideas/adspark.mdx", "utf8");
    const byDay = stagePrompts(extractIdea(body).prompts);
    expect(byDay.sat.length).toBeGreaterThan(0);
    expect(byDay.sun.map((p) => p.title)).toContain("Landing Page");
  });
});

describe("WP44-S9 plan copy", () => {
  test("stages read from the homepage plan, in order", () => {
    expect(STAGES.map((s) => STAGE_COPY[s.id])).toEqual([...WEEKEND_PLAN]);
    expect(dayName("fri")).toBe("Friday night");
    expect(dayName("mon")).toBe("Monday");
  });

  test("stage status is text, and a stage completes once", () => {
    expect(stageStatus("fri", [])).toBe("current");
    expect(stageStatus("sat", [])).toBe("upcoming");
    expect(stageStatus("fri", ["fri-research", "fri-scope"])).toBe("done");
    expect(stageStatus("sat", ["fri-research", "fri-scope"])).toBe("current");
    expect(completesStage(["fri-research"], "fri-scope")).toBe("fri");
    expect(completesStage([], "fri-scope")).toBeNull();
    expect(completesStage(["fri-research", "fri-scope"], "fri-scope")).toBeNull();
    expect(completesStage([], "mon-feedback")).toBe("mon");
    expect(progressLine({ done: 3, total: 8 })).toBe("3 of 8 steps done");
  });

  test("sources and links", () => {
    expect(planSource("saved")).toBe("saved");
    expect(planSource("idea_page")).toBe("idea_page");
    expect(planSource("evil")).toBe("ideas");
    expect(planSource(["home"])).toBe("ideas");
    expect(planSource(undefined)).toBe("ideas");
    expect(startPlanHref("invoice-chaser", "home")).toBe("/dashboard/builds/new?idea=invoice-chaser&from=home");
    expect(displayUrl("https://myapp.vercel.app/")).toBe("myapp.vercel.app");
  });

  test("Home shows Finished for a week", () => {
    const now = 1_800_000_000_000;
    expect(finishedRecently(now - 1000, now)).toBe(true);
    expect(finishedRecently(now - 8 * 86_400_000, now)).toBe(false);
    expect(finishedRecently(null, now)).toBe(false);
  });
});

describe("WP44-S9 screens", () => {
  test("prompts are members only, cached privately, and traced into the function", () => {
    expect(promptsRouteSource).toContain("isIdeaSlug(slug)");
    expect(promptsRouteSource).toContain("await convexAuthNextjsToken()");
    expect(promptsRouteSource).toContain("status: 401");
    expect(promptsRouteSource).toContain('"private, max-age=300"');
    expect(nextConfigSource).toContain('"/api/ideas/prompts": ["./content/ideas/**/*.mdx"]');
  });

  test("copy says so politely, and never sends the prompt text", () => {
    expect(copyPromptSource).toContain('role="status"');
    expect(copyPromptSource).toContain('setMessage("Prompt copied")');
    expect(copyPromptSource).toContain('name: "prompt_copied", props: { surface }');
    // The visible label starts the accessible name.
    expect(copyPromptSource).toContain('<span className="sr-only"> for {prompt.title}</span>');
  });

  test("the plan page: native checkboxes, one live region, stage events", () => {
    expect(planDetailSource).toContain('type="checkbox"');
    expect(planDetailSource.match(/role="status"/g)).toHaveLength(1);
    expect(planDetailSource).toContain('name: "weekend_step_completed", props: { step: stage }');
    expect(planDetailSource).toContain("withOptimisticUpdate");
    expect(planDetailSource).toContain('aria-labelledby={`stage-${stage.id}`}');
    expect(planDetailSource).toContain("STAGE_STATUS_LABEL[status]");
    expect(planDetailSource).toContain('rel="noopener noreferrer"');
    expect(planDetailSource).toContain("(opens in a new tab)");
    expect(planDetailSource).toContain("aria-invalid={invalid}");
    expect(planDetailSource).toContain('"RESOURCE_NOT_FOUND"');
    expect(promptListSource).toContain("<details");
  });

  test("site publishing stays parked (R5)", () => {
    for (const [name, source] of Object.entries({ planDetailSource, buildsListSource, startPlanSource, nextStepSource })) {
      expect(source, name).not.toMatch(/\/preview|\/dashboard\/projects|credits/i);
      expect(source, name).not.toMatch(/\bpublish\b/i);
    }
  });

  test("one start page handles the limit, and nothing starts on a card", () => {
    expect(startPlanSource).toContain("api.platform.weekendPlans.startPreview");
    expect(startPlanSource).toContain('name: "weekend_plan_started", props: { source }');
    expect(startPlanSource).toContain('"ACTIVE_PLAN_LIMIT"');
    expect(startPlanSource).toContain("begin(true)");
    expect(startPlanSource).toContain("Archive it and start");
    expect(newPlanPageSource).toContain("isIdeaSlug(idea)");
    expect(newPlanPageSource).toContain("planSource(from)");
    for (const [name, source] of Object.entries({ planLinkSource, ideaCardSource })) {
      expect(source, name).not.toContain("useMutation");
    }
  });

  test("Plan my weekend reaches every entry point", () => {
    expect(nextStepSource).toContain('<PlanLink slug={idea.slug} title={idea.title} source="home"');
    expect(ideaCardSource.match(/<PlanLink /g)).toHaveLength(2);
    expect(ideaCardSource.match(/<BuildingBadge \/>/g)).toHaveLength(2);
    expect(ideaPageSaveSource).toContain('startPlanHref(slug, "idea_page")');
    // Signed-out readers get sign-up, not a plan link.
    const signedOut = ideaPageSaveSource.slice(
      ideaPageSaveSource.indexOf("function SignUpToSave"),
      ideaPageSaveSource.indexOf("function SignedInSave"),
    );
    expect(signedOut).not.toContain("startPlanHref");
    expect(planLinkSource).toContain('<span className="sr-only"> for {title}</span>');
  });

  test("Home runs Building and Finished from the home query", () => {
    expect(nextStepSource).toContain("<BuildingCard plan={home.activePlan} />");
    expect(nextStepSource).toContain("<FinishedCard plan={home.lastFinished} />");
    expect(nextStepSource).toContain('surface="home"');
    expect(nextStepSource).toContain("You shipped.");
    expect(nextStepSource).toContain("Pick the next idea");
  });

  test("dashboard pages stay out of search, and the nav count is quiet", () => {
    for (const source of [buildsPageSource, planPageSource, newPlanPageSource]) {
      expect(source).toContain("robots: { index: false, follow: false }");
    }
    expect(buildsCountSource).toContain("<QuietErrorBoundary>");
    expect(buildsCountSource).not.toContain("platform/weekendPlans\"");
  });
});
