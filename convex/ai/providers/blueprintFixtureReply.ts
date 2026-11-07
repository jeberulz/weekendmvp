/**
 * Roster per idea, Part C (WP90). The fixture reply for the blueprint prompts
 * (version 2): the HydroTrail blueprint for a library idea, or the own-idea
 * light blueprint, with the `profile` and `team` of the fixture profile the
 * idea's own words point to (`lib/workspace/contracts/fixtures/teamProfiles.ts`).
 * So locally an AI receptionist hires Outbound and a course hires Curriculum,
 * with zero AI spend.
 *
 * Fixture only: the only importer is `fixtureOutputs.ts` (a test checks).
 * Nothing here reads env, the network or the clock. The idea is read from the
 * task block the prompt built (`<library_idea>` or `<own_idea>`, quoted JSON).
 */

import type Anthropic from "@anthropic-ai/sdk";

import { hydrotrailBlueprint, ownIdeaLightBlueprint } from "../../../lib/workspace/contracts/fixtures/hydrotrail";
import { FIXTURE_TEAM_PROFILES, fixtureTeamProfileFor } from "../../../lib/workspace/contracts/fixtures/teamProfiles";

/** The HydroTrail library idea keeps its own worked profile (hikers). */
const HYDROTRAIL_SLUG = "hydrotrail";

function textOf(content: Anthropic.MessageParam["content"]): string {
  if (typeof content === "string") return content;
  return content.map((block) => (block.type === "text" ? block.text : "")).join("");
}

/** The first line between `<tag>` and `</tag>` that parses as JSON, or undefined. */
function taggedJson(text: string, tag: string): unknown {
  const lines = text.split("\n");
  const at = lines.indexOf(`<${tag}>`);
  if (at < 0) return undefined;
  for (const line of lines.slice(at + 1)) {
    if (line === `</${tag}>`) return undefined;
    try {
      return JSON.parse(line) as unknown;
    } catch {
      // The block's one-line description; keep looking.
    }
  }
  return undefined;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The words a library idea record describes itself with. */
function libraryIdeaText(idea: Record<string, unknown>): string {
  return ["title", "description", "summary", "category"]
    .map((key) => idea[key])
    .filter((value): value is string => typeof value === "string")
    .join(" ");
}

/** The fixture blueprint for a blueprint request. */
export function blueprintFixtureReply(params: Anthropic.MessageCreateParamsNonStreaming): unknown {
  const userText = params.messages.filter((message) => message.role === "user").map((message) => textOf(message.content)).join("\n");
  const ownIdea = taggedJson(userText, "own_idea");
  if (ownIdea !== undefined) {
    // An own idea that happens to parse as JSON (say "42") is still the founder's text.
    const text = typeof ownIdea === "string" ? ownIdea : JSON.stringify(ownIdea);
    const chosen = FIXTURE_TEAM_PROFILES[fixtureTeamProfileFor(text)];
    return { ...structuredClone(ownIdeaLightBlueprint), profile: { ...chosen.profile }, team: chosen.team.map((entry) => ({ ...entry })) };
  }
  const library = taggedJson(userText, "library_idea");
  const idea = isRecord(library) ? library : {};
  const slug = typeof idea.slug === "string" && /^[a-z0-9]+(-[a-z0-9]+)*$/u.test(idea.slug) ? idea.slug : HYDROTRAIL_SLUG;
  const chosen = FIXTURE_TEAM_PROFILES[slug === HYDROTRAIL_SLUG ? "consumer_app" : fixtureTeamProfileFor(libraryIdeaText(idea))];
  const blueprint = structuredClone(hydrotrailBlueprint);
  return {
    ...blueprint,
    ideaSlug: slug,
    profile: slug === HYDROTRAIL_SLUG ? blueprint.profile : { ...chosen.profile },
    team: chosen.team.map((entry) => ({ ...entry })),
  };
}
