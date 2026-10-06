import { RuledFaq } from "@/components/public/Sections";
import { cn } from "@/lib/utils";

export type HubFaqItem = { question: string; answer: string };

/**
 * FAQ rendering for hub pages. `accordion` is the kit's ruled `<details>`
 * list (heading required); `cards` is the same ruled look with every answer
 * open.
 */
export function HubFaq({
  items,
  variant = "accordion",
  className,
}: {
  items: HubFaqItem[];
  variant?: "accordion" | "cards";
  className?: string;
}) {
  if (items.length === 0) return null;

  if (variant === "cards") {
    return (
      <div className={cn("border-t border-home-ink", className)}>
        {items.map((faq) => (
          <div key={faq.question} className="border-b border-home-rule py-5">
            <h3 className="font-editorial text-[20px] leading-[1.25] text-home-ink md:text-[22px]">{faq.question}</h3>
            <p className="mt-3 max-w-[600px] text-base leading-[1.6] text-home-ink-2">{faq.answer}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <RuledFaq
      id="hub-faq-heading"
      heading="Questions, answered"
      className={className}
      items={items.map((faq) => ({ question: faq.question, answer: faq.answer }))}
    />
  );
}

/** schema.org FAQPage node for the page's @graph. */
export function faqSchema(items: HubFaqItem[]) {
  return {
    "@type": "FAQPage",
    mainEntity: items.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

/** Legacy default FAQ when a collection has none of its own. */
export const DEFAULT_FAQ: HubFaqItem[] = [
  {
    question: "Can I really build these in a weekend?",
    answer:
      "Yes. Each idea is scoped for a focused MVP — one core workflow, minimal integrations, and a clear launch path. Ship the smallest version that delivers value, then iterate.",
  },
];
