import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  ARTIFACT_KINDS,
  BRAND_TEXT_PAIRS,
  LANDING_SECTION_ORDER,
  LIMITS,
  PLATFORM_CAPTION_LIMITS,
  SOCIAL_PLATFORMS,
  adsDraftsSchema,
  artifactJsonSchema,
  artifactSchemas,
  blueprintIsValidated,
  blueprintSchema,
  blueprintVariantSchemas,
  brandKitSchema,
  buildPackPrompts,
  buildPackSchema,
  buildPackVariantSchemas,
  captionFor,
  contrastRatio,
  emailSequenceSchema,
  emailsInOrder,
  failingTextPairs,
  isSafeHttpsUrl,
  isSafeMarkdown,
  landingHasWaitlist,
  landingSections,
  landingSpecSchema,
  launchPlanSchema,
  parseArtifact,
  promptCopyText,
  rosterPlanSchema,
  seoPackSchema,
  socialPackSchema,
  socialPostsInOrder,
  structuredOutputComplexity,
  toStructuredOutputSchema,
} from "@/lib/workspace/contracts/artifacts";
import type { JsonSchema } from "@/lib/workspace/contracts/artifacts";
import {
  hydrotrailAdsDrafts,
  hydrotrailArtifacts,
  hydrotrailBlueprint,
  hydrotrailBrandKit,
  hydrotrailBuildPack,
  hydrotrailEmailSequence,
  hydrotrailLandingSpec,
  hydrotrailLaunchPlan,
  hydrotrailRosterPlan,
  hydrotrailSeoPack,
  hydrotrailSocialPack,
  lightBuildPack,
  ownIdeaLightBlueprint,
} from "@/lib/workspace/contracts/fixtures/hydrotrail";
import { lintPrompts } from "../../scripts/lib/prompt-standard.mjs";

/** A deep, mutable copy of a fixture for building invalid cases. */
function mutate<T>(value: T, change: (draft: T) => void): unknown {
  const draft = structuredClone(value);
  change(draft);
  return draft;
}

const over = (max: number) => "x".repeat(max + 1);

type ParseResult = { success: boolean; error?: { issues: readonly { path: readonly PropertyKey[]; message: string }[] } };

/** Asserts the parse fails with an issue at (or under) `path`. */
function expectIssueAt(result: ParseResult, path: readonly PropertyKey[]): void {
  expect(result.success).toBe(false);
  const paths = (result.error?.issues ?? []).map((issue) => issue.path);
  const hit = paths.some((issuePath) => path.every((part, index) => issuePath[index] === part));
  expect(hit, `no issue at ${JSON.stringify(path)}; got ${JSON.stringify(paths)}`).toBe(true);
}

// ---------------------------------------------------------------------------
// JSON Schema helpers for the size and boundedness checks.
// ---------------------------------------------------------------------------

type JsonValue = JsonSchema[string];
const isNode = (value: JsonValue | undefined): value is JsonSchema =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function rawJsonSchema(schema: z.ZodType): JsonSchema {
  const converted: JsonValue = JSON.parse(JSON.stringify(z.toJSONSchema(schema)));
  if (!isNode(converted)) throw new TypeError("expected an object schema");
  return converted;
}

const byteLength = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

/** The largest JSON value a schema allows: every string at maxLength, every array at maxItems, every optional present. */
function maximal(node: JsonSchema, char: string): unknown {
  if (node.const !== undefined) return node.const;
  if (Array.isArray(node.enum)) {
    return node.enum.reduce((a, b) => (JSON.stringify(b).length > JSON.stringify(a).length ? b : a));
  }
  const branches = node.anyOf ?? node.oneOf;
  if (Array.isArray(branches)) {
    return branches
      .filter(isNode)
      .map((branch) => maximal(branch, char))
      .reduce((a, b) => (byteLength(b) > byteLength(a) ? b : a));
  }
  switch (node.type) {
    case "object": {
      const out: Record<string, unknown> = {};
      const properties = node.properties;
      if (isNode(properties)) {
        for (const [key, child] of Object.entries(properties)) if (isNode(child)) out[key] = maximal(child, char);
      }
      return out;
    }
    case "array": {
      const count = typeof node.maxItems === "number" ? node.maxItems : 0;
      return isNode(node.items) ? Array.from({ length: count }, () => maximal(node.items as JsonSchema, char)) : [];
    }
    case "string":
      return char.repeat(typeof node.maxLength === "number" ? node.maxLength : 0);
    case "integer":
    case "number":
      return typeof node.maximum === "number" ? node.maximum : Number.MAX_SAFE_INTEGER;
    case "boolean":
      return true;
    default:
      return null;
  }
}

/** Paths of strings without maxLength (and not const/enum) and arrays without maxItems. */
function unbounded(node: JsonValue, path: string, found: string[]): string[] {
  if (Array.isArray(node)) {
    node.forEach((child, index) => unbounded(child, `${path}[${index}]`, found));
    return found;
  }
  if (!isNode(node)) return found;
  if (node.type === "string" && node.const === undefined && node.enum === undefined && typeof node.maxLength !== "number") {
    found.push(path);
  }
  if (node.type === "array" && typeof node.maxItems !== "number") found.push(path);
  for (const [key, child] of Object.entries(node)) unbounded(child, `${path}.${key}`, found);
  return found;
}

