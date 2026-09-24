import { BeehiivSubscribeForm } from "@/components/forms/BeehiivSubscribeForm";
import { KIT_CONTENTS, TICKET_META } from "../content";
import { Icon } from "../icons";
import { Container, Em, Eyebrow } from "../ui";

const BARS = [2, 1, 3, 1, 1, 2, 4, 1, 2, 1, 3, 2, 1, 1, 4, 2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 4, 1, 2];

/** 08 · The Starter Kit as a ticket. The stub is the Beehiiv signup form. */
export function StarterKit() {
  return (
    <section id="starter-kit" aria-labelledby="home-kit-title" className="relative overflow-hidden bg-home-paper">
      <div aria-hidden className="home-dots absolute inset-0 opacity-60" />
      <Container className="relative flex flex-col gap-7 py-14 lg:gap-9 lg:py-[88px]">
        <div className="flex flex-col gap-3.5 lg:gap-4">
          <Eyebrow>Free Starter Kit</Eyebrow>
          <h2 id="home-kit-title" className="font-editorial text-[38px] font-normal leading-[1.02] tracking-[-0.025em] text-home-ink lg:text-[60px] lg:leading-[1.06] lg:tracking-[-0.02em]">
            Your ticket to <Em>a shipped weekend.</Em>
          </h2>
        </div>

        <div className="grid grid-cols-1 drop-shadow-[0_24px_30px_rgba(26,24,20,0.18)] lg:grid-cols-[820px_minmax(0,1fr)] lg:drop-shadow-[0_30px_40px_rgba(26,24,20,0.18)]">
          <div className="flex flex-col gap-[26px] rounded-t-3xl bg-home-orange-ink px-[22px] pb-[26px] pt-6 lg:h-[440px] lg:justify-between lg:rounded-l-[28px] lg:rounded-tr-none lg:px-12 lg:py-10">
            <p className="flex justify-between font-mono text-[10.5px] tracking-[0.1em] text-[#ffe3cf] lg:text-xs">
              <span>ADMIT ONE · FREE</span>
              <span>WEEKEND MVP</span>
            </p>
            <p className="font-editorial text-[38px] leading-[0.98] tracking-[-0.03em] text-white lg:text-[76px] lg:leading-[0.95]">
              The Weekend MVP
              <br />
              <em className="italic">Starter Kit</em>
            </p>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-4 border-t border-dashed border-white/45 pt-[18px] lg:grid-cols-5 lg:gap-4 lg:pt-[22px]">
              {TICKET_META.map(([k, v]) => (
                <div key={k} className="flex flex-col-reverse gap-[3px] lg:gap-1">
                  <dd className="font-editorial text-xl text-white lg:text-[22px]">{v}</dd>
                  <dt className="font-mono text-[10px] tracking-[0.1em] text-[#ffe3cf]">{k}</dt>
                </div>
              ))}
            </dl>
          </div>

          <div aria-hidden className="relative h-0 border-t-2 border-dashed border-home-rule lg:hidden">
            <span className="absolute -left-3.5 -top-[15px] size-7 rounded-full bg-home-paper" />
            <span className="absolute -right-3.5 -top-[15px] size-7 rounded-full bg-home-paper" />
          </div>

          <div className="relative flex flex-col gap-3 rounded-b-3xl bg-home-card px-[22px] py-6 lg:gap-4 lg:rounded-r-[28px] lg:rounded-bl-none lg:border-l-2 lg:border-dashed lg:border-home-rule lg:px-9 lg:py-10">
            <span aria-hidden className="absolute -left-[17px] -top-4 hidden size-8 rounded-full bg-home-paper lg:block" />
            <span aria-hidden className="absolute -bottom-4 -left-[17px] hidden size-8 rounded-full bg-home-paper lg:block" />
            <p className="font-mono text-[11px] tracking-[0.1em] text-home-ink-3 lg:text-xs">YOUR COPY</p>
            <BeehiivSubscribeForm
              showFirstName={false}
              submitLabel="Send me the kit"
              className="flex flex-col gap-3 space-y-0"
              emailLabelClassName="mb-3 block text-[13px] text-home-ink-2"
              inputClassName="h-[52px] rounded-xl border-home-ink-3 bg-white px-4 text-base text-home-ink placeholder:text-home-ink-3 focus:ring-home-orange-ink"
              buttonClassName="h-[52px] rounded-xl bg-home-ink text-base text-white hover:bg-black focus:ring-home-orange-ink"
            />
            <div className="flex items-end justify-between gap-4 pt-1.5 lg:mt-auto lg:flex-col lg:items-start">
              <p className="text-xs text-home-ink-3">Free. Unsubscribe anytime.</p>
              <div aria-hidden className="flex items-end gap-0.5">
                {BARS.map((w, i) => (
                  <span key={i} className="block h-10 bg-home-ink lg:h-[54px]" style={{ width: w }} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <ul className="grid grid-cols-1 gap-3 text-[15px] text-home-ink-2 lg:grid-cols-3 lg:gap-x-7 lg:gap-y-3.5">
          {KIT_CONTENTS.map((item) => (
            <li key={item.label} className="flex items-center gap-2.5">
              <Icon name={item.icon} size={18} />
              {item.label}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
