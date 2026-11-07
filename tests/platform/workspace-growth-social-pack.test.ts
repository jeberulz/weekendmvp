/**
 * WP76-S2a. The social pack's link and @handle check, its place in the
 * quality gate, its inputs and its prompt spec, pure.
 */
import { describe, expect, test } from "vitest";

import { socialPackSpec } from "../../convex/ai/prompts/socialPack.v2";
import { SOCIAL_DAYS, type SocialPack } from "../../lib/workspace/contracts/artifacts";
import { TIER_RECOMMENDED_EFFORT } from "../../lib/workspace/contracts/prompts";
import { hydrotrailBlueprint, hydrotrailBrandKit, hydrotrailSocialPack } from "../../lib/workspace/contracts/fixtures/hydrotrail";
import { checkSocialPackLinks, findLinkOrHandle } from "../../lib/workspace/crew/checks/socialLinks";
import { SOCIAL_PACK_PROMPT_REF, socialPackStepPlan } from "../../lib/workspace/crew/inputs";
import { gateCrewArtifact, issueCodes } from "../../lib/workspace/crew/quality";

const clonePack = (): SocialPack => JSON.parse(JSON.stringify(hydrotrailSocialPack)) as SocialPack;

describe("findLinkOrHandle", () => {
  test.each([
    ["Follow @hydrotrail", "@hydrotrail"],
    ["@trail_crew on launch day", "@trail_crew"],
    ["Ask @Café", "@Café"],
    ["Plans at hydrotrail.shop", "hydrotrail.shop"],
    ["Write to hello@hydrotrail.app", "hello@hydrotrail.app"],
    ["See https://hydrotrail.app", "https://"],
    ["www.hydro", "www."],
  ])("refuses %j", (text, hit) => {
    expect(findLinkOrHandle(text)).toBe(hit);
  });

  // Review minor 1: a time after `@` is not a handle; anything longer still is.
  test.each([
    "Meet us @6pm",
    "Q&A @noon Friday",
    "Live @6:30 PM on launch day",
    "Doors @ 7, talk @7pm, drinks @9 pm",
    "Start @12:30am.",
    "Back @Midnight",
    "Meet @6pm: bring water",
  ])("allows the time in %j", (text) => {
    expect(findLinkOrHandle(text)).toBeNull();
  });

  test.each([
    ["Follow @HydroTrail", "@HydroTrail"],
    ["Thanks @john_doe", "@john_doe"],
    ["Join @6pmclub tonight", "@6pmclub"],
    ["Run with @noonrun", "@noonrun"],
    ["Ask @2026hikers", "@2026hikers"],
    ["Tag @2026", "@2026"],
    ["At @6:30pmclub", "@6"],
    ["Meet @6pm, then follow @hydrotrail", "@hydrotrail"],
  ])("still refuses the handle in %j", (text, hit) => {
    expect(findLinkOrHandle(text)).toBe(hit);
  });

  test.each([
    "Waitlist open: link in bio.",
    "Meet @ the trailhead at 6",
    "A lone @ sign",
    "500 ml / hr, e.g. on a hot day",
    "Built with Next.js",
    "5 km@noon",
  ])("allows %j", (text) => {
    expect(findLinkOrHandle(text)).toBeNull();
  });
});

