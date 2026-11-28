// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import FiveToNineBuilderGuidePage, { generateMetadata } from "@/app/(marketing)/guides/5-to-9-builder/page";
import { formatPrice, resolvePrice } from "@/lib/guides/offer-live";
import { BUILD_ALONG_GUIDE_CARDS_ENABLED } from "@/lib/live/config";
import { readBuilderGuide, type BuilderGuide } from "@/lib/landing/read-builder-guide";
import { guideLiveIdeaCount } from "@/app/(marketing)/guides/5-to-9-builder/ideaCount";
import { BUILD_ALONG } from "@/lib/live/config";
import { BeehiivSubscribeForm } from "@/components/forms/BeehiivSubscribeForm";
import manifest from "@/ideas/manifest.json";
import { GUIDE_AUTOMATION_ID, subscribeViaApi, type SubscribeResult } from "@/lib/beehiiv-client";
import { mergeHomeIdeas } from "@/lib/home/data";
import { liveIdeas } from "@/lib/home/library";
import type { ManifestIdea } from "@/lib/home/types";
import { trackEvent } from "@/lib/track";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/fonts", () => ({ newsreaderEditorial: { variable: "test-newsreader" } }));
vi.mock("@/lib/track", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/beehiiv-client", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/beehiiv-client")>(),
  subscribeViaApi: vi.fn(),
}));
vi.mock("next/image", async () => {
  const { createElement } = await import("react");
  return {
    default: (props: Record<string, unknown>) => {
      const imgProps = { ...props };
      delete imgProps.unoptimized;
      return createElement("img", imgProps);
    },
  };
});

const guideCss = readFileSync("app/(marketing)/guides/_shared/guide.css", "utf8");
const subscribeMock = vi.mocked(subscribeViaApi);
const productionGuideHtml = ".next/server/app/guides/5-to-9-builder.html";
function expectGuideCopy(html: string, { deck }: BuilderGuide) {
  const container = document.createElement("div");
  container.innerHTML = html;
  const guide = activeGuide(container);
  expect(guide.textContent).not.toMatch(/TODO|COPY TO WRITE/i);
  expect(guide.querySelectorAll(".guide-placeholder")).toHaveLength(0);
  expect(guide.querySelector('[data-copy-slot="The Shift · Source for the building-is-free claim"]')).toBeNull();

  const receipts = [...guide.querySelectorAll('aside[aria-label="Receipt"]')];
  expect(receipts.some((receipt) => /researched startup ideas in the library/.test(receipt.textContent ?? ""))).toBe(true);
  for (const receipt of receipts) {
    expect(receipt.textContent).not.toMatch(/building is free|draft|liveIdeas|re-checked at build/i);
  }

  const slots = new Map([...guide.querySelectorAll<HTMLElement>("[data-copy-slot]")]
    .map((node) => [node.dataset.copySlot, node]));
  expect([...slots.keys()].sort()).toEqual(Object.keys(deck).sort());
  for (const [slot, value] of Object.entries(deck)) {
    if (value.includes("{ideaCount}")) expect(slots.get(slot)?.textContent).toContain(String(guideLiveIdeaCount()));
  }
  expect(guide.textContent).not.toContain("{ideaCount}");
  expect(slots.get("The Prompt · Prompt text")?.querySelector("code")?.textContent).toBe(deck["The Prompt · Prompt text"]);
  expect(slots.get("Sign-off · Follow destination")?.querySelector("a")?.getAttribute("href"))
    .toBe("https://www.instagram.com/weekendmvp/");
  expect(guide.textContent).toContain("Follow for one idea a day.");
  expect(guide.querySelectorAll('.guide-checklist input[type="checkbox"]')).toHaveLength(18);
  expect(formatPrice(resolvePrice("BUILD_ALONG.standardUsd"))).toBe(`$${BUILD_ALONG.standardUsd}`);
  expect(guide.querySelector('a[href="/live/build-along"]') !== null).toBe(BUILD_ALONG_GUIDE_CARDS_ENABLED);
  expect(guide.querySelectorAll('aside[aria-label="Build-Along sprint"]')).toHaveLength(BUILD_ALONG_GUIDE_CARDS_ENABLED ? 2 : 0);
}

function deferredSubscription() {
  let resolve!: (result: SubscribeResult) => void;
  subscribeMock.mockReturnValueOnce(new Promise((finish) => { resolve = finish; }));
  return (result: SubscribeResult) => act(async () => resolve(result));
}

function submitGuide() {
  const input = screen.getByLabelText("Email");
  fireEvent.change(input, { target: { value: "builder@example.com" } });
  if (!input.closest("form")) throw new Error("Guide email input must be inside its form");
  fireEvent.submit(input.closest("form")!);
}

function activeGuide(container: HTMLElement) {
  return container.querySelector<HTMLElement>(".builder-guide")!;
}

