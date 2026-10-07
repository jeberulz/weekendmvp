import { describe, expect, test } from "vitest";
import { HERO_CTA_LOCATION, heroCta, heroIdeaHref } from "../../lib/home/hero-cta";

describe("hero idea link", () => {
  test("one destination for everyone: the idea page decides what the visitor sees", () => {
    expect(heroIdeaHref("adventure-date-night-app")).toBe("/ideas/adventure-date-night-app");
    // The gate returns to this exact path after verification, so it carries no query.
    expect(heroIdeaHref("adventure-date-night-app")).not.toContain("?");
  });

  test("the slug cannot change the path it sits in", () => {
    expect(heroIdeaHref("a/b")).toBe("/ideas/a%2Fb");
    expect(heroIdeaHref("../dashboard")).toBe("/ideas/..%2Fdashboard");
    expect(heroIdeaHref("x?y=1#z")).toBe("/ideas/x%3Fy%3D1%23z");
  });

  test("words the link for a visitor and for a signed-in member", () => {
    const visitor = heroCta(false);
    const member = heroCta(true);
    expect(visitor.audience).toBe("visitor");
    expect(member.audience).toBe("member");
    expect(visitor.label).not.toBe(member.label);
    expect(visitor.note).not.toBe(member.note);
  });

  test("a visitor is told what is free and what the account unlocks, with no card or price claim", () => {
    const { note, label } = heroCta(false);
    expect(note).toMatch(/Prompt 1 is free/);
    expect(note).toMatch(/free account/);
    expect(`${label} ${note}`).not.toMatch(/\$|credit card|trial|no card/i);
  });

  test("a member is not asked to sign up", () => {
    const { label, note } = heroCta(true);
    expect(`${label} ${note}`).not.toMatch(/account|sign|unlock|free/i);
  });

  test("reports from its own location", () => {
    expect(HERO_CTA_LOCATION).toBe("home-hero-idea");
  });
});
