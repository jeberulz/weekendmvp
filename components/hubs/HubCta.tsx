import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Closing starter-kit CTA panel. Default neutral gradient matches the
 * audience/tool/collection pages; pass `panelClassName` for accent
 * variants (e.g. the solve pages' green gradient).
 */
export function HubCta({
  heading,
  body,
  panelClassName,
}: {
  heading: string;
  body: string;
  panelClassName?: string;
}) {
  return (
    <section className="mt-24">
      <div
        className={cn(
          "p-12 bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-[3rem] text-center",
          panelClassName,
        )}
      >
        <h2 className="text-2xl font-medium text-white tracking-tight mb-4">
          {heading}
        </h2>
        <p className="text-neutral-400 mb-8 max-w-xl mx-auto">{body}</p>
        <Link
          href="/starter-kit"
          className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black rounded-full text-sm font-semibold hover:bg-neutral-200 transition-all"
        >
          <span>Get the Starter Kit</span>
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
