import { describe, expect, test } from "vitest";
import { WIZARD_LIMITS, wizardAnswersProgressSchema } from "@/lib/workspace/contracts/wizard";
import { nameFromOwnIdea, nameFromTitle, shortBusinessName, wizardSeedFor } from "@/lib/workspace/wizard/defaults";

// L1-C7. The suggested business name is a short, clean, title-cased phrase:
// whole words only, no trailing hyphen, no dangling article or preposition,
// within the business-name limit.

const DANGLING = ["a", "an", "the", "and", "or", "for", "with", "of", "to", "in", "on"];

function expectClean(name: string) {
  expect(name.length).toBeGreaterThan(0);
  expect(name.length).toBeLessThanOrEqual(WIZARD_LIMITS.businessName);
  expect(name).toBe(name.trim());
  expect(name).not.toMatch(/[-–—,:;(&+]$/u);
  const last = name.split(" ").at(-1)?.toLowerCase() ?? "";
  expect(DANGLING, name).not.toContain(last);
  expect(name.split(" ").length).toBeLessThanOrEqual(4);
  // The strict wizard schema accepts it as the chosen name.
  expect(wizardAnswersProgressSchema.safeParse({ name: { chosen: name, alternatives: [] } }).success).toBe(true);
}

describe("L1-C7 nameFromTitle", () => {
  test.each([
    ["Gamified posture tracking app for phone-based desk workers", "Gamified Posture Tracking App"],
    ["Gamified posture tracking app for phone-", "Gamified Posture Tracking App"],
    ["Meal Planner: dinners for busy parents", "Meal Planner"],
    ["HydroTrail – a hydration planner", "HydroTrail"],
    ["AI for dentists who hate paperwork", "AI for Dentists"],
    ["AI-powered receipt scanner for freelancers", "AI-powered Receipt Scanner"],
    ["A marketplace of the best local tutors", "Marketplace of the Best"],
    ["Pet sitting and dog walking marketplace", "Pet Sitting"],
    ["The Daily Stoic", "The Daily Stoic"],
    ["An app to track your plants", "App to Track"],
    ["Subscription box for indie board games (monthly)", "Subscription Box"],
    ["iOS widget for habit streaks", "iOS Widget"],
    ["Salt & Pepper", "Salt & Pepper"],
    ["Bank of Ideas", "Bank of Ideas"],
    ["Tool with", "Tool"],
    ["Invoice chaser, for freelancers who hate asking twice", "Invoice Chaser"],
    ["Shared grocery list with real-time sync between roommates", "Shared Grocery List"],
  ])("%j → %j", (title, expected) => {
    const name = nameFromTitle(title);
    expect(name).toBe(expected);
    expectClean(name);
  });

  test("a single word longer than the limit is cut to the limit on a letter, never a hyphen", () => {
    const name = nameFromTitle(`${"Super".repeat(7)}-${"x".repeat(10)}`);
    expect(name.length).toBeLessThanOrEqual(WIZARD_LIMITS.businessName);
    expect(name).not.toMatch(/-$/);
    expect(name.startsWith("Super")).toBe(true);
  });

  test("nothing usable falls back to a plain name", () => {
    expect(nameFromTitle("of")).toBe("Weekend Launch");
    expect(nameFromTitle("   ")).toBe("Weekend Launch");
    expect(shortBusinessName("— , ;")).toBe("Weekend Launch");
  });
});

describe("L1-C7 nameFromOwnIdea", () => {
  test.each([
    ["A packing list that adapts to the forecast", "Packing List"],
    ["I want to build an app that helps nurses swap shifts", "App"],
    ["the cheapest way to rent camping gear for a weekend", "Cheapest Way"],
    ["Tutoring marketplace. Parents book local tutors near them", "Tutoring Marketplace"],
    ["help freelancers chase late invoices", "Help Freelancers Chase"],
    ["Dog walking app for busy city workers", "Dog Walking App"],
    // Lead-ins are stripped, straight or curly apostrophe, with or without a build verb.
    ["I'd like to build an app that helps nurses swap shifts", "App"],
    ["I’d like to build a recipe swap site for neighbours", "Recipe Swap Site"],
    ["I'd like to help freelancers chase late invoices", "Help Freelancers Chase"],
    ["I would like to make a habit tracker", "Habit Tracker"],
    ["I'm going to make a recipe swap site for neighbours", "Recipe Swap Site"],
    ["I’m going to launch a podcast clipping service", "Podcast Clipping Service"],
    ["I am going to create a study planner", "Study Planner"],
    ["I wanna build a dog walking app", "Dog Walking App"],
    ["i wanna start a podcast clipping service", "Podcast Clipping Service"],
    ["I wanna help parents swap baby gear", "Help Parents Swap"],
    ["I plan to build a gym buddy finder", "Gym Buddy Finder"],
    // A leading "&" or "+" is dropped.
    ["& friends trip planner", "Friends Trip Planner"],
    ["+ more budget tracker", "More Budget Tracker"],
  ])("%j → %j", (text, expected) => {
    const name = nameFromOwnIdea(text);
    expect(name).toBe(expected);
    expectClean(name);
  });
});

describe("L1-C7 shortBusinessName never starts on & or +", () => {
  test.each([
    ["& Co Studio", "Co Studio"],
    ["+ + Plus tracker", "Plus Tracker"],
    ["&", "Weekend Launch"],
  ])("%j → %j", (text, expected) => {
    const name = shortBusinessName(text);
    expect(name).toBe(expected);
    expect(name).not.toMatch(/^[&+]/u);
    expectClean(name);
  });
});

describe("L1-C7 the wizard seed uses it", () => {
  test("a generic library idea suggests the clean name, never a mid-word cut", () => {
    const seed = wizardSeedFor({
      idea: { source: "library", ideaSlug: "posture" },
      ideaTitle: "Gamified posture tracking app for phone-based desk workers",
    });
    expect(seed.defaults.name?.chosen).toBe("Gamified Posture Tracking App");
    expect(seed.suggestedNames).toEqual(["Gamified Posture Tracking App"]);
  });

  test("an own idea suggests a short name; HydroTrail keeps its worked names", () => {
    const own = wizardSeedFor({ idea: { source: "own_idea", text: "A packing list that adapts to the forecast" } });
    expect(own.defaults.name?.chosen).toBe("Packing List");
    const hydro = wizardSeedFor({ idea: { source: "library", ideaSlug: "hydrotrail" } });
    expect(hydro.suggestedNames).toEqual(["HydroTrail", "SipLine", "Trailwater"]);
  });
});
