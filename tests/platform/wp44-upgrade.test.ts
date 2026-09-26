/// <reference types="vite/client" />

import { describe, expect, test } from "vitest";
import flagSource from "../../components/platform/plan/flag.ts?raw";
import useUpsellSource from "../../components/platform/plan/useUpsell.ts?raw";
import tagSource from "../../components/platform/plan/BuildersHubTag.tsx?raw";
import planCardSource from "../../components/platform/plan/PlanCard.tsx?raw";
import sheetSource from "../../components/platform/plan/UpgradeSheet.tsx?raw";
import comparisonSource from "../../components/platform/plan/PlanComparison.tsx?raw";
import startPlanSource from "../../components/platform/builds/StartPlan.tsx?raw";
import planAndBillingSource from "../../components/platform/billing/PlanAndBilling.tsx?raw";
import shellSource from "../../components/platform/shell/WorkspaceShell.tsx?raw";
import accountMenuSource from "../../components/platform/shell/AccountMenu.tsx?raw";
import entitlementsSource from "../../convex/platform/entitlements.ts?raw";
import weekendPlansSource from "../../convex/platform/weekendPlans.ts?raw";
import { BILLING_COMPARISON, PLANS, UPGRADE_LABEL } from "../../convex/platform/plans";

const planComponents = import.meta.glob("../../components/platform/plan/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const withoutComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("WP44-S10 entitlements on the server", () => {
  test("one resolver, and the weekend plan gate goes through it", () => {
    expect(entitlementsSource).toContain("export async function getEntitlements(ctx: QueryCtx, ownerId: Id<\"users\">)");
    expect(entitlementsSource).toContain("await resolvePlan(ctx, ownerId)");
    expect(weekendPlansSource).toContain("getEntitlements(ctx, user._id)");
    expect(weekendPlansSource).toContain('throw upgradeRequired("weekend_plan"');
    // The old S9 code is gone: one error code for every gate.
    expect(weekendPlansSource).not.toContain("ACTIVE_PLAN_LIMIT");
  });
});

describe("WP44-S10 flag", () => {
  test("every Builder's Hub surface checks the flag first", () => {
    expect(flagSource).toContain("buildersHubUiEnabled(process.env.NEXT_PUBLIC_BUILDERS_HUB)");
    expect(useUpsellSource).toContain('BUILDERS_HUB_UI ? {} : "skip"');
    expect(planCardSource.match(/if \(!BUILDERS_HUB_UI/g)).toHaveLength(2);
    expect(startPlanSource).toContain("{BUILDERS_HUB_UI && (");
    expect(planAndBillingSource).toContain("{showBuildersHub ? (");
  });
});

describe("WP44-S10 surfaces follow PRD 6.6", () => {
  test("the Plan card: usage first, free members only, after day one, in the sidebar footer", () => {
    expect(planCardSource).toContain("const { entitlements, showUpsell } = useUpsell();");
    expect(planCardSource).toContain("if (!entitlements || !showUpsell) return null;");
    expect(planCardSource).toContain("in use");
    expect(planCardSource).toContain("bg-home-panel");
    expect(planCardSource).toContain('surface: "sidebar"');
    expect(shellSource).toContain("<PlanCard collapsed={collapsed} />");
    expect(accountMenuSource).toContain("<PlanName />");
  });

  test("the sheet is a dialog with a title, a description, a free way forward and Not now", () => {
    expect(sheetSource).toContain("<Dialog.Root open={open} onOpenChange={onOpenChange}>");
    expect(sheetSource).toContain("<Dialog.Title");
    expect(sheetSource).toContain("<Dialog.Description");
    expect(sheetSource).toMatch(/<Dialog\.Close asChild>\s*<button[^>]*>\s*Not now/);
    expect(sheetSource).toContain("freeWayForward.onSelect");
    expect(sheetSource).toContain("{UPGRADE_LABEL}");
    expect(sheetSource).toContain('name: "upgrade_prompt_viewed", props: { surface: "sheet", feature }');
    expect(sheetSource).toContain('name: "upgrade_clicked", props: { surface: "sheet", feature }');
    expect(sheetSource).toContain('<caption className="sr-only">');
  });

  test("the start page turns UPGRADE_REQUIRED into the sheet, with the archive way forward", () => {
    expect(startPlanSource).toContain("data?.code === UPGRADE_REQUIRED");
    expect(startPlanSource).toContain('entitlements?.plan !== "builders_hub"');
    expect(startPlanSource).toContain("Archive your current plan and start this one");
    expect(startPlanSource).toContain("void begin(true)");
  });

  test("tags sit only on the locked action, and only when upsells may show", () => {
    const users = Object.entries({ startPlanSource, planCardSource, comparisonSource, sheetSource }).filter(([, s]) =>
      s.includes("<BuildersHubTag"),
    );
    expect(users.map(([name]) => name)).toEqual(["startPlanSource"]);
    expect(startPlanSource).toContain("{preview.atLimit && showUpsell && <BuildersHubTag");
    expect(tagSource).toContain("PLANS.builders_hub.name");
  });

  test("Plan and billing: the table, a Current plan label, and no upsell for Builder's Hub", () => {
    expect(comparisonSource).toContain("<CurrentLabel />");
    expect(comparisonSource).toContain('<th scope="row"');
    expect(comparisonSource).toContain('id="builders-hub"');
    expect(comparisonSource).toContain('{current === "free" ? (');
    expect(comparisonSource).toContain('surface: "billing"');
    expect(BILLING_COMPARISON.at(-1)).toEqual({ label: "Price", free: "Free", hub: "$29 a month, billed monthly" });
  });
});

describe("WP44-S10 copy rules", () => {
  test("monthly only, no hosting or credits (R5, R9), and never the id `builder`", () => {
    for (const [path, source] of Object.entries(planComponents)) {
      const code = withoutComments(source);
      expect(code, path).not.toMatch(/hosting|credit|publish|yearly|annual/i);
      expect(code, path).not.toMatch(/["']builder["']/);
      // The price and name come from the plan constant, never typed out.
      expect(code, path).not.toContain("$29");
      expect(code, path).not.toContain("Builder’s Hub");
    }
    expect(UPGRADE_LABEL).toContain(`$${PLANS.builders_hub.priceMonthlyUsd}/mo`);
    expect(JSON.stringify(BILLING_COMPARISON)).not.toMatch(/hosting|credit|publish|annual/i);
  });

  test("no countdowns, fake discounts or pre-checked boxes", () => {
    for (const [path, source] of Object.entries(planComponents)) {
      expect(source, path).not.toMatch(/countdown|% off|was \$|defaultChecked/i);
    }
  });
});
