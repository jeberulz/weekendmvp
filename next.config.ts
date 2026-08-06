import type { NextConfig } from "next";

const LEGACY_ORIGIN =
  process.env.LEGACY_ORIGIN ?? "https://legacy.weekendmvp.app";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Own trailing-slash 308s in middleware so apex+slash collapses to www
  // clean in one hop (WP13). Without this, Next emits a same-host relative
  // slash redirect before our apex→www logic can run.
  skipTrailingSlashRedirect: true,
  outputFileTracingIncludes: {
    "/links": ["./content/social/reels/campaigns/**/calendar.csv"],
    // sitemap.xml enumerates MDX at request time, so the content dirs must be
    // traced into its function bundle or it emits hub pages only.
    "/sitemap.xml": [
      "./content/ideas/**/*.mdx",
      "./content/articles/**/*.mdx",
      "./content/newsletter-pages/**/*.mdx",
      // Idea publish dates for lastmod (MDX idea files omit publishedAt).
      "./ideas/manifest.json",
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

  /**
   * WP27-S4. A generated preview is a private, expiring artifact.
   *
   * Matched on the path rather than set inside the page so the *same*
   * headers apply to the 404 a malformed, unknown, or expired token
   * produces. Setting them only on a successful render would make
   * `Cache-Control` itself the enumeration oracle that the route's single
   * `notFound()` path exists to close.
   *
   * `no-store` is the point: a shared cache or CDN holding a preview would
   * serve one visitor's private artifact to another. `no-referrer` keeps the
   * capability token, which lives in the path, out of the `Referer` of any
   * cross-origin request the page might ever make.
   */
  async headers() {
    return [
      {
        source: "/preview/:token",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive, nosnippet, noimageindex",
          },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
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
