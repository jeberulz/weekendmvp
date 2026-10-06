import { ButtonLink, Container, Eyebrow } from "@/components/home/ui";

/**
 * Loud, single-destination conversion panel for a hub page.
 *
 * Distinct from HubCta (the closing starter-kit row): this one owns the
 * primary internal path — /startup-ideas — which used to be an easily missed
 * 8th tile inside the "Explore Other Tools" grid on /build-with/{tool}.
 *
 * Server component; the heading, copy, and link are all crawlable.
 */
export function HubPrimaryCta({
  eyebrow,
  heading,
  body,
  href,
  ctaLabel,
  note,
  headingId = "primary-cta-heading",
}: {
  eyebrow: string;
  heading: string;
  body: string;
  href: string;
  ctaLabel: string;
  /** Small supporting line under the button. */
  note?: string;
  headingId?: string;
}) {
  return (
    <section aria-labelledby={headingId} className="py-10 lg:py-14">
      <Container>
        <div className="flex flex-col gap-8 rounded-2xl border border-home-rule bg-home-card p-7 md:p-10 lg:flex-row lg:items-end lg:justify-between lg:gap-12 lg:p-12">
          <div className="flex max-w-[640px] flex-col gap-3.5">
            <Eyebrow>{eyebrow}</Eyebrow>
            <h2
              id={headingId}
              className="font-editorial text-[32px] font-normal leading-[1.05] tracking-[-0.02em] text-balance text-home-ink md:text-[44px]"
            >
              {heading}
            </h2>
            <p className="text-pretty text-base leading-[1.55] text-home-ink-2 md:text-[17px]">{body}</p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 lg:items-end">
            <ButtonLink href={href} className="w-full lg:w-auto">
              {ctaLabel}
            </ButtonLink>
            {note ? <p className="max-w-[320px] text-sm leading-[1.5] text-home-ink-3 lg:text-right">{note}</p> : null}
          </div>
        </div>
      </Container>
    </section>
  );
}
