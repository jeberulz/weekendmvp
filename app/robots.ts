import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_BASE_URL ?? "https://weekendmvp.app";

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
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/content/social/", "/content/video/"],
      },
      ...ai.map((userAgent) => ({ userAgent, allow: "/" })),
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
