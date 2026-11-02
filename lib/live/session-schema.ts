import type { SessionPhase } from "@/lib/live/session-phase";
import {
  sessionEmbedUrl,
  sessionPath,
  type LiveSession,
} from "@/lib/live/sessions";
import {
  ORG_ID,
  PERSON_ID,
  SITE,
  breadcrumbSchema,
  buildGraph,
  organizationSchema,
  personSchema,
} from "@/lib/seo";

/**
 * EducationEvent + optional VideoObject for a free session page.
 *
 * Demand seo-targets-v1:
 * - VideoObject uses embedUrl only (no contentUrl / watch URL).
 * - Emit VideoObject only once youtubeId is public (past phase).
 * - Keep Event markup after the session (Demand §2); skip BroadcastEvent
 *   while the stream is Unlisted.
 */
export function sessionJsonLd(session: LiveSession, phase: SessionPhase) {
  const pageUrl = `${SITE}${sessionPath(session.slug)}`;
  const eventStatus =
    phase === "cancelled"
      ? "https://schema.org/EventCancelled"
      : phase === "postponed"
        ? "https://schema.org/EventPostponed"
        : "https://schema.org/EventScheduled";

  const event: Record<string, unknown> = {
    "@type": "EducationEvent",
    name: session.title,
    description:
      session.seo?.description ??
      `Free live build of ${session.ideaName}, ${session.oneLiner}.`,
    about: `Build a ${session.category} app with AI: ${session.ideaName}`,
    startDate: session.startsAt,
    endDate: session.endsAt,
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    eventStatus,
    isAccessibleForFree: true,
    location: {
      "@type": "VirtualLocation",
      url: pageUrl,
    },
    organizer: { "@id": ORG_ID },
    performer: { "@id": PERSON_ID },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: session.lumaUrl,
    },
  };

  if (session.thumbnail) {
    event.image = session.thumbnail.startsWith("http")
      ? session.thumbnail
      : `${SITE}${session.thumbnail}`;
  }

  const graph: Array<Record<string, unknown> | null | undefined> = [
    personSchema(),
    organizationSchema(),
    breadcrumbSchema([
      { label: "Home", href: `${SITE}/` },
      { label: "Live", href: `${SITE}/live` },
      { label: session.ideaName, href: pageUrl },
    ]),
    event,
  ];

  if (phase === "past" && session.youtubeId) {
    graph.push(sessionVideoObject(session));
  }

  return buildGraph(...graph);
}

/** VideoObject for a public replay. embedUrl only — never contentUrl. */
export function sessionVideoObject(session: LiveSession): Record<string, unknown> {
  if (!session.youtubeId) {
    throw new Error(`sessionVideoObject requires youtubeId (${session.id})`);
  }
  const pageUrl = `${SITE}${sessionPath(session.slug)}`;
  const thumbnail =
    session.thumbnail &&
    (session.thumbnail.startsWith("http")
      ? session.thumbnail
      : `${SITE}${session.thumbnail}`);

  const video: Record<string, unknown> = {
    "@type": "VideoObject",
    name:
      session.seo?.title ??
      `Build a ${session.category} app with AI: ${session.ideaName} Replay`,
    description:
      session.seo?.description ??
      `Full replay: ${session.ideaName}, ${session.oneLiner}, built live with AI.`,
    uploadDate: session.replayPublishedAt ?? session.endsAt,
    embedUrl: sessionEmbedUrl(session.youtubeId),
    url: pageUrl,
    isAccessibleForFree: true,
    publisher: { "@id": ORG_ID },
  };

  if (session.durationIso) video.duration = session.durationIso;
  if (thumbnail) video.thumbnailUrl = thumbnail;

  video.publication = {
    "@type": "BroadcastEvent",
    isLiveBroadcast: true,
    startDate: session.startsAt,
    endDate: session.endsAt,
  };

  if (session.chapters && session.chapters.length > 0) {
    video.hasPart = session.chapters.map((chapter) => ({
      "@type": "Clip",
      name: chapter.name,
      startOffset: chapter.startOffset,
      endOffset: chapter.endOffset,
      url: `${pageUrl}#t=${chapter.startOffset}`,
    }));
  }

  return video;
}
