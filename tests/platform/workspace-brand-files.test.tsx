// @vitest-environment jsdom
/**
 * L1 UI fidelity: Brand kit board and Files browser. The review sits above the brand board, the board's text
 * sits only on contrast-safe pairs, the approved copy stays honest, and the Files rail lists only real entries.
 */
import axe from "axe-core";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { Id } from "@/convex/_generated/dataModel";
import { contrastRatio, MIN_TEXT_CONTRAST } from "@/lib/workspace/contracts/artifacts";
import { formatKeptWhen, memoryCopyText, memoryMetaLine, readableOn } from "@/lib/workspace/reviewPages";

const live: { brand: unknown } = { brand: undefined };

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
      if (args === "skip") return undefined;
      const name = getFunctionName(ref);
      if (name.includes("previewChangeRound")) return { outcome: "free", changeRound: 1, freeRoundsLeft: 2 };
      if (name.includes("brandKitDraft")) return live.brand;
      throw new Error(`unexpected query ${name}`);
    },
    useMutation: () => vi.fn(),
  };
});
vi.mock("@/components/platform/client-gates", async () => {
  const actual = await vi.importActual<typeof import("@/components/platform/client-gates")>("@/components/platform/client-gates");
  return {
    WhenConvexReady: ({ children }: { children: ReactNode }) => children,
    QuietErrorBoundary: actual.QuietErrorBoundary,
  };
});
vi.mock("next/font/google", async () => (await import("./tenant-site-helpers")).fontMockModule([]));

const { BrandKitPanel } = await import("@/components/workspace/brand/BrandKitPanel");
const { FilesRail } = await import("@/components/workspace/files/FilesRail");

const PROJECT = "project1" as Id<"projects">;
const colour = (name: string, hex: string, use: string) => ({ name, hex, use });

function kit(palette?: Record<string, { name: string; hex: string; use: string }>) {
  return {
    name: "HydroTrail",
    nameAlternatives: [],
    tagline: { text: "Drink better on every trail.", emphasis: "every trail." },
    palette: palette ?? {
      primary: colour("River blue", "#1D4ED8", "Buttons"),
      secondary: colour("Moss", "#4D7C0F", "Shapes"),
      accent: colour("Sunrise", "#F59E0B", "Highlight"),
      ground: colour("Paper", "#FAF7F2", "Background"),
      ink: colour("Charcoal", "#1F2937", "Text"),
    },
    visualSystem: { direction: "warm_utility", shape: "soft", density: "balanced", theme: { mode: "light", reason: "Daylight." } },
    type: { pair: "bricolage_grotesque_figtree", scale: "H1 56/0.98", notes: "Display only." },
    voice: { traits: ["Friendly"], say: "Fill up.", dontSay: "Solution.", dontSayWhy: "Brochure." },
    logo: { markDescription: "A droplet.", alt: "logo" },
    heroArt: { description: "A bottle.", alt: "bottle" },
  };
}
const ready = (status = "pending", palette?: Record<string, { name: string; hex: string; use: string }>) => ({
  state: "ready",
  kit: kit(palette),
  card: { approvalId: "approval1", status, changeRound: 0n, expiresAt: Date.now() + 86_400_000 },
});

afterEach(() => {
  cleanup();
  live.brand = undefined;
});

describe("readableOn", () => {
  test("picks the better of black or white and says whether it passes AA", () => {
    expect(readableOn("#ffffff")).toMatchObject({ text: "black", ok: true });
    expect(readableOn("#000000")).toMatchObject({ text: "white", ok: true });
    for (const hex of ["#1D4ED8", "#FAF7F2", "#1F2937", "#4D7C0F", "#F59E0B"]) {
      const { text, ratio, ok } = readableOn(hex);
      expect(ratio).toBeCloseTo(contrastRatio(text === "black" ? "#000000" : "#ffffff", hex));
      expect(ok).toBe(ratio >= MIN_TEXT_CONTRAST);
    }
  });
  test("every grey, mid-tones included, is served by black or white at AA", () => {
    for (let level = 0; level <= 255; level += 5) {
      const hex = `#${level.toString(16).padStart(2, "0").repeat(3)}`;
      expect(readableOn(hex).ratio).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    }
  });
});

