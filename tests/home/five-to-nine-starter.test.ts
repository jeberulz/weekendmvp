import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("next/image", async () => {
  const React = await import("react");
  return {
    default: ({ fill, ...props }: Record<string, unknown>) =>
      React.createElement("img", { ...props, "data-nimg": fill ? "fill" : "1" }),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/fonts", () => ({
  newsreaderEditorial: { variable: "newsreader-test" },
}));

import manifestJson from "../../ideas/manifest.json";
import { BUILD_ALONG_PRICE } from "../../app/(marketing)/5-to-9-starter/_sections";
import FiveToNineStarterPage, { metadata } from "../../app/(marketing)/5-to-9-starter/page";
import { GUIDE_AUTOMATION_ID, subscribeViaApi } from "../../lib/beehiiv-client";
import { liveIdeas } from "../../lib/home/library";
import type { ManifestIdea } from "../../lib/home/types";

function renderPage() {
  return renderToStaticMarkup(createElement(FiveToNineStarterPage));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("5-to-9 Starter landing page", () => {
  test("has its own canonical route and exact title", () => {
    expect(metadata.alternates?.canonical).toBe("/5-to-9-starter");
    expect(metadata.title).toEqual({
      absolute: "The 5-to-9 Starter: a free 5-day email guide | Weekend MVP",
    });
  });

  test("shows the live idea count in the byline", () => {
    const total = liveIdeas((manifestJson as { ideas: ManifestIdea[] }).ideas).length;
    expect(renderPage()).toMatch(
      new RegExp(`From the maker of Weekend MVP: <span[^>]*>${total}</span> researched startup ideas`),
    );
  });

  test("uses the redesigned copy and the confirmed Day 1 timing", () => {
    const html = renderPage();
    expect(html).toContain("Day 1 arrives in a few minutes.");
    expect(html).toContain("Score your shortlist in 10 minutes. The highest score wins.");
    expect(html).toContain("a waitlist, or one person paying £5.");
    expect(html).toContain(`two hours live with John for ${BUILD_ALONG_PRICE}`);
    expect(html).toContain(`Build-Along sprint (${BUILD_ALONG_PRICE})`);
    expect(html).toContain("Founder, Weekend MVP.");
    expect(html).toContain("You want to quit tomorrow.");
    expect(html).not.toMatch(/Day 1[^<>]*tomorrow|400\+|WeekendMVP/);
  });

  test("uses the Day 1 ink illustration and the existing founder portrait", () => {
    const html = renderPage();
    const illustration = html.match(/<img\b[^>]*src="\/image\/5-to-9\/hero-day1-illustration\.svg"[^>]*>/)?.[0];
    expect(illustration).toContain(
      'alt="Ink line illustration of an open notebook with five handwritten work problems, one circled in orange, and a blank work ID badge beside it."',
    );
    expect(html).not.toContain("data:image/");
    expect(html).toContain('alt="Portrait of John Iseghohi"');
    expect(html.match(/<details\b/g)).toHaveLength(5);
    expect(html.match(/<details open=""/g)).toHaveLength(1);
  });

  test("renders two forms with distinct labelled fields and live feedback", () => {
    const html = renderPage();
    const forms = html.match(/<form\b.*?<\/form>/g) ?? [];
    expect(forms).toHaveLength(2);

    const fieldIds = forms.map((form) => {
      const id = form.match(/<label for="([^"]+)"[^>]*>Email address<\/label>/)?.[1];
      expect(id).toBeDefined();
      const field = form.match(/<input\b[^>]*>/)?.[0];
      expect(field).toContain(`id="${id}"`);
      expect(field).toContain('name="email"');
      expect(field).toContain('autoComplete="email"');
      expect(form).toContain(`id="${id}-status" aria-live="polite"`);
      expect(form).toContain("Send me Day 1");
      return id;
    });
    expect(new Set(fieldIds).size).toBe(2);
  });

  test.each(["hero", "final"])("uses the existing subscribe endpoint for the %s form source", async (placement) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    const source = `5-to-9-${placement}`;

    await expect(subscribeViaApi({
      email: "test@example.com",
      automationIds: [GUIDE_AUTOMATION_ID],
      utmCampaign: "5-to-9-starter",
      utmSource: source,
    })).resolves.toMatchObject({ ok: true });

    expect(fetchMock).toHaveBeenCalledWith("/api/subscribe", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        email: "test@example.com",
        automation_ids: ["aut_ccd70ec4-dff3-4a10-8d26-290cb7fa9bc2"],
        utm_campaign: "5-to-9-starter",
        utm_source: source,
      }),
    }));
  });
});
