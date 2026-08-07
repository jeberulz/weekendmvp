import type { Metadata } from "next";

/**
 * WP28-S6. The not-found boundary for tenant hosts.
 *
 * Without this file, `notFound()` in the tenant route falls through to the
 * root `app/not-found.tsx`, which is the full Weekend MVP marketing 404 —
 * MegaNav, SiteFooter, the Starter Kit signup, cal.com, our logo and
 * copyright. Independent review confirmed that shipped on every published
 * customer page as ~27KB of RSC payload, and that it was served at **200** on
 * arbitrary unclaimed subdomains whenever Convex was unreachable.
 *
 * That contradicted this route's own contract ("nothing here can walk a
 * customer's visitor back onto our marketing site") and the owner ruling that
 * an unrecognised host gets "no branding, no application shell". The route
 * suite missed it because it asserted on *source text*, which stayed green
 * while the rendered output carried all of it.
 *
 * So this page is deliberately bare: no import from `components/`, no link,
 * no brand, no navigation. Nothing here identifies whose infrastructure this
 * is or offers a way onto it.
 *
 * The status is still 200 under Cache Components — PPR flushes the shell
 * before `notFound()` runs — and that residual is accepted by owner decision
 * (2026-08-07): a bare 200 during a backend outage is preferred over failing
 * closed, which would take every customer site offline at once. Middleware
 * still answers a genuine 404 whenever it can positively determine a host is
 * not live.
 */
export const metadata: Metadata = {
  // `absolute`, or the root layout appends "| Weekend MVP" — the same trap
  // that branded customer page titles in S3.
  title: { absolute: "Not found" },
  robots: { index: false, follow: false },
};

export default function TenantNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6">
      <p className="text-sm text-zinc-400">This site is not available.</p>
    </main>
  );
}
