import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard/b/proj1" }));

import {
  ApprovalCard,
  BrandKitCardView,
  BuildPackPromptCard,
  CreditMeter,
  EmployeeAvatar,
  FromAttribution,
  WrenComposer,
  creditMeterRightText,
  creditMeterVisibleLabel,
} from "@/components/workspace/kit";
import { freeCost, hydrotrailPrompt, irisIdentity } from "@/components/workspace/kit/fixtures";
import { WorkspaceFrame, billingLinkLabel } from "@/components/workspace/shell";
import { switcherLabel } from "@/components/workspace/shell/BusinessSwitcher";

const root = path.resolve(__dirname, "../..");
const read = (...parts: string[]) => readFileSync(path.join(root, ...parts), "utf8");
const noop = () => undefined;

describe("label in name (WCAG 2.5.3)", () => {
  const cases = [
    { balance: 48, max: 50, plan: "free" },
    { balance: 8, max: 50, plan: "free" },
    { balance: 0, max: 50, plan: "free" },
    { balance: 5, max: 0, plan: "free" },
    { balance: 600, max: 500, plan: "builders_hub" },
  ] as const;

  test.each(cases)("the Billing link name starts with the meter's visible text: %o", (credits) => {
    const label = billingLinkLabel(credits);
    const visible = creditMeterVisibleLabel(credits.balance, credits.max, credits.plan);
    expect(label.startsWith(visible)).toBe(true);
    expect(label).toContain("Billing");
    // The visible words really are in the rendered meter, in this order.
    const markup = renderToStaticMarkup(<CreditMeter {...credits} />);
    const text = markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    expect(text).toContain(`Credits`);
    expect(text).toContain(creditMeterRightText(credits.balance, credits.max));
  });

  test("the rendered Billing link carries that label", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceFrame projectId="proj1" businesses={[{ id: "proj1", name: "HydroTrail" }]} credits={{ balance: 8, max: 50, plan: "free" }}>
        <main id="workspace-main" tabIndex={-1} />
      </WorkspaceFrame>,
    );
    expect(markup).toContain('aria-label="Credits Free 8 left · low, open Billing"');
  });

  test("the switcher name starts with the visible business name", () => {
    expect(switcherLabel("HydroTrail").startsWith("HydroTrail")).toBe(true);
  });

  test("the copy button name contains its visible text", () => {
    const markup = renderToStaticMarkup(<BuildPackPromptCard {...hydrotrailPrompt} />);
    expect(markup).toMatch(/aria-label="Copy prompt 2: [^"]+"/);
    expect(markup).toContain("Copy prompt</button>");
  });
});

describe("decorative glyphs and legibility", () => {
  test("the approved tick is aria-hidden in the approval card and the brand kit card", () => {
    const approval = renderToStaticMarkup(
      <ApprovalCard id="a" title="T" from={irisIdentity} cost={freeCost} state="approved" onApprove={noop} onAskChanges={noop} />,
    );
    expect(approval).toContain('<span aria-hidden="true">✓ </span>');
    const brand = renderToStaticMarkup(
      <BrandKitCardView state="approved" openHref="#x" onApprove={noop} onAskChanges={noop} />,
    );
    expect(brand).toContain('<span aria-hidden="true">✓ </span>');
  });

  test("the AI badge is at least 10px", () => {
    const markup = renderToStaticMarkup(<EmployeeAvatar name="Iris" role="brand" size="lg" showAiBadge />);
    expect(markup).toContain("text-[10px]");
    expect(markup).not.toContain("text-[8px]");
  });
});

describe("composer", () => {
  test("the textarea is described by the Enter / Shift+Enter hint", () => {
    const markup = renderToStaticMarkup(<WrenComposer onSend={noop} />);
    const describedBy = markup.match(/<textarea[^>]*aria-describedby="([^"]+)"/)?.[1];
    expect(describedBy).toBeTruthy();
    expect(markup).toContain(`id="${describedBy}"`);
    expect(markup).toContain("Press Enter to send. Press Shift and Enter for a new line.");
  });
});

