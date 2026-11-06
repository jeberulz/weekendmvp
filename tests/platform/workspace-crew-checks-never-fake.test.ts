import { describe, expect, it } from "vitest";

import { hydrotrailArtifacts, hydrotrailLandingSpec } from "@/lib/workspace/contracts/fixtures/hydrotrail";
import { checkNeverFake, neverFakeMatches } from "@/lib/workspace/crew/checks";

const codes = (text: string): string[] => neverFakeMatches(text).map((hit) => hit.code);

describe("never fake it: invented proof is found", () => {
  const bad: readonly (readonly [string, string])[] = [
    // testimonials
    ["fake_testimonial", "“HydroTrail changed how I hike every weekend” — Sarah K."],
    ["fake_testimonial", '"Best planner I have ever used" - Mark Jensen'],
    ["fake_testimonial", '"I never run out of water now," says Priya'],
    ["fake_testimonial", "Great app.\n— Sarah K., solo hiker"],
    ["fake_testimonial", "What our hikers are saying"],
    ["fake_testimonial", "Our beta users say it saves them every trip"],
    ["fake_testimonial", "Hikers love it"],
    ["fake_testimonial", "Read the customer stories"],
    // ratings and reviews
    ["fake_rating", "★★★★★ on the App Store"],
    ["fake_rating", "Rated 4.9/5 by hikers"],
    ["fake_rating", "4.8 out of 5 stars"],
    ["fake_rating", "Rated by our users: 5/5"],
    ["fake_rating", "A five-star experience"],
    ["fake_rating", "5-star support"],
    ["fake_review", "Over 1,200 reviews"],
    ["fake_review", "Rave reviews from every trail"],
    // counts
    ["fake_social_count", "Join 500 hikers already on the list"],
    ["fake_social_count", "Join 2,000 others on the waitlist"],
    ["fake_social_count", "Over 10,000 runners use it"],
    ["fake_social_count", "More than 500 customers"],
    ["fake_social_count", "10,000+ hikers trust HydroTrail"],
    ["fake_social_count", "Thousands of happy customers"],
    ["fake_social_count", "Helped 3k founders ship"],
    ["fake_social_count", "Used by 800 teams"],
    // trusted by, logos
    ["fake_trusted_by", "Trusted by hikers everywhere"],
    ["fake_trusted_by", "Recommended by dietitians"],
    ["fake_trusted_by", "Loved by thousands"],
    ["fake_logo_wall", "Teams at Google use it"],
    ["fake_logo_wall", "Companies like Patagonia rely on it"],
    ["fake_logo_wall", "Our partners"],
    // press
    ["fake_press", "As seen in TechCrunch"],
    ["fake_press", "As featured on Forbes"],
    ["fake_press", "Featured in Outside Magazine"],
    ["fake_press", "Covered by the New York Times"],
    ["fake_press", "Wired calls it the best hiking tool"],
    // credentials
    ["fake_credential", "Award-winning trail planner"],
    ["fake_credential", "Rated #1 by hikers"],
    ["fake_credential", "The best-selling hiking app"],
    ["fake_credential", "Clinically proven hydration plans"],
    ["fake_credential", "Doctor-recommended pacing"],
    // statistics
    ["fake_stat", "73% of hikers carry too little water"],
    ["fake_stat", "Cut dehydration by 40%"],
    ["fake_stat", "Save up to 30% of your pack weight"],
    ["fake_stat", "3x faster planning"],
    ["fake_stat", "9 in 10 hikers misjudge their water"],
    ["fake_stat", "4 out of 5 users plan better"],
  ];

  it.each(bad)("%s: %s", (code, text) => {
    expect(codes(text)).toContain(code);
  });

  it("flags soft appeals to evidence without hard-failing them", () => {
    const hits = neverFakeMatches("Studies show most hikers carry too little");
    expect(hits).toEqual([expect.objectContaining({ code: "unsupported_evidence", severity: "soft" })]);
  });
});

