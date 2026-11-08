/**
 * WP90-S3. The fixture reply for `crew-idea-seed@2`: a valid, audit-passing
 * seed draft built from the idea page the request quotes, so a fixture
 * precompute run writes a real seed row for every idea, offline and free.
 *
 * Deterministic and fixture-only (`fixtureOutputs.ts` rules): it reads the
 * `<idea_page>` block of the request and nothing else. Page text is reused
 * only where it is short and carries no market claim; everything else is a
 * fixed sentence that says it was written in test mode. It never invents a
 * buyer quote or a competitor, so the audit has nothing to reject.
 */
import type Anthropic from "@anthropic-ai/sdk";

import { hasMarketClaim } from "../../../lib/workspace/contracts/marketClaims";
import type { IdeaSeedDraft } from "../../../lib/workspace/contracts/seeds";

type Page = {
  readonly title: string;
  readonly description: string;
  readonly audiences: readonly string[];
  readonly howItWorks: readonly string[];
};

function userText(params: Anthropic.MessageCreateParamsNonStreaming): string {
  return params.messages
    .map((message) =>
      typeof message.content === "string"
        ? message.content
        : message.content.map((block) => (block.type === "text" ? block.text : "")).join(""),
    )
    .join("\n");
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

/** The quoted page: the JSON line inside `<idea_page>`, or null. */
function pageOf(params: Anthropic.MessageCreateParamsNonStreaming): Page | null {
  const match = /<idea_page>\n[^\n]*\n([^\n]*)\n<\/idea_page>/u.exec(userText(params));
  if (match === null) return null;
  try {
    const raw: unknown = JSON.parse(match[1]!);
    if (typeof raw !== "object" || raw === null) return null;
    const record = raw as Record<string, unknown>;
    return {
      title: typeof record.title === "string" ? record.title : "",
      description: typeof record.description === "string" ? record.description : "",
      audiences: strings(record.audiences),
      howItWorks: strings(record.howItWorks),
    };
  } catch {
    return null;
  }
}

/** One line of page text, if it fits and carries no market claim; otherwise the fallback. */
function pageLine(text: string | undefined, max: number, fallback: string): string {
  const clean = (text ?? "").replace(/\s+/gu, " ").trim();
  return clean.length > 0 && clean.length <= max && !hasMarketClaim(clean) ? clean : fallback;
}

export function seedFixtureReply(params: Anthropic.MessageCreateParamsNonStreaming): IdeaSeedDraft | undefined {
  const page = pageOf(params);
  if (page === null) return undefined;
  const name = pageLine(page.title, 40, "Test idea");
  const audience = pageLine(page.audiences[0]?.replace(/-/gu, " ").toLowerCase(), 40, "early users");
  const steps = page.howItWorks
    .map((step) => pageLine(step, 140, ""))
    .filter((step) => step.length > 0)
    .slice(0, 5);
  const howItWorks = steps.length >= 2 ? steps : ["Sign up with an email address", "Try the one core action"];
  const pain = pageLine(page.description, 200, "The problem on the idea page, in the buyer's words.");
  return {
    blueprint: {
      pitch: pageLine(`${name}, drafted in test mode from its idea page.`, 160, "Drafted in test mode from its idea page."),
      oneUser: `One of the ${audience} the idea page describes.`,
      oneLoop: "They come back to do the one core action the page describes.",
      features: [
        "Sign up with an email address",
        "The one core action from the idea page",
        "A simple history of past actions",
      ],
      profile: { ideaKind: "app", buyer: "consumer", deliveryFormat: "self_serve", audiencePlural: audience },
      scopeCuts: ["Billing", "Teams and sharing"],
    },
    wizardHints: {
      platform: { deviceNeeds: [], confidence: "low" },
      commercialModel: { value: "free", reason: "Test mode: no AI model read the business model.", confidence: "low" },
      goal: { kind: "waitlist", timeframe: "weekend", reason: "Test mode: a waitlist is the default first goal.", confidence: "low" },
      names: [name],
    },
    brandSeeds: {
      positioning: `Test mode positioning for ${name}.`,
      voiceCues: ["Plain", "Calm"],
      avoid: ["Hype words"],
      imagery: "Simple, real scenes of the person using it.",
    },
    landingSeeds: {
      heroAngle: `Test mode hero angle for ${name}.`,
      painLines: [pain],
      howItWorks,
      buyerWords: [],
    },
    emailAngles: [
      { angle: "Why we built it", hook: "Test mode: the problem, told plainly." },
      { angle: "How it works", hook: "Test mode: the steps, one email each." },
    ],
    socialAngles: [
      { angle: "The problem", hook: "Test mode: name the problem.", channel: "LinkedIn" },
      { angle: "The fix", hook: "Test mode: show the one action.", channel: "Instagram" },
      { angle: "Behind the build", hook: "Test mode: what we cut this weekend.", channel: "X" },
    ],
    buildPackSeeds: {
      stack: "Next.js, Convex and Vercel",
      coreFeature: "Input: what the person enters.\nOutput: the one result the idea page promises.\nEmpty state: a short line on what to do first.",
      screens: ["Home"],
      doNotBuild: ["Billing"],
    },
    roleBriefs: { outbound: { buyerTitles: [], channels: [] }, seo: { searchTerms: [] } },
  };
}
