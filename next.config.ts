import type { NextConfig } from "next";

const LEGACY_ORIGIN =
  process.env.LEGACY_ORIGIN ?? "https://legacy.weekendmvp.app";

const nextConfig: NextConfig = {
  cacheComponents: true,

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
    // Populated in U13: .html → extensionless, trailing-slash collections,
    // /image/og/* → /og/*.
    return [];
  },
};

export default nextConfig;
