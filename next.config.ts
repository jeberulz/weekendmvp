import type { NextConfig } from "next";

const LEGACY_ORIGIN =
  process.env.LEGACY_ORIGIN ?? "https://legacy.weekendmvp.app";

const nextConfig: NextConfig = {
  cacheComponents: true,
  outputFileTracingIncludes: {
    "/links": ["./content/social/reels/campaigns/**/calendar.csv"],
    // sitemap.xml enumerates MDX at request time, so the content dirs must be
    // traced into its function bundle or it emits hub pages only.
    "/sitemap.xml": [
      "./content/ideas/**/*.mdx",
      "./content/articles/**/*.mdx",
      "./content/newsletter-pages/**/*.mdx",
    ],
  },
  turbopack: {
    root: __dirname,
  },

  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      // Any path this app does not own is served by the legacy static site
      // until its slice migrates. Removed at cutover (U14).
      fallback: [
        {
          source: "/:path*",
          destination: `${LEGACY_ORIGIN}/:path*`,
        },
      ],
    };
  },

  async redirects() {
    return [
      // Path cleaning (.html / trailing slash) + apex→www live in
      // middleware.ts so dirty URLs resolve in a single 308 (WP13).
      // /image/og/* stays under public/image/og/ — no redirect needed.

      // Legacy /api/ideas-today rewrite target — redirect to the new public URL
      {
        source: "/api/ideas-today",
        destination: "/ideas/today",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
