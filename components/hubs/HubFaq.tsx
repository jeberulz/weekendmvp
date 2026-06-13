import { ChevronDown } from "lucide-react";

export type HubFaqItem = { question: string; answer: string };

/**
 * FAQ rendering for hub pages. Collection hubs use the legacy
 * <details>-accordion variant; audience/build-time hubs used flat cards —
 * pick with `variant`.
 */
export function HubFaq({
  items,
  variant = "accordion",
}: {
  items: HubFaqItem[];
  variant?: "accordion" | "cards";
}) {
  if (items.length === 0) return null;

  if (variant === "cards") {
    return (
      <div className="space-y-4">
        {items.map((faq) => (
          <div
            key={faq.question}
            className="p-6 bg-white/5 border border-white/10 rounded-2xl"
          >
            <h3 className="text-white font-medium mb-3">{faq.question}</h3>
            <p className="text-neutral-400 text-sm leading-relaxed">
              {faq.answer}
            </p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((faq) => (
        <details
          key={faq.question}
          className="group p-6 bg-white/5 border border-white/10 rounded-2xl"
        >
          <summary className="flex items-center justify-between cursor-pointer list-none">
            <span className="text-white font-medium">{faq.question}</span>
            <ChevronDown
              size={20}
              className="text-neutral-400 group-open:rotate-180 transition-transform"
              aria-hidden="true"
            />
          </summary>
          <p className="mt-4 text-neutral-400 leading-relaxed">{faq.answer}</p>
        </details>
      ))}
    </div>
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
