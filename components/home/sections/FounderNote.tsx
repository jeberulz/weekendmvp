import Image from "next/image";

import { FOUNDER_LETTER } from "../content";
import { Container, Em, TextLink } from "../ui";

/** 09 · A note from John. */
export function FounderNote() {
  const [first, ...rest] = FOUNDER_LETTER;
  return (
    <section aria-labelledby="home-founder-title" data-scene="founder" className="bg-home-sunk py-14 lg:pb-24 lg:pt-[104px]">
      <Container className="flex flex-col items-center gap-7 lg:gap-10">
        <h2
          id="home-founder-title"
          data-m="title"
          className="flex flex-col items-center gap-2.5 text-center font-editorial text-[46px] font-normal leading-none tracking-[-0.03em] text-home-ink lg:flex-row lg:gap-[22px] lg:text-[84px]"
        >
          A note from
          <span className="flex items-center gap-3.5 lg:gap-[22px]">
            <Image
              src="/image/john-portrait.webp"
              alt=""
              data-m="pill"
              width={150}
              height={84}
              className="h-[58px] w-[104px] rounded-full object-cover object-[center_52%] lg:h-[84px] lg:w-[150px]"
            />
            <Em>John</Em>
          </span>
        </h2>
        <div data-m="letter" className="flex w-full max-w-[680px] flex-col gap-[18px] text-[17px] leading-[1.65] text-home-ink-2 lg:gap-[22px] lg:text-[19px] lg:leading-[1.7]">
          <p>
            {/* Drop cap is the real first letter — no aria-hidden/sr-only duplicate (crawlers were reading "I I started"). */}
            <span data-m="cap" className="float-left pr-2.5 pt-1.5 font-editorial text-[66px] leading-[0.8] text-home-orange lg:pr-3 lg:pt-2 lg:text-[84px]">
              {first.charAt(0)}
            </span>
            {first.slice(1)}
          </p>
          {rest.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <div data-m="signoff" className="flex w-full max-w-[680px] flex-col gap-2 border-t border-home-rule pt-5 lg:flex-row lg:items-end lg:justify-between lg:pt-6">
          <div className="flex flex-col gap-2 lg:gap-1.5">
            <p data-m="sign" className="font-editorial text-4xl italic leading-none lg:text-[44px]">John Iseghohi</p>
            <p data-m="rise" className="text-[13px] leading-[1.45] text-home-ink-3 lg:text-sm">
              Founder, Weekend MVP · runs a community of 400+ weekend builders
            </p>
          </div>
          <TextLink href="/john-iseghohi" m="rise" className="mt-1.5 lg:mt-0">
            More about John
          </TextLink>
        </div>
      </Container>
    </section>
  );
}
