import { describe, expect, it } from "vitest";

import { LIMITS, type BrandKit, type LandingSpec } from "@/lib/workspace/contracts/artifacts";
import { hydrotrailBrandKit, hydrotrailLandingSpec } from "@/lib/workspace/contracts/fixtures/hydrotrail";
import {
  DISPLAY_TARGETS,
  checkAltText,
  checkBrandKit,
  checkHeadingLengths,
  checkLandingLayouts,
  checkLandingSpec,
  checkNoEmoji,
  checkNoEyebrow,
  checkProofSlots,
} from "@/lib/workspace/crew/checks";

const codes = (issues: readonly { code: string }[]): string[] => issues.map((found) => found.code);
/** Matches an issue by code and severity (every assertion names both). */
const hit = (code: string, severity: "hard" | "soft") => expect.objectContaining({ code, severity });

const withHero = (patch: Partial<LandingSpec["hero"]>): LandingSpec => ({
  ...hydrotrailLandingSpec,
  hero: { ...hydrotrailLandingSpec.hero, ...patch },
});

describe("heading lengths", () => {
  it("passes the HydroTrail landing spec", () => {
    expect(checkHeadingLengths(hydrotrailLandingSpec)).toEqual([]);
  });

  it("is hard over the C-ART cap and names the path", () => {
    const long = "A".repeat(LIMITS.landingSpec.headline + 1);
    const issues = checkHeadingLengths(withHero({ headline: { text: long, emphasis: "A" } }));
    expect(issues).toEqual([expect.objectContaining({ code: "heading_too_long", severity: "hard", path: ["hero", "headline", "text"] })]);
  });

  it("is soft between the display target and the cap", () => {
    const text = "Plan every route, pack exactly the right litres and sip on pace all day long";
    expect(text.length).toBeGreaterThan(DISPLAY_TARGETS.headline.maxChars);
    expect(text.length).toBeLessThanOrEqual(LIMITS.landingSpec.headline);
    const issues = checkHeadingLengths(withHero({ headline: { text, emphasis: "all day long" } }));
    expect(issues).toEqual([expect.objectContaining({ code: "heading_long_for_display", severity: "soft" })]);
  });

  it("checks section headings and item titles", () => {
    const spec: LandingSpec = {
      ...hydrotrailLandingSpec,
      waitlist: { ...hydrotrailLandingSpec.waitlist, heading: "Join the waitlist today and be the very first person on the trail" },
      how_it_works: hydrotrailLandingSpec.how_it_works && {
        ...hydrotrailLandingSpec.how_it_works,
        steps: [
          { title: "Plan the whole route with distance climb and forecast", body: "x" },
          ...hydrotrailLandingSpec.how_it_works.steps.slice(1),
        ] as typeof hydrotrailLandingSpec.how_it_works.steps,
      },
    };
    const issues = checkHeadingLengths(spec);
    expect(issues).toContainEqual(expect.objectContaining({ code: "heading_long_for_display", severity: "soft", path: ["waitlist", "heading"] }));
    expect(issues).toContainEqual(expect.objectContaining({ code: "heading_long_for_display", severity: "soft", path: ["how_it_works", "steps", 0, "title"] }));
  });

  it("counts characters, not UTF-16 units", () => {
    const text = "🙂".repeat(LIMITS.landingSpec.headline);
    expect(codes(checkHeadingLengths(withHero({ headline: { text, emphasis: "x" } })))).not.toContain("heading_too_long");
  });
});

