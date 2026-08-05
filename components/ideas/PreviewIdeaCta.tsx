import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function PreviewIdeaCta({ slug, title }: { slug: string; title: string }) {
  return (
    <aside
      aria-labelledby="preview-idea-heading"
      className="my-12 border-y border-neutral-200 py-8"
    >
      <p className="text-sm font-medium text-neutral-500">
        Ready to make the research concrete?
      </p>
      <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            id="preview-idea-heading"
            className="max-w-xl text-2xl font-medium tracking-tight text-black"
          >
            See what {title} could look like as a focused landing page.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-600">
            Answer a short customisation step, then review a watermarked preview before deciding what to build.
          </p>
        </div>
        <Link
          href={`/build/${slug}`}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-black px-6 text-sm font-semibold text-white outline-none transition-colors hover:bg-neutral-800 focus-visible:ring-3 focus-visible:ring-black/30 focus-visible:ring-offset-2"
        >
          Preview this idea
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
}
