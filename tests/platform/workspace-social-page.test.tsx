// @vitest-environment jsdom
/**
 * WP76-S2b: the Social page panel through the real DOM (Testing Library +
 * user-event) and axe-core: each state, the seven posts in day order, the
 * platform picker changing counts and limits, over-limit wording, the copied
 * text per platform, approve and ask-for-changes through the shared review
 * card, and no post or schedule control.
 */
import axe from "axe-core";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { Id } from "@/convex/_generated/dataModel";
import { SOCIAL_DAYS, SOCIAL_PLATFORMS } from "@/lib/workspace/contracts/artifacts";
import { captionCount, copiedAnnouncement, copyTextFor, hashtagLine } from "@/lib/workspace/socialPage";

const FREE_PREVIEW = { outcome: "free", changeRound: 1, freeRoundsLeft: 2 };
const live: { view: unknown; preview: unknown } = { view: undefined, preview: FREE_PREVIEW };
const decideMock = vi.fn();

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
      if (args === "skip") return undefined;
      if (getFunctionName(ref).includes("previewChangeRound")) return live.preview;
      return live.view;
    },
    useMutation: () => decideMock,
  };
});
vi.mock("@/components/platform/client-gates", async () => {
  const actual = await vi.importActual<typeof import("@/components/platform/client-gates")>("@/components/platform/client-gates");
  return {
    WhenConvexReady: ({ children }: { children: ReactNode }) => children,
    QuietErrorBoundary: actual.QuietErrorBoundary,
  };
});

const { SocialPackPanel } = await import("@/components/workspace/social/SocialPackPanel");

