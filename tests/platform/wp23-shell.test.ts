/// <reference types="vite/client" />

import { describe, expect, test } from "vitest";
import dashboardLayoutSource from "../../app/dashboard/layout.tsx?raw";
import dashboardPageSource from "../../app/dashboard/page.tsx?raw";
import sheetSource from "../../components/ui/sheet.tsx?raw";
import shellSource from "../../components/platform/shell/WorkspaceShell.tsx?raw";
import { isWorkspaceLinkCurrent } from "../../components/platform/shell/workspace-current";

describe("WP23 authenticated workspace shell", () => {
  test("retains the request-time auth boundary and private metadata", () => {
    expect(dashboardLayoutSource).toContain("<AuthPlatformProvider>");
    expect(dashboardLayoutSource).toContain("<WorkspaceShell>");
    expect(dashboardLayoutSource).toContain("index: false");
    expect(dashboardLayoutSource).toContain("noarchive: true");
    expect(dashboardLayoutSource).toContain("nocache: true");
  });

  test("owns the only main landmark and provides keyboard navigation", () => {
    expect(shellSource.match(/<main\b/g)).toHaveLength(1);
    expect(shellSource.match(/<nav\b/g)).toHaveLength(1);
    expect(shellSource).toContain('href="#workspace-main"');
    expect(shellSource).toContain('aria-current={current ? "page" : undefined}');
    expect(shellSource).toContain("<SheetContent");
    expect(shellSource).toContain("<SheetClose asChild>");
    expect(dashboardPageSource).not.toContain("<main");
  });

  test("exposes the frozen primary routes without a free-agent control", () => {
    for (const route of [
      "/dashboard",
      "/dashboard/explore",
      "/dashboard/new",
      "/dashboard/billing",
    ]) {
      expect(shellSource).toContain(route);
    }
    expect(shellSource).not.toContain("Ask Weekend MVP");
  });

  test("keeps the mobile navigation labelled and the sheet operable", () => {
    expect(shellSource).toContain('compact && "min-h-12 min-w-12 flex-col');
    expect(shellSource).toContain("<span>{item.label}</span>");
    expect(shellSource).toContain("<SheetContent");
    expect(shellSource).toContain("<SignOutButton />");
    const mobileSheet = shellSource.slice(
      shellSource.indexOf("<SheetContent"),
      shellSource.indexOf(">", shellSource.indexOf("<SheetContent")) + 1,
    );
    expect(mobileSheet).toContain(
      'overlayClassName="motion-reduce:animate-none"',
    );
    expect(mobileSheet).toContain("motion-reduce:animate-none");
    expect(mobileSheet).toContain("motion-reduce:transition-none");
    expect(sheetSource).toContain(
      "<SheetOverlay className={overlayClassName} />",
    );
  });

  test("derives Saved and Interested current state from the query", () => {
    expect(shellSource).toContain("useSearchParams().get(\"view\")");
    expect(shellSource).toContain('queryView: "saved"');
    expect(shellSource).toContain('queryView: "interested"');
    expect(shellSource).toContain("isWorkspaceLinkCurrent(pathname, activeView, item)");

    const explore = {
      href: "/dashboard/explore",
      match: "prefix" as const,
    };
    const saved = {
      href: "/dashboard/explore?view=saved",
      queryView: "saved" as const,
    };
    const interested = {
      href: "/dashboard/explore?view=interested",
      queryView: "interested" as const,
    };
    expect(
      isWorkspaceLinkCurrent("/dashboard/explore", "saved", saved),
    ).toBe(true);
    expect(
      isWorkspaceLinkCurrent("/dashboard/explore", "saved", explore),
    ).toBe(false);
    expect(
      isWorkspaceLinkCurrent("/dashboard/explore", "interested", interested),
    ).toBe(true);
    expect(
      isWorkspaceLinkCurrent("/dashboard/explore", "for_you", explore),
    ).toBe(true);
    expect(
      isWorkspaceLinkCurrent("/dashboard/explore", "for_you", saved),
    ).toBe(false);
    expect(
      isWorkspaceLinkCurrent("/dashboard", null, {
        href: "/dashboard",
        match: "exact",
      }),
    ).toBe(true);
  });

  test("uses AA-oriented text and action colors in the WP23 shell", () => {
    expect(shellSource).not.toMatch(/text-zinc-(500|600)/);
    expect(shellSource).not.toContain("bg-orange-600");
    expect(shellSource).toContain("bg-orange-800");
  });
});
