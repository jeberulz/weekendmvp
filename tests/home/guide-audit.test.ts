import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { guideSpec } from "@/app/(marketing)/guides/5-to-9-builder/guide.spec";
import { guideCopy } from "@/app/(marketing)/guides/5-to-9-builder/guideCopy";
import { auditGuide, currencySymbols, offerReaderStrings, publicSpecStrings, receiptAmounts, receiptSources, type AuditInput } from "@/lib/guides/audit";
import { evaluateLive, type LiveSnapshot, type PageState } from "@/lib/guides/audit-live";
import { effectiveStatus, isOfferEnabled, resolvePrice } from "@/lib/guides/offer-live";
import { BUILD_ALONG_GUIDE_CARDS_ENABLED } from "@/lib/live/config";
import { offers, type Offer } from "@/lib/guides/offers";
import { appRouteExists } from "@/lib/guides/routes";
import { requiredSlots } from "@/lib/guides/slots";
import { guideSpecSchema } from "@/lib/guides/spec-schema";

/** A date before the 14 Nov session ended, so the Build-Along offer is open. Fixed so tests do not depend on the clock. */
const BEFORE_EVENT_ENDS = Date.parse("2026-11-10T12:00:00Z");
const AFTER_EVENT_ENDS = Date.parse("2026-11-26T12:00:00Z");

/** Deep copy that keeps function values, which `structuredClone` cannot copy. */
function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => clone(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)])) as T;
  }
  return value;
}
const everythingExists = () => true;

function audit(overrides: Partial<AuditInput> & { spec?: unknown } = {}) {
  return auditGuide({
    spec: clone(guideSpec),
    deck: guideCopy,
    fileExists: everythingExists,
    now: BEFORE_EVENT_ENDS,
    resolvePrice,
    effectiveStatus,
    routeExists: (urlPath) => appRouteExists(path.join(process.cwd(), "app"), urlPath),
    // Tests judge the offer as if its switch were on, so they do not depend on the value in config. The switch has its own tests.
    isOfferEnabled: () => true,
    ...overrides,
  });
}
const rulesOf = (result: ReturnType<typeof audit>) => result.findings.map((finding) => finding.rule);
const errorsOf = (result: ReturnType<typeof audit>) => result.findings.filter((f) => f.severity === "error").map((f) => f.rule);

describe("guide spec schema", () => {
  test("the 5-to-9 spec parses", () => {
    expect(guideSpecSchema.safeParse(guideSpec).success).toBe(true);
  });

  test("a bad slug, path, headline and section id are all rejected", () => {
    const spec = clone(guideSpec) as Record<string, unknown>;
    spec.slug = "Bad Slug";
    spec.path = "/somewhere";
    spec.headline = "No emphasis tail here";
    (spec.sections as { id: string }[])[0].id = "one";
    const paths = auditGuide({ spec, deck: guideCopy, fileExists: everythingExists }).findings.map((f) => f.path);
    expect(paths).toEqual(expect.arrayContaining(["slug", "path", "headline", "sections.0.id"]));
  });
});

