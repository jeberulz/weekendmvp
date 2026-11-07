import type { Metadata } from "next";

/**
 * WP74 wizard routes (`/start/[ideaSlug]`, `/start/own`). Private and
 * dormant: every page calls `requireWizardAccess`, which 404s unless the
 * workspace is on for the caller's cohort (C-OPS) and they are signed in.
 * L1-C9: a signed-in founder off the allowlist sees "not in the beta yet".
 */
export const metadata: Metadata = {
  title: { template: "%s | Build", default: "Build your idea" },
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true,
    googleBot: { index: false, follow: false, noarchive: true, noimageindex: true },
  },
};

export default function StartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
