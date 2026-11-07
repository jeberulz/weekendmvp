// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import type { FunctionReference } from "convex/server";
import { afterEach, describe, expect, test, vi } from "vitest";

// L1-C5b. The desk's signed-in nav links back into each business workspace,
// from `api.workspace.access.myBusinesses`; with no business (the query's
// answer when the workspace is off, too) there is no link and no error.

const convex = vi.hoisted(() => ({ businesses: undefined as unknown, fail: false }));
vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useQuery: (query: FunctionReference<"query">) => {
      if (getFunctionName(query) !== "workspace/access:myBusinesses") return undefined;
      if (convex.fail) throw new Error("session expired");
      return convex.businesses;
    },
    useMutation: () => vi.fn(),
    useConvex: () => ({ query: vi.fn() }),
    useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  };
});
vi.mock("../../components/platform/client-gates", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../components/platform/client-gates")>()),
  WhenConvexReady: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/saved",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("../../components/idea-requests/IdeaRequestWidget", () => ({ IdeaRequestWidget: () => null }));
vi.mock("next/font/google", () => ({
  Newsreader: () => ({ className: "font-serif", variable: "--font-serif", style: { fontFamily: "serif" } }),
}));

import { WorkspaceShell } from "../../components/platform/shell/WorkspaceShell";
import {
  BusinessWorkspaceLinks,
  businessLinkLabel,
  businessWorkspaceLinks,
} from "../../components/platform/shell/BusinessWorkspaceLinks";

afterEach(() => {
  cleanup();
  convex.businesses = undefined;
  convex.fail = false;
});

/** The mobile bottom bar's Account button (the one that opens the sheet dialog). */
const accountTrigger = () => {
  const trigger = screen.getAllByRole("button", { name: "Account" }).find((button) => button.getAttribute("aria-haspopup") === "dialog");
  if (trigger === undefined) throw new Error("no Account sheet trigger");
  return trigger;
};

const shell = () => renderToStaticMarkup(<WorkspaceShell>Page</WorkspaceShell>);
const businessLinks = (html: string) => [...html.matchAll(/<a [^>]*href="(\/dashboard\/b\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
  .map((match) => ({ href: match[1], text: match[2].replace(/<[^>]+>/g, "").trim() }));

describe("L1-C5b desk link into the business workspace", () => {
  test("each owned business gets a visible link to /dashboard/b/{projectId}, inside the Workspace nav", () => {
    convex.businesses = [{ projectId: "proj1", name: "PostureUp" }, { projectId: "a b/c", name: "SipLine" }];
    const html = shell();
    expect(businessLinks(html)).toEqual([
      { href: "/dashboard/b/proj1", text: "Your business: PostureUp" },
      { href: "/dashboard/b/a%20b%2Fc", text: "Your business: SipLine" },
    ]);
    const nav = html.slice(html.indexOf("<nav"), html.indexOf("</nav>"));
    expect(nav).toContain('href="/dashboard/b/proj1"');
  });

  test("no business (or the workspace off, which reads the same), loading or a failed read: no link and no error", () => {
    for (const businesses of [[], undefined]) {
      convex.businesses = businesses;
      const html = shell();
      expect(businessLinks(html)).toEqual([]);
      expect(html).not.toContain("Your business");
    }
    // A failed read (a session ending while the page is open) is caught by the quiet boundary in the browser.
    convex.fail = true;
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { container } = render(<WorkspaceShell>Page</WorkspaceShell>);
    quiet.mockRestore();
    expect(container.textContent).toContain("Page");
    expect(container.querySelector('a[href^="/dashboard/b/"]')).toBeNull();
  });

  test("the mobile Account sheet lists the same links, after Starter Kit, and none without a business", async () => {
    const user = userEvent.setup();
    convex.businesses = [{ projectId: "proj1", name: "PostureUp" }, { projectId: "a b/c", name: "SipLine" }];
    render(<WorkspaceShell>Page</WorkspaceShell>);
    await user.click(accountTrigger());
    const sheet = screen.getByRole("dialog", { name: "Account" });
    const links = within(sheet).getAllByRole("link");
    const labels = links.map((link) => link.textContent?.trim());
    expect(labels.slice(-2)).toEqual(["Your business: PostureUp", "Your business: SipLine"]);
    expect(labels.indexOf("Starter Kit")).toBe(labels.length - 3);
    expect(links.slice(-2).map((link) => link.getAttribute("href"))).toEqual(["/dashboard/b/proj1", "/dashboard/b/a%20b%2Fc"]);
    // Choosing one closes the sheet (each link sits in a SheetClose). jsdom cannot navigate, so the click's default is stopped.
    const stopNavigation = (event: MouseEvent) => event.preventDefault();
    window.addEventListener("click", stopNavigation);
    await user.click(within(sheet).getByRole("link", { name: "Your business: PostureUp" }));
    window.removeEventListener("click", stopNavigation);
    expect(screen.queryByRole("dialog", { name: "Account" })).toBeNull();
    cleanup();

    convex.businesses = [];
    render(<WorkspaceShell>Page</WorkspaceShell>);
    await user.click(accountTrigger());
    const empty = screen.getByRole("dialog", { name: "Account" });
    expect(within(empty).getByRole("link", { name: "Starter Kit" })).toBeTruthy();
    expect(within(empty).queryByRole("link", { name: /Your business/ })).toBeNull();
  });

  test("helpers word and encode the link", () => {
    expect(businessLinkLabel("PostureUp")).toBe("Your business: PostureUp");
    expect(businessWorkspaceLinks([{ projectId: "x/y", name: "N" }])).toEqual([
      { projectId: "x/y", href: "/dashboard/b/x%2Fy", label: "Your business: N" },
    ]);
    convex.businesses = [{ projectId: "p", name: "N" }];
    const html = renderToStaticMarkup(
      <BusinessWorkspaceLinks>{(links) => links.map((link) => <span key={link.projectId}>{link.href}</span>)}</BusinessWorkspaceLinks>,
    );
    expect(html).toBe("<span>/dashboard/b/p</span>");
  });
});
