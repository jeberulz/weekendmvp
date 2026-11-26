import { offerSchema, offers as registry, type EffectiveStatus, type Offer, type PriceConfigKey } from "./offers.ts";
import { requiredSlots } from "./slots.ts";
import { guideSpecSchema, type GuideSpec } from "./spec-schema.ts";

/**
 * Static guide audit (WP103-S2). Pure: every input is passed in, so tests can feed fixtures and the
 * CLI (`scripts/audit-guide.mjs`) can feed real files. Plain Node can load this file.
 *
 * Not here yet: claim and source rules (S4), upsell rules (S3), word floors and honest-catch caps
 * (thresholds need a second guide to set).
 */

export type FindingSeverity = "error" | "warn" | "info";

export type Finding = {
  rule: string;
  severity: FindingSeverity;
  message: string;
  path?: string;
};

export type AuditInput = {
  /** The spec as exported by the guide, not yet validated. */
  spec: unknown;
  /** The copy deck: slot name to prose. */
  deck: Readonly<Record<string, string>>;
  /** True when a file exists under `public/`. Receives a path like `/image/john-portrait.webp`. */
  fileExists: (publicPath: string) => boolean;
  /** Guide source files, to scan Receipt sources and similar inline strings. */
  sources?: readonly { file: string; text: string }[];
  /** Offers to check the guide's upsells against. Defaults to the real registry. */
  offers?: readonly unknown[];
  /** The time to judge offer status at, in ms. Needed with `effectiveStatus`. */
  now?: number;
  /** Looks up a paid offer's price from config. Without it the price check is reported as skipped. */
  resolvePrice?: (key: PriceConfigKey) => number;
  /** Works out an offer's status from config. Without it the status check is reported as skipped. */
  effectiveStatus?: (offer: Offer, now: number) => EffectiveStatus;
  /** True when an internal URL path hits a page. Without it internal links are not checked. */
  routeExists?: (urlPath: string) => boolean;
};

/** An offer link must be an internal path or an https URL, and must not be a stand-in. */
export const LINK_PLACEHOLDER_RE = /example\.(?:com|org|net)|\bTODO\b|\bTBD\b|localhost|^#|^$/i;

export type AuditResult = {
  ok: boolean;
  findings: Finding[];
  spec?: GuideSpec;
};

/** Words that mark a stand-in or unfinished text. */
export const PLACEHOLDER_RE = /\b(?:TODO|TBD|FIXME|COPY TO WRITE|lorem ipsum|placeholder)\b/i;
/** Alt text that describes a stand-in image instead of the real one. */
export const STAND_IN_ALT_RE = /\b(?:placeholder|stand-?in|draft artwork|photo to come|to come)\b/i;
/** Labels that belong to our process, not to a reader. */
export const INTERNAL_LABEL_RE = /liveIdeas|re-checked at build|\bguide draft\b|\binternal only\b/i;
/** A currency symbol directly before an amount. */
export const CURRENCY_RE = /([£$€¥])\s?\d/g;

/** Spec fields that hold identifiers, paths or settings, not words a reader sees. */
const TECHNICAL_KEYS = new Set([
  "slug", "path", "ogImagePath", "lang", "utmCampaign", "checklistKey", "promptFileName",
  "id", "src", "sizes", "mode", "nextHref", "finePrintSlot", "assetStatus", "width", "height",
]);

/** Every string a reader can see in the spec. Skips identifiers and function-valued summaries. */
export function publicSpecStrings(spec: unknown): string[] {
  const out: string[] = [];
  const walk = (value: unknown, key?: string) => {
    if (key && TECHNICAL_KEYS.has(key)) return;
    if (typeof value === "string") out.push(value);
    else if (Array.isArray(value)) for (const item of value) walk(item);
    else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) walk(v, k);
  };
  walk(spec);
  return out;
}

export function currencySymbols(strings: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const text of strings) {
    for (const match of text.matchAll(CURRENCY_RE)) counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
  }
  return counts;
}

