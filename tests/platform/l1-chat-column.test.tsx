// @vitest-environment jsdom
/**
 * L1 UI fidelity, wave 1 (F2): the right-hand chat column, the co-founder name
 * flowing through the chat, the Team HQ "N need you" badge, the footer sign-out
 * row and the beta-safe approval copy.
 */
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { getFunctionName } from "convex/server";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { Id } from "@/convex/_generated/dataModel";

type Row = {
  _id: Id<"chat_messages">;
  author: "founder" | "wren";
  body: string;
  status: "done" | "streaming" | "failed";
  createdAt: number;
  updatedAt: number;
  cards: readonly unknown[];
};

const NOW = Date.UTC(2026, 10, 6, 12, 0, 0);
const state: {
  thread: Row[];
  reviews: { approvalId: string; expiresAt: number }[] | undefined;
  launch: unknown;
  decide: (args: { decision: string }) => Promise<{ status: string }>;
} = {
  thread: [],
  reviews: [],
  launch: { state: "ready", hired: new Array<unknown>(9).fill({}) },
  decide: async () => ({ status: "approved" }),
};
const signOut = vi.hoisted(() => ({ run: vi.fn(async () => undefined), pending: false }));
const nav = vi.hoisted(() => ({ pathname: "/dashboard/b/p1" }));

