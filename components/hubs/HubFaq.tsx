import Link from "next/link";
import type { ReactNode } from "react";

import { Container } from "@/components/home/ui";
import { RuledFaq } from "@/components/public/Sections";
import { cn } from "@/lib/utils";

export type HubFaqLink = { href: string; label: string };

export type HubFaqItem = {
  question: string;
  answer: string;
  /** "Read more" link(s) rendered after the answer paragraph (not inside it). */
  readMore?: HubFaqLink | HubFaqLink[];
  /**
   * Phrases in the visible answer to wrap with internal links.
   * JSON-LD / schema text stays the plain `answer` string.
   */
  inlineLinks?: Array<{ text: string; href: string }>;
};

/**
 * FAQ rendering for hub pages.
 * - `questions` — each question is a visible `<h2>` + `<p>` (SSR-safe; preferred for SEO)
 * - `accordion` — kit's ruled `<details>` list
 * - `cards` — ruled look with every answer open (h3)
 */
export function HubFaq({
  items,
  variant = "accordion",
  className,
  labelledBy,
}: {
  items: HubFaqItem[];
  variant?: "accordion" | "cards" | "questions";
  className?: string;
  /** Optional section label id when variant is `questions`. */
  labelledBy?: string;
}) {
  if (items.length === 0) return null;

  if (variant === "questions") {
    return (
      <section
        aria-labelledby={labelledBy}
        className={cn("pt-14", className)}
      >
        <Container className="flex flex-col gap-10">
          {items.map((faq) => (
            <div key={faq.question} className="max-w-3xl">
              <h2 className="font-editorial text-[28px] font-normal leading-[1.15] tracking-[-0.02em] text-home-ink md:text-[32px]">
                {faq.question}
              </h2>
              <p className="mt-4 text-base leading-[1.65] text-home-ink-2 md:text-[17px]">
                {linkAnswer(faq.answer, faq.inlineLinks)}
              </p>
              {faq.readMore
                ? (Array.isArray(faq.readMore) ? faq.readMore : [faq.readMore]).map(
                    (link) => (
                      <p key={link.href} className="mt-3">
                        <Link
                          href={link.href}
                          className="text-[15px] font-medium text-home-orange-ink underline underline-offset-4 transition-colors hover:text-home-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink motion-reduce:transition-none"
                        >
                          {link.label}
                        </Link>
                      </p>
                    ),
                  )
                : null}
            </div>
          ))}
        </Container>
      </section>
    );
  }

  if (variant === "cards") {
    return (
      <div className={cn("border-t border-home-ink", className)}>
        {items.map((faq) => (
          <div key={faq.question} className="border-b border-home-rule py-5">
            <h3 className="font-editorial text-[20px] leading-[1.25] text-home-ink md:text-[22px]">
              {faq.question}
            </h3>
            <p className="mt-3 max-w-[600px] text-base leading-[1.6] text-home-ink-2">
              {faq.answer}
            </p>
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

/** Replace the first occurrence of each `inlineLinks` phrase with a Link. */
function linkAnswer(
  answer: string,
  inlineLinks?: Array<{ text: string; href: string }>,
): ReactNode {
  if (!inlineLinks?.length) return answer;

  const nodes: ReactNode[] = [];
  let remaining = answer;
  let key = 0;

  for (const { text, href } of inlineLinks) {
    const idx = remaining.indexOf(text);
    if (idx === -1) continue;
    if (idx > 0) nodes.push(remaining.slice(0, idx));
    nodes.push(
      <Link
        key={`${text}-${key++}`}
        href={href}
        className="text-home-orange-ink underline underline-offset-4 transition-colors hover:text-home-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink motion-reduce:transition-none"
      >
        {text}
      </Link>,
    );
    remaining = remaining.slice(idx + text.length);
  }
  if (remaining) nodes.push(remaining);
  return nodes.length > 0 ? nodes : answer;
}
