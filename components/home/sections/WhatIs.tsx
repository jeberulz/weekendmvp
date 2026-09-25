import Link from "next/link";

import { START_HERE, WHAT_IS } from "../content";
import { Container, Eyebrow } from "../ui";

/** Citeable “What is Weekend MVP” block + Start here links (SEO/AEO P1). */
export function WhatIs() {
  return (
    <section aria-labelledby="home-what-is-label" className="border-t border-home-rule bg-home-paper">
      <Container className="flex flex-col gap-6 py-10 md:gap-7 md:py-12 lg:flex-row lg:items-start lg:justify-between lg:gap-16">
        <div className="flex max-w-[720px] flex-col gap-3.5">
          <Eyebrow>
            <span id="home-what-is-label">What is Weekend MVP</span>
          </Eyebrow>
          <p id="home-what-is" className="text-[17px] leading-[1.6] text-home-ink-2 md:text-lg md:leading-[1.65]">
            {WHAT_IS}
          </p>
        </div>
        <nav aria-label="Start here" className="flex shrink-0 flex-col gap-3 lg:min-w-[240px] lg:pt-1">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-home-orange-ink">Start here</p>
          <ul className="flex flex-col gap-2.5">
            {START_HERE.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex text-[15px] font-medium text-home-ink underline decoration-home-rule underline-offset-4 transition-colors hover:text-home-orange-ink hover:decoration-home-orange-ink"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
    </section>
  );
}