function containsKey(node: JsonValue, key: string): boolean {
  if (Array.isArray(node)) return node.some((child) => containsKey(child, key));
  if (!isNode(node)) return false;
  return Object.entries(node).some(([k, child]) => k === key || containsKey(child, key));
}

// ---------------------------------------------------------------------------

describe("C-ART registry", () => {
  it("has a schema for every artifact kind", () => {
    expect(Object.keys(artifactSchemas).sort()).toEqual([...ARTIFACT_KINDS].sort());
  });

  it.each(ARTIFACT_KINDS)("HydroTrail %s fixture parses and round-trips", (kind) => {
    const fixture = hydrotrailArtifacts[kind];
    const result = parseArtifact(kind, fixture);
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    expect(result.data).toEqual(fixture);
  });

  it("rejects an artifact parsed as the wrong kind", () => {
    expect(parseArtifact("brand_kit", hydrotrailBlueprint).success).toBe(false);
  });

  it.each(ARTIFACT_KINDS)("%s requires schemaVersion 1", (kind) => {
    const fixture = { ...hydrotrailArtifacts[kind], schemaVersion: 2 };
    expect(parseArtifact(kind, fixture).success).toBe(false);
  });

  it("re-exports the roster plan schema", () => {
    expect(rosterPlanSchema.safeParse(hydrotrailRosterPlan).success).toBe(true);
  });
});

describe("structured-output JSON Schema", () => {
  it.each(ARTIFACT_KINDS)("%s converts with no oneOf and no unhonoured keywords", (kind) => {
    const schema = artifactJsonSchema(kind);
    for (const keyword of ["oneOf", "minLength", "maxLength", "maxItems", "minimum", "maximum", "multipleOf", "$schema"]) {
      expect(containsKey(schema, keyword), `${kind} still has ${keyword}`).toBe(false);
    }
    expect(JSON.stringify(schema)).not.toContain('"minItems":2');
    expect(JSON.stringify(schema)).not.toContain("\\p{");
  });

  it("carries limits in descriptions", () => {
    const schema = JSON.stringify(artifactJsonSchema("seo_pack"));
    expect(schema).toContain(`≤ ${LIMITS.seoPack.title} characters`);
  });

  it.each(ARTIFACT_KINDS)("%s stays within the per-request complexity limits", (kind) => {
    const { optionalParams, unionParams } = structuredOutputComplexity(artifactJsonSchema(kind));
    expect(optionalParams).toBeLessThanOrEqual(24);
    expect(unionParams).toBeLessThanOrEqual(16);
  });

  it("converts the single-variant schemas the gateway can ask for", () => {
    for (const schema of [...Object.values(blueprintVariantSchemas), ...Object.values(buildPackVariantSchemas)]) {
      const converted = toStructuredOutputSchema(schema);
      expect(converted.type).toBe("object");
      expect(converted.additionalProperties).toBe(false);
    }
  });

  it.each(ARTIFACT_KINDS)("%s bounds every string and array", (kind) => {
    expect(unbounded(rawJsonSchema(artifactSchemas[kind]), kind, [])).toEqual([]);
  });

  it.each(ARTIFACT_KINDS)("a maximal %s stays under 262,144 bytes of JSON (ASCII and CJK)", (kind) => {
    const schema = rawJsonSchema(artifactSchemas[kind]);
    for (const char of ["x", "水"]) {
      expect(byteLength(maximal(schema, char))).toBeLessThan(262_144);
    }
  });
});

