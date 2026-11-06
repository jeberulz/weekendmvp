/**
 * WP75-S4a: weekend prompt standard v1, as per-prompt rules for build packs.
 *
 * A TypeScript port of the per-prompt rules in `scripts/lib/prompt-standard.mjs`
 * (`lintPrompts`), applied to one `BuildPrompt` at a time. Parity with the
 * script is tested on shared fixtures (`tests/platform/workspace-crew-checks-
 * prompt-standard.test.ts`), so the two cannot drift silently. The script
 * stays the source for the idea corpus; this is for the crew's build pack
 * (S3d imports it, WP76 may too).
 *
 * What v1 requires of every prompt: a `Done when:` line, a `Do not build:`
 * line (the build pack contract makes both fields required), no Next.js major
 * pin, no code fence. The Project Setup prompt also: no billing, one login,
 * at most three outside services, 3+ tables as `- name(columns)` lines,
 * 8+ lines. The title rule and the Branding Package rule belong to the idea's
 * four prompts and do not apply to a build pack.
 *
 * How v1 maps onto eight prompts, and whether a light pack may mention
 * checkout, are open owner questions (WP75 progress, Owner questions 8 and
 * 9). Both rulings run on the same rules through `BuildPackStandardOptions`:
 *
 * - `setupPromptNumbers`: which prompts (1-based, `buildPackPrompts` order)
 *   get the Project Setup rules. Default `DEFAULT_SETUP_PROMPT_NUMBERS`:
 *   prompt 3 for a full pack (the scaffold phase's first prompt, which the
 *   schema names as Project Setup) and none for a light pack. A number no
 *   pack of that weight can have (0, 9, 2.5) is a caller bug and throws.
 * - `billing`: severity of a billing mention, per prompt kind
 *   (`{ setup, standard }`; either may be left out). Default
 *   `DEFAULT_BILLING`: hard in a setup prompt and soft elsewhere for a full
 *   pack; off for both in a light pack (a light pack sets up checkout).
 *
 * Messages name a prompt by its number ("Prompt 3"), never by its title: the
 * title is model text and the messages go to the repair call.
 *
 * Pure; no imports beyond contracts.
 */
import {
  BUILD_PHASES,
  LIMITS,
  promptCopyText,
  type BuildPack,
  type BuildPrompt,
} from "../../contracts/artifacts";
import { issue, type CheckIssue, type IssuePath, type IssueSeverity } from "./types";

export const PROMPT_STANDARD_VERSION = 1;
export const SETUP_MIN_LINES = 8;
export const SETUP_MAX_SERVICES = 3;
export const SETUP_MIN_TABLES = 3;

/** Tables the idea engine adds to every Setup prompt; they do not count as idea-specific. */
const GENERIC_TABLES = new Set(["workspaces", "members", "usage_events", "documents", "jobs"]);

/** Outside services a prompt can pull in. Hosting (Vercel, Cloudflare) is not counted. */
const SERVICES: readonly (readonly [string, RegExp])[] = [
  ["stripe", /\bstripe\b/i],
  ["clerk", /\bclerk\b/i],
  ["supabase", /\bsupabase\b/i],
  ["firebase", /\bfirebase\b/i],
  ["auth0", /\bauth0\b/i],
  ["resend", /\bresend\b/i],
  ["sendgrid", /\bsendgrid\b/i],
  ["postmark", /\bpostmark\b/i],
  ["mailgun", /\bmailgun\b/i],
  ["twilio", /\btwilio\b/i],
  ["openai", /\bopenai\b/i],
  ["anthropic", /\banthropic\b|\bclaude api\b/i],
  ["plaid", /\bplaid\b/i],
  ["google", /\bgoogle (oauth|calendar|sheets|drive|maps|places|business|analytics|search console)\b/i],
  ["microsoft", /\bmicrosoft (graph|365)\b/i],
  ["slack", /\bslack\b/i],
  ["notion", /\bnotion (api|database)\b/i],
  ["shopify", /\bshopify\b/i],
  ["hubspot", /\bhubspot\b/i],
  ["airtable", /\bairtable\b/i],
  ["zapier", /\bzapier\b/i],
  ["upstash", /\bupstash\b|\bredis\b/i],
  ["pinecone", /\bpinecone\b/i],
  ["algolia", /\balgolia\b/i],
  ["mapbox", /\bmapbox\b/i],
  ["twitter", /\b(twitter|x) api\b/i],
  ["reddit", /\breddit api\b/i],
  ["github", /\bgithub (api|app|oauth)\b/i],
];

/** Two logins in one prompt, or a login that does not work with the database's row rules. */
const AUTH_PROVIDERS: readonly (readonly [string, RegExp])[] = [
  ["clerk", /\bclerk\b/i],
  ["auth0", /\bauth0\b/i],
  ["nextauth", /\bnext-?auth\b|\bauth\.js\b/i],
  ["firebase-auth", /\bfirebase auth/i],
  ["supabase-auth", /\bsupabase\b[^.\n]{0,80}\bauth\b/i],
];

