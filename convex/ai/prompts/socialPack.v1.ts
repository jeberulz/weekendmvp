/**
 * WP76-S2a. Social pack (`crew_social_pack`, Theo): the seven launch-week
 * posts, Friday (launch day) to Thursday, as a draft the founder reviews.
 * `fast` tier (`02` §5.2 puts social posts on Haiku), thinking off, one
 * structured call with the C-ART social pack schema as the output schema.
 * Nothing here posts: the founder copies each post to the platform they use.
 *
 * Inputs (all quoted data): the blueprint the launch uses, and the brand
 * kit's name, tagline and voice. The founder adds the link to each post
 * themselves, so no field carries a URL, an address or an @handle (the S2a
 * `social_link_in_text` check refuses one).
 *
 * Any change to this file or to `crewShared.ts` (comments included: the lock
 * hashes module source) needs a version bump (a new `socialPack.v2.ts`),
 * then `node --experimental-strip-types scripts/check-prompt-versions.mjs --write`.
 */

import { definePromptSpec } from "../../../lib/workspace/contracts/prompts.ts";
import {
  LIMITS,
  SOCIAL_DAYS,
  SOCIAL_POST_FORMATS,
  SOCIAL_POST_KINDS,
  artifactOutputSchemas,
  type SocialPack,
} from "../../../lib/workspace/contracts/artifacts.ts";
import { CREW_SYSTEM_RULES, REVISION_INSTRUCTION, dataBlock, revisionBlocks } from "./crewShared.ts";

export type SocialPackInput = {
  /** The blueprint the launch uses, as JSON. */
  readonly blueprint: string;
  /** The brand kit's name, tagline and voice, as JSON. */
  readonly brand: string;
  /** A revision's stored draft block, added by the runner. */
  readonly previousArtifact?: string | null;
  /** A revision's founder note block, added by the runner. Untrusted. */
  readonly revisionNote?: string | null;
};

const SYSTEM = [
  ...CREW_SYSTEM_RULES,
  "Your role: social media writer. You write the founder's launch-week social pack: seven posts, one a day. The founder reviews and approves them, then copies each one to the platform they post on; nothing is posted for them.",
  `The days, in order: ${SOCIAL_DAYS.join(", ")}. fri is launch day: its post announces the business and its kind is launch. The other six days build on it through the week to thu.`,
  `Each post has a kind (${SOCIAL_POST_KINDS.join(", ")}) and a format (${SOCIAL_POST_FORMATS.join(", ")}). Vary kinds and formats across the week. A reel_script caption reads as the script of a short video.`,
  `hook is the first line a reader sees. caption is the full post. shortCaption must stand alone at ${LIMITS.socialPack.shortCaption} characters or fewer, because it is posted as is on X; it is not a fragment of the caption. imageText is the 2 to 3 words printed on the post's card.`,
  "Keep every post short so all seven fit in one reply: a hook is one short line, a caption stays under about 900 characters, and most posts need far less.",
  "imageAlt is plain alt text for a screen reader, describing the card. Include it only on image and carousel posts; leave it out on every other format.",
  `pollOptions are only for a poll: ${LIMITS.socialPack.pollOptionsMin} to ${LIMITS.socialPack.pollOptionsMax} short answers. Leave the field out on every other format.`,
  "hashtags are plain words without the # sign: letters, numbers and _ only, no spaces, none repeated.",
  "No URLs, web addresses, domain names, email addresses or @handles in any field. The founder adds their own link and tags; you may say \"link in bio\".",
  "Never invent facts, prices, discounts, dates, figures, testimonials or user counts, and never claim other people already use the product. Use only what the data states.",
  "Write in the brand voice from <brand>: follow its traits and say line, and never write like its dontSay line. The business name is name in <brand>, copied exactly.",
].join("\n");

export const socialPackSpec = definePromptSpec<SocialPackInput, SocialPack>({
  id: "crew-social-pack",
  version: 1,
  tier: "fast",
  // TIER_RECOMMENDED_EFFORT.fast, written out: the lock lets a prompt module import only definePromptSpec from C-PROMPT.
  effort: "low",
  thinking: { type: "disabled" },
  maxTokens: 4_096,
  system: SYSTEM,
  buildUser: (inputs) =>
    [
      dataBlock("blueprint", "The business's blueprint (JSON).", inputs.blueprint),
      dataBlock("brand", "The brand kit's name, tagline and voice (JSON).", inputs.brand),
      ...revisionBlocks(inputs),
      ...(typeof inputs.previousArtifact === "string" && inputs.previousArtifact.length > 0 ? [REVISION_INSTRUCTION] : []),
      "Write this business's launch-week social pack.",
    ].join("\n"),
  outputSchema: artifactOutputSchemas.social_pack,
  cacheLayout: { system: "stable", business: "per_business", ttl: "5m" },
  evalSuite: "crew-social-pack",
  mode: "realtime",
  fallbacks: "none",
});
