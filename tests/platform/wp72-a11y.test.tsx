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
  EmployeeCard,
  FromAttribution,
  WrenComposer,
  creditMeterVisibleLabel,
} from "@/components/workspace/kit";
import { freeCost, hydrotrailEmployees, hydrotrailPrompt, irisIdentity } from "@/components/workspace/kit/fixtures";
import { WorkspaceFrame, billingLinkLabel } from "@/components/workspace/shell";
import { shouldCloseOnBlur, switcherLabel } from "@/components/workspace/shell/BusinessSwitcher";

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

  const decode = (text: string) =>
    text
      .replace(/&#x27;|&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");

  /** The meter's first visible row (label, plan, count), read from the rendered markup. */
  function firstRowText(markup: string): string {
    const row = markup.match(/<div class="flex items-center gap-2 text-\[13px\]">([\s\S]*?)<\/div>/)?.[1] ?? "";
    return decode(row.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  }

  test.each(cases)("the Billing link name starts with the rendered meter's first row: %o", (credits) => {
    const visible = firstRowText(renderToStaticMarkup(<CreditMeter {...credits} />));
    expect(visible.length).toBeGreaterThan("Credits".length);
    expect(visible.startsWith("Credits")).toBe(true);
    const frame = renderToStaticMarkup(
      <WorkspaceFrame projectId="proj1" businesses={[{ id: "proj1", name: "HydroTrail" }]} credits={credits}>
        <main id="workspace-main" tabIndex={-1} />
      </WorkspaceFrame>,
    );
    const tag = frame.match(/<a [^>]*href="\/dashboard\/b\/proj1\/billing"[^>]*>/)?.[0] ?? "";
    const label = decode(tag.match(/aria-label="([^"]*)"/)?.[1] ?? "");
    expect(label.startsWith(visible)).toBe(true);
    expect(label).toContain("Billing");
    // The helpers agree with what was rendered.
    expect(billingLinkLabel(credits)).toBe(label);
    expect(creditMeterVisibleLabel(credits.balance, credits.max, credits.plan)).toBe(visible);
  });

  test("the rendered Billing link carries that label", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceFrame projectId="proj1" businesses={[{ id: "proj1", name: "HydroTrail" }]} credits={{ balance: 8, max: 50, plan: "free" }}>
        <main id="workspace-main" tabIndex={-1} />
      </WorkspaceFrame>,
    );
    expect(markup).toContain('aria-label="Credits Free 8 left · low, open Billing, coming soon"');
    // L1-C2: the visible coming-soon line is in the name too.
    expect(markup).toContain("Billing · Coming soon</p>");
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

describe("shouldCloseOnBlur", () => {
  const inside = { nodeType: 1 };
  const outside = { nodeType: 1 };
  const root = { contains: (node: unknown) => node === inside } as unknown as Node;

  test("a null target keeps the list open", () => {
    expect(shouldCloseOnBlur(null, root)).toBe(false);
  });
  test("a target inside keeps it open", () => {
    expect(shouldCloseOnBlur(inside as unknown as EventTarget, root)).toBe(false);
  });
  test("a target outside closes it", () => {
    expect(shouldCloseOnBlur(outside as unknown as EventTarget, root)).toBe(true);
  });
  test("a missing root never closes", () => {
    expect(shouldCloseOnBlur(outside as unknown as EventTarget, null)).toBe(false);
  });
  test("a non-node target (window) keeps it open", () => {
    expect(shouldCloseOnBlur({} as EventTarget, root)).toBe(false);
  });
});

describe("autopilot gate is visible", () => {
  test("Free shows a visible Paid label next to the lock; paid plans do not", () => {
    const iris = hydrotrailEmployees[0];
    const gated = renderToStaticMarkup(
      <EmployeeCard employee={iris} autopilotAvailable={false} workstreamHref="/x" onAutopilotToggle={noop} />,
    );
    expect(gated).toMatch(/<span aria-hidden="true" class="text-\[11px\] font-medium text-home-ink-2">Paid<\/span>/);
    const open = renderToStaticMarkup(
      <EmployeeCard employee={iris} autopilotAvailable workstreamHref="/x" onAutopilotToggle={noop} />,
    );
    expect(open).not.toContain(">Paid<");
    // Name still starts with the visible "Autopilot" and mentions paid plans.
    expect(gated).toContain('aria-label="Autopilot for Iris, Brand (paid plans)"');
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

  test("the switcher keeps its outside pointer-down listener and removes it on cleanup", () => {
    const source = read("components", "workspace", "shell", "BusinessSwitcher.tsx");
    expect(source).toContain('document.addEventListener("pointerdown", onPointerDown)');
    expect(source).toContain('document.removeEventListener("pointerdown", onPointerDown)');
    expect(source).toContain("shouldCloseOnBlur(event.relatedTarget, rootRef.current)");
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

  test("the dynamic import and all JSX sit inside the development branch, before notFound()", () => {
    const check = page.indexOf('if (process.env.NODE_ENV === "development") {', page.indexOf("export default async function"));
    const dynamicImport = page.indexOf('await import("./KitPreviewClient")');
    const firstReturn = page.indexOf("return (", check);
    const notFoundCall = page.indexOf("notFound();", check);
    expect(check).toBeGreaterThan(-1);
    expect(dynamicImport).toBeGreaterThan(check);
    expect(firstReturn).toBeGreaterThan(dynamicImport);
    expect(notFoundCall).toBeGreaterThan(firstReturn);
    // Nothing renders before the check.
    expect(page.slice(page.indexOf("export default async function"), check)).not.toMatch(/<[A-Za-z]/);
  });

  test("page.tsx has no static import of the client preview or the fixtures", () => {
    expect(page).not.toMatch(/^import[^;]*KitPreviewClient/m);
    expect(page).not.toMatch(/^import[^;]*fixtures/m);
    expect(page).not.toMatch(/from\s+"\.\/KitPreviewClient"/);
    expect(page).not.toMatch(/kit\/fixtures/);
  });

  test("robots is noindex and nofollow, and the title is set only in development", () => {
    expect(page).toMatch(/export function generateMetadata/);
    expect(page).not.toMatch(/export const metadata/);
    expect(page).toMatch(/robots\s*=\s*\{[^}]*index:\s*false/);
    expect(page).toMatch(/robots\s*=\s*\{[^}]*follow:\s*false/);
    const body = page.slice(page.indexOf("export function generateMetadata"), page.indexOf("const PROJECT_ID"));
    const devBranch = body.indexOf('process.env.NODE_ENV === "development"');
    const title = body.indexOf("title:");
    expect(devBranch).toBeGreaterThan(-1);
    expect(title).toBeGreaterThan(devBranch);
    // The title is inside the dev branch's braces, and the fallback return has none.
    const afterBranch = body.slice(body.indexOf("}", title));
    expect(afterBranch).toMatch(/return \{ robots \};/);
    expect(body.match(/title:/g)).toHaveLength(1);
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
    expect(client).toMatch(/clearTimeout/);
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