/** "Catalog Clerk" is a product, not the Clerk login. */
const PRODUCT_NAMES = /\bcatalog clerk\b/gi;
const BILLING =
  /\b(stripe|paddle|lemon ?squeezy|billing|subscriptions?|checkout (?:flow|page|session)s?|paid plans?|pricing tiers?|pricing plans?)\b/i;
const NEXT_PIN = /\bnext\.?js\s*v?\d+/i;
const DONE_WHEN = /^\s*done when\b/im;
const DO_NOT_BUILD = /^\s*do not build\b/im;

const withoutProductNames = (text: string): string => text.replace(PRODUCT_NAMES, "");
const nonEmptyLines = (text: string): string[] => text.split("\n").filter((l) => l.trim() !== "");
/** The text a prompt asks the tool to build; the `Do not build:` line names what is left out. */
export const withoutFence = (text: string): string =>
  text
    .split("\n")
    .filter((line) => !DO_NOT_BUILD.test(line))
    .join("\n");

const servicesIn = (text: string): string[] => SERVICES.filter(([, re]) => re.test(text)).map(([name]) => name);
const tableNames = (text: string): string[] =>
  [...text.matchAll(/^[^\S\n]*[-*]\s*([a-z][a-z0-9_]*)\s*\(/gm)].map((m) => m[1]).filter((name): name is string => name !== undefined);

export type PromptRole = "setup" | "standard";
export type BillingSeverity = IssueSeverity | "off";

export type PromptStandardOptions = {
  /** `setup` applies the Project Setup rules too. Default `standard`. */
  readonly role?: PromptRole;
  /** Severity of a billing mention. Default: hard for `setup`, soft for `standard`. */
  readonly billing?: BillingSeverity;
  /** How messages name the prompt, e.g. "Prompt 3". Default "This prompt". Never the model's title. */
  readonly label?: string;
};

/** One prompt against the per-prompt rules of v1. `base` is the prompt's path in the artifact. */
export function checkBuildPrompt(prompt: BuildPrompt, options: PromptStandardOptions = {}, base: IssuePath = []): CheckIssue[] {
  const role = options.role ?? "standard";
  const billing = options.billing ?? (role === "setup" ? "hard" : "soft");
  const name = options.label ?? "This prompt";
  const issues: CheckIssue[] = [];
  const at = (field: string): IssuePath => [...base, field];
  const text = promptCopyText(prompt);
  const built = withoutProductNames(withoutFence(text));

  if (prompt.doneWhen.trim() === "" || !DONE_WHEN.test(text)) {
    issues.push(issue("hard", "done_when", at("doneWhen"), `${name} needs a Done when: line that names something checkable.`));
  }
  if (prompt.doNotBuild.trim() === "" || !DO_NOT_BUILD.test(text)) {
    issues.push(issue("hard", "do_not_build", at("doNotBuild"), `${name} needs a Do not build: line naming what is left out.`));
  }
  if (DONE_WHEN.test(prompt.body) || DO_NOT_BUILD.test(prompt.body)) {
    issues.push(issue("soft", "duplicate_label", at("body"), `${name} repeats a Done when: or Do not build: label inside its body; the pack adds them.`));
  }
  if (NEXT_PIN.test(text)) {
    issues.push(issue("hard", "next_pin", at("body"), `${name} pins a Next.js major version; say "Next.js".`));
  }
  if (text.includes("```")) {
    issues.push(issue("hard", "code_fence", at("body"), `${name} contains a code fence, which ends the copied block early.`));
  }
  if (billing !== "off" && BILLING.test(built)) {
    issues.push(
      issue(
        billing,
        role === "setup" ? "setup_billing" : "billing",
        at("body"),
        role === "setup"
          ? `${name} mentions billing; the setup prompt has none (a Do not build: line may name it).`
          : `${name} mentions billing or checkout; fine only where taking payment is the product's own function.`,
      ),
    );
  }

  if (role === "setup") {
    // As `lintPrompts` counts: the copied text, Do not build and Done when lines included.
    const lines = nonEmptyLines(text).length;
    if (lines < SETUP_MIN_LINES) {
      issues.push(issue("hard", "setup_structure", at("body"), `${name} (Project Setup) has ${lines} lines; it needs ${SETUP_MIN_LINES}+, one idea per line.`));
    }
    const services = servicesIn(built);
    if (services.length > SETUP_MAX_SERVICES) {
      issues.push(
        issue("hard", "setup_services", at("body"), `${name} (Project Setup) names ${services.length} outside services (${services.join(", ")}); the most is ${SETUP_MAX_SERVICES}.`),
      );
    }
    const auth = AUTH_PROVIDERS.filter(([, re]) => re.test(built)).map(([name]) => name);
    if (auth.length > 1) {
      issues.push(issue("hard", "setup_auth", at("body"), `${name} (Project Setup) names ${auth.length} login providers (${auth.join(", ")}); use one.`));
    }
    if (/\bclerk\b/i.test(built) && /\bsupabase\b/i.test(built)) {
      issues.push(issue("hard", "setup_auth_rls", at("body"), `${name} (Project Setup) pairs Clerk with Supabase; row rules need the database to trust the login. Use Supabase Auth.`));
    }
    const tables = tableNames(prompt.body).filter((name) => !GENERIC_TABLES.has(name));
    if (tables.length < SETUP_MIN_TABLES) {
      issues.push(issue("hard", "setup_tables", at("body"), `${name} (Project Setup) declares ${tables.length} table(s) as "- name(columns)" lines; it needs ${SETUP_MIN_TABLES}+.`));
    }
  }
  return issues;
}

export type BillingByKind = { readonly setup: BillingSeverity; readonly standard: BillingSeverity };

export type BuildPackStandardOptions = {
  /** 1-based prompt numbers (`buildPackPrompts` order) that get the Project Setup rules. */
  readonly setupPromptNumbers?: readonly number[];
  /** Billing severity per prompt kind; a kind left out keeps the default for the pack's weight. */
  readonly billing?: Partial<BillingByKind>;
};

/** Owner question 9's default ruling, in one place: which prompts are Project Setup prompts. */
export const DEFAULT_SETUP_PROMPT_NUMBERS: Readonly<Record<BuildPack["weight"], readonly number[]>> = Object.freeze({
  full: Object.freeze([3]),
  light: Object.freeze([]),
});

/** Owner question 8's default ruling: billing severity per prompt kind and pack weight. */
export const DEFAULT_BILLING: Readonly<Record<BuildPack["weight"], BillingByKind>> = Object.freeze({
  full: Object.freeze({ setup: "hard", standard: "soft" }),
  light: Object.freeze({ setup: "off", standard: "off" }),
});

/** The default ruling for a pack's weight. */
export function defaultBuildPackStandard(weight: BuildPack["weight"]): { setupPromptNumbers: readonly number[]; billing: BillingByKind } {
  return { setupPromptNumbers: DEFAULT_SETUP_PROMPT_NUMBERS[weight], billing: DEFAULT_BILLING[weight] };
}

const PROMPT_SLOTS = ["first", "second"] as const;

/** Every prompt in a pack with its artifact path and number, in `buildPackPrompts` order. */
function packPrompts(pack: BuildPack): { prompt: BuildPrompt; path: IssuePath; n: number }[] {
  if (pack.weight === "light") {
    return pack.setupPrompts.map((prompt, index) => ({ prompt, path: ["setupPrompts", index], n: index + 1 }));
  }
  return BUILD_PHASES.flatMap((phase, phaseIndex) =>
    PROMPT_SLOTS.map((slot, slotIndex) => ({
      prompt: pack.phases[phase.key].prompts[slot],
      path: ["phases", phase.key, "prompts", slot] as IssuePath,
      n: phaseIndex * PROMPT_SLOTS.length + slotIndex + 1,
    })),
  );
}

/**
 * A whole build pack against standard v1: each prompt's rules, the stack's
 * outside-service cap, and no Next.js major pin in the stack or PRODUCT.md.
 * Billing severity per prompt kind comes from `options.billing`, then
 * `DEFAULT_BILLING` for the pack's weight. Throws a RangeError for a setup
 * prompt number no pack of that weight can have (a caller bug, not model output).
 */
export function checkBuildPackStandard(pack: BuildPack, options: BuildPackStandardOptions = {}): CheckIssue[] {
  const defaults = defaultBuildPackStandard(pack.weight);
  const prompts = packPrompts(pack);
  const setupNumbers = options.setupPromptNumbers ?? defaults.setupPromptNumbers;
  // Validated against what the weight allows, not this pack's length: a light pack's prompt count varies.
  const most = pack.weight === "full" ? BUILD_PHASES.length * PROMPT_SLOTS.length : LIMITS.buildPack.lightPromptsMax;
  for (const n of setupNumbers) {
    if (!Number.isInteger(n) || n < 1 || n > most) {
      throw new RangeError(`setupPromptNumbers: ${String(n)} is not a prompt number a ${pack.weight} pack can have (1 to ${most}).`);
    }
  }
  const billing: BillingByKind = {
    setup: options.billing?.setup ?? defaults.billing.setup,
    standard: options.billing?.standard ?? defaults.billing.standard,
  };
  const issues: CheckIssue[] = [];
  for (const { prompt, path, n } of prompts) {
    const role: PromptRole = setupNumbers.includes(n) ? "setup" : "standard";
    issues.push(...checkBuildPrompt(prompt, { role, billing: billing[role], label: `Prompt ${n}` }, path));
  }
  const outside = pack.stack.filter((item) => item.outsideService).length;
  if (outside > LIMITS.buildPack.outsideServicesMax) {
    issues.push(issue("hard", "stack_services", ["stack"], `The stack lists ${outside} outside services; the most is ${LIMITS.buildPack.outsideServicesMax}.`));
  }
  pack.stack.forEach((item, index) => {
    if (NEXT_PIN.test(item.value)) {
      issues.push(issue("hard", "next_pin", ["stack", index, "value"], 'The stack pins a Next.js major version; say "Next.js".'));
    }
  });
  if (pack.productMd !== undefined && NEXT_PIN.test(pack.productMd)) {
    issues.push(issue("hard", "next_pin", ["productMd"], 'PRODUCT.md pins a Next.js major version; say "Next.js".'));
  }
  return issues;
}
