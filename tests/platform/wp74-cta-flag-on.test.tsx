// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";

const authActions = vi.hoisted(() => ({
  signIn: (async () => ({ signingIn: false })) as (...args: unknown[]) => Promise<unknown>,
}));
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: (...args: unknown[]) => authActions.signIn(...args), signOut: async () => undefined }),
}));
vi.mock("../../components/marketing/SignupCta", () => ({
  SignupCta: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <button type="button" className={className}>{children}</button>
  ),
}));
const track = vi.hoisted(() => vi.fn());
vi.mock("../../lib/track", () => ({ trackEvent: track }));

import { AuthCard } from "../../components/auth/AuthCard";
import { EmailGate } from "../../components/ideas/EmailGate";
import { Hero } from "../../components/home/sections/Hero";
import { IdeaOfTheWeek } from "../../components/home/sections/IdeaOfTheWeek";
import { BuildIdeaCta } from "../../components/workspace/BuildIdeaCta";
import type { HeroIdea, SpotlightIdea } from "../../lib/home/types";
import { BUILD_CTA_LABEL, buildHref, ownIdeaHref } from "../../lib/workspace/build-cta";

afterEach(() => {
  cleanup();
  track.mockClear();
});

const hero: HeroIdea = {
  slug: "example-idea",
  title: "Example Idea",
  libraryNo: 7,
  category: "saas",
  categoryName: "SaaS",
  buildTime: 12,
  promptTitles: ["Project Setup", "Core Feature", "Landing Page"],
  firstPrompt: Array.from({ length: 9 }, (_, i) => `prompt line ${i + 1}`),
};

const spotlight: SpotlightIdea = {
  slug: "example-idea",
  title: "Example Idea",
  shortTitle: "Example",
  description: "A short description of the example idea for the weekend.",
  category: "saas",
  categoryName: "SaaS",
  buildTime: 12,
  revenueGoal: "side-income",
  how: ["Pick the idea", "Paste the prompt", "Ship it"],
  scores: { opportunity: 8, pain: 7, timing: 9, builder_confidence: 8 },
  sources: 14,
  art: "",
  prompts: [],
  tools: ["cursor"],
};

const draftHero: HeroIdea = { ...hero, slug: "engine-draft-secret" };
const draftSpotlight: SpotlightIdea = { ...spotlight, slug: "engine-draft-secret" };

function links(html: string) {
  const root = document.createElement("div");
  root.innerHTML = html;
  return [...root.querySelectorAll("a")].map((a) => ({ href: a.getAttribute("href"), text: a.textContent ?? "" }));
}

/** Every link into the wizard (through sign-up), whatever slug it carries. */
function wizardLinks(html: string) {
  return links(html)
    .map((l) => l.href)
    .filter((href): href is string => href !== null && href.startsWith("/signup?returnTo=%2Fstart%2F"));
}