describe("static audit", () => {
  test("passes on the real 5-to-9 guide while its offer is open, with one warning for thin offer copy", () => {
    const result = audit();
    expect(result.findings).toEqual([expect.objectContaining({ rule: "offer-thin", severity: "warn" })]);
    expect(result.ok).toBe(true);
  });

  test("fails on the real 5-to-9 guide before ticket sales open", () => {
    const result = audit({ now: Date.parse("2026-10-31T12:00:00Z") });
    expect(result.ok).toBe(false);
    expect(result.findings).toContainEqual(
      expect.objectContaining({ rule: "offer-status", severity: "error", message: expect.stringContaining("SALES_OPEN_AT") }),
    );
  });

  test("fails on the real 5-to-9 guide once the Build-Along session has ended and next-session checkout is off", () => {
    const result = audit({ now: AFTER_EVENT_ENDS });
    expect(result.ok).toBe(false);
    expect(result.findings).toContainEqual(
      expect.objectContaining({ rule: "offer-status", severity: "error", message: expect.stringContaining("NEXT_SESSION_CHECKOUT_ENABLED") }),
    );
  });

  test("a schema failure stops the audit and is reported with its path", () => {
    const spec = clone(guideSpec) as Record<string, unknown>;
    delete spec.hero;
    const result = audit({ spec });
    expect(result.ok).toBe(false);
    expect(rulesOf(result)).toEqual(["schema"]);
    expect(result.findings[0].path).toBe("hero");
  });

  test("section ids must run s01, s02 in order and titles must be unique", () => {
    const spec = clone(guideSpec);
    spec.sections[2].id = "s09";
    spec.sections[3].title = spec.sections[1].title;
    expect(errorsOf(audit({ spec }))).toEqual(expect.arrayContaining(["sections-sequential", "sections-unique"]));
  });

  test("a missing slot and an empty slot both fail, naming the slot", () => {
    const deck = { ...guideCopy } as Record<string, string>;
    delete deck["Prove it · Reasoning"];
    deck["The first offer · Readiness test"] = "   ";
    const result = audit({ deck });
    expect(result.findings).toContainEqual(expect.objectContaining({ rule: "slot-missing", path: "Prove it · Reasoning" }));
    expect(result.findings).toContainEqual(expect.objectContaining({ rule: "slot-empty", path: "The first offer · Readiness test" }));
  });

  test("requiredSlots covers every step, skill, role, week and FAQ question", () => {
    const slots = requiredSlots(guideSpec);
    expect(slots).toHaveLength(
      guideSpec.steps.length * 3 + guideSpec.skills.length * 2 + guideSpec.roles.names.length * guideSpec.roles.labels.length + guideSpec.weeks.length + guideSpec.faq.length + 2,
    );
    for (const slot of slots) expect(guideCopy).toHaveProperty([slot]);
  });

  test("self-check items cannot skip a number", () => {
    const deck = { ...guideCopy } as Record<string, string>;
    delete deck["Self-Check · Item 7"];
    expect(errorsOf(audit({ deck }))).toContain("selfcheck-items");
  });

  test("gate.mode none is reported as unsupported, and the next link must hit a section", () => {
    const spec = clone(guideSpec);
    spec.gate.mode = "none";
    spec.gate.nextHref = "#s99";
    expect(errorsOf(audit({ spec }))).toEqual(expect.arrayContaining(["gate-mode-unsupported", "gate-next-link"]));
  });

  test("placeholder wording in the deck fails", () => {
    const deck = { ...guideCopy, "The Shift · Lede": "PLACEHOLDER HERO text goes here" };
    expect(errorsOf(audit({ deck }))).toContain("placeholder-text");
    expect(errorsOf(audit({ deck: { ...guideCopy, "The Shift · Lede": "TODO write this" } }))).toContain("placeholder-text");
  });

  test("an internal label in copy fails", () => {
    const deck = { ...guideCopy, "The Shift · Lede": "Counted by the liveIdeas rule." };
    expect(errorsOf(audit({ deck }))).toContain("internal-label");
  });

  test("the Receipt labels that shipped on the live page would have failed", () => {
    const source = `
      <Receipt kind="Price" amount="£29" source="5-day guide draft, Day 5">first paid offer.</Receipt>
      <Receipt kind="Live count" amount={ideaCount} source="Homepage liveIdeas rule · re-checked at build">ideas.</Receipt>
    `;
    expect(receiptSources(source)).toEqual(["5-day guide draft, Day 5", "Homepage liveIdeas rule · re-checked at build"]);
    const result = audit({ sources: [{ file: "_sections.tsx", text: source }] });
    expect(result.findings.filter((f) => f.rule === "internal-label" && f.path === "_sections.tsx")).toHaveLength(2);
  });

  test("the clean Receipt sources pass", () => {
    const source = `<Receipt kind="Price" amount="$29" source="A working example, not a benchmark">first paid offer.</Receipt>`;
    const findings = audit({ sources: [{ file: "_sections.tsx", text: source }] }).findings.filter((f) => f.rule !== "offer-thin");
    expect(findings).toEqual([]);
  });

  test("a Receipt amount in another currency is caught even though it lives in the source, not the deck", () => {
    const source = `<Receipt kind="Price" amount="£29" source="A working example, not a benchmark">first paid offer.</Receipt>`;
    expect(receiptAmounts(source)).toEqual(["£29"]);
    const result = audit({ sources: [{ file: "_sections.tsx", text: source }] });
    expect(errorsOf(result)).toContain("currency-mixed");
    expect(result.findings.find((f) => f.rule === "currency-mixed")?.message).toMatch(/£ x1/);
  });

  test("a Receipt amount in the same currency, a template-literal amount and a numeric expression are all fine", () => {
    const source = [
      `<Receipt kind="Price" amount="$29" source="x">a</Receipt>`,
      "<Receipt kind=\"Price\" amount={`$5`} source=\"x\">b</Receipt>",
      `<Receipt kind="Live count" amount={ideaCount} source="x">c</Receipt>`,
    ].join("\n");
    expect(receiptAmounts(source)).toEqual(["$29", "$5"]);
    expect(errorsOf(audit({ sources: [{ file: "_sections.tsx", text: source }] }))).not.toContain("currency-mixed");
  });

  test("empty copy fails for every deck slot, including ledes, honest catches and self-check items", () => {
    const deck = { ...guideCopy } as Record<string, string>;
    deck["The Shift · Honest catch"] = "   ";
    deck["Self-Check · Item 1"] = "";
    deck["The Method · Lede"] = "\n";
    const empty = audit({ deck }).findings.filter((f) => f.rule === "slot-empty").map((f) => f.path);
    expect(empty).toEqual(expect.arrayContaining(["The Shift · Honest catch", "Self-Check · Item 1", "The Method · Lede"]));
  });

  test("an empty required slot is reported once, not twice", () => {
    const deck = { ...guideCopy } as Record<string, string>;
    deck["Prove it · Reasoning"] = "";
    const hits = audit({ deck }).findings.filter((f) => f.rule === "slot-empty" && f.path === "Prove it · Reasoning");
    expect(hits).toHaveLength(1);
  });

  test("mixed currencies fail, one currency passes", () => {
    const mixed = { ...guideCopy, "The price": "Start with £29 as your working example. Or $29." };
    const result = audit({ deck: mixed });
    expect(errorsOf(result)).toContain("currency-mixed");
    expect(result.findings.find((f) => f.rule === "currency-mixed")?.message).toMatch(/£ x1/);
    expect(currencySymbols(["$5 and $29", "$1,800"]).size).toBe(1);
  });

  test("a draft hero, a missing file and a stand-in alt each fail", () => {
    const draft = clone(guideSpec);
    draft.hero.image.assetStatus = "draft";
    expect(errorsOf(audit({ spec: draft }))).toContain("hero-asset-not-approved");

    expect(errorsOf(audit({ fileExists: (path) => path !== guideSpec.hero.image.src }))).toContain("hero-asset-missing");

    const alt = clone(guideSpec);
    alt.hero.image.alt = "Placeholder hero for John's working photo. An illustration of a late-night desk.";
    expect(errorsOf(audit({ spec: alt }))).toContain("hero-alt-placeholder");
  });

  test("a missing social image is a warning, not an error", () => {
    const result = audit({ fileExists: (path) => path !== guideSpec.ogImagePath });
    expect(result.ok).toBe(true);
    expect(result.findings).toContainEqual(expect.objectContaining({ rule: "og-image-missing", severity: "warn" }));
  });

  test("publicSpecStrings skips identifiers, paths and function summaries", () => {
    const strings = publicSpecStrings(guideSpec);
    expect(strings).toContain(guideSpec.hero.lede);
    expect(strings).not.toContain(guideSpec.slug);
    expect(strings).not.toContain(guideSpec.hero.image.src);
    expect(strings.every((value) => typeof value === "string")).toBe(true);
  });
});

