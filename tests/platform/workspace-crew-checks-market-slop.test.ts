import { describe, expect, it } from "vitest";

import { hydrotrailArtifacts, ownIdeaLightBlueprint } from "@/lib/workspace/contracts/fixtures/hydrotrail";
import { carriesMarketNumber, checkMarketNumbers, checkSlop, isTriad } from "@/lib/workspace/crew/checks";

describe("market numbers in own ideas", () => {
  const claims: readonly string[] = [
    "A $4B market for hikers",
    "Hikers spend $49 a year on gear",
    "Charge 9/month for the planner",
    "30% of hikers run out of water",
    "Already at 5k MRR",
    "500 waitlist sign ups in a week",
    "10k dentists need this",
    "1 in 5 hikers gets dehydrated",
    "Search volume for water planner is high",
    "A TAM of millions",
    "Priced at €19",
  ];
  it.each(claims)("flags: %s", (text) => {
    expect(carriesMarketNumber(text)).toBe(true);
  });

  const fine: readonly string[] = [
    "Enter distance, climb and the forecast high.",
    "3 steps, 2 founders, Top 10 tips",
    "A 250 ml sip every 20 minutes",
    "Carry 2.4 L on a 22 km route",
    "A 22 km route with 600 m climb at 30°C",
    "Hike 100 days across the trail",
    "Since 2025 we have planned hikes",
    "Open 24/7 on your phone",
    "Couch to 5k for beginners",
    "[4.9/5 from 200 reviews]",
    "Web3 and B2B are not numbers",
    "Plan, pack and sip",
    "First 50 on the waitlist get early access",
    "10,000 steps a day",
  ];
  it.each(fine)("does not flag: %s", (text) => {
    expect(carriesMarketNumber(text)).toBe(false);
  });

  it("passes the own-idea light blueprint fixture", () => {
    expect(checkMarketNumbers(ownIdeaLightBlueprint)).toEqual([]);
  });

  it("flags the string and reports its path", () => {
    const blueprint = { ...ownIdeaLightBlueprint, features: ["Checklist from the forecast", "A 12% faster pack"] };
    const issues = checkMarketNumbers(blueprint);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: "own_idea_market_number", severity: "hard", path: ["features", 1] });
  });

  it("skips proof slots, hex colours and the voice counter-example", () => {
    expect(
      checkMarketNumbers({
        proofSlots: [{ kind: "stat", placeholder: true, value: "[N]", label: "people on the waitlist" }],
        palette: { ink: { hex: "#13242A" } },
        voice: { dontSay: "Save 40% today!" },
      }),
    ).toEqual([]);
  });
});

describe("copy-slop lexicon", () => {
  const hard: readonly string[] = [
    "Unlock the power of your trail data",
    "Revolutionize how you hike",
    "A true game-changer for hikers",
    "Take your hiking to the next level",
    "Supercharge your weekend",
    "In today's fast-paced world, water matters",
    "Delve into your hydration data",
    "Say goodbye to dehydration",
    "Look no further than HydroTrail",
    "Cutting-edge hydration planning",
    "Whether you're a day hiker or a thru-hiker, we have you covered.",
  ];
  it.each(hard)("hard: %s", (text) => {
    const issues = checkSlop({ copy: text });
    expect(issues.some((found) => found.severity === "hard" && found.code === "slop_phrase")).toBe(true);
  });

  const soft: readonly string[] = [
    "A seamless planner",
    "Robust offline support",
    "Leverage your route data",
    "Empower every hiker",
    "It's not just a planner, it's a trail partner",
    "Not only a log but a coach",
  ];
  it.each(soft)("soft: %s", (text) => {
    const issues = checkSlop({ copy: text });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((found) => found.severity === "soft")).toBe(true);
  });

  const clean: readonly string[] = [
    "Know your water. Drink before you're thirsty.",
    "HydroTrail turns distance, heat and climb into litres to carry, then reminds you to sip on pace.",
    "Enter distance, climb and the forecast high.",
    "Sip now: 250 ml keeps you on pace for the climb.",
    "A planner, a reminder and a log in one mobile web app.",
    "Plan the route, pack the litres, sip on the trail.",
    "Trail planner: distance, heat and climb → litres to carry",
    "Your meals for the week, planned in five minutes.",
    "We send one email a week. Reply to any of them and a person answers.",
    "Three steps before you leave the car park",
    "Free at launch · Works in your phone's browser · Add it to your home screen",
  ];
  it.each(clean)("clean: %s", (text) => {
    expect(checkSlop({ copy: text })).toEqual([]);
  });

  describe("triads", () => {
    it.each(["Fast, simple and secure.", "Fast. Simple. Secure.", "Plan, pack, sip", "Calm, practical and trail-tested."])("flags %s", (text) => {
      expect(isTriad(text)).toBe(true);
      expect(checkSlop({ headline: text }).map((found) => found.code)).toContain("slop_triad");
    });
    it.each([
      "Distance, heat and climb",
      "Plan the route, pack the litres and sip on pace.",
      "Fast and simple",
      "Plan, On trail and Log",
    ])("does not flag %s", (text) => {
      expect(isTriad(text)).toBe(text === "Distance, heat and climb");
    });
  });

  it("flags two em dashes in one string, not one", () => {
    expect(checkSlop({ a: "Plan — pack — sip" }).map((found) => found.code)).toContain("slop_em_dash_stack");
    expect(checkSlop({ a: "Plan the route — then pack the litres." })).toEqual([]);
  });

  it("does not walk the brand voice's don't-say example", () => {
    expect(checkSlop({ voice: { say: "Sip now.", dontSay: "Revolutionize your hydration!", dontSayWhy: "Hype." } })).toEqual([]);
  });

  it("passes every HydroTrail artifact except build prompts and the roster (not copy)", () => {
    for (const [kind, artifact] of Object.entries(hydrotrailArtifacts)) {
      if (kind === "roster_plan") continue;
      expect(checkSlop(artifact), kind).toEqual([]);
    }
  });
});
