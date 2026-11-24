import Link from "next/link";
import { FOCUS } from "@/components/workspace/kit/styles";
import { cn } from "@/lib/utils";

/**
 * The own-idea screen's other way in (design: `wizard-step1-visual-direction.md` §6). It is a quiet link
 * styled like the library variant's "Pick a different idea", so Continue leads. It goes to `/ideas`,
 * where an idea page's "Build this idea, free" starts `/start/{slug}`. Render it under the example
 * chips, above Continue, on every Step 1 own-idea surface.
 */
export function OwnIdeaLibraryLink() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <Link href="/ideas" className={cn("text-sm text-home-ink-2 underline underline-offset-2 hover:text-home-ink", FOCUS)}>
        Pick one from the library instead
      </Link>
    </div>
  );
}