describe("checkSocialPackLinks", () => {
  test("the HydroTrail pack is clean", () => {
    expect(checkSocialPackLinks(hydrotrailSocialPack)).toEqual([]);
  });

  test.each([
    ["hook", (pack: SocialPack): void => void (pack.posts.fri.hook = "Go to hydrotrail.shop"), ["posts", "fri", "hook"]],
    ["caption", (pack: SocialPack): void => void (pack.posts.sat.caption = "Thanks @trailcrew"), ["posts", "sat", "caption"]],
    ["shortCaption", (pack: SocialPack): void => void (pack.posts.sun.shortCaption = "Mail me@hydrotrail.app"), ["posts", "sun", "shortCaption"]],
    ["imageText", (pack: SocialPack): void => void (pack.posts.mon.imageText = "www.hydro"), ["posts", "mon", "imageText"]],
    ["imageAlt", (pack: SocialPack): void => void (pack.posts.tue.imageAlt = "Card reading hydrotrail.app"), ["posts", "tue", "imageAlt"]],
    ["pollOptions", (pack: SocialPack): void => void (pack.posts.mon.pollOptions = ["An app", "Ask @trailcrew"]), ["posts", "mon", "pollOptions", 1]],
    ["hashtags", (pack: SocialPack): void => void (pack.posts.wed.hashtags = ["hiking", "@trail"]), ["posts", "wed", "hashtags", 1]],
  ] as const)("a hard social_link_in_text issue for %s, with its path", (_field, edit, path) => {
    const next = clonePack();
    edit(next);
    const issues = checkSocialPackLinks(next);
    expect(issues).toEqual([expect.objectContaining({ code: "social_link_in_text", severity: "hard", path: [...path] })]);
  });
});

describe("the quality gate", () => {
  const context = { ownIdea: false, businessName: "HydroTrail" } as const;

  test("passes the HydroTrail pack unchanged", () => {
    const gated = gateCrewArtifact("social_pack", hydrotrailSocialPack, context);
    expect(gated.result.hard).toEqual([]);
    expect(gated.artifact).toEqual(hydrotrailSocialPack);
  });

  test("a handle in any post stores nothing", () => {
    for (const day of SOCIAL_DAYS) {
      const next = clonePack();
      next.posts[day].caption = `${next.posts[day].caption} Tag @friends.`;
      const gated = gateCrewArtifact("social_pack", next, context);
      expect(issueCodes(gated.result.hard)).toContain("social_link_in_text");
      expect(gated.artifact).toBeNull();
    }
  });
});

describe("the step's inputs and spec", () => {
  test("the blueprint and the kit's name, tagline and voice only: no answers, no palette, no art", () => {
    const plan = socialPackStepPlan({ blueprint: hydrotrailBlueprint, brandKit: hydrotrailBrandKit });
    expect(plan.promptRef).toBe(SOCIAL_PACK_PROMPT_REF);
    expect(Object.keys(plan.inputs).sort()).toEqual(["blueprint", "brand", "ideaAngles"]);
    // WP90-S5: no seed, no angles; the spec then sends the v1 user block.
    expect(plan.inputs.ideaAngles).toBeNull();
    expect(JSON.parse(plan.inputs.brand ?? "null")).toEqual({
      name: hydrotrailBrandKit.name, tagline: hydrotrailBrandKit.tagline.text, voice: hydrotrailBrandKit.voice,
    });
  });

  test("crew-social-pack@2 runs on the fast tier at the tier's recommended effort, thinking off", () => {
    expect(`${socialPackSpec.id}@${socialPackSpec.version}`).toBe(SOCIAL_PACK_PROMPT_REF);
    expect(socialPackSpec).toMatchObject({ tier: "fast", effort: TIER_RECOMMENDED_EFFORT.fast, thinking: { type: "disabled" }, fallbacks: "none" });
  });

  test("the user block quotes the inputs as data and adds the revision instruction only for a revision", () => {
    const inputs = socialPackStepPlan({ blueprint: hydrotrailBlueprint, brandKit: hydrotrailBrandKit }).inputs;
    const user = socialPackSpec.buildUser({ blueprint: inputs.blueprint ?? "", brand: inputs.brand ?? "" });
    expect(user).toContain("<blueprint>");
    expect(user).toContain("<brand>");
    expect(user).not.toContain("This is a revision.");
    const revision = socialPackSpec.buildUser({ blueprint: "{}", brand: "{}", previousArtifact: "<previous_draft>\n{}\n</previous_draft>" });
    expect(revision).toContain("This is a revision.");
  });
});
