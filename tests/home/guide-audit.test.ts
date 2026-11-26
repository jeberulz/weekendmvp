import { spawnSync } from "node:child_process";
import { describe, expect, test } from "vitest";

import { guideSpec } from "@/app/(marketing)/guides/5-to-9-builder/guide.spec";
import { guideCopy } from "@/app/(marketing)/guides/5-to-9-builder/guideCopy";
import { auditGuide, currencySymbols, publicSpecStrings, receiptSources, type AuditInput } from "@/lib/guides/audit";
import { evaluateLive, type LiveSnapshot, type PageState } from "@/lib/guides/audit-live";
import { requiredSlots } from "@/lib/guides/slots";
import { guideSpecSchema } from "@/lib/guides/spec-schema";

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
  return auditGuide({ spec: clone(guideSpec), deck: guideCopy, fileExists: everythingExists, ...overrides });
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
  test("passes on the real 5-to-9 guide", () => {
    const result = audit();
    expect(result.findings).toEqual([]);
    expect(result.ok).toBe(true);
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
    expect(audit({ sources: [{ file: "_sections.tsx", text: source }] }).findings).toEqual([]);
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
    const result = run("--slug=5-to-9-builder");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PASS 5-to-9-builder (static): 0 errors");
  });

  test("--json prints a machine-readable result", () => {
    const parsed = JSON.parse(run("--slug=5-to-9-builder", "--json").stdout);
    expect(parsed).toMatchObject({ slug: "5-to-9-builder", live: false, ok: true, findings: [] });
  });

  test("usage errors exit 2: no slug, unknown guide, --live without --url, --email without --live", () => {
    expect(run().status).toBe(2);
    expect(run("--slug=no-such-guide").status).toBe(2);
    expect(run("--slug=5-to-9-builder", "--live").status).toBe(2);
    expect(run("--slug=5-to-9-builder", "--email=a@b.test").status).toBe(2);
  });
});
