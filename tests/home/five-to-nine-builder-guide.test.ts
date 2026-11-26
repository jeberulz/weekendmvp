// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import FiveToNineBuilderGuidePage, { metadata } from "@/app/(marketing)/guides/5-to-9-builder/page";
import { guideLiveIdeaCount } from "@/app/(marketing)/guides/5-to-9-builder/ideaCount";
import { BeehiivSubscribeForm } from "@/components/forms/BeehiivSubscribeForm";
import manifest from "@/ideas/manifest.json";
import { GUIDE_AUTOMATION_ID, subscribeViaApi, type SubscribeResult } from "@/lib/beehiiv-client";
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

const guidePath = "app/(marketing)/guides/5-to-9-builder";
const guideCss = readFileSync(`${guidePath}/guide.css`, "utf8");
const subscribeMock = vi.mocked(subscribeViaApi);

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
  test("renders the canonical static route and gated body in server markup", () => {
    const html = renderToStaticMarkup(createElement(FiveToNineBuilderGuidePage));
    const container = document.createElement("div");
    container.innerHTML = html;
    const guide = activeGuide(container);
    const rest = guide.querySelector(".guide-rest");

    expect(metadata.alternates?.canonical).toBe("/guides/5-to-9-builder");
    expect(metadata.title).toEqual({ absolute: expect.stringContaining("5-to-9 Builder") });
    expect(guide.querySelector("h1")?.textContent).toBe("AI made building free. Knowing what to build is the job now.");
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
      const runBootstrap = () => new Function("document", "localStorage", script.textContent!)({ currentScript: script }, localStorage);
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
    expect(trackEvent).toHaveBeenCalledExactlyOnceWith("guide_unlocked", { via: "timer" });
  });

  test("recognizes a returning reader without a request or address in storage", () => {
    localStorage.setItem("weekendmvp_subscribed", "true");
    const { container } = render(createElement(FiveToNineBuilderGuidePage));
    expect(activeGuide(container).dataset.guide).toBe("returning");
    expect(screen.getByText("You unlocked it on this device.")).toBeTruthy();
    expect(subscribeMock).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(1);
  });

  test("confirms an API-first success in place and clears the optimistic timer", async () => {
    const reply = deferredSubscription();
    const { container } = render(createElement(FiveToNineBuilderGuidePage));
    submitGuide();
    await reply({ ok: true, message: "Subscribed" });

    expect(activeGuide(container).dataset.guide).toBe("confirmed");
    expect(localStorage.getItem("weekendmvp_subscribed")).toBe("true");
    await act(() => vi.advanceTimersByTimeAsync(8000));
    expect(trackEvent).toHaveBeenCalledExactlyOnceWith("guide_unlocked", { via: "api" });
    expect(push).not.toHaveBeenCalled();
  });

  test("keeps a rejected address locked even after eight seconds", async () => {
    const reply = deferredSubscription();
    const { container } = render(createElement(FiveToNineBuilderGuidePage));
    submitGuide();
    await reply({ ok: false, status: 422, message: "Invalid address" });
    await act(() => vi.advanceTimersByTimeAsync(8000));

    expect(activeGuide(container).dataset.guide).toBe("locked");
    expect(screen.getByLabelText("Email").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("That email didn't go through. Check it and try again.")).toBeTruthy();
    expect(localStorage.getItem("weekendmvp_subscribed")).toBeNull();
    expect(trackEvent).not.toHaveBeenCalled();
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
    expect(trackEvent).toHaveBeenNthCalledWith(2, "api_failed_after_optimistic_success");
    expect(trackEvent).toHaveBeenNthCalledWith(3, "signup_fallback_fired");
    expect(trackEvent).toHaveBeenCalledTimes(3);
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
    const { unmount } = render(createElement(FiveToNineBuilderGuidePage));
    submitGuide();
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(8000));
    await reply({ ok: true, message: "Subscribed" });
    expect(localStorage.getItem("weekendmvp_subscribed")).toBeNull();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  test("uses the homepage liveIdeas count", () => {
    expect(guideLiveIdeaCount()).toBe(liveIdeas(manifest.ideas as ManifestIdea[]).length);
  });

  test("lists the guide in the sitemap and allows its campaign", () => {
    expect(readFileSync("app/sitemap.ts", "utf8"))
      .toContain('entry("/guides/5-to-9-builder", { priority: 0.85, changeFrequency: "monthly" })');
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
