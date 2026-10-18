import Link from "next/link";
import { connection } from "next/server";

import { MinimalLiveNav } from "@/components/live/MinimalLiveNav";
import { Logo } from "@/components/primitives/Logo";
import { newsreaderEditorial } from "@/lib/fonts";
import { BUILD_ALONG } from "@/lib/live/config";
import { livePriceAt } from "@/lib/live/pricing";
import { buildAlongPhase } from "@/lib/live/schedule";
import { loadSeatsInfo } from "@/lib/live/seats-server";
import { readLiveClockMs } from "@/lib/live/now";

/**
 * Checkout-focused chrome for `/live/build-along`.
 * No marketing MegaNav / SiteFooter — only logo, section anchors, ticket CTA.
 */
export const instant = false;

export default async function LiveCheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  const now = readLiveClockMs();
  const price = livePriceAt(now);
  const seats = await loadSeatsInfo();
  const phase = buildAlongPhase(now);
  const ended = phase === "ended";
  const soldOut = seats.soldOut && !ended;

  let ctaLabel = `Get my ticket, ${price.amountLabel}`;
  let ctaDisabled = false;
  const ctaHref = "#ticket";

  if (ended) {
    ctaLabel = "Session ended";
    ctaDisabled = true;
  } else if (soldOut) {
    ctaLabel = "Sold out";
    ctaDisabled = true;
  } else if (phase === "pre_sale") {
    ctaLabel = "Tickets open Sun 1 Nov";
    ctaDisabled = true;
  }

  return (
    <div
      className={`${newsreaderEditorial.variable} theme-desk relative min-h-screen overflow-x-clip bg-home-paper font-sans text-home-ink selection:bg-home-orange-light/40`}
    >
      <MinimalLiveNav
        ctaLabel={ctaLabel}
        ctaHref={ctaHref}
        ctaDisabled={ctaDisabled}
      />
      <main id="main">{children}</main>
      <footer className="border-t border-home-rule">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-3 px-5 py-8 sm:px-10">
          <Link
            href="/"
            aria-label="Weekend MVP home"
            className="rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-home-orange"
          >
            <Logo className="h-4 w-32 text-home-ink" />
          </Link>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#6B6457]">
            <a href="#ticket" className="hover:text-home-ink">
              {BUILD_ALONG.title}
            </a>
            <Link href="/privacy-policy" className="hover:text-home-ink">
              Privacy
            </Link>
            <span>All times GMT</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
