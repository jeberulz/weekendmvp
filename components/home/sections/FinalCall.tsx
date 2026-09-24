import { SignupCta } from "@/components/marketing/SignupCta";
import { cn } from "@/lib/utils";
import { FAQS } from "../content";
import { IdeaArt } from "../IdeaArt";
import { ButtonLink, Container, Em, buttonClass } from "../ui";
import { Icon } from "../icons";

const TILT = ["-rotate-[5deg]", "rotate-[3deg]", "-rotate-[2deg]", "rotate-[4deg]", "-rotate-[3deg]", "rotate-[5deg]"];

/** 10 · The big close: idea art strip, one last call, three quick answers. */
export function FinalCall({ total, strip }: { total: number; strip: { slug: string; art: string }[] }) {
  return (
    <section aria-labelledby="home-final-title" className="overflow-hidden bg-home-ink pb-14 pt-9 lg:pb-[72px] lg:pt-[72px]">
      <ul aria-hidden className="flex justify-center gap-3.5 lg:gap-[22px]">
        {strip.map((s, i) => (
          <li
            key={s.slug}
            className={cn(
              "shrink-0 overflow-hidden rounded-xl border-[3px] border-home-d1 shadow-[0_18px_36px_-18px_rgba(0,0,0,0.7)] lg:rounded-2xl",
              TILT[i % TILT.length],
            )}
          >
            <IdeaArt src={s.art} sizes="(min-width: 1024px) 720px, 420px" className="h-[110px] w-[170px] lg:h-[190px] lg:w-[300px]" />
          </li>
        ))}
      </ul>
      <Container className="flex flex-col gap-7 pt-10 lg:items-center lg:gap-9 lg:pt-[72px]">
        <h2
          id="home-final-title"
          className="text-center font-editorial text-[60px] font-normal leading-[0.92] tracking-[-0.04em] text-home-d1 lg:text-[150px] lg:leading-[0.9] lg:tracking-[-0.045em]"
        >
          Pick an idea.
          <br />
          <Em dark>Build it this weekend.</Em>
        </h2>
        <div className="flex flex-col gap-2.5 lg:flex-row lg:gap-3.5">
          <ButtonLink href="/startup-ideas" tone="dark">
            Browse {total} ideas
          </ButtonLink>
          <SignupCta buttonLocation="home-final" className={buttonClass("ghost-dark", "px-[22px] font-medium")}>
            <Icon name="kit" size={20} accent="var(--color-home-orange-light)" />
            Get the free Starter Kit
          </SignupCta>
        </div>
        <dl className="mt-3 grid w-full grid-cols-1 border-b border-home-dr lg:mt-[88px] lg:grid-cols-3 lg:gap-12 lg:border-b-0 lg:border-t lg:pt-8">
          {FAQS.map((f) => (
            <div key={f.question} className="flex flex-col gap-2 border-t border-home-dr py-5 lg:border-t-0 lg:py-0">
              <dt className="text-base font-semibold text-home-d1 lg:text-[17px]">{f.question}</dt>
              <dd className="text-[15px] leading-[1.5] text-home-d2">{f.answer}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}
