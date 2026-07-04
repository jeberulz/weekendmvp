/**
 * GET /newsletter/feed.xml — RSS feed of newsletter issues (newest first).
 * Items come from newsletter/manifest.json (bundled at build; no Convex needed).
 */

import { newsletterFeedItems, renderRss, rssResponse } from "@/lib/feeds";

export async function GET() {
  const xml = renderRss(
    {
      title: "The Weekend MVP Newsletter",
      path: "/newsletter",
      feedPath: "/newsletter/feed.xml",
      description:
        "Twice-daily newsletter for weekend builders. Fresh startup ideas every morning, deeper build guides every afternoon.",
    },
    newsletterFeedItems(),
  );
  return rssResponse(xml);
}