describe("reflow at 320px (WCAG 1.4.10)", () => {
  test("rows that hold several items wrap", () => {
    const approval = renderToStaticMarkup(
      <ApprovalCard id="a" title="T" from={irisIdentity} cost={freeCost} state="open" onApprove={noop} onAskChanges={noop} />,
    );
    expect(approval).toMatch(/<div class="flex flex-wrap items-center gap-2">/);
    const prompt = renderToStaticMarkup(<BuildPackPromptCard {...hydrotrailPrompt} />);
    expect(prompt).toMatch(/<header class="flex flex-wrap/);
    expect(prompt).toContain("break-words");
    const from = renderToStaticMarkup(<FromAttribution from={irisIdentity} time="9:00" workstreamHref="#x" />);
    expect(from).toMatch(/<div class="flex flex-wrap items-center/);
  });
});

describe("source guards", () => {
  test("the output title keeps a focus indicator (no outline-none on a programmatic focus target)", () => {
    const source = read("components", "workspace", "kit", "WorkstreamPanel.tsx");
    expect(source).not.toContain("outline-none");
  });

  test("the switcher blur handler never closes on a null relatedTarget", () => {
    const source = read("components", "workspace", "shell", "BusinessSwitcher.tsx");
    expect(source).toContain("!(next instanceof Node)");
  });

  test("no kit or shell file uses inline styles, any or console.log", () => {
    for (const dir of ["kit", "shell"]) {
      const names = ["ApprovalCard", "BuildPackPromptCard", "CreditMeter", "EmployeeAvatar", "EmployeeCard", "StatusPill", "WorkstreamPanel", "WrenCards", "WrenThread", "states"];
      for (const name of dir === "kit" ? names : ["WorkspaceSidebar", "BusinessSwitcher", "WorkspaceFrame"]) {
        const source = read("components", "workspace", dir, `${name}.tsx`);
        expect(source, name).not.toMatch(/\sstyle=\{/);
        expect(source, name).not.toMatch(/:\s*any\b|<any>|as any/);
        expect(source, name).not.toContain("console.log");
      }
    }
  });
});

describe("kit preview page", () => {
  const dir = ["app", "(launch-workspace)", "workspace-kit-preview"];
  const page = read(...dir, "page.tsx");
  const client = read(...dir, "KitPreviewClient.tsx");

  test("the NODE_ENV check runs, and calls notFound, before any JSX", () => {
    const check = page.indexOf('process.env.NODE_ENV !== "development"');
    const notFoundCall = page.indexOf("notFound();", check);
    const firstReturn = page.indexOf("return (");
    expect(check).toBeGreaterThan(-1);
    expect(notFoundCall).toBeGreaterThan(check);
    expect(firstReturn).toBeGreaterThan(notFoundCall);
    // No JSX element appears in the function before the check.
    const fnStart = page.indexOf("export default function");
    expect(page.slice(fnStart, check)).not.toMatch(/<[A-Za-z]/);
  });

  test("robots is noindex and nofollow", () => {
    expect(page).toMatch(/export const metadata/);
    expect(page).toMatch(/robots:\s*\{[^}]*index:\s*false/);
    expect(page).toMatch(/robots:\s*\{[^}]*follow:\s*false/);
  });

  test("it lives outside /dashboard and needs no Convex, auth or network", () => {
    expect(dir.join("/")).not.toContain("dashboard");
    for (const raw of [page, client]) {
      const source = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      expect(source).not.toMatch(/convex|requireWorkspaceAccess|AuthPlatformProvider|fetch\(|server-only/i);
      expect(source).not.toMatch(/lib\/workspace\/(credits|businesses)"/);
      expect(source).not.toMatch(/\sstyle=\{/);
      expect(source).not.toContain("console.log");
    }
  });

  test("the server page passes no functions; callbacks live in the client wrapper", () => {
    expect(client.startsWith('"use client"')).toBe(true);
    expect(page).not.toMatch(/=>|onApprove|onSend|onRetry/);
  });

  test("the preview renders every kit area (client wrapper, static markup)", async () => {
    const { KitPreviewClient } = await import("@/app/(launch-workspace)/workspace-kit-preview/KitPreviewClient");
    const markup = renderToStaticMarkup(<KitPreviewClient />);
    expect(markup.match(/<h1[ >]/g)).toHaveLength(1);
    for (const kind of ["brand", "landing", "seo", "marketing", "email", "social", "engineering", "ads"]) {
      expect(markup).toContain(`data-kind="${kind}"`);
    }
    for (const status of ["queued", "working", "needs_you", "done", "draft", "ready", "approved", "changes_requested", "live"]) {
      expect(markup).toContain(`data-status="${status}"`);
    }
    for (const cost of ["free", "credits", "not-enough"]) expect(markup).toContain(`data-cost="${cost}"`);
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('data-skipped-role="merch"');
    expect(markup).toContain('data-state="empty"');
    expect(markup).toContain('data-state="loading"');
    expect(markup).toContain('data-state="error"');
    expect(markup).toContain('role="log"');
    expect(markup).toContain('data-prompt="2"');
    expect(markup).toContain("Not set");
    const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(markup).not.toMatch(/\sstyle=/);
  });
});
