/**
 * GET /articles/feed.xml — RSS feed of published articles (newest first).
 * Items come from content/articles/*.mdx frontmatter (no Convex needed).
 */

import { articleFeedItems, renderRss, rssResponse } from "@/lib/feeds";

export async function GET() {
  const xml = renderRss(
    {
      title: "Weekend MVP — Articles",
      path: "/articles",
      feedPath: "/articles/feed.xml",
      description:
        "Guides and playbooks for weekend builders: validating ideas, shipping MVPs, and building with AI tools.",
    },
    await articleFeedItems(),
  );
  return rssResponse(xml);
}