describe("no eyebrow, section number or emoji (D24)", () => {
  it("passes HydroTrail", () => {
    expect(checkNoEyebrow(hydrotrailLandingSpec)).toEqual([]);
    expect(checkNoEmoji(hydrotrailLandingSpec)).toEqual([]);
  });

  it.each(["eyebrow", "kicker", "overline", "preTitle", "super_heading"])("flags a %s field anywhere", (key) => {
    const spec = { ...hydrotrailLandingSpec, hero: { ...hydrotrailLandingSpec.hero, [key]: "NEW" } };
    expect(checkNoEyebrow(spec)).toEqual([expect.objectContaining({ code: "eyebrow_field", severity: "hard", path: ["hero", key] })]);
  });

  it.each(["01 Plan the route", "02. Pack", "3 / Sip", "1) Go", "Step 2: pack"])("flags a numbered heading: %s", (heading) => {
    const spec: LandingSpec = { ...hydrotrailLandingSpec, waitlist: { ...hydrotrailLandingSpec.waitlist, heading } };
    expect(checkNoEyebrow(spec)).toContainEqual(hit("section_number", "hard"));
  });

  it.each(["1. Fill the pack", "Step 1: fill the pack", "01 Fill", "3 / 5 trails"])(
    "allows a numbered how-it-works step title (07 §4): %s",
    (title) => {
      const steps = hydrotrailLandingSpec.how_it_works?.steps ?? [];
      const spec = {
        ...hydrotrailLandingSpec,
        how_it_works: hydrotrailLandingSpec.how_it_works && {
          ...hydrotrailLandingSpec.how_it_works,
          steps: [{ ...steps[0], title }, ...steps.slice(1)] as typeof steps,
        },
      } as LandingSpec;
      expect(checkNoEyebrow(spec)).toEqual([]);
    },
  );

  it("still flags a numbered how-it-works section heading", () => {
    const spec = {
      ...hydrotrailLandingSpec,
      how_it_works: hydrotrailLandingSpec.how_it_works && { ...hydrotrailLandingSpec.how_it_works, heading: "02. How it works" },
    } as LandingSpec;
    expect(checkNoEyebrow(spec)).toEqual([expect.objectContaining({ code: "section_number", severity: "hard", path: ["how_it_works", "heading"] })]);
  });

  it.each(["3 steps before you leave the car park", "2 minutes to plan", "5k plans that fit your week"])(
    "does not flag a heading that starts with a quantity: %s",
    (heading) => {
      const spec: LandingSpec = { ...hydrotrailLandingSpec, waitlist: { ...hydrotrailLandingSpec.waitlist, heading } };
      expect(checkNoEyebrow(spec)).toEqual([]);
    },
  );

  it("flags an all-caps heading softly", () => {
    const spec: LandingSpec = { ...hydrotrailLandingSpec, waitlist: { ...hydrotrailLandingSpec.waitlist, heading: "JOIN THE WAITLIST" } };
    expect(checkNoEyebrow(spec)).toEqual([expect.objectContaining({ code: "all_caps_heading", severity: "soft" })]);
  });

  it("allows an acronym inside a normal heading", () => {
    const spec: LandingSpec = { ...hydrotrailLandingSpec, waitlist: { ...hydrotrailLandingSpec.waitlist, heading: "Be first to try the GPS-free plan" } };
    expect(checkNoEyebrow(spec)).toEqual([]);
  });

  it("flags emoji but not © or ™", () => {
    const spec = withHero({ subhead: "Plan your water 💧 before you go" });
    expect(checkNoEmoji(spec)).toEqual([expect.objectContaining({ code: "emoji_in_copy", severity: "hard", path: ["hero", "subhead"] })]);
    expect(checkNoEmoji(withHero({ subhead: "HydroTrail™ plans your water © 2026" }))).toEqual([]);
  });
});

describe("proof slots stay placeholders", () => {
  it("passes the default slots", () => {
    expect(checkProofSlots({ ...hydrotrailLandingSpec, proofSlots: [
      { kind: "testimonial", placeholder: true, quote: "[Quote from an early user]", attribution: "[Name, role]" },
      { kind: "stat", placeholder: true, value: "[N]", label: "people on the waitlist" },
      { kind: "logo", placeholder: true, name: "[Partner or community name]", alt: "[Partner or community] logo" },
    ] })).toEqual([]);
    expect(checkProofSlots(hydrotrailLandingSpec)).toEqual([]);
  });

  it("flags real-looking proof and a missing placeholder flag", () => {
    const issues = checkProofSlots({
      proofSlots: [
        { kind: "testimonial", placeholder: true, quote: "Changed how I hike", attribution: "[Name, role]" },
        { kind: "stat", placeholder: false, value: "[N]", label: "people" },
        { kind: "rating", placeholder: true, value: "4.9", label: "stars" },
        { kind: "press", placeholder: true, outlet: "[Outlet]", quote: "Best app" },
      ],
    });
    expect(issues.map((found) => [found.code, found.severity, found.path])).toEqual([
      ["proof_not_bracketed", "hard", ["proofSlots", 0, "quote"]],
      ["proof_not_placeholder", "hard", ["proofSlots", 1, "placeholder"]],
      ["proof_not_bracketed", "hard", ["proofSlots", 2, "value"]],
      ["proof_not_bracketed", "hard", ["proofSlots", 3, "quote"]],
    ]);
  });
});

