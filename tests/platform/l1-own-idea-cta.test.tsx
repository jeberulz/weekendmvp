// @vitest-environment jsdom
/**
 * L1: the homepage side door for a founder who brings their own idea (canvas
 * Main board, "Have your own idea? Start building with it"). It shows only
 * behind the launch-workspace flag, under the hero buttons and in the final
 * call, and links through sign-up to `/start/own`.
 */
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";

import homeSource from "../../app/(marketing)/page.tsx?raw";

vi.mock("../../components/marketing/SignupCta", () => ({
  SignupCta: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <button type="button" className={className}>{children}</button>
  ),
}));
const track = vi.hoisted(() => vi.fn());
vi.mock("../../lib/track", () => ({ trackEvent: track }));

import { FinalCall } from "../../components/home/sections/FinalCall";
import { Hero } from "../../components/home/sections/Hero";
import { OwnIdeaCta } from "../../components/workspace/OwnIdeaCta";
import { safePlatformReturn } from "../../lib/auth-return";
import { OWN_IDEA_CTA_LABEL, OWN_IDEA_PATH, ownIdeaHref } from "../../lib/workspace/build-cta";

afterEach(() => {
  cleanup();
  track.mockClear();
});

const HREF = "/signup?returnTo=%2Fstart%2Fown";
const strip = [{ slug: "example-idea", art: "" }];

function ownLinks(html: string) {
  const root = document.createElement("div");
  root.innerHTML = html;
  return [...root.querySelectorAll(`a[href="${HREF}"]`)].map((a) => a.textContent ?? "");
}

describe("the own-idea href", () => {
  test("goes through sign-up, and sign-up returns to the own-idea wizard", () => {
    expect(ownIdeaHref()).toBe(HREF);
    expect(safePlatformReturn(OWN_IDEA_PATH)).toBe("/start/own");
  });
});

describe("hero", () => {
  test("flag on: one own-idea link under the buttons", () => {
    const html = renderToStaticMarkup(<Hero idea={null} total={225} buildCta />);
    expect(ownLinks(html)).toEqual([OWN_IDEA_CTA_LABEL]);
    expect(html).toContain("Have your own idea?");
  });

  test("flag off: nothing", () => {
    const html = renderToStaticMarkup(<Hero idea={null} total={225} />);
    expect(ownLinks(html)).toEqual([]);
    expect(html).not.toContain("Have your own idea?");
  });
});

describe("final call", () => {
  test("flag on: one own-idea link", () => {
    const html = renderToStaticMarkup(<FinalCall total={225} strip={strip} buildCta />);
    expect(ownLinks(html)).toEqual([OWN_IDEA_CTA_LABEL]);
    expect(html).toContain("Already have an idea?");
  });

  test("flag off: nothing", () => {
    expect(ownLinks(renderToStaticMarkup(<FinalCall total={225} strip={strip} />))).toEqual([]);
  });
});

describe("OwnIdeaCta", () => {
  test("is a link, reports one consent-gated event on click, and has no axe violations", async () => {
    const { container } = render(
      <main>
        <p>
          Have your own idea? <OwnIdeaCta location="home-hero" />
        </p>
      </main>,
    );
    const link = screen.getByRole("link", { name: OWN_IDEA_CTA_LABEL });
    expect(link.getAttribute("href")).toBe(HREF);
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("cta_button_clicked", {
      button_location: "own-idea-cta-home-hero",
      button_text: OWN_IDEA_CTA_LABEL,
    });
    expect((await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
  });

  test("the hero and final call with the flag on pass axe", async () => {
    for (const ui of [<Hero key="h" idea={null} total={225} buildCta />, <FinalCall key="f" total={225} strip={strip} buildCta />]) {
      const dom = render(<main>{ui}</main>);
      expect((await axe(dom.container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } })).violations).toEqual([]);
      dom.unmount();
    }
  });
});

describe("wiring", () => {
  test("the homepage passes the flag to the final call", () => {
    expect(homeSource).toMatch(/<FinalCall [^>]*buildCta=\{buildCta\}/);
  });
});
