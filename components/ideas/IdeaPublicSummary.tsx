import Link from "next/link";

import { CopyablePre } from "@/components/ideas/PromptCopyButton";
import type { PublicIdeaPreview } from "@/lib/ideas/public-preview";

/**
 * Short introduction before the account card on mobile. Desktop retains the
 * original type sizes and spacing in the left reader column.
 */
export function IdeaPublicHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl">
      <Link
        href="/startup-ideas"
        className="text-sm text-neutral-500 underline underline-offset-4 hover:text-black"
      >
        All Startup Ideas
      </Link>
      <h1 className="mt-6 text-[28px] font-medium leading-tight tracking-tight text-black sm:text-4xl lg:mt-8 lg:text-5xl">
        {title}
      </h1>
      <p className="mt-4 text-base leading-relaxed text-neutral-600 lg:mt-5 lg:text-xl">
        {description}
      </p>
    </div>
  );
}

/** Server-rendered public summary, section teasers and ungated build prompts. */
export function IdeaPublicSummary({ preview }: { preview: PublicIdeaPreview }) {
  return (
    <div className="max-w-2xl">
      {preview.summaryParagraphs.length > 0 ? (
        <div className="space-y-4 text-base leading-relaxed text-neutral-700 lg:mt-10">
          {preview.summaryParagraphs.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
      ) : null}

      {preview.teasers.length > 0 ? (
        <div className="mt-12 space-y-8">
          {preview.teasers.map(({ heading, teaser }) => (
            <section key={heading}>
              <h2 className="text-2xl font-medium tracking-tight text-black">
                {heading}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-neutral-600">
                {teaser}
              </p>
            </section>
          ))}
        </div>
      ) : null}

      {preview.prompts.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-2xl font-medium tracking-tight text-black">
            AI Prompts to Build This
          </h2>
          <p className="mt-3 text-base leading-relaxed text-neutral-600">
            Copy these build prompts into Claude, Cursor, or your AI coding tool.
            Create a free account to unlock the full research behind them.
          </p>
          <ol className="mt-8 list-none space-y-8 p-0">
            {preview.prompts.map((prompt, index) => (
              <li key={prompt.title}>
                <h3 className="text-lg font-medium text-black">
                  {index + 1}. {prompt.title}
                </h3>
                <div className="mt-3">
                  <CopyablePre>
                    {prompt.lines.join("\n")}
                  </CopyablePre>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
