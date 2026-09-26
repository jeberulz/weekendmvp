/// <reference types="vite/client" />

import { describe, expect, test } from "vitest";
import sheetSource from "../../components/platform/plan/UpgradeSheet.tsx?raw";
import shellSource from "../../components/platform/shell/WorkspaceShell.tsx?raw";
import planDetailSource from "../../components/platform/builds/PlanDetail.tsx?raw";
import collectionViewSource from "../../components/platform/hub/CollectionView.tsx?raw";
import buildsListSource from "../../components/platform/builds/BuildsList.tsx?raw";
import projectCardSource from "../../components/platform/projects/ProjectCard.tsx?raw";
import savedRouteSource from "../../app/api/platform/saved/route.ts?raw";
import savedIdeasSource from "../../components/platform/explore/SavedIdeas.tsx?raw";
import startPlanSource from "../../components/platform/builds/StartPlan.tsx?raw";
import exportSource from "../../components/platform/hub/ExportPromptPack.tsx?raw";
import { MAX_LIBRARY_LIMIT } from "../../convex/platform/libraryFilters";

// WP44-S13 package gate: fixes from the keyboard pass and the independent review.
describe("WP44-S13 focus starts on the safe choice", () => {
  test("the upgrade sheet opens on Not now, not on the archive button", () => {
    expect(sheetSource).toContain("onOpenAutoFocus={(event) => {");
    expect(sheetSource).toContain("notNow.current?.focus();");
    expect(sheetSource).toContain('<button ref={notNow} type="button"');
  });

  test("the phone Account sheet opens on its first link, not on Sign out", () => {
    expect(shellSource).toContain("onOpenAutoFocus={focusFirstLink}");
    expect(shellSource).toContain("<Link ref={firstLink} href={BILLING_NAV.href}");
  });

  test("finishing, archiving and deleting confirms start on the cancel button", () => {
    expect(planDetailSource).toContain("if (asking) cancelRef.current?.focus();");
    expect(collectionViewSource).toContain("if (confirming) cancelButton.current?.focus();");
  });
});

describe("WP44-S13 review fixes", () => {
  test("R4: own-idea drafts are reachable from Builds, never through the parked cockpit", () => {
    expect(buildsListSource).toContain('project.source === "own_idea" && project.nextAction === "resume_brief"');
    expect(buildsListSource).toContain("href={`/dashboard/new?project=${draft.projectId}`}");
    expect(buildsListSource).not.toContain("/dashboard/projects");
  });

  test("R5: the parked project card no longer links into the preview builder", () => {
    expect(projectCardSource).toContain("const SITE_PUBLISHING_PARKED = true;");
    expect(projectCardSource).toContain("? `/ideas/${project.sourceSlug}`");
  });

  test("paging reaches every idea and every save", () => {
    expect(MAX_LIBRARY_LIMIT).toBe(1000);
    expect(savedIdeasSource).toContain("{data.hasMore && (");
  });

  test("a revoked session on Save reads as signed out, not as an outage", () => {
    expect(savedRouteSource).toContain('if (code === "UNAUTHENTICATED") return json({ code: "AUTHENTICATION_REQUIRED" }, 401);');
  });

  test("no silent Start button, and downloads are not cancelled early", () => {
    expect(startPlanSource).toContain('else setError("You already have a weekend plan running.');
    expect(exportSource).toContain("setTimeout(() => URL.revokeObjectURL(url), 10_000);");
  });
});
