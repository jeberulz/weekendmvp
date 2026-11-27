// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import FiveToNineBuilderGuidePage, { metadata } from "@/app/(marketing)/guides/5-to-9-builder/page";
import { formatPrice, resolvePrice } from "@/lib/guides/offer-live";
import { BUILD_ALONG_GUIDE_CARDS_ENABLED } from "@/lib/live/config";
import { guideCopy } from "@/app/(marketing)/guides/5-to-9-builder/guideCopy";
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
function expectGuideCopy(html: string) {
  expect(html).not.toContain("COPY TO WRITE");
  const container = document.createElement("div");
  container.innerHTML = html;
  const guide = activeGuide(container);
  expect(guide.textContent).not.toMatch(/TODO|COPY TO WRITE/i);
  expect(guide.querySelectorAll(".guide-placeholder")).toHaveLength(0);
  expect(guide.querySelector('[data-copy-slot="The Shift · Source for the building-is-free claim"]')).toBeNull();
  expect(guideCopy).not.toHaveProperty("The Shift · Source for the building-is-free claim");
  const receipts = [...guide.querySelectorAll('aside[aria-label="Receipt"]')];
  expect(receipts.some((receipt) => /researched startup ideas in the library/.test(receipt.textContent ?? ""))).toBe(true);
  for (const receipt of receipts) {
    expect(receipt.textContent).not.toMatch(/building is free/i);
    expect(receipt.textContent).not.toMatch(/draft|liveIdeas|re-checked at build/i);
  }
  expect(guide.textContent).not.toContain("£");
  const slots = [...guide.querySelectorAll<HTMLElement>("[data-copy-slot]")];
  expect(slots.map((slot) => slot.dataset.copySlot).sort()).toEqual(Object.keys(guideCopy).sort());
  expect(guide.querySelector('[data-copy-slot="The Shift · Lede"]')?.textContent).toBe(
    "Finding something worth building starts with a problem you can check.",
  );
  expect(guide.querySelector('[data-copy-slot="The Shift · Validation paragraph"]')?.textContent).toBe(
    "Before you spend an evening building, talk to someone who has the problem. Ask how they deal with it now and what it costs them. Then see whether they'll pay for a fix.",
  );
  expect(guide.querySelector('[data-copy-slot="The Shift · Definition"]')?.textContent).toBe(
    "A 5-to-9 builder keeps their job and uses evenings to test an idea for extra income.",
  );
  expect(guide.querySelector('[data-copy-slot="FAQ · Do I need to code?"]')?.textContent).toContain(
    "The method tests whether someone will pay before you build.",
  );
  expect(guide.querySelector('[data-copy-slot="Find it · Worked example"]')?.textContent).toContain("$1,800");
  expect(guide.querySelector('[data-copy-slot="Find it · Worked example"]')?.textContent).toContain(
    "R&R compressor, evac/recharge, orifice tube, dye test",
  );
  expect(guide.querySelector('[data-copy-slot="Find it · Worked example"]')?.textContent).toContain(
    "I've watched advisors explain the same line.",
  );
  expect(guide.textContent).not.toContain("five times a day");
  expect(guide.textContent).not.toContain("almost any idea without a team or a budget");
  expect(guide.textContent).not.toContain("Most people skip that step");
  expect(guide.textContent).not.toContain("The method proves someone will pay");
  expect(guide.querySelector('[data-copy-slot="Gate · Fine print"]')?.textContent).toBe(
    "Free. Unsubscribe anytime. We'll send the 5-day Starter.",
  );
  const follow = guide.querySelector('[data-copy-slot="Sign-off · Follow destination"]');
  expect(follow?.textContent).toMatch(/@weekendmvp/);
  expect(follow?.textContent).toMatch(/Instagram/);
  expect(follow?.querySelector("a")?.getAttribute("href")).toBe("https://www.instagram.com/weekendmvp/");
  expect(guide.textContent).toContain("Follow for one idea a day.");

  for (const slot of ["The Idea Bank · How to use the library", "FAQ · I have no idea yet. Where do I start?"]) {
    expect(guide.querySelector(`[data-copy-slot="${slot}"]`)?.textContent).toContain(`${guideLiveIdeaCount()} researched ideas`);
  }
  expect(guide.textContent).not.toContain("{ideaCount}");
  expect(guide.querySelectorAll('.guide-checklist input[type="checkbox"]')).toHaveLength(18);
  expect(guide.querySelector('[data-copy-slot="The Prompt · Prompt text"] code')?.textContent).toBe(guideCopy["The Prompt · Prompt text"]);
  expect(guide.querySelector('[data-copy-slot="Founder note · Body"]')?.textContent).not.toContain("John Iseghohi");
  const buildAlongPrice = formatPrice(resolvePrice("BUILD_ALONG.standardUsd"));
  expect(buildAlongPrice).toBe(`$${BUILD_ALONG.standardUsd}`);
  expect(buildAlongPrice).toBe("$29");
  expect(guide.textContent).toContain("$29");
  // The Build-Along switch in lib/live/config.ts decides whether the sprint shows anywhere in the guide:
  // both cards, the founder-note sprint line and the link to its page. A switched-off sprint leaves no trace.
  expect(guide.textContent?.includes("Build-Along")).toBe(BUILD_ALONG_GUIDE_CARDS_ENABLED);
  expect(guide.querySelector('a[href="/live/build-along"]') !== null).toBe(BUILD_ALONG_GUIDE_CARDS_ENABLED);
  expect(guide.querySelectorAll('aside[aria-label="Build-Along sprint"]')).toHaveLength(BUILD_ALONG_GUIDE_CARDS_ENABLED ? 2 : 0);
  expect(guide.textContent).not.toContain("$47");
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

function gateStatus() {
  return within(screen.getByRole("region", { name: "Unlock the guide" })).getByRole("status");
}

function submitDefaultForm() {
  const input = screen.getByLabelText("Email address");
  fireEvent.change(input, { target: { value: "starter@example.com" } });
  fireEvent.submit(input.closest("form")!);
}

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
  test("renders the deck with no visible TODO or COPY TO WRITE in server markup", () => {
    expectGuideCopy(renderToStaticMarkup(createElement(FiveToNineBuilderGuidePage)));
  });

  test.runIf(process.env.CHECK_BUILT_GUIDE === "1")("renders the same copy in the production HTML", () => {
    expectGuideCopy(readFileSync(productionGuideHtml, "utf8"));
  });

  test("renders the canonical static route and gated body in server markup", () => {
    const html = renderToStaticMarkup(createElement(FiveToNineBuilderGuidePage));
    const container = document.createElement("div");
    container.innerHTML = html;
    const guide = activeGuide(container);
    const rest = guide.querySelector(".guide-rest");

    expect(metadata.alternates?.canonical).toBe("/guides/5-to-9-builder");
    expect(metadata.title).toEqual({ absolute: expect.stringContaining("5-to-9 Builder") });
    const headline = guide.querySelector("h1");
    expect(headline?.textContent).toBe("AI made building free. Knowing what to build is the job now.");
    expect(headline?.firstChild?.textContent).toBe("AI made building free. ");
    expect(headline?.querySelector("em")?.textContent).toBe("Knowing what to build is the job now.");
    expect(guide.querySelector("#s01")?.closest(".guide-rest")).toBeNull();
    for (let section = 2; section <= 11; section++) {
      expect(rest?.querySelector(`#s${String(section).padStart(2, "0")}`)).toBeTruthy();
    }
    expect(rest?.textContent).toContain("Self-Check");
    expect(guide.hasAttribute("data-guide")).toBe(false);
    expect(guide.querySelectorAll("form")).toHaveLength(1);
    expect(JSON.parse(guide.querySelector('script[type="application/ld+json"]')!.textContent!)["@graph"])
      .toContainEqual(expect.objectContaining({
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
    const { container } = render(createElement(FiveToNineBuilderGuidePage));
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
    const { container } = render(createElement(FiveToNineBuilderGuidePage));
    expect(activeGuide(container).dataset.guide).toBe("returning");
    expect(screen.getByText("You unlocked it on this device.")).toBeTruthy();
    expect(subscribeMock).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(1);
  });

  test("keeps every gate status in the layout and announces only the active message", async () => {
    subscribeMock.mockReturnValue(new Promise(() => {}));
    const style = document.createElement("style");
    style.textContent = guideCss;
    document.head.append(style);
    try {
      render(createElement(FiveToNineBuilderGuidePage));
      const status = gateStatus();
      const sizingMessages = [...status.parentElement!.querySelectorAll(':scope > [aria-hidden="true"]')];
      expect(sizingMessages.map((node) => node.textContent)).toEqual([
        "Opening the guide…",
        "Taking a moment. The guide opens in a few seconds either way.",
        "! That doesn't look like an email address. Check for a typo.",
        "! Enter your email to unlock the guide.",
        "! That email didn't go through. Check it and try again.",
      ]);
      for (const node of sizingMessages) {
        expect(getComputedStyle(node).visibility).toBe("hidden");
        expect(getComputedStyle(node).display).not.toBe("none");
      }
      expect(status.textContent).toBe("");

      const input = screen.getByLabelText("Email");
      fireEvent.submit(input.closest("form")!);
      expect(status.textContent).toBe("! Enter your email to unlock the guide.");
      expect(status.querySelector('[aria-hidden="true"]')?.textContent).toBe("! ");

      submitGuide();
      expect(status.textContent).toBe("Opening the guide…");
      await act(() => vi.advanceTimersByTimeAsync(3000));
      expect(status.textContent).toBe("Taking a moment. The guide opens in a few seconds either way.");
      expect(sizingMessages.every((node) => node.isConnected)).toBe(true);
    } finally {
      style.remove();
    }
  });

  test("confirms an API-first success in place and clears the optimistic timer", async () => {
    const reply = deferredSubscription();
    const { container } = render(createElement(FiveToNineBuilderGuidePage));
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
    const { container } = render(createElement(FiveToNineBuilderGuidePage));
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
    const { container } = render(createElement(FiveToNineBuilderGuidePage));
    submitGuide();
    await reply({ ok: false, status: 422, message: "Invalid address" });
    await act(() => vi.advanceTimersByTimeAsync(8000));

    expect(activeGuide(container).dataset.guide).toBe("locked");
    expect(screen.getByLabelText("Email").getAttribute("aria-invalid")).toBe("true");
    expect(gateStatus().textContent).toBe("! That email didn't go through. Check it and try again.");
    expect(localStorage.getItem("weekendmvp_subscribed")).toBeNull();
    expect(trackEvent).toHaveBeenCalledWith("signup_form_submitted", { method: "api", email_domain: "example.com" });
    expect(trackEvent).toHaveBeenCalledWith("signup_form_error", { error: "address_rejected" });
    expect(trackEvent).not.toHaveBeenCalledWith("signup_form_success", expect.anything());
    expect(trackEvent).not.toHaveBeenCalledWith("guide_unlocked", expect.anything());
    expect(trackEvent).not.toHaveBeenCalledWith("signup_fallback_fired");
  });

  test("late failure fires a quiet embed and one resend can confirm in place", async () => {
    const reply = deferredSubscription();
    const submitEmbed = vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => {});
    const { container } = render(createElement(FiveToNineBuilderGuidePage));
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
    expect(gateStatus().textContent).toBe("");

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
    const { unmount } = render(createElement(FiveToNineBuilderGuidePage));
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
    const { container } = render(createElement(FiveToNineBuilderGuidePage));
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
    expect(gateStatus().textContent).toBe("");
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
      .toContain('entry("/guides/5-to-9-builder", { priority: 0.85, changeFrequency: "monthly" })');
    expect(metadata.robots).toBeUndefined();
    expect(readFileSync("app/api/subscribe/route.ts", "utf8"))
      .toMatch(/ALLOWED_UTM_CAMPAIGNS = new Set\(\[[^\]]*"5-to-9-builder"/);
  });
});

test("the shared form waits for the API by default and keeps its legacy redirect", async () => {
  const reply = deferredSubscription();
  const onSuccess = vi.fn();
  render(createElement(BeehiivSubscribeForm, { onSuccess }));
  submitDefaultForm();
  expect(vi.getTimerCount()).toBe(0);

  await act(() => vi.advanceTimersByTimeAsync(9000));
  expect(screen.getByText("Sending...")).toBeTruthy();
  expect(localStorage.getItem("weekendmvp_subscribed")).toBeNull();
  expect(push).not.toHaveBeenCalled();
  expect(trackEvent).not.toHaveBeenCalled();

  await reply({ ok: true, message: "Subscribed" });
  expect(vi.mocked(trackEvent).mock.calls).toEqual([
    ["signup_form_submitted", { method: "api", email_domain: "example.com" }],
    ["signup_form_success", { method: "api" }],
  ]);
  expect(onSuccess).toHaveBeenCalledExactlyOnceWith();
  expect(push).toHaveBeenCalledExactlyOnceWith("/starter-kit?subscribed=true");
  expect(localStorage.getItem("weekendmvp_subscribed")).toBe("true");
});

test("the default form completes via the embed after one second without tracking a conversion", async () => {
  const reply = deferredSubscription();
  const onSuccess = vi.fn();
  const submitEmbed = vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => {});
  render(createElement(BeehiivSubscribeForm, { onSuccess }));
  submitDefaultForm();
  await reply({ ok: false, status: 502, message: "Unavailable" });

  expect(submitEmbed).toHaveBeenCalledOnce();
  const embed = submitEmbed.mock.contexts[0] as HTMLFormElement;
  expect(embed.target).toBe("beehiiv-hidden-frame");
  expect(document.getElementById(embed.target)?.tagName).toBe("IFRAME");
  await act(() => vi.advanceTimersByTimeAsync(999));
  expect(localStorage.getItem("weekendmvp_subscribed")).toBeNull();
  expect(onSuccess).not.toHaveBeenCalled();
  expect(push).not.toHaveBeenCalled();
  expect(trackEvent).not.toHaveBeenCalled();

  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(localStorage.getItem("weekendmvp_subscribed")).toBe("true");
  expect(onSuccess).toHaveBeenCalledExactlyOnceWith();
  expect(push).toHaveBeenCalledExactlyOnceWith("/starter-kit?subscribed=true");
  expect(trackEvent).toHaveBeenCalledExactlyOnceWith("signup_form_submitted", {
    method: "embed_fallback",
    email_domain: "example.com",
  });
});

test("the default form shows an error if the API fails and embed submission throws", async () => {
  const reply = deferredSubscription();
  const onSuccess = vi.fn();
  const submitEmbed = vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => {
    throw new Error("Embed submission failed");
  });
  render(createElement(BeehiivSubscribeForm, { onSuccess }));
  submitDefaultForm();
  await reply({ ok: false, status: 502, message: "Unavailable" });
  await act(() => vi.advanceTimersByTimeAsync(1000));

  expect(submitEmbed).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: "Error. Try again?" })).toBeTruthy();
  expect(localStorage.getItem("weekendmvp_subscribed")).toBeNull();
  expect(onSuccess).not.toHaveBeenCalled();
  expect(push).not.toHaveBeenCalled();
  expect(trackEvent).toHaveBeenCalledExactlyOnceWith("signup_form_error", { error: "both_methods_failed" });
});