vi.mock("convex/react", () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(ref);
    if (name.endsWith("listWrenThread")) return state.thread;
    if (name.endsWith("pendingReviews")) return state.reviews;
    if (name.endsWith("launchStatus")) return state.launch;
    return undefined;
  },
  useMutation: () => (args: { decision: string }) => state.decide(args),
}));
vi.mock("@/components/platform/client-gates", () => ({
  WhenConvexReady: ({ children }: { children: ReactNode }) => children,
  QuietErrorBoundary: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/app/dashboard/SignOutButton", () => ({ useSignOut: () => signOut }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

const { WrenChatColumn } = await import("@/components/workspace/chat/WrenChatColumn");
const { WrenChatCards, approvalSpecialist } = await import("@/components/workspace/chat/WrenChatCards");
const { SidebarUserRow } = await import("@/components/workspace/shell/SidebarUserRow");
const { TeamNeedsYouBadge, needsYouLabel } = await import("@/components/workspace/shell/TeamNeedsYouBadge");
const { WorkspaceFrame } = await import("@/components/workspace/shell");
const { approvalDecisionCopy, BETA_APPROVED_COPY } = await import("@/lib/workspace/wrenCards");

const projectId = "p1" as Id<"projects">;

function wrenRow(body: string): Row {
  return { _id: "m1" as Id<"chat_messages">, author: "wren", body, status: "done", createdAt: NOW, updatedAt: NOW, cards: [] };
}

async function violations(): Promise<string[]> {
  const results = await axe.run(document.body, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    resultTypes: ["violations"],
    rules: { "color-contrast": { enabled: false } },
  });
  return results.violations.map((violation) => violation.id);
}

beforeEach(() => {
  state.thread = [];
  state.reviews = [];
  state.launch = { state: "ready", hired: new Array<unknown>(9).fill({}) };
  state.decide = async () => ({ status: "approved" });
  signOut.run.mockClear();
  signOut.pending = false;
});
afterEach(cleanup);

describe("the partner name flows through the chat", () => {
  test("a custom name replaces Wren in the landmark, header, composer, empty state and mark", async () => {
    state.thread = [wrenRow("Hello there.")];
    render(<main><WrenChatColumn projectId={projectId} name="Sam" /></main>);
    const aside = screen.getByRole("complementary", { name: "Chat with Sam" });
    expect(within(aside).getByRole("heading", { level: 2, name: "Sam" })).toBeTruthy();
    expect(within(aside).getByLabelText("Message Sam")).toBeTruthy();
    expect(within(aside).getByPlaceholderText("Message Sam…")).toBeTruthy();
    const message = aside.querySelector('[data-message="wren"]');
    expect(message?.textContent).toContain("Sam");
    // The picture belongs to the role: a renamed co-founder keeps the crew lead's portrait, hidden from assistive tech.
    expect(message?.querySelector('[aria-hidden="true"] img')?.getAttribute("src")).toBe("/image/crew/lead-wren.webp");
    expect(aside.textContent).not.toContain("Wren");
    expect(await violations()).toEqual([]);
  });

  test("the empty state, the send notices and the announcement use the name", () => {
    render(<main><WrenChatColumn projectId={projectId} name="Juno" /></main>);
    expect(screen.getByText("Ask Juno anything about your launch")).toBeTruthy();
    expect(document.body.textContent).not.toContain("Wren");
  });

  test("Wren is the default only when the name is missing", () => {
    render(<main><WrenChatColumn projectId={projectId} /></main>);
    expect(screen.getByRole("complementary", { name: "Chat with Wren" })).toBeTruthy();
    expect(screen.getByLabelText("Message Wren")).toBeTruthy();
  });

  test("the header links to Team HQ with the crew size", () => {
    render(<main><WrenChatColumn projectId={projectId} name="Sam" /></main>);
    const link = screen.getByRole("link", { name: "team of 9" });
    expect(link.getAttribute("href")).toBe("/dashboard/b/p1/team");
    expect(screen.getByText(/Crew Lead/u)).toBeTruthy();
  });

  test("the crew size is left out until the team exists", () => {
    state.launch = { state: "assembling" };
    render(<main><WrenChatColumn projectId={projectId} name="Sam" /></main>);
    expect(screen.queryByRole("link", { name: /team of/u })).toBeNull();
  });

  test("the send button is the ink square with an up arrow and a label", () => {
    render(<main><WrenChatColumn projectId={projectId} name="Sam" /></main>);
    const send = screen.getByRole("button", { name: "Send message" });
    expect(send.className).toContain("bg-home-ink");
    expect(send.querySelector("svg.lucide-arrow-up")).not.toBeNull();
  });
});

describe("the column below xl: a toggle and a drawer", () => {
  function setup() {
    const view = render(<main><WrenChatColumn projectId={projectId} name="Sam" /></main>);
    const toggle = screen.getByRole("button", { name: "Chat with Sam" });
    const aside = view.container.querySelector("aside");
    if (aside === null) throw new Error("aside missing");
    return { toggle, aside };
  }

  test("closed: a visible toggle that controls the aside; the aside is hidden below xl and shown from xl", () => {
    const { toggle, aside } = setup();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe(aside.id);
    expect(toggle.className).toContain("xl:hidden");
    expect(aside.className).toMatch(/(^|\s)hidden(\s|$)/u);
    expect(aside.className).toContain("xl:flex");
    expect(aside.className).toContain("xl:sticky");
    expect(aside.className).toContain("xl:h-dvh");
    expect(aside.className).toContain("xl:w-[360px]");
    expect(aside.className).toContain("2xl:w-[380px]");
  });

  test("open: the drawer shows, focus moves to Close, and Close returns focus to the toggle", async () => {
    const user = userEvent.setup();
    const { toggle, aside } = setup();
    await user.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(aside.className).not.toMatch(/(^|\s)hidden(\s|$)/u);
    expect(aside.className).toContain("fixed");
    const close = screen.getByRole("button", { name: "Close chat with Sam" });
    expect(document.activeElement).toBe(close);
    await user.click(close);
    expect(aside.className).toMatch(/(^|\s)hidden(\s|$)/u);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(toggle);
  });

  test("keyboard: Enter opens it and Escape closes it, returning focus to the toggle", async () => {
    const user = userEvent.setup();
    const { toggle, aside } = setup();
    toggle.focus();
    await user.keyboard("{Enter}");
    expect(aside.className).toContain("fixed");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close chat with Sam" }));
    await user.keyboard("{Escape}");
    expect(aside.className).toMatch(/(^|\s)hidden(\s|$)/u);
    expect(document.activeElement).toBe(toggle);
  });

  test("Escape inside the composer closes the drawer too", async () => {
    const user = userEvent.setup();
    const { toggle, aside } = setup();
    await user.click(toggle);
    await user.click(screen.getByLabelText("Message Sam"));
    await user.keyboard("{Escape}");
    expect(aside.className).toMatch(/(^|\s)hidden(\s|$)/u);
    expect(document.activeElement).toBe(toggle);
  });

  test("Escape with the drawer shut does nothing", async () => {
    const user = userEvent.setup();
    const { toggle } = setup();
    toggle.focus();
    await user.keyboard("{Escape}");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("the frame has three regions and one main", () => {
  test("nav, then the single main, then the labelled aside, and the skip link still targets main", () => {
    // React hoists a preload for each avatar image; Next.js puts it in <head>. Read the body markup only.
    const markup = renderToStaticMarkup(
      <WorkspaceFrame
        projectId="p1"
        businesses={[{ id: "p1", name: "HydroTrail" }]}
        credits={{ balance: 48, max: 50, plan: "free" }}
        chat={<WrenChatColumn projectId={projectId} name="Sam" />}
      >
        <main id="workspace-main" tabIndex={-1}>Page</main>
      </WorkspaceFrame>,
    ).replace(/^(<link rel="preload" as="image"[^>]*\/>)+/u, "");
    expect(markup.match(/<main\b/g)).toHaveLength(1);
    expect(markup.match(/<aside\b/g)).toHaveLength(1);
    expect(markup.match(/<nav\b/g)).toHaveLength(1);
    expect(markup).toContain('aria-label="Chat with Sam"');
    expect(markup.indexOf("<nav")).toBeLessThan(markup.indexOf("<main"));
    expect(markup.indexOf("<main")).toBeLessThan(markup.indexOf("<aside"));
    expect(markup.startsWith('<a href="#workspace-main"')).toBe(true);
    expect(markup).not.toMatch(/\sstyle=/);
  });
});

describe("the Team HQ badge", () => {
  const future = Date.now() + 60 * 60 * 1000;

  test("shows N need you with a screen-reader tail", () => {
    state.reviews = [
      { approvalId: "a1", expiresAt: future },
      { approvalId: "a2", expiresAt: future },
    ];
    const { container } = render(<div>Team HQ<TeamNeedsYouBadge projectId={projectId} /></div>);
    expect(container.textContent).toBe("Team HQ2 need you to review");
    expect(container.querySelector(".sr-only")?.textContent).toBe(" to review");
  });

  test("is omitted at 0, while loading, and for expired cards", () => {
    for (const reviews of [[], undefined, [{ approvalId: "a1", expiresAt: Date.now() - 1000 }]]) {
      state.reviews = reviews;
      const { container, unmount } = render(<TeamNeedsYouBadge projectId={projectId} />);
      expect(container.innerHTML).toBe("");
      unmount();
    }
    expect(needsYouLabel(0)).toBe("");
    expect(needsYouLabel(1)).toBe("1 need you");
  });

  test("sits inside the Team HQ row of the nav, and only that row", () => {
    // React hoists a preload for each avatar image; Next.js puts it in <head>. Read the body markup only.
    const markup = renderToStaticMarkup(
      <WorkspaceFrame
        projectId="p1"
        businesses={[{ id: "p1", name: "HydroTrail" }]}
        credits={{ balance: 48, max: 50, plan: "free" }}
        teamBadge={<span data-testid="badge">3 need you</span>}
      >
        <main id="workspace-main">Page</main>
      </WorkspaceFrame>,
    );
    expect(markup.match(/data-testid="badge"/g)).toHaveLength(1);
    const row = markup.slice(markup.indexOf('href="/dashboard/b/p1/team"'));
    expect(row.slice(0, row.indexOf("</a>"))).toContain("3 need you");
  });
});

describe("the footer user row", () => {
  test("shows initials, the name and Founder, and Sign out runs the existing hook", async () => {
    const user = userEvent.setup();
    const { container } = render(<SidebarUserRow name="John" />);
    expect(container.textContent).toContain("John");
    expect(container.textContent).toContain("Founder");
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe("J");
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(signOut.run).toHaveBeenCalledTimes(1);
    expect(await violations()).toEqual([]);
  });

  test("while signing out the button stays focusable and ignores another press", async () => {
    signOut.pending = true;
    const user = userEvent.setup();
    render(<SidebarUserRow name="John" />);
    const button = screen.getByRole("button", { name: "Signing out" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    await user.click(button);
    expect(signOut.run).not.toHaveBeenCalled();
  });

  test("the frame renders the user row slot after the nav", () => {
    // React hoists a preload for each avatar image; Next.js puts it in <head>. Read the body markup only.
    const markup = renderToStaticMarkup(
      <WorkspaceFrame
        projectId="p1"
        businesses={[{ id: "p1", name: "HydroTrail" }]}
        credits={{ balance: 48, max: 50, plan: "free" }}
        userRow={<SidebarUserRow name="John" />}
      >
        <main id="workspace-main">Page</main>
      </WorkspaceFrame>,
    );
    expect(markup.indexOf('aria-label="Sign out"')).toBeGreaterThan(markup.indexOf("</nav>"));
  });
});

describe("approval cards in the chat", () => {
  function card(kind: "send" | "post" | "publish", status: "pending" | "approved" = "pending") {
    const table = { send: "email", post: "social", publish: "team" } as const;
    return {
      kind: "approval" as const,
      approvalId: "a1" as Id<"approvals">,
      approvalKind: kind,
      status,
      title: "Do the thing",
      subject: "A subject",
      reviewRoute: table[kind],
    };
  }

  test("the specialist is worked out on the client from the kind", () => {
    expect(approvalSpecialist("send")).toBe("email");
    expect(approvalSpecialist("post")).toBe("social");
    expect(approvalSpecialist("publish")).toBe("landing");
    expect(approvalSpecialist("spend")).toBeNull();
    for (const [kind, label] of [["send", "From Email"], ["post", "From Social"], ["publish", "From Landing"]] as const) {
      const { container, unmount } = render(<ul><WrenChatCards projectId={projectId} cards={[card(kind)]} name="Sam" time="9:20 AM" /></ul>);
      expect(container.textContent).toContain(label);
      expect(container.textContent).toContain("routed by Sam");
      expect(container.textContent).toContain("9:20 AM");
      unmount();
    }
  });

  test("approving a send or post card says nothing goes out during the beta", async () => {
    for (const [kind, expected] of [
      ["send", "Approved. Sending is off during the beta, so nothing goes out yet."],
      ["post", "Approved. Posting is off during the beta, so nothing goes out yet."],
    ] as const) {
      const user = userEvent.setup();
      const { container, unmount } = render(<WrenChatCards projectId={projectId} cards={[card(kind)]} name="Sam" />);
      await user.click(screen.getByRole("button", { name: /^Approve/u }));
      await act(async () => {
        await Promise.resolve();
      });
      expect(container.querySelector("[data-card-status]")?.textContent).toBe(expected);
      unmount();
    }
  });

  test("a publish approval keeps the plain line, and a decline offers to bring it back by name", () => {
    expect(approvalDecisionCopy("approved", { approvalKind: "publish" })).toBe("Approved.");
    expect(approvalDecisionCopy("approved")).toBe("Approved.");
    expect(approvalDecisionCopy("approved", { approvalKind: "send" })).toBe(BETA_APPROVED_COPY.email);
    expect(approvalDecisionCopy("cancelled", { partnerName: "Sam" })).toBe("Okay, not now. You can ask Sam to bring it back.");
    expect(approvalDecisionCopy("cancelled")).toBe("Okay, not now.");
  });

  test("a navigate card to a Coming soon page says so; a built page does not", () => {
    const { container } = render(
      <ul>
        <WrenChatCards
          projectId={projectId}
          cards={[{ kind: "navigate", route: "launch" }, { kind: "navigate", route: "brand" }]}
          name="Sam"
        />
      </ul>,
    );
    const items = container.querySelectorAll('[data-card="wren-navigate"]');
    expect(items[0]?.textContent).toContain("Coming soon");
    expect(items[1]?.textContent).not.toContain("Coming soon");
  });

  test("explain copy uses the partner's name", () => {
    const { container } = render(
      <ul><WrenChatCards projectId={projectId} cards={[{ kind: "explain", topic: "approvals" }]} name="Sam" /></ul>,
    );
    expect(container.textContent).toContain("Sam and the crew");
    expect(container.textContent).not.toContain("Wren");
  });
});
