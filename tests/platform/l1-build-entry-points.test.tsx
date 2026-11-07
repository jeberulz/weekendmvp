// @vitest-environment jsdom
/**
 * L1-C9: invited beta testers get into the build wizard from the idea page
 * and from the member dashboard, not only from the homepage. Both entries sit
 * behind the launch-workspace flag (`buildCtaVisible`); off, the pages render
 * as before. Signed in, the links go straight to `/start/*`; the anonymous
 * idea-page CTA still goes through sign-up. In `allowlist` mode a signed-out
 * visitor sees the CTA too (owner's call (b)), and a new account that is not
 * invited gets `NotInvited` at `/start` instead of a 404.
 */
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";

import dashboardPageSource from "../../app/dashboard/page.tsx?raw";
import startIdeaSource from "../../app/start/[ideaSlug]/page.tsx?raw";
import startOwnSource from "../../app/start/own/page.tsx?raw";
import ideaSource from "../../app/ideas/[slug]/page.tsx?raw";

const track = vi.hoisted(() => vi.fn());
vi.mock("../../lib/track", () => ({ trackEvent: track, trackDashboardEvent: vi.fn() }));

// Home's other modules read Convex in the browser; only the composition is under test.
vi.mock("../../components/platform/home/Greeting", () => ({ Greeting: () => <h1>Home</h1> }));
vi.mock("../../components/live/WorkshopDashboardCards", () => ({ WorkshopDashboardCards: () => null }));
vi.mock("../../components/platform/home/NextStepCard", () => ({ NextStepCard: () => null }));
vi.mock("../../components/platform/home/PickedForYou", () => ({ PickedForYou: () => null }));
vi.mock("../../components/platform/home/HomeRail", () => ({ HomeRail: () => null }));
// The public chrome (MegaNav, footer) is covered elsewhere; keep the landmark.
vi.mock("../../components/public/PublicShell", () => ({
  PublicShell: ({ children }: { children: React.ReactNode }) => <main id="main">{children}</main>,
}));

import { NotInvited } from "../../app/start/NotInvited";
import { DashboardHome } from "../../components/platform/home/DashboardHome";
import { StartBuildingCard } from "../../components/platform/home/StartBuildingCard";
import { BuildIdeaCta } from "../../components/workspace/BuildIdeaCta";
import {
  BUILD_CTA_LABEL,
  PICK_LIBRARY_IDEA_LABEL,
  START_BUILDING_LABEL,
  buildCtaHref,
  buildHref,
  wizardPath,
} from "../../lib/workspace/build-cta";

afterEach(() => {
  cleanup();
  track.mockClear();
});

const AXE = { rules: { "color-contrast": { enabled: false } } };

describe("the CTA href", () => {
  test("signed in goes straight to the wizard; anonymous goes through sign-up", () => {
    expect(buildCtaHref("example-idea", true)).toBe("/start/example-idea");
    expect(buildCtaHref("example-idea", true)).toBe(wizardPath("example-idea"));
    expect(buildCtaHref("example-idea", false)).toBe("/signup?returnTo=%2Fstart%2Fexample-idea");
    expect(buildCtaHref("example-idea", false)).toBe(buildHref("example-idea"));
  });
});

describe("BuildIdeaCta", () => {
  test("signed in: links to /start/{slug}, keeps the idea title in its name, reports one event, passes axe", async () => {
    const { container } = render(
      <main>
        <BuildIdeaCta slug="example-idea" title="Example Idea" location="idea-member-header" signedIn />
      </main>,
    );
    const link = screen.getByRole("link", { name: `${BUILD_CTA_LABEL} for Example Idea` });
    expect(link.getAttribute("href")).toBe("/start/example-idea");
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("cta_button_clicked", {
      button_location: "build-cta-idea-member-header",
      button_text: BUILD_CTA_LABEL,
      idea_slug: "example-idea",
    });
    expect((await axe(container, AXE)).violations).toEqual([]);
  });

  test("anonymous (the default): still goes through sign-up", () => {
    render(<BuildIdeaCta slug="example-idea" title="Example Idea" location="idea-account-card" />);
    const link = screen.getByRole("link", { name: `${BUILD_CTA_LABEL} for Example Idea` });
    expect(link.getAttribute("href")).toBe("/signup?returnTo=%2Fstart%2Fexample-idea");
  });
});

