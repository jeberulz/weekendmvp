/**
 * GET /feed.xml — RSS feed of published startup ideas (newest first).
 * Items come from ideas/manifest.json (bundled at build; no Convex needed).
 */

import { ideaFeedItems, renderRss, rssResponse } from "@/lib/feeds";

export async function GET() {
  const xml = renderRss(
    {
      title: "Weekend MVP — Startup Ideas",
      path: "/startup-ideas",
      feedPath: "/feed.xml",
      description:
        "Research-backed startup ideas you can build this weekend. New ideas published regularly.",
    },
    ideaFeedItems(),
  );
  return rssResponse(xml);
}
