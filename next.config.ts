import type { NextConfig } from "next";

const LEGACY_ORIGIN =
  process.env.LEGACY_ORIGIN ?? "https://legacy.weekendmvp.app";

const nextConfig: NextConfig = {
  cacheComponents: true,
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
      // .html → extensionless (legacy idea/article/newsletter URLs)
      {
        source: "/:path*.html",
        destination: "/:path*",
        permanent: true,
      },
      // /image/og/* paths remain at /image/og/* (files now live under
      // public/image/og/) — no redirect needed; preserved verbatim.
      // The plan called for /og/* parity, but moving everything under
      // public/image/og/ keeps every cached social card URL valid.

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