describe("alt text", () => {
  it("flags alt text that opens with 'image of'", () => {
    const issues = checkAltText({ image: { description: "d", alt: "Image of a hiker on a ridge" } });
    expect(issues).toEqual([expect.objectContaining({ code: "alt_redundant", severity: "soft", path: ["image", "alt"] })]);
    expect(checkAltText({ post: { imageAlt: "Picture of a refill" } })).toEqual([
      expect.objectContaining({ code: "alt_redundant", severity: "soft", path: ["post", "imageAlt"] }),
    ]);
    expect(checkAltText(hydrotrailLandingSpec)).toEqual([]);
    expect(checkAltText(hydrotrailBrandKit)).toEqual([]);
  });
});

describe("checkLandingSpec", () => {
  it("passes HydroTrail clean", () => {
    expect(checkLandingSpec(hydrotrailLandingSpec)).toEqual([]);
  });

  it("flags a missing waitlist", () => {
    const rest: Record<string, unknown> = { ...hydrotrailLandingSpec };
    delete rest.waitlist;
    expect(checkLandingSpec(rest as unknown as LandingSpec)).toContainEqual(hit("waitlist_missing", "hard"));
  });
});

describe("layouts against the brand kit's direction", () => {
  it("passes HydroTrail's spec and kit", () => {
    expect(checkLandingLayouts(hydrotrailLandingSpec, hydrotrailBrandKit)).toEqual([]);
  });

  it("flags a layout the direction forbids, once per section", () => {
    const spec = withHero({ layout: "type_led" });
    const issues = checkLandingLayouts(spec, hydrotrailBrandKit);
    expect(issues).toEqual([expect.objectContaining({ code: "layout_not_allowed", severity: "hard", path: ["hero", "layout"] })]);
  });

  it("follows the kit's direction", () => {
    const editorial: BrandKit = { ...hydrotrailBrandKit, visualSystem: { ...hydrotrailBrandKit.visualSystem, direction: "editorial" } };
    const issues = checkLandingLayouts(hydrotrailLandingSpec, editorial);
    expect(issues.map((found) => found.path)).toEqual(expect.arrayContaining([["app_preview", "layout"], ["waitlist", "layout"]]));
    expect(issues.every((found) => found.code === "layout_not_allowed" && found.severity === "hard")).toBe(true);
  });
});

describe("brand kit", () => {
  const withPalette = (patch: Partial<BrandKit["palette"]>): BrandKit => ({ ...hydrotrailBrandKit, palette: { ...hydrotrailBrandKit.palette, ...patch } });

  it("passes HydroTrail", () => {
    expect(checkBrandKit(hydrotrailBrandKit)).toEqual([]);
  });

  it("flags every failing text pair with its ratio", () => {
    const kit = withPalette({ ink: { ...hydrotrailBrandKit.palette.ink, hex: "#B8B3A8" } });
    const issues = checkBrandKit(kit);
    expect(issues).toContainEqual(hit("low_contrast", "hard"));
    const first = issues.find((found) => found.code === "low_contrast");
    expect(first).toMatchObject({ severity: "hard", path: ["palette", "ink", "hex"] });
    expect(first?.message).toMatch(/ink text on ground is \d\.\d\d:1; WCAG AA needs 4\.5:1/);
  });

  it("flags a primary that fails on ground", () => {
    const kit = withPalette({ primary: { ...hydrotrailBrandKit.palette.primary, hex: "#9AD0E0" } });
    expect(checkBrandKit(kit)).toContainEqual(expect.objectContaining({ code: "low_contrast", severity: "hard", path: ["palette", "primary", "hex"] }));
  });

  it("does not throw on a malformed hex", () => {
    const kit = withPalette({ ground: { ...hydrotrailBrandKit.palette.ground, hex: "cream" } });
    const issues = checkBrandKit(kit);
    expect(issues).toEqual([expect.objectContaining({ code: "invalid_hex", severity: "hard", path: ["palette", "ground", "hex"] })]);
  });

  it("flags a type pair the direction does not allow", () => {
    const kit: BrandKit = { ...hydrotrailBrandKit, visualSystem: { ...hydrotrailBrandKit.visualSystem, direction: "editorial" } };
    expect(checkBrandKit(kit)).toContainEqual(hit("type_pair_direction", "hard"));
  });

  it("flags a theme mode that contradicts the palette", () => {
    const kit: BrandKit = {
      ...hydrotrailBrandKit,
      visualSystem: { ...hydrotrailBrandKit.visualSystem, theme: { ...hydrotrailBrandKit.visualSystem.theme, mode: "dark" } },
    };
    expect(checkBrandKit(kit)).toContainEqual(hit("theme_mode_mismatch", "hard"));
  });
});
