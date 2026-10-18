export type LiveFaqItem = { question: string; answer: React.ReactNode };

export function LiveFaq({
  heading = "Questions",
  items,
}: {
  heading?: string;
  items: readonly LiveFaqItem[];
}) {
  return (
    <section className="mx-auto max-w-[760px] px-5 py-14 sm:px-10 sm:py-24">
      <h2 className="font-editorial mb-5 text-[34px] leading-[1.06] font-medium tracking-[-0.015em] sm:text-5xl">
        {heading}
      </h2>
      <div className="divide-y divide-home-rule border-y border-home-rule">
        {items.map((item, i) => (
          <details key={item.question} className="group py-5" open={i === 0}>
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-left text-lg font-medium marker:content-none [&::-webkit-details-marker]:hidden">
              <span>{item.question}</span>
              <span
                aria-hidden="true"
                className="font-mono text-xl text-home-orange group-open:hidden"
              >
                +
              </span>
              <span
                aria-hidden="true"
                className="font-mono hidden text-xl text-home-orange group-open:inline"
              >
                –
              </span>
            </summary>
            <div className="mt-3 text-[15px] leading-relaxed text-[#4A453C] sm:text-base">
              {item.answer}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