describe("flag on: hero", () => {
  const html = renderToStaticMarkup(<Hero idea={hero} total={225} buildCta />);

  test("has a real link to the wizard, and keeps the research link", () => {
    const all = links(html);
    const build = all.filter((l) => l.href === buildHref("example-idea"));
    expect(build).toHaveLength(1);
    expect(build[0].text).toContain(BUILD_CTA_LABEL);
    expect(all.some((l) => l.href === "/ideas/example-idea")).toBe(true);
  });

  test("the link is an anchor, so it is in the tab order, and names the idea", () => {
    expect(html).toMatch(/<a [^>]*href="\/signup\?returnTo=%2Fstart%2Fexample-idea"/);
    expect(html).toContain(`${BUILD_CTA_LABEL}<span class="sr-only"> for Example Idea</span>`);
    expect(html).not.toMatch(/<a [^>]*tabindex="-1"[^>]*href="\/signup\?returnTo=%2Fstart/);
  });

  test("an engine draft gets no CTA even with the flag on", () => {
    expect(wizardLinks(renderToStaticMarkup(<Hero idea={draftHero} total={225} buildCta />))).toEqual([ownIdeaHref()]);
  });

  test("flag off, or no hero idea: no wizard link", () => {
    expect(renderToStaticMarkup(<Hero idea={hero} total={225} />)).not.toContain("returnTo=%2Fstart%2F");
    // With no hero idea there is no idea link; only the own-idea side door (L1) remains.
    expect(wizardLinks(renderToStaticMarkup(<Hero idea={null} total={225} buildCta />))).toEqual([ownIdeaHref()]);
  });
});

describe("flag on: idea of the week", () => {
  test("links to the wizard and still offers the research", () => {
    const html = renderToStaticMarkup(<IdeaOfTheWeek idea={spotlight} weekLabel="Nov 2" total={225} buildCta />);
    const all = links(html);
    expect(all.filter((l) => l.href === buildHref("example-idea"))).toHaveLength(1);
    expect(all.find((l) => l.href === buildHref("example-idea"))?.text).toContain(BUILD_CTA_LABEL);
    expect(all.some((l) => l.href === "/ideas/example-idea" && l.text.includes("Read the research"))).toBe(true);
  });

  test("an engine draft gets none, and off gets none", () => {
    expect(renderToStaticMarkup(<IdeaOfTheWeek idea={draftSpotlight} weekLabel="Nov 2" total={225} buildCta />)).not.toContain("returnTo=%2Fstart%2F");
    expect(renderToStaticMarkup(<IdeaOfTheWeek idea={spotlight} weekLabel="Nov 2" total={225} />)).not.toContain("returnTo=%2Fstart%2F");
  });
});

describe("flag on: the idea page account card", () => {
  test("the gate sends the visitor to the wizard after sign-in; the heading is unchanged", () => {
    const tree = EmailGate({ slug: "example-idea", intro: <p>intro</p>, children: <p>body</p>, buildFirst: true });
    const json = JSON.stringify(tree, (_k, v: unknown) => (typeof v === "function" ? undefined : v));
    expect(json).toContain('"returnTo":"/start/example-idea"');
    expect(json).toContain('"buildFirst":true');
    expect(json).toContain('"signInReturnTo":"/ideas/example-idea"');
  });

  test("Create goes to the wizard, Sign in keeps the idea page", async () => {
    const signIn = vi.fn(async () => ({ signingIn: false }));
    authActions.signIn = signIn;
    render(<AuthCard mode="signup" returnTo="/start/example-idea" signInReturnTo="/ideas/example-idea" embedded gate buildFirst />);
    const email = screen.getByLabelText("Email address");
    fireEvent.change(email, { target: { value: "a@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Create free account and build" }));
    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1));
    expect(signIn).toHaveBeenLastCalledWith("email", { email: "a@example.test", redirectTo: "/start/example-idea" });
    cleanup();
    signIn.mockClear();

    render(<AuthCard mode="signup" returnTo="/start/example-idea" signInReturnTo="/ideas/example-idea" embedded gate buildFirst />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.queryByText(/straight to building this idea/i)).toBeNull();
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "b@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Email me a sign-in link" }));
    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1));
    expect(signIn).toHaveBeenLastCalledWith("email", { email: "b@example.test", redirectTo: "/ideas/example-idea" });
    cleanup();
    signIn.mockClear();

    render(<AuthCard mode="signup" returnTo="/start/example-idea" signInReturnTo="/ideas/example-idea" embedded gate buildFirst />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    fireEvent.click(screen.getByRole("button", { name: /Continue with Google/ }));
    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1));
    expect(signIn).toHaveBeenLastCalledWith("google", { redirectTo: "/auth/callback?returnTo=%2Fideas%2Fexample-idea" });
  });

  test("the card keeps its heading and adds the build-first note", () => {
    render(<AuthCard mode="signup" returnTo="/start/example-idea" embedded gate buildFirst />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Read the full research, free");
    expect(screen.getByText(/straight to building this idea/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create free account and build" })).toBeTruthy();
  });

  test("the card is unchanged without it", () => {
    render(<AuthCard mode="signup" returnTo="/ideas/example-idea" embedded gate />);
    expect(screen.queryByText(/straight to building this idea/i)).toBeNull();
    expect(screen.getByRole("button", { name: "Create free account" })).toBeTruthy();
  });
});

describe("BuildIdeaCta", () => {
  test("is a link, reports one consent-gated event on click, and has no axe violations", async () => {
    const { container } = render(
      <main>
        <BuildIdeaCta slug="example-idea" title="Example Idea" location="home-hero" />
      </main>,
    );
    const link = screen.getByRole("link", { name: `${BUILD_CTA_LABEL} for Example Idea` });
    expect(link.getAttribute("href")).toBe("/signup?returnTo=%2Fstart%2Fexample-idea");
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("cta_button_clicked", {
      button_location: "build-cta-home-hero",
      button_text: BUILD_CTA_LABEL,
      idea_slug: "example-idea",
    });
    expect((await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
  });

  test("the hero, idea of the week and gate card with the flag on pass axe", async () => {
    const heroDom = render(
      <main>
        <Hero idea={hero} total={225} buildCta />
      </main>,
    );
    expect((await axe(heroDom.container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } })).violations).toEqual([]);
    heroDom.unmount();
    const iotw = render(
      <main>
        <IdeaOfTheWeek idea={spotlight} weekLabel="Nov 2" total={225} buildCta />
      </main>,
    );
    expect((await axe(iotw.container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } })).violations).toEqual([]);
    iotw.unmount();
    const card = render(
      <main>
        <AuthCard mode="signup" returnTo="/start/example-idea" embedded gate buildFirst />
      </main>,
    );
    expect((await axe(card.container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
  });
});
