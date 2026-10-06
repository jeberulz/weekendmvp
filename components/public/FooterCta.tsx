import { ButtonLink, Container, Em } from "@/components/home/ui";
import { publicLibraryTotal } from "@/lib/public/ideas";

/** Closing call above the footer on public pages; the homepage has its own (FinalCall). */
export async function FooterCta() {
  const total = await publicLibraryTotal();
  return (
    <section aria-labelledby="footer-cta-title" className="bg-home-ink text-home-d1">
      <Container className="flex flex-col gap-7 border-b border-home-dr py-14 lg:flex-row lg:items-end lg:justify-between lg:py-[72px]">
        <h2
          id="footer-cta-title"
          className="max-w-[640px] font-editorial text-[34px] font-normal leading-[1.04] tracking-[-0.02em] text-balance lg:text-[48px]"
        >
          Pick an idea. Paste the prompt. <Em dark>Ship it by Sunday.</Em>
        </h2>
        <ButtonLink href="/startup-ideas" tone="dark" className="w-full lg:w-auto">
          Browse {total} ideas
        </ButtonLink>
      </Container>
    </section>
  );
}
