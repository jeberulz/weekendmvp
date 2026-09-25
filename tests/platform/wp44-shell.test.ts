/// <reference types="vite/client" />

import { describe, expect, test } from "vitest";
import dashboardLayoutSource from "../../app/dashboard/layout.tsx?raw";
import dashboardPageSource from "../../app/dashboard/page.tsx?raw";
import signOutSource from "../../app/dashboard/SignOutButton.tsx?raw";
import sheetSource from "../../components/ui/sheet.tsx?raw";
import accountMenuSource from "../../components/platform/shell/AccountMenu.tsx?raw";
import searchSource from "../../components/platform/shell/WorkspaceSearch.tsx?raw";
import shellSource from "../../components/platform/shell/WorkspaceShell.tsx?raw";
import navSource from "../../components/platform/shell/workspace-current.ts?raw";
import {
  PRIMARY_NAV,
  isSearchShortcut,
  isWorkspaceNavCurrent,
} from "../../components/platform/shell/workspace-current";

const chromeSources = { shellSource, accountMenuSource, searchSource, signOutSource };

describe("WP44-S2 light workspace shell", () => {
  test("keeps the request-time auth boundary and private metadata", () => {
    expect(dashboardLayoutSource).toContain("<AuthPlatformProvider");
    expect(dashboardLayoutSource).toContain('fallbackClassName="bg-home-paper"');
    expect(dashboardLayoutSource).toContain("<WorkspaceShell ideaCount=");
    expect(dashboardLayoutSource).toContain("index: false");
    expect(dashboardLayoutSource).toContain("noarchive: true");
    expect(dashboardLayoutSource).toContain("nocache: true");
  });

  test("owns the only main landmark, one labelled nav and a skip link", () => {
    expect(shellSource.match(/<main\b/g)).toHaveLength(1);
    expect(shellSource.match(/<nav\b/g)).toHaveLength(1);
    expect(shellSource).toContain('<nav aria-label="Workspace"');
    expect(shellSource).toContain('href="#workspace-main"');
    expect(shellSource).toContain('id="workspace-main"');
    expect(shellSource).toContain('aria-current={current ? "page" : undefined}');
    expect(dashboardPageSource).not.toContain("<main");
  });

  test("links Home, Ideas and Saved, and drops New idea and Interested (R3, R4)", () => {
    expect(PRIMARY_NAV.map((item) => item.label)).toEqual(["Home", "Ideas", "Saved"]);
    expect(PRIMARY_NAV.map((item) => item.href)).toEqual([
      "/dashboard",
      "/dashboard/explore",
      "/dashboard/saved",
    ]);
    for (const source of [shellSource, navSource, accountMenuSource]) {
      expect(source).not.toContain('"/dashboard/new"');
      expect(source).not.toContain("view=interested");
      expect(source).not.toMatch(/label: "(New idea|Interested)"/);
      expect(source).not.toMatch(/>\s*(New idea|Interested)\s*</);
    }
    expect(navSource).toContain('href: "/dashboard/billing"');
    expect(navSource).toContain('"/starter-kit"');
    expect(shellSource).not.toContain("Ask Weekend MVP");
  });

  test("uses research-desk tokens only in the shell chrome", () => {
    for (const [name, source] of Object.entries(chromeSources)) {
      expect(source, name).not.toContain("#050505");
      expect(source, name).not.toMatch(/\bzinc-\d/);
      expect(source, name).not.toMatch(/\bwhite\/\d/);
    }
    expect(shellSource).toContain("bg-home-paper");
    expect(shellSource).toContain("bg-home-sunk");
  });

  test("collapses the sidebar with a labelled, stateful toggle", () => {
    expect(shellSource).toContain('id="workspace-sidebar"');
    expect(shellSource).toContain('aria-controls="workspace-sidebar"');
    expect(shellSource).toContain("aria-expanded={!collapsed}");
    expect(shellSource).toContain('"Expand sidebar" : "Collapse sidebar"');
    expect(shellSource).toContain('w-[72px]');
    expect(shellSource).toContain('w-[248px]');
  });

  test("searches the whole library from the top bar", () => {
    expect(searchSource).toContain('role="search"');
    expect(searchSource).toContain("action={IDEAS_PATH}");
    expect(searchSource).toContain('name="q"');
    expect(searchSource).toContain('aria-keyshortcuts="/"');
    expect(searchSource).toContain('<label htmlFor="workspace-search" className="sr-only">');
  });

  test("keeps the mobile account sheet labelled and calm", () => {
    expect(shellSource).toContain("<SheetTitle");
    expect(shellSource).toContain("<SheetClose asChild>");
    expect(shellSource).toContain("<SignOutButton");
    const mobileSheet = shellSource.slice(
      shellSource.indexOf("<SheetContent"),
      shellSource.indexOf(">", shellSource.indexOf("<SheetContent")) + 1,
    );
    expect(mobileSheet).toContain('overlayClassName="motion-reduce:animate-none"');
    expect(mobileSheet).toContain("motion-reduce:animate-none");
    expect(mobileSheet).toContain("motion-reduce:transition-none");
    expect(sheetSource).toContain("<SheetOverlay className={overlayClassName} />");
  });
});

