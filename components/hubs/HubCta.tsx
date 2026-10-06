import { ButtonLink, Container } from "@/components/home/ui";

/**
 * Closing starter-kit call, drawn as a ruled row on paper: heading and body
 * on the left, the button on the right.
 */
export function HubCta({
  heading,
  body,
  headingId = "hub-cta-heading",
}: {
  heading: string;
  body: string;
  headingId?: string;
}) {
  return (
    <section aria-labelledby={headingId} className="py-14 lg:py-20">
      <Container>
        <div className="flex flex-col gap-6 border-t border-home-ink pt-8 md:flex-row md:items-end md:justify-between md:gap-12">
          <div className="flex max-w-[640px] flex-col gap-3">
            <h2
              id={headingId}
              className="font-editorial text-[28px] font-normal leading-[1.1] tracking-[-0.02em] text-balance text-home-ink md:text-[36px]"
            >
              {heading}
            </h2>
            <p className="text-pretty text-base leading-[1.55] text-home-ink-2 md:text-[17px]">{body}</p>
          </div>
          <ButtonLink href="/starter-kit" className="w-full shrink-0 md:w-auto">
            Get the Starter Kit
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