describe("idea page wiring", () => {
  test("the member page shows the signed-in CTA only behind the flag, beside Save", () => {
    expect(ideaSource).toContain("<IdeaContent slug={slug} resolved={resolved} buildCta={buildCta} />");
    expect(ideaSource).toMatch(
      /\{buildCta \? \(\s*<BuildIdeaCta slug=\{slug\} title=\{title\} location="idea-member-header" signedIn \/>\s*\) : null\}\s*<SaveIdeaButton/,
    );
    // The anonymous branch is unchanged: the account card returns to the wizard.
    expect(ideaSource).toContain("buildFirst={buildCta}");
  });
});

function startLinks(html: string) {
  const root = document.createElement("div");
  root.innerHTML = html;
  return [...root.querySelectorAll("a")]
    // The "pick an idea" check is by name: Home's other modules link to the library too.
    .filter((a) => a.getAttribute("href") === "/start/own" || a.textContent === PICK_LIBRARY_IDEA_LABEL)
    .map((a) => [a.getAttribute("href"), a.textContent]);
}

describe("dashboard", () => {
  const props = { editorial: null, nowMs: 0 };

  test("flag on: Start building goes straight to /start/own, with a library link", () => {
    const html = renderToStaticMarkup(<DashboardHome {...props} startBuilding />);
    expect(startLinks(html)).toEqual([
      ["/start/own", START_BUILDING_LABEL],
      ["/dashboard/explore", PICK_LIBRARY_IDEA_LABEL],
    ]);
    expect(html).not.toContain("/signup");
  });

  test("flag off: Home renders exactly as before", () => {
    const off = renderToStaticMarkup(<DashboardHome {...props} startBuilding={false} />);
    expect(off).toBe(renderToStaticMarkup(<DashboardHome {...props} />));
    expect(off).not.toContain("/start/own");
    expect(off).not.toContain(START_BUILDING_LABEL);
  });

  test("the card reports consent-gated clicks and passes axe", async () => {
    const { container } = render(
      <main>
        <StartBuildingCard />
      </main>,
    );
    const start = screen.getByRole("link", { name: START_BUILDING_LABEL });
    start.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(start);
    expect(track).toHaveBeenCalledWith("cta_button_clicked", {
      button_location: "start-building-dashboard",
      button_text: START_BUILDING_LABEL,
    });
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Build your own idea with your AI co-founder.");
    expect((await axe(container, AXE)).violations).toEqual([]);
  });

  test("Home with the flag on passes axe", async () => {
    const { container } = render(
      <main>
        <DashboardHome {...props} startBuilding />
      </main>,
    );
    expect((await axe(container, AXE)).violations).toEqual([]);
  });

  test("the page starts the flag read beside the editorial read and passes it to Home", () => {
    const flag = dashboardPageSource.indexOf("buildCtaVisible()");
    expect(dashboardPageSource.indexOf("await connection()")).toBeLessThan(flag);
    expect(flag).toBeLessThan(dashboardPageSource.indexOf("await getDashboardEditorial()"));
    expect(dashboardPageSource).toContain(
      "<DashboardHome editorial={editorial} nowMs={nowMs} startBuilding={startBuilding} />",
    );
  });
});

describe("not in the beta yet (/start)", () => {
  test("both wizard routes render NotInvited for a not-invited founder, before any wizard JSX", () => {
    for (const source of [startIdeaSource, startOwnSource]) {
      const gate = source.indexOf('access.kind === "not-invited"');
      expect(gate).toBeGreaterThan(-1);
      expect(gate).toBeLessThan(source.indexOf("<WizardPage"));
    }
    expect(startIdeaSource).toContain("<NotInvited ideaSlug={ideaSlug} />");
    expect(startOwnSource).toContain("<NotInvited ideaSlug={null} />");
  });

  test("from an idea: one h1, a way back to that idea, the library and the dashboard; passes axe", async () => {
    const { container } = render(<NotInvited ideaSlug="example-idea" />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("You're not in the beta yet.");
    const hrefs = screen.getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")]);
    expect(hrefs).toEqual([
      ["Back to the idea", "/ideas/example-idea"],
      ["Browse all ideas", "/startup-ideas"],
      ["Go to your dashboard", "/dashboard"],
    ]);
    expect((await axe(container, AXE)).violations).toEqual([]);
  });

  test("own idea: no idea link, and it promises no waitlist or email", () => {
    const html = renderToStaticMarkup(<NotInvited ideaSlug={null} />);
    expect(html).not.toContain("Back to the idea");
    expect(html).not.toMatch(/waitlist|we.ll email|we will email/i);
  });
});