describe("never fake it: normal copy is not flagged", () => {
  const good: readonly string[] = [
    "Know your water. Drink before you're thirsty.",
    "Join the waitlist and get early access when HydroTrail opens.",
    "Be one of the first 50 people on the list.",
    "The first 50 on the waitlist get early access, free.",
    "Join the waitlist",
    "Couch to 5k for beginners",
    "A 5k race plan that fits around work",
    "Our 10k training week, in five days",
    "6.2 km to the next source. You're on pace.",
    "A 250 ml sip every twenty minutes",
    "Plan 3 routes and pick the coolest start time",
    "Open 24/7 on your phone",
    "Since 2019 we have been hiking the same ridge",
    "Top 10 mistakes new hikers make",
    "Step 2 in 3 minutes: pack the litres",
    "Rate your thirst from 1 to 5 after each stop",
    "Step 2/5: confirm your email",
    "Used by the planner to work out litres",
    "Recommended carry: 2.4 litres for a 22 km route",
    "Hikers from Colorado to Kent ask the same question",
    "People who hike alone need a water plan",
    "Made for solo hikers who plan long, hot routes",
    "Free at launch · Works in your phone's browser · Add it to your home screen",
    "Reminders keep you on pace; one tap logs each drink.",
    "I drank my water too early and turned back 3 km short.",
    "Reach 50 waitlist signups this weekend",
    "Post on Product Hunt on launch day",
    "Share it in the r/hiking weekly thread",
    "Join the 5k run club on Saturday",
    "A calm voice, not an alarm",
    "He said 'drink' and I did",
    "Add a testimonial section once you have real quotes",
  ];
  it.each(good)("%s", (text) => {
    expect(neverFakeMatches(text)).toEqual([]);
  });

  it("ignores bracketed placeholders", () => {
    expect(neverFakeMatches("[Quote from a beta user] — [Name, role]".replace(/\[[^\]]*\]/g, " "))).toEqual([]);
    const spec = { ...hydrotrailLandingSpec, hero: { ...hydrotrailLandingSpec.hero, reassurance: "[4.9/5 from 200 reviews]" } };
    expect(checkNeverFake(spec)).toEqual([]);
  });
});

describe("checkNeverFake over artifacts", () => {
  it("passes every HydroTrail artifact", () => {
    for (const [kind, artifact] of Object.entries(hydrotrailArtifacts)) {
      expect(checkNeverFake(artifact), kind).toEqual([]);
    }
  });

  it("reports the path of the offending string", () => {
    const spec = {
      ...hydrotrailLandingSpec,
      promises: {
        ...hydrotrailLandingSpec.promises,
        items: [
          { title: "Trusted by 5,000 hikers", body: "x" },
          ...(hydrotrailLandingSpec.promises?.items.slice(1) ?? []),
        ],
      },
    };
    const issues = checkNeverFake(spec);
    expect(issues.map((found) => found.path)).toContainEqual(["promises", "items", 0, "title"]);
    expect(issues.every((found) => found.severity === "hard")).toBe(true);
  });

  it("does not walk the workspace proof slots, the don't-say example or Do not build lines", () => {
    const slots = {
      proofSlots: [{ kind: "testimonial", placeholder: true, quote: "[Quote]", attribution: "[Name]" }],
      voice: { say: "Sip now.", dontSay: "Trusted by 10,000 hikers!", dontSayWhy: "Awards and 5-star claims are invented." },
      prompt: { body: "Build the planner.", doNotBuild: "fake testimonials, a 4.9/5 rating or a logo wall." },
    };
    expect(checkNeverFake(slots)).toEqual([]);
  });

  it("does not walk enum-like or colour fields", () => {
    expect(checkNeverFake({ palette: { ink: { hex: "#13242A" } }, layout: "split_media", kind: "rating" })).toEqual([]);
  });

  it("finds a fake in a social post, an email and a build prompt body", () => {
    const social = { mon: { caption: "Join 1,000 hikers on the waitlist" } };
    const email = { emails: { welcome: { body: "As seen in Forbes, HydroTrail is here." } } };
    const pack = { body: "Add a section showing 4.9/5 from 300 reviews." };
    expect(checkNeverFake(social).map((found) => found.code)).toContain("fake_social_count");
    expect(checkNeverFake(email).map((found) => found.code)).toContain("fake_press");
    expect(checkNeverFake(pack).map((found) => found.code)).toEqual(expect.arrayContaining(["fake_rating", "fake_review"]));
  });
});