describe("WP44-S2 navigation state", () => {
  test("Home is current only on the dashboard root", () => {
    expect(isWorkspaceNavCurrent("home", "/dashboard", null)).toBe(true);
    expect(isWorkspaceNavCurrent("home", "/dashboard/explore", null)).toBe(false);
  });

  test("Ideas covers Explore except the saved views", () => {
    expect(isWorkspaceNavCurrent("ideas", "/dashboard/explore", null)).toBe(true);
    expect(isWorkspaceNavCurrent("ideas", "/dashboard/explore", "for_you")).toBe(true);
    expect(isWorkspaceNavCurrent("ideas", "/dashboard/explore", "saved")).toBe(false);
    expect(isWorkspaceNavCurrent("ideas", "/dashboard/explore", "interested")).toBe(false);
    expect(isWorkspaceNavCurrent("ideas", "/dashboard/explorer", null)).toBe(false);
  });

  test("Saved covers both saved and interested views (R3)", () => {
    expect(isWorkspaceNavCurrent("saved", "/dashboard/explore", "saved")).toBe(true);
    expect(isWorkspaceNavCurrent("saved", "/dashboard/explore", "interested")).toBe(true);
    expect(isWorkspaceNavCurrent("saved", "/dashboard/saved", null)).toBe(true);
    expect(isWorkspaceNavCurrent("saved", "/dashboard/explore", null)).toBe(false);
  });

  test("Plan and billing matches its route", () => {
    expect(isWorkspaceNavCurrent("billing", "/dashboard/billing", null)).toBe(true);
    expect(isWorkspaceNavCurrent("billing", "/dashboard", null)).toBe(false);
  });
});

describe("WP44-S2 search shortcut", () => {
  const base = {
    key: "/",
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    defaultPrevented: false,
    target: { tagName: "BODY", isContentEditable: false },
  };

  test("focuses search from the page", () => {
    expect(isSearchShortcut(base)).toBe(true);
    expect(isSearchShortcut({ ...base, target: null })).toBe(true);
  });

  test("never steals a slash someone is typing", () => {
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT", "input"]) {
      expect(isSearchShortcut({ ...base, target: { tagName } })).toBe(false);
    }
    expect(
      isSearchShortcut({ ...base, target: { tagName: "DIV", isContentEditable: true } }),
    ).toBe(false);
  });

  test("ignores other keys, modifiers and handled events", () => {
    expect(isSearchShortcut({ ...base, key: "?" })).toBe(false);
    expect(isSearchShortcut({ ...base, metaKey: true })).toBe(false);
    expect(isSearchShortcut({ ...base, ctrlKey: true })).toBe(false);
    expect(isSearchShortcut({ ...base, altKey: true })).toBe(false);
    expect(isSearchShortcut({ ...base, defaultPrevented: true })).toBe(false);
  });
});