describe("live audit evaluation", () => {
  const ids = guideSpec.sections.map((section) => section.id);
  const state = (overrides: Partial<PageState> = {}): PageState => ({
    mode: "returning", visibleSections: ids, text: "Plain page about $29.", imageAlts: ["John Iseghohi, founder of WeekendMVP, working at his desk"], ...overrides,
  });
  const healthy = (): LiveSnapshot => ({
    url: "https://example.test/guides/5-to-9-builder",
    pageErrors: [],
    locked: state({ mode: "locked", visibleSections: [ids[0]] }),
    unlocked: state({ mode: "confirmed" }),
    returning: state(),
    mobileSidewaysScroll: false,
    subscribe: { status: 200 },
  });
  const rules = (snap: LiveSnapshot) => evaluateLive(guideSpec, snap).filter((f) => f.severity === "error").map((f) => f.rule);

  test("a healthy gated page has no findings", () => {
    expect(evaluateLive(guideSpec, healthy())).toEqual([]);
  });

  test("no email means the subscribe check is skipped with an info finding, not an error", () => {
    const snap = healthy();
    snap.subscribe = null;
    const findings = evaluateLive(guideSpec, snap);
    expect(findings).toEqual([expect.objectContaining({ rule: "live-subscribe-skipped", severity: "info" })]);
  });

  test("a subscribe failure, page errors and sideways scroll are errors", () => {
    const snap = healthy();
    snap.subscribe = { status: 500 };
    snap.pageErrors = ["boom"];
    snap.mobileSidewaysScroll = true;
    expect(rules(snap)).toEqual(expect.arrayContaining(["live-subscribe", "live-page-error", "live-sideways-scroll"]));
    snap.subscribe = { status: null };
    expect(rules(snap)).toContain("live-subscribe");
  });

  test("a locked page that shows the whole body fails", () => {
    const snap = healthy();
    snap.locked = state({ mode: "locked", visibleSections: ids });
    expect(rules(snap)).toContain("live-locked-state");
  });

  test("an unlock that leaves sections hidden fails, and so does a reload that forgets", () => {
    const snap = healthy();
    snap.unlocked = state({ mode: "confirmed", visibleSections: [ids[0], ids[1]] });
    snap.returning = state({ mode: "locked", visibleSections: [ids[0]] });
    expect(rules(snap)).toEqual(expect.arrayContaining(["live-unlocked-state", "live-returning-mode", "live-returning-state"]));
  });

  test("the placeholder hero and mixed currency on the live page would have failed", () => {
    const snap = healthy();
    snap.unlocked = state({
      mode: "confirmed",
      text: "PLACEHOLDER HERO John's working photo to come. Offer it for £29. The sprint is $29.",
      imageAlts: ["Placeholder hero for John's working photo. An illustration of a late-night desk with a laptop."],
    });
    expect(rules(snap)).toEqual(expect.arrayContaining(["live-placeholder-text", "live-placeholder-alt", "live-currency-mixed"]));
  });

  test("an ungated guide skips the gate checks and says so", () => {
    const spec = clone(guideSpec);
    spec.gate.mode = "none";
    const snap = healthy();
    snap.locked = state({ mode: null, visibleSections: ids });
    snap.subscribe = null;
    const findings = evaluateLive(spec, snap);
    expect(findings.map((f) => f.rule)).toEqual(["live-gate-skipped"]);
  });
});