describe("Brand kit page body", () => {
  test("the review comes first, then the brand board, then the Brand Book", () => {
    live.brand = ready();
    render(<BrandKitPanel projectId={PROJECT} />);
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings[0]).toBe("Your review");
    expect(headings.indexOf("Brand board")).toBeGreaterThan(0);
    expect(headings.findIndex((h) => h?.startsWith("The rules your team follows"))).toBeGreaterThan(headings.indexOf("Brand board"));
    expect(screen.getByText(/Read the brand kit details below/)).toBeTruthy();
  });

  test("the board is a 3 x 3 grid of real text with no image, no inline style and no dropped extras", () => {
    live.brand = ready();
    const { container } = render(<BrandKitPanel projectId={PROJECT} />);
    const board = screen.getByRole("region", { name: "Brand board" });
    expect(within(board).getAllByRole("listitem").length).toBe(7);
    expect(screen.getByText("WORDMARK")).toBeTruthy();
    expect(screen.getByText("Hero art · described below")).toBeTruthy();
    expect(container.querySelector("[style]")).toBeNull();
    expect(container.querySelector("img,svg,canvas")).toBeNull();
    expect(screen.queryByText(/Open in Studio/)).toBeNull();
    expect(screen.queryByText(/Upload/)).toBeNull();
    expect(screen.queryByText(/app icon/i)).toBeNull();
  });

  test("tagline emphasis is italic, never an accent-coloured run", () => {
    live.brand = ready();
    const { container } = render(<BrandKitPanel projectId={PROJECT} />);
    const em = Array.from(container.querySelectorAll("section[aria-labelledby='brand-board-h'] em"));
    expect(em.map((node) => node.textContent)).toEqual(["every trail."]);
    expect(em[0].className).toContain("italic");
    expect(container.innerHTML).not.toMatch(/text-\(--t-accent\)|text-\(--t-primary\)/);
  });

  test("palette tile text is black or white by contrast, never on a failing colour without a chip", () => {
    live.brand = ready();
    const { container } = render(<BrandKitPanel projectId={PROJECT} />);
    const rows = Array.from(container.querySelectorAll("[class*='grid-rows-[2fr'] > div"));
    expect(rows.length).toBe(5);
    rows.forEach((row) => expect(/text-(black|white)/.test(row.className)).toBe(true));
  });

  test("an unreadable or invalid colour never prints a hex it did not draw", () => {
    live.brand = ready("pending", {
      primary: colour("Odd", "red", "Buttons"),
      secondary: colour("Moss", "#4D7C0F", "Shapes"),
      accent: colour("Sunrise", "#F59E0B", "Highlight"),
      ground: colour("Paper", "#FAF7F2", "Background"),
      ink: colour("Charcoal", "#1F2937", "Text"),
    });
    const { container } = render(<BrandKitPanel projectId={PROJECT} />);
    const board = container.querySelector("section[aria-labelledby='brand-board-h']") as HTMLElement;
    expect(board.textContent).not.toContain("red");
  });

  test("an approved kit says nothing is published, and nothing else", () => {
    live.brand = ready("approved");
    const { container } = render(<BrandKitPanel projectId={PROJECT} />);
    expect(screen.getByText(/Approved\. Nothing is published yet\./)).toBeTruthy();
    expect(container.textContent).not.toMatch(/Studio now use|site, emails/);
  });

  test("no kit yet shows the empty state and no board", () => {
    live.brand = { state: "none" };
    render(<BrandKitPanel projectId={PROJECT} />);
    expect(screen.queryByRole("region", { name: "Brand board" })).toBeNull();
  });

  test("passes axe", async () => {
    live.brand = ready();
    const { container } = render(<main><BrandKitPanel projectId={PROJECT} /></main>);
    const results = await axe.run(container, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"], rules: { "color-contrast": { enabled: false } } });
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});

describe("Files rail", () => {
  test("lists only real entries", () => {
    render(<FilesRail projectId="project1" name="Wren" />);
    const nav = screen.getByRole("navigation", { name: "Files" });
    const links = within(nav).getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")]);
    expect(links).toEqual([
      ["What Wren knows", "#wren-memory"],
      ["Blueprint", "/dashboard/b/project1/team#blueprint"],
      ["Brand kit", "/dashboard/b/project1/brand"],
      ["Email sequence", "/dashboard/b/project1/email"],
      ["Social posts", "/dashboard/b/project1/social"],
    ]);
    expect(nav.textContent).not.toMatch(/PRODUCT_PROMPTS|OWNER|SOUL|\.md|\.png/);
  });

  test("uses the co-founder's name and passes axe", async () => {
    const { container } = render(<main><FilesRail projectId="project1" name="Iris" /></main>);
    expect(screen.getByText("What Iris knows")).toBeTruthy();
    const results = await axe.run(container, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"], rules: { "color-contrast": { enabled: false } } });
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});

describe("Files reader meta line and copy text", () => {
  const now = Date.UTC(2026, 10, 7, 12, 0);
  test("says who kept it, when, and how many facts", () => {
    const at = now - 3_600_000;
    expect(memoryMetaLine({ name: "Wren", updatedAt: at, facts: 3, factsMax: 20, now, timeZone: "UTC" })).toBe(
      `Kept by Wren · updated ${formatKeptWhen(at, now, "UTC")} · 3 of 20 facts`,
    );
    expect(memoryMetaLine({ name: "Wren", updatedAt: null, facts: 0, factsMax: 20, now })).toBe("Nothing kept yet · 0 of 20 facts");
  });
  test("a week or older reads as a date", () => {
    expect(formatKeptWhen(now - 8 * 86_400_000, now, "UTC")).toBe("Oct 30");
  });
  test("copy text is the summary and the facts as plain text", () => {
    expect(memoryCopyText("Wren", "A hiking app.", ["Launch Sunday.", "Price $9."])).toBe(
      "# What Wren knows\n\nA hiking app.\n\n## Facts\n- Launch Sunday.\n- Price $9.\n",
    );
  });
});