/** `source` strings on `<Receipt ...>` tags, from guide source text. */
export function receiptSources(text: string): string[] {
  const sources: string[] = [];
  for (const tag of text.matchAll(/<Receipt\b[^>]*>/g)) {
    const attr = tag[0].match(/\bsource=(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/);
    const value = attr?.[1] ?? attr?.[2] ?? attr?.[3];
    if (value !== undefined) sources.push(value);
  }
  return sources;
}

export function auditGuide(input: AuditInput): AuditResult {
  const findings: Finding[] = [];
  const add = (rule: string, severity: FindingSeverity, message: string, path?: string) =>
    findings.push({ rule, severity, message, ...(path ? { path } : {}) });

  const parsed = guideSpecSchema.safeParse(input.spec);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) add("schema", "error", issue.message, issue.path.join(".") || undefined);
    return { ok: false, findings };
  }
  const spec = parsed.data;
  const { deck } = input;

  // Section ids run s01, s02, ... in order, and titles are unique.
  spec.sections.forEach((section, index) => {
    const expected = `s${String(index + 1).padStart(2, "0")}`;
    if (section.id !== expected) {
      add("sections-sequential", "error", `section ${index + 1} has id "${section.id}", expected "${expected}"`, `sections.${index}.id`);
    }
  });
  const titles = spec.sections.map((section) => section.title);
  for (const title of new Set(titles.filter((t, i) => titles.indexOf(t) !== i))) {
    add("sections-unique", "error", `section title "${title}" appears more than once`);
  }

  // Every slot the shared blocks read must exist and hold text.
  for (const slot of requiredSlots(spec)) {
    const value = deck[slot];
    if (value === undefined) add("slot-missing", "error", `copy slot is missing from the deck: "${slot}"`, slot);
    else if (value.trim() === "") add("slot-empty", "error", `copy slot is empty: "${slot}"`, slot);
  }

  // Self-check items run 1..N with no gaps.
  const items = Object.keys(deck)
    .map((slot) => slot.match(/^Self-Check · Item (\d+)$/)?.[1])
    .filter((n): n is string => n !== undefined)
    .map(Number)
    .sort((a, b) => a - b);
  if (items.length === 0) add("selfcheck-items", "warn", "the deck has no self-check items");
  items.forEach((n, index) => {
    if (n !== index + 1) add("selfcheck-items", "error", `self-check items skip from ${index} to ${n}`);
  });

  // The gate must point at a real section, and the layout must be able to render the mode.
  if (spec.gate.mode === "none") {
    add("gate-mode-unsupported", "error", 'gate.mode "none" is not rendered by the layout yet, so the page would hide its body with no way to unlock it', "gate.mode");
  }
  if (!spec.sections.some((section) => `#${section.id}` === spec.gate.nextHref)) {
    add("gate-next-link", "error", `gate.nextHref "${spec.gate.nextHref}" does not match a section id`, "gate.nextHref");
  }

  // Placeholder, internal-label and currency checks run over everything a reader sees.
  const readerStrings = [...Object.values(deck), ...publicSpecStrings(spec)];
  const placeholderHits = readerStrings.filter((text) => PLACEHOLDER_RE.test(text));
  for (const text of placeholderHits) add("placeholder-text", "error", `placeholder wording in copy: "${text.slice(0, 80)}"`);
  for (const text of readerStrings.filter((t) => INTERNAL_LABEL_RE.test(t))) {
    add("internal-label", "error", `internal label in copy: "${text.slice(0, 80)}"`);
  }
  for (const source of input.sources ?? []) {
    for (const value of receiptSources(source.text)) {
      if (INTERNAL_LABEL_RE.test(value) || PLACEHOLDER_RE.test(value)) {
        add("internal-label", "error", `Receipt source shows an internal or placeholder label: "${value}"`, source.file);
      }
    }
  }
  const symbols = currencySymbols(readerStrings);
  if (symbols.size > 1) {
    const list = [...symbols].map(([symbol, count]) => `${symbol} x${count}`).join(", ");
    add("currency-mixed", "error", `copy mixes currencies: ${list}`);
  }

  // The hero image must be approved, real and honestly described.
  const image = spec.hero.image;
  if (image.assetStatus !== "approved") {
    add("hero-asset-not-approved", "error", `hero image assetStatus is "${image.assetStatus}", only "approved" can ship`, "hero.image.assetStatus");
  }
  if (!input.fileExists(image.src)) {
    add("hero-asset-missing", "error", `hero image file not found under public/: ${image.src}`, "hero.image.src");
  }
  if (STAND_IN_ALT_RE.test(image.alt)) {
    add("hero-alt-placeholder", "error", `hero alt text describes a stand-in: "${image.alt}"`, "hero.image.alt");
  }
  if (!input.fileExists(spec.ogImagePath)) {
    add("og-image-missing", "warn", `social image not found under public/: ${spec.ogImagePath}`, "ogImagePath");
  }

  auditUpsells(spec, input, add);

  return { ok: !findings.some((finding) => finding.severity === "error"), findings, spec };
}