describe("Blueprint", () => {
  it("accepts a light own-idea blueprint, labelled not validated", () => {
    expect(blueprintSchema.safeParse(ownIdeaLightBlueprint).success).toBe(true);
    expect(blueprintIsValidated(ownIdeaLightBlueprint)).toBe(false);
    expect(blueprintIsValidated(hydrotrailBlueprint)).toBe(true);
  });

  it("rejects an own-idea blueprint with market data", () => {
    const bad = { ...ownIdeaLightBlueprint, market: hydrotrailBlueprint.source === "library" ? hydrotrailBlueprint.market : undefined };
    expect(blueprintSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an own-idea blueprint with an ideaSlug", () => {
    expect(blueprintSchema.safeParse({ ...ownIdeaLightBlueprint, ideaSlug: "hydrotrail" }).success).toBe(false);
  });

  it("rejects the dropped validated field and keyword numbers in market", () => {
    const validated = { ...hydrotrailBlueprint, validated: true };
    const keywordVolume = mutate(hydrotrailBlueprint, (draft) => {
      if (draft.source === "library" && draft.market) Object.assign(draft.market, { keywordVolume: 12000 });
    });
    expect(blueprintSchema.safeParse(validated).success).toBe(false);
    expect(blueprintSchema.safeParse(keywordVolume).success).toBe(false);
  });

  it("rejects fewer than 3 features and a library blueprint without a slug", () => {
    const fewFeatures = mutate(hydrotrailBlueprint, (draft) => {
      draft.features = draft.features.slice(0, 2);
    });
    const noSlug = mutate(hydrotrailBlueprint, (draft) => {
      Reflect.deleteProperty(draft, "ideaSlug");
    });
    expect(blueprintSchema.safeParse(fewFeatures).success).toBe(false);
    expect(blueprintSchema.safeParse(noSlug).success).toBe(false);
  });
});

describe("BrandKit", () => {
  it("rejects an emphasis that is not the closing words of the tagline", () => {
    const missing = mutate(hydrotrailBrandKit, (draft) => {
      draft.tagline.emphasis = "hungry.";
    });
    const notAtEnd = mutate(hydrotrailBrandKit, (draft) => {
      draft.tagline.emphasis = "Drink";
    });
    expectIssueAt(brandKitSchema.safeParse(missing), ["tagline", "emphasis"]);
    expectIssueAt(brandKitSchema.safeParse(notAtEnd), ["tagline", "emphasis"]);
  });

  it("rejects a palette missing a role or with an extra one", () => {
    const missing = mutate(hydrotrailBrandKit, (draft) => {
      Reflect.deleteProperty(draft.palette, "ink");
    });
    const extra = mutate(hydrotrailBrandKit, (draft) => {
      Object.assign(draft.palette, { highlight: draft.palette.accent });
    });
    expect(brandKitSchema.safeParse(missing).success).toBe(false);
    expect(brandKitSchema.safeParse(extra).success).toBe(false);
  });

  it("rejects a non-hex colour and a missing hero alt", () => {
    const notHex = mutate(hydrotrailBrandKit, (draft) => {
      draft.palette.primary.hex = "rgb(31, 78, 95)";
    });
    const noAlt = mutate(hydrotrailBrandKit, (draft) => {
      Reflect.deleteProperty(draft.heroArt, "alt");
    });
    expect(brandKitSchema.safeParse(notHex).success).toBe(false);
    expect(brandKitSchema.safeParse(noAlt).success).toBe(false);
  });

  it("rejects an over-limit tagline and a multi-line name", () => {
    const longTagline = mutate(hydrotrailBrandKit, (draft) => {
      draft.tagline = { text: over(LIMITS.brandKit.tagline) };
    });
    const twoLines = mutate(hydrotrailBrandKit, (draft) => {
      draft.name = "Hydro\nTrail";
    });
    expect(brandKitSchema.safeParse(longTagline).success).toBe(false);
    expect(brandKitSchema.safeParse(twoLines).success).toBe(false);
  });
});

describe("contrast", () => {
  it("passes Basalt on Granite and fails Ember on Granite", () => {
    expect(contrastRatio("#13242A", "#F2EEE6")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#E07B2E", "#F2EEE6")).toBeLessThan(4.5);
  });

  it("is symmetric, 21 for black on white, and rejects bad input", () => {
    expect(contrastRatio("#F2EEE6", "#E07B2E")).toBeCloseTo(contrastRatio("#E07B2E", "#F2EEE6"));
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21);
    expect(() => contrastRatio("#fff", "#000000")).toThrow(RangeError);
  });

  it("the HydroTrail kit passes every text pair, and accent is never text", () => {
    expect(failingTextPairs(hydrotrailBrandKit)).toEqual([]);
    const textRoles: string[] = BRAND_TEXT_PAIRS.map((pair) => pair.text);
    expect(textRoles).not.toContain("accent");
  });

  it("reports a failing pair", () => {
    const kit = mutate(hydrotrailBrandKit, (draft) => {
      draft.palette.primary.hex = "#8CC2D3";
    });
    const parsed = brandKitSchema.parse(kit);
    expect(failingTextPairs(parsed).map((pair) => `${pair.text}/${pair.background}`)).toEqual([
      "primary/ground",
      "ground/primary",
    ]);
  });
});

describe("LandingSpec", () => {
  it("has a waitlist and renders slots in order", () => {
    expect(landingHasWaitlist(hydrotrailLandingSpec)).toBe(true);
    expect(landingSections(hydrotrailLandingSpec)).toEqual([...LANDING_SECTION_ORDER]);
  });

  it("rejects a spec without a waitlist", () => {
    const bad = mutate(hydrotrailLandingSpec, (draft) => {
      Reflect.deleteProperty(draft, "waitlist");
    });
    expectIssueAt(landingSpecSchema.safeParse(bad), ["waitlist"]);
  });

  it("rejects a non-placeholder testimonial and the old proof field", () => {
    const notPlaceholder = {
      ...hydrotrailLandingSpec,
      proofSlots: [{ kind: "testimonial", placeholder: false, quote: "[Quote]", attribution: "[Name]" }],
    };
    const oldField = { ...hydrotrailLandingSpec, proof: [] };
    expectIssueAt(landingSpecSchema.safeParse(notPlaceholder), ["proofSlots", 0]);
    expect(landingSpecSchema.safeParse(oldField).success).toBe(false);
  });

  it("accepts bracketed placeholder proof slots, including a rating", () => {
    const ok = {
      ...hydrotrailLandingSpec,
      proofSlots: [
        { kind: "testimonial", placeholder: true, quote: "[Quote from a beta hiker]", attribution: "[Name, trail]" },
        { kind: "stat", placeholder: true, value: "[N]", label: "hikers on the waitlist" },
        { kind: "rating", placeholder: true, value: "[4.8]", label: "average rating from beta hikers" },
        { kind: "logo", placeholder: true, name: "[Club name]", alt: "Logo of a hiking club" },
        { kind: "press", placeholder: true, outlet: "[Outlet]" },
      ],
    };
    const result = landingSpecSchema.safeParse(ok);
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
  });

  it('rejects the "12,000+" stat and an unbracketed quote', () => {
    const stat = {
      ...hydrotrailLandingSpec,
      proofSlots: [{ kind: "stat", placeholder: true, value: "12,000+", label: "hikers on the waitlist" }],
    };
    const quote = {
      ...hydrotrailLandingSpec,
      proofSlots: [{ kind: "testimonial", placeholder: true, quote: "Saved my hike.", attribution: "[Name]" }],
    };
    expectIssueAt(landingSpecSchema.safeParse(stat), ["proofSlots", 0, "value"]);
    expectIssueAt(landingSpecSchema.safeParse(quote), ["proofSlots", 0, "quote"]);
  });

  it("rejects promises that are not exactly 3 and an over-limit headline", () => {
    const fourPromises = mutate(hydrotrailLandingSpec, (draft) => {
      const first = draft.promises?.items[0];
      if (draft.promises && first) draft.promises.items.push(first);
    });
    const longHeadline = mutate(hydrotrailLandingSpec, (draft) => {
      draft.hero.headline = { text: over(LIMITS.landingSpec.headline) };
    });
    expect(landingSpecSchema.safeParse(fourPromises).success).toBe(false);
    expect(landingSpecSchema.safeParse(longHeadline).success).toBe(false);
  });

  it("rejects a hero headline emphasis that is not its closing words", () => {
    const bad = mutate(hydrotrailLandingSpec, (draft) => {
      draft.hero.headline.emphasis = "Know your water.";
    });
    expectIssueAt(landingSpecSchema.safeParse(bad), ["hero", "headline", "emphasis"]);
  });

  it("rejects a CTA to an http URL or an anchor no section has", () => {
    const http = mutate(hydrotrailLandingSpec, (draft) => {
      draft.nav.cta.target = "http://example.com";
    });
    const deadAnchor = mutate(hydrotrailLandingSpec, (draft) => {
      draft.nav.cta.target = "#pricing";
    });
    const missingSection = mutate(hydrotrailLandingSpec, (draft) => {
      Reflect.deleteProperty(draft, "app_preview");
    });
    expect(landingSpecSchema.safeParse(http).success).toBe(false);
    expectIssueAt(landingSpecSchema.safeParse(deadAnchor), ["nav", "cta", "target"]);
    expectIssueAt(landingSpecSchema.safeParse(missingSection), ["nav", "links", 1, "target"]);
  });

  it("rejects an added section without its reason and a reason on a non-added section", () => {
    const noReason = mutate(hydrotrailLandingSpec, (draft) => {
      Reflect.deleteProperty(draft.waitlist, "addedReason");
    });
    const reasonNotAdded = mutate(hydrotrailLandingSpec, (draft) => {
      if (draft.app_preview) draft.app_preview.addedByWeekendMvp = false;
    });
    expectIssueAt(landingSpecSchema.safeParse(noReason), ["waitlist", "addedReason"]);
    expectIssueAt(landingSpecSchema.safeParse(reasonNotAdded), ["app_preview", "addedReason"]);
  });

  it("rejects platform-owned privacy fields and an unknown key", () => {
    const privacy = mutate(hydrotrailLandingSpec, (draft) => {
      Object.assign(draft.waitlist, { privacyLine: "One email a week at most." });
    });
    const unknownKey = { ...hydrotrailLandingSpec, theme: "dark" };
    expect(landingSpecSchema.safeParse(privacy).success).toBe(false);
    expect(landingSpecSchema.safeParse(unknownKey).success).toBe(false);
  });

  it("rejects a success message with another merge tag or no confirm step", () => {
    const otherTag = mutate(hydrotrailLandingSpec, (draft) => {
      draft.waitlist.successMessage = "Check {email} and confirm, {first name}.";
    });
    const noConfirm = mutate(hydrotrailLandingSpec, (draft) => {
      draft.waitlist.successMessage = "You're on the list. Watch {email} for your invite.";
    });
    expectIssueAt(landingSpecSchema.safeParse(otherTag), ["waitlist", "successMessage"]);
    expectIssueAt(landingSpecSchema.safeParse(noConfirm), ["waitlist", "successMessage"]);
  });
});

describe("URL safety", () => {
  it("accepts a plain https URL", () => {
    expect(isSafeHttpsUrl("https://hydrotrail.weekendmvp.app/blog?x=1")).toBe(true);
  });

  it.each([
    ["userinfo", "https://user:pw@example.com/"],
    ["NUL", "https://example.com/\u0000x"],
    ["bidi override", "https://example.com/‮gnp.exe"],
    ["IPv4 literal", "https://127.0.0.1/"],
    ["IPv6 literal", "https://[::1]/"],
    ["http", "http://example.com/"],
    ["no dot", "https://localhost/"],
  ])("rejects %s", (_label, url) => {
    expect(isSafeHttpsUrl(url)).toBe(false);
    const spec = mutate(hydrotrailLandingSpec, (draft) => {
      draft.footer.cta.target = url;
    });
    expectIssueAt(landingSpecSchema.safeParse(spec), ["footer", "cta", "target"]);
  });
});

describe("Markdown safety", () => {
  it("accepts https and relative links", () => {
    expect(isSafeMarkdown("See [the guide](/blog/water) and ![map](https://example.com/map.png).")).toBe(true);
  });

  it.each([
    ["raw HTML", "Hello <script>alert(1)</script>"],
    ["closing tag", "text </div>"],
    ["comment", "<!-- hidden -->"],
    ["processing instruction", "<?php ?>"],
    ["autolink", "<https://example.com>"],
    ["javascript link", "[x](javascript:alert(1))"],
    ["entity-encoded scheme", "[x](javascript&#58;alert(1))"],
    ["escaped scheme", "[x](javascript\\:alert(1))"],
    ["protocol-relative", "[x](//evil.example)"],
    ["http image", "![x](http://example.com/a.png)"],
    ["reference definition", "[x]: data:text/html;base64,AAAA"],
  ])("rejects %s", (_label, markdown) => {
    expect(isSafeMarkdown(markdown)).toBe(false);
  });

  it("applies to the article body and productMd, not prompt bodies", () => {
    const article = mutate(hydrotrailSeoPack, (draft) => {
      draft.article.bodyMarkdown = "# Title\n\n<img src=x onerror=alert(1)>";
    });
    const productMd = mutate(hydrotrailBuildPack, (draft) => {
      if (draft.weight === "full") draft.productMd = "[x](javascript:alert(1))";
    });
    const promptBody = mutate(hydrotrailBuildPack, (draft) => {
      if (draft.weight === "full") draft.phases.ship.prompts.second.body = "Render <App /> and deploy.";
    });
    expectIssueAt(seoPackSchema.safeParse(article), ["article", "bodyMarkdown"]);
    expectIssueAt(buildPackSchema.safeParse(productMd), ["productMd"]);
    expect(buildPackSchema.safeParse(promptBody).success).toBe(true);
  });
});

describe("EmailSequence", () => {
  it("lists the four emails in send order", () => {
    expect(emailsInOrder(hydrotrailEmailSequence).map(({ kind }) => kind)).toEqual([
      "welcome",
      "value",
      "offer",
      "follow_up",
    ]);
  });

  it("rejects an email body with {last name}", () => {
    const bad = mutate(hydrotrailEmailSequence, (draft) => {
      draft.emails.welcome.body = "Hi {first name} {last name}, thanks for joining.";
    });
    expectIssueAt(emailSequenceSchema.safeParse(bad), ["emails", "welcome", "body"]);
  });

  it("rejects a URL in a body and an unknown CTA target", () => {
    const url = mutate(hydrotrailEmailSequence, (draft) => {
      draft.emails.offer.body = "Hi {first name}, sign in at https://hydrotrail.weekendmvp.app today.";
    });
    const bareDomain = mutate(hydrotrailEmailSequence, (draft) => {
      draft.emails.offer.body = "Hi {first name}, sign in at hydrotrail.app today.";
    });
    const badTarget = mutate(hydrotrailEmailSequence, (draft) => {
      Object.assign(draft.emails.offer, { cta: { label: "Go", target: "https://example.com" } });
    });
    expectIssueAt(emailSequenceSchema.safeParse(url), ["emails", "offer", "body"]);
    expectIssueAt(emailSequenceSchema.safeParse(bareDomain), ["emails", "offer", "body"]);
    expect(emailSequenceSchema.safeParse(badTarget).success).toBe(false);
  });

  it("rejects a missing email, a delayed welcome and an undelayed follow-up", () => {
    const missing = mutate(hydrotrailEmailSequence, (draft) => {
      Reflect.deleteProperty(draft.emails, "offer");
    });
    const delayedWelcome = mutate(hydrotrailEmailSequence, (draft) => {
      Object.assign(draft.emails.welcome, { delayHours: 1 });
    });
    const noDelay = mutate(hydrotrailEmailSequence, (draft) => {
      draft.emails.follow_up.delayHours = 0;
    });
    expect(emailSequenceSchema.safeParse(missing).success).toBe(false);
    expect(emailSequenceSchema.safeParse(delayedWelcome).success).toBe(false);
    expect(emailSequenceSchema.safeParse(noDelay).success).toBe(false);
  });

  it("rejects an over-limit or multi-line subject and a sender address field", () => {
    const longSubject = mutate(hydrotrailEmailSequence, (draft) => {
      draft.emails.welcome.subject = over(LIMITS.emailSequence.subject);
    });
    const twoLines = mutate(hydrotrailEmailSequence, (draft) => {
      draft.emails.welcome.subject = "Welcome\nto HydroTrail";
    });
    const senderAddress = { ...hydrotrailEmailSequence, senderAddress: "team@hydrotrail.weekendmvp.app" };
    expect(emailSequenceSchema.safeParse(longSubject).success).toBe(false);
    expect(emailSequenceSchema.safeParse(twoLines).success).toBe(false);
    expect(emailSequenceSchema.safeParse(senderAddress).success).toBe(false);
  });

  it("rejects control characters in a body but keeps newlines and tabs", () => {
    const bell = mutate(hydrotrailEmailSequence, (draft) => {
      draft.emails.value.body = "Hi {first name},\n\tthanks\u0007";
    });
    expectIssueAt(emailSequenceSchema.safeParse(bell), ["emails", "value", "body"]);
  });
});

describe("SocialPack", () => {
  it("orders posts Friday to Thursday", () => {
    expect(socialPostsInOrder(hydrotrailSocialPack).map(({ day }) => day)).toEqual([
      "fri",
      "sat",
      "sun",
      "mon",
      "tue",
      "wed",
      "thu",
    ]);
  });

  it("rejects a missing day and the dropped dayOffset", () => {
    const missingDay = mutate(hydrotrailSocialPack, (draft) => {
      Reflect.deleteProperty(draft.posts, "thu");
    });
    const dayOffset = mutate(hydrotrailSocialPack, (draft) => {
      Object.assign(draft.posts.fri, { dayOffset: 0 });
    });
    expect(socialPackSchema.safeParse(missingDay).success).toBe(false);
    expect(socialPackSchema.safeParse(dayOffset).success).toBe(false);
  });

  it("rejects a poll without options and options on a non-poll", () => {
    const pollNoOptions = mutate(hydrotrailSocialPack, (draft) => {
      Reflect.deleteProperty(draft.posts.mon, "pollOptions");
    });
    const optionsOnImage = mutate(hydrotrailSocialPack, (draft) => {
      draft.posts.fri.pollOptions = ["Yes", "No"];
    });
    expectIssueAt(socialPackSchema.safeParse(pollNoOptions), ["posts", "mon", "pollOptions"]);
    expectIssueAt(socialPackSchema.safeParse(optionsOnImage), ["posts", "fri", "pollOptions"]);
  });

  it("rejects an over-limit caption or short caption and a state field", () => {
    const longCaption = mutate(hydrotrailSocialPack, (draft) => {
      draft.posts.fri.caption = over(LIMITS.socialPack.caption);
    });
    const longShort = mutate(hydrotrailSocialPack, (draft) => {
      draft.posts.fri.shortCaption = over(LIMITS.socialPack.shortCaption);
    });
    const withState = mutate(hydrotrailSocialPack, (draft) => {
      Object.assign(draft.posts.fri, { state: "draft" });
    });
    expect(socialPackSchema.safeParse(longCaption).success).toBe(false);
    expect(socialPackSchema.safeParse(longShort).success).toBe(false);
    expect(socialPackSchema.safeParse(withState).success).toBe(false);
  });

  it("rejects # in a hashtag and duplicate hashtags, and accepts Unicode tags", () => {
    const hashPrefix = mutate(hydrotrailSocialPack, (draft) => {
      draft.posts.fri.hashtags = ["#hiking"];
    });
    const duplicate = mutate(hydrotrailSocialPack, (draft) => {
      draft.posts.fri.hashtags = ["hiking", "Hiking"];
    });
    const unicode = mutate(hydrotrailSocialPack, (draft) => {
      draft.posts.fri.hashtags = ["wandern", "登山", "randonnée_été"];
    });
    expectIssueAt(socialPackSchema.safeParse(hashPrefix), ["posts", "fri", "hashtags", 0]);
    expectIssueAt(socialPackSchema.safeParse(duplicate), ["posts", "fri", "hashtags", 1]);
    expect(socialPackSchema.safeParse(unicode).success).toBe(true);
  });

  it("picks the short caption only where the full one is too long", () => {
    const post = { caption: "a".repeat(400), shortCaption: "short" };
    expect(captionFor(post, "instagram")).toBe(post.caption);
    expect(captionFor(post, "x")).toBe("short");
    expect(captionFor(post, "threads")).toBe(post.caption);
    expect(Object.keys(PLATFORM_CAPTION_LIMITS).sort()).toEqual([...SOCIAL_PLATFORMS].sort());
    for (const platform of SOCIAL_PLATFORMS) {
      expect(PLATFORM_CAPTION_LIMITS[platform]).toBeGreaterThanOrEqual(LIMITS.socialPack.shortCaption);
    }
  });
});

describe("SeoPack", () => {
  it("rejects a 61-character title and a 161-character meta description", () => {
    const longTitle = mutate(hydrotrailSeoPack, (draft) => {
      const [first] = draft.pages;
      if (first) first.title = over(LIMITS.seoPack.title);
    });
    const longMeta = mutate(hydrotrailSeoPack, (draft) => {
      const [first] = draft.pages;
      if (first) first.metaDescription = over(LIMITS.seoPack.metaDescription);
    });
    expect(seoPackSchema.safeParse(longTitle).success).toBe(false);
    expect(seoPackSchema.safeParse(longMeta).success).toBe(false);
  });

  it("rejects keyword numbers: objects instead of strings", () => {
    const bad = { ...hydrotrailSeoPack, keywordsTargeted: [{ keyword: "hiking water", volume: 2400, cpc: 1.2 }] };
    expect(seoPackSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects duplicate page paths and duplicate keywords", () => {
    const duplicatePath = mutate(hydrotrailSeoPack, (draft) => {
      const [first, second] = draft.pages;
      if (first && second) second.path = first.path;
    });
    const duplicateKeyword = mutate(hydrotrailSeoPack, (draft) => {
      draft.keywordsTargeted = ["hiking water", "Hiking Water"];
    });
    expectIssueAt(seoPackSchema.safeParse(duplicatePath), ["pages", 1, "path"]);
    expectIssueAt(seoPackSchema.safeParse(duplicateKeyword), ["keywordsTargeted", 1]);
  });
});

describe("LaunchPlan", () => {
  it("rejects 3 items and a status field", () => {
    const three = mutate(hydrotrailLaunchPlan, (draft) => {
      draft.items = draft.items.slice(0, 3);
    });
    const withStatus = mutate(hydrotrailLaunchPlan, (draft) => {
      const [first] = draft.items;
      if (first) Object.assign(first, { status: "live" });
    });
    expect(launchPlanSchema.safeParse(three).success).toBe(false);
    expect(launchPlanSchema.safeParse(withStatus).success).toBe(false);
  });

  it("rejects an unknown role, a duplicate key and a duplicate day and order", () => {
    const unknownRole = mutate(hydrotrailLaunchPlan, (draft) => {
      const [first] = draft.items;
      if (first) Object.assign(first, { owner: { kind: "employee", roleKey: "designer" } });
    });
    const duplicateKey = mutate(hydrotrailLaunchPlan, (draft) => {
      const [first, second] = draft.items;
      if (first && second) second.key = first.key;
    });
    const duplicateOrder = mutate(hydrotrailLaunchPlan, (draft) => {
      const [first, second] = draft.items;
      if (first && second) second.order = first.order;
    });
    expect(launchPlanSchema.safeParse(unknownRole).success).toBe(false);
    expectIssueAt(launchPlanSchema.safeParse(duplicateKey), ["items", 1, "key"]);
    expectIssueAt(launchPlanSchema.safeParse(duplicateOrder), ["items", 1, "order"]);
  });

  it("rejects the old page link and an unknown workspace page", () => {
    const oldPage = mutate(hydrotrailLaunchPlan, (draft) => {
      const [first] = draft.items;
      if (first) Object.assign(first, { link: { page: "/" } });
    });
    const unknownWorkspace = mutate(hydrotrailLaunchPlan, (draft) => {
      const [first] = draft.items;
      if (first) Object.assign(first, { link: { workspace: "billing" } });
    });
    expect(launchPlanSchema.safeParse(oldPage).success).toBe(false);
    expect(launchPlanSchema.safeParse(unknownWorkspace).success).toBe(false);
  });
});

describe("AdsDrafts", () => {
  it("rejects a lifetime cap above budget × window and below one day", () => {
    const above = mutate(hydrotrailAdsDrafts, (draft) => {
      draft.campaign.lifetimeCapCents = 700 * 14 + 1;
    });
    const below = mutate(hydrotrailAdsDrafts, (draft) => {
      draft.campaign.lifetimeCapCents = 699;
    });
    expectIssueAt(adsDraftsSchema.safeParse(above), ["campaign", "lifetimeCapCents"]);
    expectIssueAt(adsDraftsSchema.safeParse(below), ["campaign", "lifetimeCapCents"]);
  });

  it("rejects ageMin above ageMax and a currency other than USD", () => {
    const ages = mutate(hydrotrailAdsDrafts, (draft) => {
      draft.campaign.audience.ageMin = 55;
    });
    const currency = mutate(hydrotrailAdsDrafts, (draft) => {
      Object.assign(draft.campaign, { currency: "EUR" });
    });
    expectIssueAt(adsDraftsSchema.safeParse(ages), ["campaign", "audience", "ageMin"]);
    expect(adsDraftsSchema.safeParse(currency).success).toBe(false);
  });

  it("rejects a budget over $100/day, a fractional cent and a 6-day window", () => {
    const highBudget = mutate(hydrotrailAdsDrafts, (draft) => {
      draft.campaign.dailyBudgetCents = LIMITS.adsDrafts.dailyBudgetCentsMax + 100;
    });
    const fraction = mutate(hydrotrailAdsDrafts, (draft) => {
      draft.campaign.dailyBudgetCents = 700.5;
    });
    const shortWindow = mutate(hydrotrailAdsDrafts, (draft) => {
      draft.campaign.learningWindowDays = 6;
      draft.campaign.lifetimeCapCents = 4200;
    });
    expect(adsDraftsSchema.safeParse(highBudget).success).toBe(false);
    expect(adsDraftsSchema.safeParse(fraction).success).toBe(false);
    expect(adsDraftsSchema.safeParse(shortWindow).success).toBe(false);
  });

  it("rejects 4 creatives and an unsupported platform", () => {
    const four = mutate(hydrotrailAdsDrafts, (draft) => {
      const [first] = draft.creatives;
      if (first) draft.creatives = [first, first, first, first];
    });
    const tiktok = mutate(hydrotrailAdsDrafts, (draft) => {
      Object.assign(draft.campaign, { platforms: ["tiktok"] });
    });
    expect(adsDraftsSchema.safeParse(four).success).toBe(false);
    expect(adsDraftsSchema.safeParse(tiktok).success).toBe(false);
  });
});

describe("BuildPack", () => {
  it("flattens a full pack to 8 numbered prompts with derived phases", () => {
    const prompts = buildPackPrompts(hydrotrailBuildPack);
    expect(prompts.map((p) => p.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(prompts.map((p) => p.phase?.key)).toEqual([
      "discovery",
      "discovery",
      "scaffold",
      "scaffold",
      "core_loops",
      "core_loops",
      "ship",
      "ship",
    ]);
    expect(prompts[2]?.phase?.when).toBe("sat_morning");
  });

  it("scaffold.first passes the Project Setup rules and every prompt passes the per-prompt rules", () => {
    if (hydrotrailBuildPack.weight !== "full") throw new Error("expected a full pack");
    const setup = promptCopyText(hydrotrailBuildPack.phases.scaffold.prompts.first);
    const blocks = [
      { title: "Project Setup", text: setup },
      ...buildPackPrompts(hydrotrailBuildPack)
        .filter((p) => p.n !== 3)
        .map((p) => ({ title: p.title, text: promptCopyText(p) })),
    ];
    const { errors } = lintPrompts(blocks);
    const relevant = errors.filter(
      (e: { code: string }) => e.code.startsWith("setup") || ["next-pin", "done-when", "fence"].includes(e.code),
    );
    expect(relevant).toEqual([]);
  });

  it("the setup lint catches a Project Setup without tables or with billing", () => {
    if (hydrotrailBuildPack.weight !== "full") throw new Error("expected a full pack");
    const setup = hydrotrailBuildPack.phases.scaffold.prompts.first;
    const noTables = { ...setup, body: setup.body.split("\n").filter((l) => !l.startsWith("- ")).join("\n") };
    const billing = { ...setup, body: `${setup.body}\nAdd Stripe checkout for paid plans.` };
    const codes = (prompt: typeof setup) =>
      lintPrompts([{ title: "Project Setup", text: promptCopyText(prompt) }]).errors.map((e: { code: string }) => e.code);
    expect(codes(noTables)).toContain("setup-tables");
    expect(codes(billing)).toContain("setup-billing");
  });

  it("counts outside services by the build-pack rules", () => {
    const outside = hydrotrailBuildPack.stack.filter((item) => item.outsideService).map((item) => item.label);
    expect(outside).toEqual(["Database and login", "Forecast"]);
  });

  it("accepts a light pack and numbers its prompts", () => {
    expect(buildPackSchema.safeParse(lightBuildPack).success).toBe(true);
    expect(buildPackPrompts(lightBuildPack).map((p) => [p.n, p.phase])).toEqual([[1, null]]);
  });

  it("rejects a full build pack with 7 prompts", () => {
    const bad = mutate(hydrotrailBuildPack, (draft) => {
      if (draft.weight === "full") Reflect.deleteProperty(draft.phases.ship.prompts, "second");
    });
    expectIssueAt(buildPackSchema.safeParse(bad), ["phases", "ship", "prompts", "second"]);
  });

  it("rejects a stack with 4 outside services", () => {
    const bad = mutate(hydrotrailBuildPack, (draft) => {
      draft.stack = [
        ...draft.stack,
        { label: "Email", value: "Resend", outsideService: true },
        { label: "Analytics", value: "PostHog", outsideService: true },
      ];
    });
    expectIssueAt(buildPackSchema.safeParse(bad), ["stack"]);
  });

  it("rejects a missing phase, an echoed n and an empty Done when", () => {
    const missingPhase = mutate(hydrotrailBuildPack, (draft) => {
      if (draft.weight === "full") Reflect.deleteProperty(draft.phases, "scaffold");
    });
    const echoedN = mutate(hydrotrailBuildPack, (draft) => {
      if (draft.weight === "full") Object.assign(draft.phases.discovery.prompts.first, { n: 1 });
    });
    const emptyDoneWhen = mutate(hydrotrailBuildPack, (draft) => {
      if (draft.weight === "full") draft.phases.discovery.prompts.first.doneWhen = "  ";
    });
    expect(buildPackSchema.safeParse(missingPhase).success).toBe(false);
    expect(buildPackSchema.safeParse(echoedN).success).toBe(false);
    expect(buildPackSchema.safeParse(emptyDoneWhen).success).toBe(false);
  });

  it("rejects a light pack with product phases and 4 setup prompts", () => {
    const withPhases = { ...lightBuildPack, phases: {} };
    const fourPrompts = mutate(lightBuildPack, (draft) => {
      if (draft.weight === "light") {
        const [first] = draft.setupPrompts;
        if (first) draft.setupPrompts = [first, first, first, first];
      }
    });
    expect(buildPackSchema.safeParse(withPhases).success).toBe(false);
    expect(buildPackSchema.safeParse(fourPrompts).success).toBe(false);
  });
});

describe("RosterPlan bounds", () => {
  it("rejects a multi-line employee name, a long role label and an empty rulesVersion", () => {
    const multiLine = mutate(hydrotrailRosterPlan, (draft) => {
      const [first] = draft.hired;
      if (first) first.employeeName = "Wren\nSmith";
    });
    const longLabel = mutate(hydrotrailRosterPlan, (draft) => {
      const [first] = draft.skipped;
      if (first) first.roleLabel = over(40);
    });
    const emptyVersion = { ...hydrotrailRosterPlan, rulesVersion: "" };
    expect(rosterPlanSchema.safeParse(multiLine).success).toBe(false);
    expect(rosterPlanSchema.safeParse(longLabel).success).toBe(false);
    expect(rosterPlanSchema.safeParse(emptyVersion).success).toBe(false);
  });
});
