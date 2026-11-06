// @vitest-environment jsdom
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: async () => ({ signingIn: false }), signOut: async () => undefined }),
}));

vi.mock("../../components/marketing/SignupCta", () => ({
  SignupCta: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <button type="button" className={className}>{children}</button>
  ),
}));

import { AuthCard } from "../../components/auth/AuthCard";
import { EmailGate } from "../../components/ideas/EmailGate";
import { Hero } from "../../components/home/sections/Hero";
import { IdeaOfTheWeek } from "../../components/home/sections/IdeaOfTheWeek";
import type { HeroIdea, SpotlightIdea } from "../../lib/home/types";

/**
 * WP74-S5: with the launch-workspace flag off (or the visitor outside the
 * cohort) the homepage hero, Idea of the week and the idea-page account card
 * render exactly the bytes they rendered before the CTAs existed. The golden
 * files in `__snapshots__/wp74-cta-flag-off/` were written from the code before
 * S5 touched these components. Passing no CTA prop is the "off" state.
 */

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

/** A stable text form of a React element tree (names and props, no functions). */
function describeTree(node: React.ReactNode): unknown {
  if (node === null || node === undefined || typeof node === "boolean") return null;
  if (typeof node === "string" || typeof node === "number") return node;
  if (Array.isArray(node)) return node.map(describeTree);
  if (!React.isValidElement(node)) return String(node);
  const element = node as React.ReactElement<Record<string, unknown>>;
  const type = typeof element.type === "string" ? element.type : (element.type as { name?: string }).name ?? "anonymous";
  const { children, ...rest } = element.props;
  const props: Record<string, unknown> = {};
  for (const key of Object.keys(rest).sort()) {
    const value = rest[key];
    props[key] = React.isValidElement(value) ? describeTree(value) : typeof value === "function" ? "[fn]" : value;
  }
  return { type, props, children: describeTree(children as React.ReactNode) };
}

describe("flag off: the rendered output is the pre-S5 output", () => {
  test("homepage hero", async () => {
    await expect(renderToStaticMarkup(<Hero idea={hero} total={225} />)).toMatchFileSnapshot(
      "./__snapshots__/wp74-cta-flag-off/hero.html",
    );
  });

  test("idea of the week", async () => {
    await expect(
      renderToStaticMarkup(<IdeaOfTheWeek idea={spotlight} weekLabel="Nov 2" total={225} />),
    ).toMatchFileSnapshot("./__snapshots__/wp74-cta-flag-off/idea-of-the-week.html");
  });

  test("idea page account card, signup gate", async () => {
    await expect(
      renderToStaticMarkup(<AuthCard mode="signup" returnTo="/ideas/example-idea" embedded gate />),
    ).toMatchFileSnapshot("./__snapshots__/wp74-cta-flag-off/account-card.html");
  });

  test("idea page gate layout", async () => {
    const tree = EmailGate({ slug: "example-idea", intro: <p>intro</p>, children: <p>body</p> });
    await expect(JSON.stringify(describeTree(tree), null, 2)).toMatchFileSnapshot(
      "./__snapshots__/wp74-cta-flag-off/email-gate-tree.json",
    );
  });
});