type AddFinding = (rule: string, severity: FindingSeverity, message: string, path?: string) => void;

/** Upsell and offer rules (WP103-S3). */
function auditUpsells(spec: GuideSpec, input: AuditInput, add: AddFinding) {
  // Every offer in the registry must be well formed.
  const known = new Map<string, Offer>();
  (input.offers ?? registry).forEach((raw, index) => {
    const parsed = offerSchema.safeParse(raw);
    if (parsed.success) {
      known.set(parsed.data.id, parsed.data);
      return;
    }
    const id = (raw as { id?: unknown } | null)?.id;
    for (const issue of parsed.error.issues) {
      add("offer-schema", "error", `offer ${typeof id === "string" ? `"${id}"` : index}: ${issue.message}`, `offers.${index}${issue.path.length ? `.${issue.path.join(".")}` : ""}`);
    }
  });

  if (spec.upsells.length === 0) add("upsell-missing", "error", "the guide lists no upsell, a gated guide needs at least one offer", "upsells");
  if (spec.upsells.length > 2) add("upsell-cap", "error", `the guide lists ${spec.upsells.length} upsell cards, the cap is two`, "upsells");
  const placements = spec.upsells.map((upsell) => upsell.placement);
  for (const placement of new Set(placements.filter((p, i) => placements.indexOf(p) !== i))) {
    add("upsell-cap", "error", `the "${placement}" placement is used more than once`, "upsells");
  }

  const checked = new Set<string>();
  spec.upsells.forEach((upsell, index) => {
    const offer = known.get(upsell.offer);
    if (!offer) {
      add("offer-unknown", "error", `upsell "${upsell.offer}" is not in the offers registry`, `upsells.${index}.offer`);
      return;
    }
    if (checked.has(offer.id)) return;
    checked.add(offer.id);
    auditOffer(offer, input, add);
  });
}

function auditOffer(offer: Offer, input: AuditInput, add: AddFinding) {
  const at = `offer:${offer.id}`;

  // The link must be real: an internal page that exists, or an https URL.
  if (LINK_PLACEHOLDER_RE.test(offer.url)) {
    add("offer-link-placeholder", "error", `offer "${offer.id}" links to a stand-in: "${offer.url}"`, at);
  } else if (offer.url.startsWith("/")) {
    if (input.routeExists && !input.routeExists(offer.url)) {
      add("offer-link-dead", "error", `offer "${offer.id}" links to ${offer.url}, which is not a page in the app`, at);
    }
  } else if (!offer.url.startsWith("https://")) {
    add("offer-link-placeholder", "error", `offer "${offer.id}" must link to an internal path or an https URL, not "${offer.url}"`, at);
  }

  // A paid offer's price must resolve from config.
  if (offer.kind === "paid" && offer.price) {
    if (!input.resolvePrice) {
      add("offer-price-unchecked", "info", `offer "${offer.id}": no config was loaded, so the price was not resolved`, at);
    } else {
      try {
        const amount = input.resolvePrice(offer.price.configKey);
        if (!Number.isFinite(amount) || amount <= 0) {
          add("offer-price", "error", `offer "${offer.id}": ${offer.price.configKey} resolved to ${String(amount)}, expected a positive number`, at);
        }
      } catch (error) {
        add("offer-price", "error", `offer "${offer.id}": ${error instanceof Error ? error.message : String(error)}`, at);
      }
    }
  }

  // The status must allow a sale. A closed offer, or a paid card for an offer that is not open, fails.
  if (!input.effectiveStatus || input.now === undefined) {
    add("offer-status-unchecked", "info", `offer "${offer.id}": no config or time was given, so its status was not checked`, at);
  } else {
    const { status, reason } = input.effectiveStatus(offer, input.now);
    if (status === "closed") {
      add("offer-status", "error", `offer "${offer.id}" is closed: ${reason}`, at);
    } else if (offer.kind === "paid" && status === "waitlist") {
      add("offer-status", "error", `offer "${offer.id}" is paid but its status is waitlist: ${reason}`, at);
    }
  }

  // Thin offers are allowed, but the owner should approve wording for the full card.
  const bullets = offer.bullets?.length ?? 0;
  if (bullets < 3 || !offer.notFor) {
    add("offer-thin", "warn", `offer "${offer.id}" has ${bullets} of 3 bullets${offer.notFor ? "" : " and no \"not for\" line"}, add owner-approved wording`, at);
  }
}