const PROJECT = "project1" as Id<"projects">;
const APPROVAL = "approval1" as Id<"approvals">;
const DAY_NAMES = ["Friday (launch day)", "Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

const LONG_CAPTION = `${"Long caption. ".repeat(30)}End.`; // about 420 characters, over X's 280

function post(day: (typeof SOCIAL_DAYS)[number], extra: Record<string, unknown> = {}) {
  return {
    day,
    kind: "value",
    format: "image",
    hook: `Hook ${day}`,
    caption: `Caption ${day}`,
    shortCaption: `Short ${day}`,
    imageText: `Card ${day}`,
    imageAlt: `Alt ${day}`,
    hashtags: ["hydrotrail", "weekendmvp"],
    ...extra,
  };
}

function posts() {
  return SOCIAL_DAYS.map((day, index) => {
    if (index === 0) return post(day, { kind: "launch", caption: LONG_CAPTION, shortCaption: "Short launch caption." });
    if (index === 2) {
      return post(day, { format: "poll", imageAlt: undefined, pollOptions: ["Option A", "Option B"], hashtags: [] });
    }
    return post(day);
  });
}

function ready(card: unknown = { approvalId: APPROVAL, status: "pending", changeRound: 0n, expiresAt: Date.now() + 86_400_000 }) {
  return { state: "ready", posts: posts(), card };
}

function show() {
  return render(<SocialPackPanel projectId={PROJECT} />);
}

function postItems() {
  return Array.from(screen.getByRole("list", { name: "The posts, in order" }).children) as HTMLElement[];
}

/** user-event installs its own clipboard stub on `setup()`; replace it with a spy we can read. */
function setup() {
  const user = userEvent.setup();
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  return { user, writeText };
}

afterEach(() => {
  cleanup();
  decideMock.mockReset();
  live.view = undefined;
  live.preview = FREE_PREVIEW;
});

describe("helpers", () => {
  test("copy text is the platform caption, then a blank line and the hashtags with #", () => {
    const p = { caption: LONG_CAPTION, shortCaption: "Short.", hashtags: ["a", "b"] };
    expect(copyTextFor(p, "instagram")).toBe(`${LONG_CAPTION}\n\n#a #b`);
    expect(copyTextFor(p, "x")).toBe("Short.\n\n#a #b");
    expect(copyTextFor({ ...p, hashtags: [] }, "x")).toBe("Short.");
    expect(hashtagLine(["a", "b"])).toBe("#a #b");
  });
  test("branch 1: the full caption plus hashtags fits, so it is used", () => {
    const p = { caption: "x".repeat(250), shortCaption: "y".repeat(100), hashtags: ["a", "b"] };
    const c = captionCount(p, "x");
    expect(c).toMatchObject({ count: 257, limit: 280, over: false, usesShort: false, note: null });
    expect(c.summary).toBe("257 of 280 characters, hashtags included");
    expect(copyTextFor(p, "x")).toBe(`${"x".repeat(250)}\n\n#a #b`);
  });
  test("branch 2: the full caption fits alone but not with hashtags, so the short caption is used", () => {
    const p = { caption: "x".repeat(270), shortCaption: "y".repeat(100), hashtags: ["h".repeat(31)] };
    const c = captionCount(p, "x");
    expect(c).toMatchObject({ count: 134, over: false, usesShort: true });
    expect(c.summary).toBe("134 of 280 characters, hashtags included");
    expect(c.note).toMatch(/short caption is used/);
    expect(copyTextFor(p, "x")).toBe(`${"y".repeat(100)}\n\n#${"h".repeat(31)}`);
  });
  test("branch 3: even the short caption plus hashtags is too long, so it is used and marked over", () => {
    const p = { caption: "x".repeat(400), shortCaption: "y".repeat(280), hashtags: ["abc"] };
    const c = captionCount(p, "x");
    expect(c).toMatchObject({ count: 286, over: true, usesShort: true });
    expect(c.summary).toBe("286 of 280 characters, hashtags included. Over the limit by 6.");
    expect(copyTextFor(p, "x")).toBe(`${"y".repeat(280)}\n\n#abc`);
  });
  test("no hashtags leaves out the hashtag clause; code points are counted", () => {
    const c = captionCount({ caption: "é😀", shortCaption: "s", hashtags: [] }, "instagram");
    expect(c.count).toBe(2);
    expect(c.summary).toBe("2 of 2,200 characters");
  });
  test("announcement names the day and the platform", () => {
    expect(copiedAnnouncement("fri", "x")).toBe("Copied the Friday post for X.");
  });
});

describe("states", () => {
  test("loading", () => {
    show();
    expect(screen.getByText("Loading your posts…")).toBeTruthy();
  });
  test("none", () => {
    live.view = { state: "none" };
    show();
    expect(screen.getByText("Your social posts will appear here once your team writes them.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
  test("unavailable shows calm copy with no detail", () => {
    live.view = { state: "unavailable" };
    show();
    expect(screen.getByText(/can't be shown right now/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("ready", () => {
  test("seven posts in day order with their facts, and a heading outline", () => {
    live.view = ready();
    show();
    const items = postItems();
    expect(items).toHaveLength(7);
    expect(items.map((item) => within(item).getByRole("heading", { level: 3 }).textContent)).toEqual(DAY_NAMES);
    const first = items[0];
    expect(within(first).getByText("Launch · Image post")).toBeTruthy();
    expect(within(first).getByText("Hook fri")).toBeTruthy();
    expect(within(first).getByText("Card fri")).toBeTruthy();
    expect(within(first).getByText("Alt fri")).toBeTruthy();
    expect(within(first).getByText("#hydrotrail #weekendmvp")).toBeTruthy();
    const poll = items[2];
    expect(within(poll).getByText("Value · Poll")).toBeTruthy();
    expect(within(poll).getByText("Option A")).toBeTruthy();
    expect(within(poll).queryByText("Hashtags")).toBeNull();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1);
  });

  test("says plainly that nothing posts and has no post or schedule control", () => {
    live.view = ready();
    show();
    expect(screen.getByText(/Nothing posts for you/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /schedule|publish|post now/i })).toBeNull();
  });

  test("text from the server is never parsed as HTML", () => {
    const view = ready();
    view.posts[1] = post("sat", { caption: "<b>bold</b> <img src=x onerror=alert(1)>" });
    live.view = view;
    const { container } = show();
    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText(/<b>bold<\/b>/)).toBeTruthy();
  });

  test("switching platform changes the count, the limit and the caption used", async () => {
    live.view = ready();
    show();
    const { user } = setup();
    const launch = () => postItems()[0];
    expect(within(launch()).getByText("449 of 2,200 characters, hashtags included")).toBeTruthy();
    expect(within(launch()).queryByText(/short caption is used/)).toBeNull();
    await user.selectOptions(screen.getByLabelText("Post on"), "x");
    expect(within(launch()).getByText("46 of 280 characters, hashtags included")).toBeTruthy();
    expect(within(launch()).getByText(/short caption is used/)).toBeTruthy();
    expect(within(launch()).getByText("Short launch caption.")).toBeTruthy();
    await user.selectOptions(screen.getByLabelText("Post on"), "threads");
    expect(within(launch()).getByText("449 of 500 characters, hashtags included")).toBeTruthy();
    expect(within(launch()).queryByText(/short caption is used/)).toBeNull();
  });

  test("the picker lists the 8 platforms", () => {
    live.view = ready();
    show();
    const options = within(screen.getByLabelText("Post on")).getAllByRole("option");
    expect(options).toHaveLength(8);
    expect(options).toHaveLength(SOCIAL_PLATFORMS.length);
  });

  test("a post still too long after the short caption says so in words", async () => {
    const view = ready();
    view.posts[3] = post("mon", { caption: "x".repeat(400), shortCaption: "y".repeat(280) });
    live.view = view;
    show();
    await userEvent.setup().selectOptions(screen.getByLabelText("Post on"), "x");
    expect(within(postItems()[3]).getByText("305 of 280 characters, hashtags included. Over the limit by 25.")).toBeTruthy();
    expect(within(postItems()[0]).queryByText(/Over the limit/)).toBeNull();
  });

  test("poll options carry a hint", () => {
    live.view = ready();
    show();
    expect(within(postItems()[2]).getByText("Add these as the poll's choices on the platform.")).toBeTruthy();
  });

  test("passes axe", async () => {
    live.view = ready();
    const { container } = show();
    const results = await axe.run(container, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] });
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});

const FRIDAY_FULL = `${LONG_CAPTION}\n\n#hydrotrail #weekendmvp`;
const FRIDAY_SHORT = "Short launch caption.\n\n#hydrotrail #weekendmvp";
const PLATFORM_ROWS = [
  ["instagram", "Instagram", "449 of 2,200 characters, hashtags included", FRIDAY_FULL],
  ["facebook", "Facebook", "449 of 63,206 characters, hashtags included", FRIDAY_FULL],
  ["tiktok", "TikTok", "449 of 2,200 characters, hashtags included", FRIDAY_FULL],
  ["x", "X", "46 of 280 characters, hashtags included", FRIDAY_SHORT],
  ["youtube", "YouTube", "449 of 5,000 characters, hashtags included", FRIDAY_FULL],
  ["linkedin", "LinkedIn", "449 of 3,000 characters, hashtags included", FRIDAY_FULL],
  ["threads", "Threads", "449 of 500 characters, hashtags included", FRIDAY_FULL],
  ["pinterest", "Pinterest", "449 of 500 characters, hashtags included", FRIDAY_FULL],
] as const;

describe("copy", () => {
  test("the platform rows cover all 8 platforms", () => {
    expect(PLATFORM_ROWS.map((row) => row[0])).toEqual([...SOCIAL_PLATFORMS]);
  });

  test.each(PLATFORM_ROWS)("%s: copies the exact text and shows the exact count", async (value, label, count, text) => {
    live.view = ready();
    show();
    const { user, writeText } = setup();
    await user.selectOptions(screen.getByLabelText("Post on"), value);
    expect(within(postItems()[0]).getByText(count)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: `Copy the Friday post for ${label}` }));
    expect(writeText).toHaveBeenCalledWith(text);
  });

  test("copies the caption plus hashtags and announces it", async () => {
    live.view = ready();
    show();
    const { user, writeText } = setup();
    await user.click(screen.getByRole("button", { name: "Copy the Saturday post for Instagram" }));
    expect(writeText).toHaveBeenCalledWith("Caption sat\n\n#hydrotrail #weekendmvp");
    await waitFor(() => expect(screen.getByTestId("social-copy-status").textContent).toBe("Copied the Saturday post for Instagram."));
  });

  test("the button name keeps starting with its visible text", async () => {
    live.view = ready();
    show();
    const { user } = setup();
    const button = screen.getByRole("button", { name: "Copy the Saturday post for Instagram" });
    await user.click(button);
    expect(button.textContent).toBe("Copy");
    expect(button.getAttribute("aria-label")?.startsWith(button.textContent ?? "")).toBe(true);
  });

  test("a post without hashtags copies the caption alone", async () => {
    live.view = ready();
    show();
    const { user, writeText } = setup();
    await user.click(screen.getByRole("button", { name: "Copy the Sunday post for Instagram" }));
    expect(writeText).toHaveBeenLastCalledWith("Caption sun");
  });

  test("copying the same post twice announces twice (a new node each time)", async () => {
    live.view = ready();
    show();
    const { user } = setup();
    const button = screen.getByRole("button", { name: "Copy the Saturday post for Instagram" });
    await user.click(button);
    const first = screen.getByTestId("social-copy-status").firstElementChild;
    await user.click(button);
    const second = screen.getByTestId("social-copy-status").firstElementChild;
    expect(first).not.toBeNull();
    expect(second).not.toBe(first);
    expect(second?.textContent).toBe("Copied the Saturday post for Instagram.");
  });

  test("a failed copy says so calmly, and again on a second failure", async () => {
    live.view = ready();
    show();
    const { user, writeText } = setup();
    writeText.mockRejectedValue(new Error("denied"));
    const button = screen.getByRole("button", { name: "Copy the Monday post for Instagram" });
    await user.click(button);
    await waitFor(() => expect(screen.getByTestId("social-copy-status").textContent).toMatch(/Couldn't copy/));
    const first = screen.getByTestId("social-copy-status").firstElementChild;
    await user.click(button);
    await waitFor(() => expect(screen.getByTestId("social-copy-status").firstElementChild).not.toBe(first));
    expect(button.textContent).toBe("Copy");
  });
});

describe("review card", () => {
  test("approve calls the mutation and announces", async () => {
    decideMock.mockResolvedValue({ status: "approved", changed: true });
    live.view = ready();
    show();
    const user = userEvent.setup();
    expect(screen.getByText(/Read the posts below/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(decideMock).toHaveBeenCalledWith({ projectId: PROJECT, approvalId: APPROVAL, decision: "approve" });
    await waitFor(() => expect(screen.getByText("Approved.")).toBeTruthy());
  });

  test("an approved card says nothing is posted for the founder", () => {
    live.view = ready({ approvalId: APPROVAL, status: "approved", changeRound: 0n, expiresAt: Date.now() + 86_400_000 });
    show();
    expect(screen.getByText(/Review status: Approved\. Nothing is posted for you\./)).toBeTruthy();
  });

  test("ask for changes sends the trimmed note and says the posts are being rewritten", async () => {
    decideMock.mockResolvedValue({
      status: "changes_requested",
      changed: true,
      changeRound: { outcome: "free", changeRound: 1, freeRoundsLeft: 1, taskId: "task1" },
    });
    live.view = ready();
    show();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Ask for changes" }));
    expect(screen.getByText(/rewrite the posts/)).toBeTruthy();
    await user.type(screen.getByLabelText("What should change?"), "  Shorter  ");
    await user.click(screen.getByRole("button", { name: "Send changes" }));
    expect(decideMock).toHaveBeenCalledWith({
      projectId: PROJECT,
      approvalId: APPROVAL,
      decision: "request_changes",
      note: "Shorter",
    });
    await waitFor(() => expect(screen.getByText(/Your team is rewriting the posts\./)).toBeTruthy());
  });

  test("an approved card shows neither Approve nor Ask for changes", () => {
    live.view = ready({ approvalId: APPROVAL, status: "approved", changeRound: 0n, expiresAt: Date.now() + 86_400_000 });
    show();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ask for changes" })).toBeNull();
  });

  test("a paid round is explained in terms of posts and Ask for changes is not offered", () => {
    live.preview = { outcome: "spend_required", costCredits: 5 };
    live.view = ready();
    show();
    expect(
      screen.getByText("Another round of changes costs 5 credits. Paying for changes isn't open yet, so you can approve these posts as they are."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ask for changes" })).toBeNull();
    expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
  });

  test("an expired card shows no buttons and the closed copy names the posts", () => {
    live.view = ready({ approvalId: APPROVAL, status: "pending", changeRound: 0n, expiresAt: Date.now() - 1000 });
    show();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ask for changes" })).toBeNull();
    expect(screen.getByText(/Your posts stay as they are\./)).toBeTruthy();
  });

  test("a pack with no card still shows the posts", () => {
    live.view = ready(null);
    show();
    expect(postItems()).toHaveLength(7);
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });
});
