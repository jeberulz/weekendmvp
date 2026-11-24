/**
 * WP100. The fixture reply for `wizard-idea-improve@1`: a deterministic "sharper"
 * sentence built from the founder's own words, so the Step 1 improve flow runs
 * offline and free in fixture mode (`AI_PROVIDER_MODE` not `"live"`).
 *
 * It only removes filler words, fixes the first capital and the full stop, and
 * reads the audience from a "for …" phrase. When that changes nothing it
 * answers `already_clear`. It never adds a fact, so the code checks
 * (`judgeIdeaImprovement`) pass it unchanged.
 *
 * Fixture only (`fixtureOutputs.ts` rules): the only importer is
 * `fixtureOutputs.ts`; nothing here reads env, the network or the clock.
 */
import type Anthropic from "@anthropic-ai/sdk";

function textOf(content: Anthropic.MessageParam["content"]): string {
  if (typeof content === "string") return content;
  return content.map((block) => (block.type === "text" ? block.text : "")).join("");
}

/** The quoted string inside `<tag>`, or null. */
function taggedString(text: string, tag: string): string | null {
  const lines = text.split("\n");
  const at = lines.indexOf(`<${tag}>`);
  if (at < 0) return null;
  for (const line of lines.slice(at + 1)) {
    if (line === `</${tag}>`) return null;
    try {
      const value: unknown = JSON.parse(line);
      if (typeof value === "string") return value;
    } catch {
      // The block's one-line description; keep looking.
    }
  }
  return null;
}

const FILLER = /\b(?:basically|kind of|sort of|just|really|literally|stuff|an app that|a thing that|something that)\b\s*/giu;

function tidyWords(text: string): string {
  return text.replace(FILLER, "").replace(/\bdont\b/giu, "don't").replace(/\s{2,}/gu, " ").trim();
}

function asSentence(text: string): string {
  const tidy = tidyWords(text).replace(/[.!?\s]+$/u, "");
  return tidy.length === 0 ? "" : `${tidy.charAt(0).toUpperCase()}${tidy.slice(1)}.`;
}

function audienceOf(text: string): string | null {
  const match = /\bfor ([\p{L} -]{3,50}?)(?=\s+(?:who|that|to|so|on|in|with)\b|[,.]|$)/iu.exec(text);
  return match === null ? null : match[1].trim().toLowerCase();
}

export function ideaImproveFixtureReply(params: Anthropic.MessageCreateParamsNonStreaming): unknown {
  const user = params.messages.filter((message) => message.role === "user").map((message) => textOf(message.content)).join("\n");
  const idea = taggedString(user, "idea") ?? "";
  const selected = taggedString(user, "selected");
  const hints = { audience: audienceOf(idea), coreAction: null, offer: null };
  if (selected !== null) {
    const replacement = tidyWords(selected);
    if (replacement.length === 0 || replacement === selected.trim()) {
      return { status: "already_clear", text: "", changeNote: "", hints };
    }
    return { status: "improved", text: replacement, changeNote: "Tightened the words you picked.", hints };
  }
  const sentence = asSentence(idea);
  if (sentence.length === 0 || sentence === idea.trim()) {
    return { status: "already_clear", text: "", changeNote: "", hints };
  }
  return { status: "improved", text: sentence, changeNote: "Tightened the wording and kept your idea.", hints };
}
