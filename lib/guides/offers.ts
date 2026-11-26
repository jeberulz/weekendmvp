import { z } from "zod";

/**
 * Offers registry for guide upsells (WP103-S3). A guide lists the offers it shows by id and
 * placement. Prices and live status come from config, never from typed text.
 *
 * Plain Node can load this file (no `@/` alias). Config-backed lookups live in `offer-live.ts`.
 */

/** Keys a paid offer may use for its price. `offer-live.ts` resolves each one from `lib/live/config.ts`. */
export const PRICE_CONFIG_KEYS = ["BUILD_ALONG.standardUsd"] as const;
export type PriceConfigKey = (typeof PRICE_CONFIG_KEYS)[number];

/** Names of the functions in `offer-live.ts` that work out an offer's status from config. */
export const STATUS_RESOLVER_KEYS = ["build-along"] as const;
export type StatusResolverKey = (typeof STATUS_RESOLVER_KEYS)[number];

export const PRICE_TOKEN = "{price}";

const text = z.string().trim().min(1);

export const offerSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "id is lowercase words joined by hyphens"),
    kind: z.enum(["paid", "waitlist", "free-asset"]),
    /** "derived" means the status is worked out from config by `statusResolver`. */
    status: z.enum(["open", "waitlist", "closed", "derived"]),
    statusResolver: z.enum(STATUS_RESOLVER_KEYS).optional(),
    title: text,
    eyebrow: text,
    ariaLabel: text,
    /** One line. A paid offer puts `{price}` where the price goes. */
    promise: text,
    linkLabel: text,
    /** An internal path like /live/build-along, or an https URL. */
    url: text,
    /** What you get, at most three. Left empty until the owner approves the wording. */
    bullets: z.array(text).max(3).optional(),
    /** One honest line on who this is not for. */
    notFor: text.optional(),
    /** Paid offers only. A key into `lib/live/config.ts`, never a typed price. */
    price: z.object({ configKey: z.enum(PRICE_CONFIG_KEYS) }).optional(),
    /** A scarcity or deadline line. It must name the data that backs it. */
    urgency: z.object({ text, source: text }).optional(),
    topics: z.array(text).min(1),
    audiences: z.array(text).min(1),
    /** Why a guide would pick this offer. Read by the skill when it suggests offers. */
    fit: text,
  })
  .superRefine((offer, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (offer.kind === "paid") {
      if (!offer.price) issue("price", "a paid offer needs price.configKey");
      const tokens = offer.promise.split(PRICE_TOKEN).length - 1;
      if (tokens !== 1) issue("promise", `a paid offer's promise needs the ${PRICE_TOKEN} token exactly once, found ${tokens}`);
    } else {
      if (offer.price) issue("price", `a ${offer.kind} offer cannot state a price`);
      if (offer.promise.includes(PRICE_TOKEN)) issue("promise", `a ${offer.kind} offer cannot use the ${PRICE_TOKEN} token`);
    }
    if (offer.status === "derived" && !offer.statusResolver) issue("statusResolver", 'status "derived" needs a statusResolver');
    if (offer.status !== "derived" && offer.statusResolver) issue("statusResolver", 'a statusResolver only applies to status "derived"');
  });

export type Offer = z.infer<typeof offerSchema>;

/** What an offer's status really is right now, and why. Worked out in `offer-live.ts`. */
export type EffectiveStatus = { status: "open" | "waitlist" | "closed"; reason: string };

const registrySchema = z
  .array(offerSchema)
  .refine((list) => new Set(list.map((offer) => offer.id)).size === list.length, "offer ids must be unique");

/** Validated at import, so a bad entry fails the build. */
export const offers: readonly Offer[] = registrySchema.parse([
  {
    id: "build-along",
    kind: "paid",
    status: "derived",
    statusResolver: "build-along",
    title: "Do this live with John",
    eyebrow: "Paid · Live",
    ariaLabel: "Build-Along sprint",
    promise: "The {price} Build-Along sprint. Two hours, live.",
    linkLabel: "See the Build-Along",
    url: "/live/build-along",
    price: { configKey: "BUILD_ALONG.standardUsd" },
    topics: ["validation", "first-sale", "build"],
    audiences: ["9-to-5", "non-technical", "builder"],
    fit: "The natural next step after any guide whose last step is a shipped proof: do the next step live instead of alone.",
  },
]);

export function offerById(id: string, list: readonly Offer[] = offers): Offer {
  const offer = list.find((candidate) => candidate.id === id);
  if (!offer) throw new Error(`Unknown offer "${id}". Known offers: ${list.map((o) => o.id).join(", ") || "none"}`);
  return offer;
}

export type OfferMatch = { offer: Offer; score: number; matchedTopics: string[]; matchedAudiences: string[] };

/**
 * Rank offers for a guide by tag overlap. A topic match counts double an audience match.
 * Offers declared closed are left out. An offer with no overlap is left out.
 * The skill suggests the top two and the owner approves.
 */
export function rankOffers(
  guide: { topics: readonly string[]; audiences: readonly string[] },
  list: readonly Offer[] = offers,
): OfferMatch[] {
  const lower = (values: readonly string[]) => new Set(values.map((value) => value.toLowerCase()));
  const topics = lower(guide.topics);
  const audiences = lower(guide.audiences);
  return list
    .filter((offer) => offer.status !== "closed")
    .map((offer) => {
      const matchedTopics = offer.topics.filter((topic) => topics.has(topic.toLowerCase()));
      const matchedAudiences = offer.audiences.filter((audience) => audiences.has(audience.toLowerCase()));
      return { offer, score: matchedTopics.length * 2 + matchedAudiences.length, matchedTopics, matchedAudiences };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || a.offer.id.localeCompare(b.offer.id));
}