let guidePage: Awaited<ReturnType<typeof FiveToNineBuilderGuidePage>>;
let metadata: Awaited<ReturnType<typeof generateMetadata>>;
let liveGuide: BuilderGuide;

beforeAll(async () => {
  [guidePage, metadata, liveGuide] = await Promise.all([FiveToNineBuilderGuidePage(), generateMetadata(), readBuilderGuide()]);
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  subscribeMock.mockReset();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  document.getElementById("beehiiv-hidden-frame")?.remove();
  document.querySelector('form[target="beehiiv-hidden-frame"]')?.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("5-to-9 Builder guide", () => {
  test("uses the current editor metadata with the site social settings", () => {
    expect(metadata.title).toEqual({ absolute: liveGuide.spec.metaTitle });
    expect(metadata.description).toBe(liveGuide.spec.description);
    expect(metadata.openGraph?.title).toBe(liveGuide.spec.metaTitle);
    expect(metadata.openGraph?.description).toBe(liveGuide.spec.description);
    expect(metadata.openGraph?.siteName).toBe("Weekend MVP");
    expect(metadata.twitter?.site).toBe("@weekendmvp");
  });

  test("renders the deck with no visible TODO or COPY TO WRITE in server markup", () => {
    expectGuideCopy(renderToStaticMarkup(guidePage), liveGuide);
  });

  test.runIf(process.env.CHECK_BUILT_GUIDE === "1")("renders the same copy in the production HTML", () => {
    expectGuideCopy(readFileSync(productionGuideHtml, "utf8"), liveGuide);
  });

  test("renders the canonical static route and gated body in server markup", () => {
    const html = renderToStaticMarkup(guidePage);
    const container = document.createElement("div");
    container.innerHTML = html;
    const guide = activeGuide(container);
    const rest = guide.querySelector(".guide-rest");

    expect(metadata.alternates?.canonical).toBe("/guides/5-to-9-builder");
    expect(guide.querySelector("h1")?.textContent).toBe("AI made building free. Knowing what to build is the job now.");
    expect(guide.querySelector('img[alt="John Iseghohi, founder of Weekend MVP, working at his desk"]')).toBeTruthy();
    expect(guide.querySelectorAll('.guide-day-one a[href="/5-to-9-starter"]')).toHaveLength(3);
    expect(guide.querySelector("#s01")?.closest(".guide-rest")).toBeNull();
    for (let section = 2; section <= 11; section++) {
      expect(rest?.querySelector(`#s${String(section).padStart(2, "0")}`)).toBeTruthy();
    }
    expect(guide.hasAttribute("data-guide")).toBe(false);
    expect(guide.querySelectorAll("form")).toHaveLength(1);
    expect(JSON.parse(guide.querySelector('script[type="application/ld+json"]')!.textContent!)["@graph"])
      .toContainEqual(expect.objectContaining({
        "@type": "Article",
        datePublished: "2026-11-26T07:53:49Z",
        dateModified: "2026-11-27",
        isAccessibleForFree: false,
        hasPart: expect.objectContaining({ cssSelector: ".guide-rest", isAccessibleForFree: false }),
      }));

    const style = document.createElement("style");
    style.textContent = guideCss;
    document.head.append(style);
    document.body.append(container);
    try {
      expect(getComputedStyle(rest!).display).not.toBe("none");
      const script = guide.querySelector("script")!;
      expect(script.id).toBe("builder-guide-bootstrap");
      const runBootstrap = () => {
        const runner = document.createElement("script");
        runner.textContent = script.textContent;
        script.parentElement!.append(runner);
        runner.remove();
      };
      runBootstrap();
      expect(guide.dataset.guide).toBe("locked");
      expect(getComputedStyle(rest!).display).toBe("none");

      localStorage.setItem("weekendmvp_subscribed", "true");
      runBootstrap();
      expect(guide.dataset.guide).toBe("returning");
      expect(getComputedStyle(rest!).display).not.toBe("none");
    } finally {
      style.remove();
      container.remove();
    }
  });

  test("opens in place at eight seconds even when the subscribe request never resolves", async () => {
    subscribeMock.mockReturnValue(new Promise(() => {}));
    const { container } = render(guidePage);
    const guide = activeGuide(container);

    expect(guide.dataset.guide).toBe("locked");
    expect(guide.querySelectorAll("form")).toHaveLength(1);
    submitGuide();
    expect(subscribeMock).toHaveBeenCalledWith({
      email: "builder@example.com",
      firstName: undefined,
      automationIds: [GUIDE_AUTOMATION_ID],
      utmCampaign: "5-to-9-builder",
    });

    await act(() => vi.advanceTimersByTimeAsync(7999));
    expect(guide.dataset.guide).toBe("locked");
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(guide.dataset.guide).toBe("pending");
    expect(localStorage.getItem("weekendmvp_subscribed")).toBe("true");
    expect(document.activeElement?.textContent).toBe("The guide's open below.");
    expect(push).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith("signup_form_submitted", { method: "timer", email_domain: "example.com" });
    expect(trackEvent).not.toHaveBeenCalledWith("signup_form_success", expect.anything());
    expect(trackEvent).toHaveBeenCalledWith("guide_unlocked", { via: "timer" });
    expect(trackEvent).toHaveBeenCalledTimes(2);
  });

  test("recognizes a returning reader without a request or address in storage", () => {
    localStorage.setItem("weekendmvp_subscribed", "true");
    const { container } = render(guidePage);
    expect(activeGuide(container).dataset.guide).toBe("returning");
    expect(screen.getByText("You unlocked it on this device.")).toBeTruthy();
    expect(subscribeMock).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(1);
  });

  test("confirms an API-first success in place and clears the optimistic timer", async () => {
    const reply = deferredSubscription();
    const { container } = render(guidePage);
    submitGuide();
    await reply({ ok: true, message: "Subscribed" });

    expect(activeGuide(container).dataset.guide).toBe("confirmed");
    expect(localStorage.getItem("weekendmvp_subscribed")).toBe("true");
    await act(() => vi.advanceTimersByTimeAsync(8000));
    expect(trackEvent).toHaveBeenCalledWith("signup_form_submitted", { method: "api", email_domain: "example.com" });
    expect(trackEvent).toHaveBeenCalledWith("signup_form_success", { method: "api" });
    expect(trackEvent).toHaveBeenCalledWith("guide_unlocked", { via: "api" });
    expect(trackEvent).toHaveBeenCalledTimes(3);
    expect(push).not.toHaveBeenCalled();
  });

  test("records API confirmation once after the timer opens the guide", async () => {
    const reply = deferredSubscription();
    const { container } = render(guidePage);
    submitGuide();
    await act(() => vi.advanceTimersByTimeAsync(8000));

    expect(activeGuide(container).dataset.guide).toBe("pending");
    expect(trackEvent).not.toHaveBeenCalledWith("signup_form_success", expect.anything());
    await reply({ ok: true, message: "Subscribed" });

    expect(activeGuide(container).dataset.guide).toBe("confirmed");
    expect(vi.mocked(trackEvent).mock.calls).toEqual([
      ["signup_form_submitted", { method: "timer", email_domain: "example.com" }],
      ["guide_unlocked", { via: "timer" }],
      ["signup_form_success", { method: "api" }],
    ]);
  });

  test("keeps a rejected address locked even after eight seconds", async () => {
    const reply = deferredSubscription();
    const { container } = render(guidePage);
    submitGuide();
    await reply({ ok: false, status: 422, message: "Invalid address" });
    await act(() => vi.advanceTimersByTimeAsync(8000));

    expect(activeGuide(container).dataset.guide).toBe("locked");
    expect(screen.getByLabelText("Email").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("That email didn't go through. Check it and try again.")).toBeTruthy();
    expect(localStorage.getItem("weekendmvp_subscribed")).toBeNull();
    expect(trackEvent).toHaveBeenCalledWith("signup_form_submitted", { method: "api", email_domain: "example.com" });
    expect(trackEvent).toHaveBeenCalledWith("signup_form_error", { error: "address_rejected" });
    expect(trackEvent).not.toHaveBeenCalledWith("guide_unlocked", expect.anything());
    expect(trackEvent).not.toHaveBeenCalledWith("signup_fallback_fired");
  });

  test("late failure fires a quiet embed and one resend can confirm in place", async () => {
    const reply = deferredSubscription();
    const submitEmbed = vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => {});
    const { container } = render(guidePage);
    submitGuide();
    await act(() => vi.advanceTimersByTimeAsync(8000));
    await reply({ ok: false, status: 502, message: "Unavailable" });

    expect(activeGuide(container).dataset.guide).toBe("pending");
    expect(submitEmbed).toHaveBeenCalledOnce();
    expect(trackEvent).toHaveBeenCalledWith("signup_form_submitted", { method: "timer", email_domain: "example.com" });
    expect(trackEvent).not.toHaveBeenCalledWith("signup_form_success", expect.anything());
    expect(trackEvent).toHaveBeenCalledWith("guide_unlocked", { via: "timer" });
    expect(trackEvent).toHaveBeenCalledWith("api_failed_after_optimistic_success");
    expect(trackEvent).toHaveBeenCalledWith("signup_fallback_fired");
    expect(trackEvent).toHaveBeenCalledTimes(4);
    expect(trackEvent).not.toHaveBeenCalledWith("signup_form_error", expect.anything());
    expect(trackEvent).not.toHaveBeenCalledWith(expect.stringMatching(/double_failure|both_methods_failed/));
    expect(screen.queryByText("That email didn't go through. Check it and try again.")).toBeNull();

    const resendReply = deferredSubscription();
    const resend = screen.getByText("Resend", { exact: true });
    fireEvent.click(resend);
    fireEvent.click(resend);
    expect(subscribeMock).toHaveBeenCalledTimes(2);
    expect(subscribeMock).toHaveBeenLastCalledWith({
      email: "builder@example.com",
      automationIds: [GUIDE_AUTOMATION_ID],
      utmCampaign: "5-to-9-builder",
    });
    await resendReply({ ok: true, message: "Subscribed" });
    expect(activeGuide(container).dataset.guide).toBe("confirmed");
    expect(screen.getByText("Resend requested.")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  test("cancels a pending unlock on unmount", async () => {
    const reply = deferredSubscription();
    const { unmount } = render(guidePage);
    submitGuide();
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(8000));
    await reply({ ok: true, message: "Subscribed" });
    expect(localStorage.getItem("weekendmvp_subscribed")).toBeNull();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  test("an early 5xx fallback unlocks quietly and fires signup_fallback_fired", async () => {
    const reply = deferredSubscription();
    const submitEmbed = vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => {});
    const { container } = render(guidePage);
    submitGuide();
    await reply({ ok: false, status: 502, message: "Unavailable" });

    expect(activeGuide(container).dataset.guide).toBe("pending");
    expect(submitEmbed).toHaveBeenCalledOnce();
    expect(trackEvent).toHaveBeenCalledWith("signup_form_submitted", { method: "embed_fallback", email_domain: "example.com" });
    expect(trackEvent).not.toHaveBeenCalledWith("signup_form_success", expect.anything());
    expect(trackEvent).toHaveBeenCalledWith("guide_unlocked", { via: "fallback" });
    expect(trackEvent).toHaveBeenCalledWith("signup_fallback_fired");
    expect(trackEvent).not.toHaveBeenCalledWith("api_failed_after_optimistic_success");
    expect(trackEvent).not.toHaveBeenCalledWith("signup_form_error", expect.anything());
    expect(screen.queryByText("That email didn't go through. Check it and try again.")).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  test("guide idea count matches the homepage count", () => {
    const ideas = (manifest as { ideas: ManifestIdea[] }).ideas;
    // Homepage membership in getHomeData: liveIdeas(mergeHomeIdeas(manifest, publications)).
    const homepageCount = liveIdeas(mergeHomeIdeas(ideas, [])).length;
    expect(guideLiveIdeaCount()).toBe(homepageCount);

    const liveSlug = ideas.find((idea) => !idea._retiredAt)!.slug;
    const withdrawn = [{ slug: liveSlug, state: "removed" }] as Parameters<typeof mergeHomeIdeas>[1];
    const homepageAfterWithdraw = liveIdeas(mergeHomeIdeas(ideas, withdrawn)).length;
    expect(guideLiveIdeaCount(withdrawn)).toBe(homepageAfterWithdraw);
    expect(homepageAfterWithdraw).toBe(homepageCount - 1);
  });

  test("lists the guide in the sitemap and is indexable, and allows its campaign", () => {
    expect(readFileSync("app/sitemap.ts", "utf8"))
      .toMatch(/entry\("\/guides\/5-to-9-builder", \{[^}]*lastModified: new Date\(BUILDER_DATE_MODIFIED\)/);
    expect(metadata.robots).toBeUndefined();
    expect(readFileSync("app/api/subscribe/route.ts", "utf8"))
      .toMatch(/ALLOWED_UTM_CAMPAIGNS = new Set\(\[[^\]]*"5-to-9-builder"/);
  });
});

test("the shared form waits for the API by default and keeps its legacy redirect", async () => {
  const reply = deferredSubscription();
  const onSuccess = vi.fn();
  render(createElement(BeehiivSubscribeForm, { onSuccess }));
  const input = screen.getByLabelText("Email address");
  fireEvent.change(input, { target: { value: "starter@example.com" } });
  fireEvent.submit(input.closest("form")!);
  expect(vi.getTimerCount()).toBe(0);

  await act(() => vi.advanceTimersByTimeAsync(9000));
  expect(screen.getByText("Sending...")).toBeTruthy();
  expect(localStorage.getItem("weekendmvp_subscribed")).toBeNull();
  expect(push).not.toHaveBeenCalled();

  await reply({ ok: true, message: "Subscribed" });
  expect(onSuccess).toHaveBeenCalledExactlyOnceWith();
  expect(push).toHaveBeenCalledExactlyOnceWith("/starter-kit?subscribed=true");
  expect(localStorage.getItem("weekendmvp_subscribed")).toBe("true");
});
