import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

/**
 * Allowlist mirrors the legacy robots.txt: AI crawlers (GPTBot, ChatGPT-User,
 * Claude-Web, Anthropic-AI, PerplexityBot, Google-Extended, Bingbot,
 * Googlebot) get explicit Allow rules so the email-gate-friendly content
 * (R4 — body server-rendered by default) is indexable for AEO. /api is
 * disallowed because /ideas/today is exposed at its clean public URL.
 */
export default function robots(): MetadataRoute.Robots {
  const ai = [
    "GPTBot",
    "ChatGPT-User",
    "Claude-Web",
    "ClaudeBot",
    "Anthropic-AI",
    "PerplexityBot",
    "Google-Extended",
    "Bingbot",
    "Googlebot",
  ];
  // Private / activation surfaces — keep out of the crawl budget. Trailing
  // slash form matches the existing /api/ + /content/* Disallow style.
  const privatePaths = [
    "/api/",
    "/content/social/",
    "/content/video/",
    "/preview/",
    "/login/",
    "/signup/",
    "/dashboard/",
    "/build/",
  ];
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: privatePaths,
      },
      // AI groups previously Allow:/ only, which overrode * Disallows for
      // those bots. Mirror the private Disallow list so preview/auth/build
      // stay out of AEO crawlers too.
      ...ai.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: privatePaths,
      })),
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