describe("audit:guide CLI", () => {
  const run = (...args: string[]) =>
    spawnSync(process.execPath, ["--experimental-strip-types", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/audit-guide.mjs", ...args], { encoding: "utf8" });

  test("passes on the real guide with exit 0", () => {
    const result = run("--slug=5-to-9-builder", "--offers-on", "--now=2026-11-10");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PASS 5-to-9-builder (static): 0 errors, 1 warnings");
  });

  test("fails with exit 1 and names the closed offer once the session has ended", () => {
    const result = run("--slug=5-to-9-builder", "--offers-on", "--now=2026-11-26");
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("offer-status");
    expect(result.stdout).toContain("FAIL 5-to-9-builder: 1 errors");
  });

  test("fails with exit 1 before ticket sales open", () => {
    const result = run("--slug=5-to-9-builder", "--offers-on", "--now=2026-10-31");
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("SALES_OPEN_AT");
  });

  test.runIf(!BUILD_ALONG_GUIDE_CARDS_ENABLED)("with the switch off in config the guide passes on any date and says its upsells are hidden", () => {
    for (const date of ["2026-10-31", "2026-11-10", "2026-11-26"]) {
      const result = run("--slug=5-to-9-builder", `--now=${date}`);
      expect(result.status, date).toBe(0);
      expect(result.stdout, date).toContain("offer-switched-off");
    }
  });

  test("a bad --now date is a usage error", () => {
    expect(run("--slug=5-to-9-builder", "--now=tomorrow").status).toBe(2);
  });

  test("--json prints a machine-readable result", () => {
    const parsed = JSON.parse(run("--slug=5-to-9-builder", "--json", "--offers-on", "--now=2026-11-10").stdout);
    expect(parsed).toMatchObject({ slug: "5-to-9-builder", live: false, ok: true, findings: [expect.objectContaining({ rule: "offer-thin" })] });
  });

  test("usage errors exit 2: no slug, unknown guide, --live without --url, --email without --live", () => {
    expect(run().status).toBe(2);
    expect(run("--slug=no-such-guide").status).toBe(2);
    expect(run("--slug=5-to-9-builder", "--live").status).toBe(2);
    expect(run("--slug=5-to-9-builder", "--email=a@b.test").status).toBe(2);
  });
});

describe("upsell and offer audit", () => {
  const base = (): Offer => clone(offers[0]);
  /** The real offer with overrides, as the only entry in a fixture registry. */
  const withOffer = (change: (offer: Offer) => void) => {
    const offer = base();
    change(offer);
    return audit({ offers: [offer] });
  };

  test("a guide with no upsell fails", () => {
    const spec = clone(guideSpec);
    spec.upsells = [];
    expect(errorsOf(audit({ spec }))).toContain("upsell-missing");
  });

  test("three cards, or one placement used twice, fails the cap", () => {
    const three = clone(guideSpec);
    three.upsells = [...three.upsells, { offer: "build-along", placement: "close" }];
    expect(errorsOf(audit({ spec: three }))).toContain("upsell-cap");

    const twice = clone(guideSpec);
    twice.upsells = [{ offer: "build-along", placement: "mid" }, { offer: "build-along", placement: "mid" }];
    const result = audit({ spec: twice });
    expect(result.findings).toContainEqual(expect.objectContaining({ rule: "upsell-cap", message: expect.stringContaining('"mid"') }));
  });

  test("an upsell that names an offer not in the registry fails", () => {
    const spec = clone(guideSpec);
    spec.upsells[0].offer = "no-such-offer";
    expect(errorsOf(audit({ spec }))).toContain("offer-unknown");
  });

  test("a closed offer fails, and a paid card for an offer on a waitlist fails", () => {
    expect(errorsOf(withOffer((o) => { o.status = "closed"; delete o.statusResolver; }))).toContain("offer-status");
    expect(errorsOf(withOffer((o) => { o.status = "waitlist"; delete o.statusResolver; }))).toContain("offer-status");
  });

  test("a waitlist offer with a waitlist status is fine", () => {
    const result = withOffer((o) => {
      o.kind = "waitlist";
      o.status = "waitlist";
      delete o.statusResolver;
      delete o.price;
      o.promise = "Join the list for the next cohort.";
      o.url = "https://example-waitlist.test/join";
    });
    expect(errorsOf(result)).toEqual([]);
  });

  test("a dead internal link fails and a placeholder or non-https link fails", () => {
    expect(errorsOf(withOffer((o) => { o.url = "/live/no-such-page"; }))).toContain("offer-link-dead");
    for (const url of ["#", "https://example.com/join", "http://insecure.test/join", "mailto:hi@x.test", "TODO"]) {
      expect(errorsOf(withOffer((o) => { o.url = url; })), url).toContain("offer-link-placeholder");
    }
  });

  test("an https link with no host, and a protocol-relative link, fail. A real https link passes", () => {
    for (const url of ["https://", "https://   ", "//evil.test/x"]) {
      expect(errorsOf(withOffer((o) => { o.url = url; })), url).toContain("offer-link-placeholder");
    }
    const ok = withOffer((o) => { o.url = "https://shop.test/join"; });
    expect(errorsOf(ok)).not.toContain("offer-link-placeholder");
  });

  test("the text a card renders from the registry gets the same placeholder, label and currency checks as the deck", () => {
    expect(errorsOf(withOffer((o) => { o.promise = "TODO {price}"; }))).toContain("placeholder-text");
    expect(errorsOf(withOffer((o) => { o.title = "Placeholder title"; }))).toContain("placeholder-text");
    expect(errorsOf(withOffer((o) => { o.notFor = "anyone, see the liveIdeas rule"; }))).toContain("internal-label");
    const mixed = withOffer((o) => { o.bullets = ["Extra seats cost £5", "two", "three"]; });
    expect(errorsOf(mixed)).toContain("currency-mixed");
    // The guide shows this offer in two placements, but its text is counted once.
    expect(mixed.findings.find((f) => f.rule === "currency-mixed")?.message).toMatch(/£ x1/);
    const twice = withOffer((o) => { o.promise = "TODO {price}"; });
    expect(twice.findings.filter((f) => f.rule === "placeholder-text")).toHaveLength(1);
  });

  test("offer text is only checked for offers the guide actually shows", () => {
    const unused = base();
    unused.id = "unused-offer";
    unused.promise = "TODO {price}";
    const result = audit({ offers: [base(), unused] });
    expect(errorsOf(result)).not.toContain("placeholder-text");
  });

  test("offerReaderStrings lists every rendered field and drops the price token", () => {
    const offer = base();
    offer.bullets = ["one", "two", "three"];
    offer.notFor = "people who want a course";
    offer.urgency = { text: "Seats close Friday", source: "seat counter" };
    const strings = offerReaderStrings(offer);
    expect(strings).toEqual(expect.arrayContaining([offer.title, offer.eyebrow, offer.ariaLabel, offer.linkLabel, "one", "two", "three", "people who want a course", "Seats close Friday"]));
    expect(strings.join(" ")).not.toContain("{price}");
  });

  test("a price key that does not resolve, or resolves to nothing, fails", () => {
    expect(errorsOf(audit({ resolvePrice: () => 0 }))).toContain("offer-price");
    expect(errorsOf(audit({ resolvePrice: () => { throw new Error("no resolver"); } }))).toContain("offer-price");
  });

  test("the registry entries are checked: a paid offer needs a price and the price token, a waitlist offer cannot have one", () => {
    const noPrice = withOffer((o) => { delete o.price; });
    expect(noPrice.findings.filter((f) => f.rule === "offer-schema").map((f) => f.path)).toContain("offers.0.price");

    const waitlistWithPrice = withOffer((o) => { o.kind = "waitlist"; o.status = "waitlist"; delete o.statusResolver; });
    expect(errorsOf(waitlistWithPrice)).toContain("offer-schema");

    const derivedNoResolver = withOffer((o) => { delete o.statusResolver; });
    expect(derivedNoResolver.findings.map((f) => f.path)).toContain("offers.0.statusResolver");
  });

  test("an offer with three bullets and a not-for line has no thin warning", () => {
    const result = withOffer((o) => { o.bullets = ["one", "two", "three"]; o.notFor = "people who want a course"; });
    expect(result.findings).toEqual([]);
  });

  test("without config or a clock, price and status are reported as skipped, not passed", () => {
    const result = audit({ resolvePrice: undefined, effectiveStatus: undefined, now: undefined });
    const rules = result.findings.map((f) => f.rule);
    expect(rules).toEqual(expect.arrayContaining(["offer-price-unchecked", "offer-status-unchecked"]));
    expect(result.findings.filter((f) => f.severity === "info")).toHaveLength(2);
  });
});

describe("offer switch", () => {
  const off = () => false;
  // The real founder note links to the sprint only while the switch is on in config. These tests force the offer off
  // whatever config says, so they use a note with no sprint link and never depend on that value.
  const noSprintLinkDeck = { ...guideCopy, "Founder note · Body": "I run WeekendMVP. I'd like to hear what you test." };

  test("a switched-off offer is not judged on its sale status or its thin copy, and the audit says so", () => {
    const result = audit({ deck: noSprintLinkDeck, isOfferEnabled: off, now: AFTER_EVENT_ENDS });
    expect(errorsOf(result)).toEqual([]);
    expect(result.findings).toContainEqual(expect.objectContaining({ rule: "offer-switched-off", severity: "info" }));
    expect(result.findings.some((f) => f.rule === "offer-status")).toBe(false);
    expect(result.findings.some((f) => f.rule === "offer-thin")).toBe(false);
  });

  test("a guide with every upsell switched off passes, with a warning that no upsell is showing", () => {
    const result = audit({ deck: noSprintLinkDeck, isOfferEnabled: off });
    expect(result.ok).toBe(true);
    expect(result.findings).toContainEqual(expect.objectContaining({ rule: "upsell-none-shown", severity: "warn" }));
  });

  test("switching the same closed offer on makes it an error again", () => {
    expect(errorsOf(audit({ isOfferEnabled: () => true, now: AFTER_EVENT_ENDS }))).toContain("offer-status");
    expect(audit({ isOfferEnabled: () => true, now: AFTER_EVENT_ENDS }).findings.some((f) => f.rule === "upsell-none-shown")).toBe(false);
  });

  test("copy that links to a switched-off offer fails, and the same copy is fine once it is on", () => {
    const deck = { ...guideCopy, "Founder note · Body": "Join us live, the sprint is [here](/live/build-along)." };
    const result = audit({ deck, isOfferEnabled: off });
    expect(result.findings).toContainEqual(
      expect.objectContaining({ rule: "offer-link-in-copy", severity: "error", path: "Founder note · Body" }),
    );
    expect(errorsOf(audit({ deck, isOfferEnabled: () => true }))).not.toContain("offer-link-in-copy");
  });

  test("the real founder note follows the switch in config", () => {
    const founder = guideCopy["Founder note · Body"];
    expect(founder.includes("/live/build-along")).toBe(BUILD_ALONG_GUIDE_CARDS_ENABLED);
    expect(founder.includes("Build-Along")).toBe(BUILD_ALONG_GUIDE_CARDS_ENABLED);
  });

  test("with the real switch, the real guide never links to a sprint that is switched off", () => {
    const result = audit({ isOfferEnabled, now: AFTER_EVENT_ENDS });
    expect(result.findings.filter((f) => f.rule === "offer-link-in-copy")).toEqual([]);
  });
});
