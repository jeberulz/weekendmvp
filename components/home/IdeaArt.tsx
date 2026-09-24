import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Idea art cropped out of its 1200×630 OG card.
 *
 * The OG cards carry the logo (top) and the title (bottom), so only the band
 * from y=108 to y=426 is clean art. The image is scaled so that band fills the
 * container's height and is centred horizontally. The container must have a
 * height and be at least as wide as it is tall. Decorative: the idea's title is
 * always printed next to it.
 */
export function IdeaArt({ src, sizes, className, priority = false }: { src: string; sizes: string; className?: string; priority?: boolean }) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div className="absolute left-1/2 top-[-34%] aspect-[1200/630] h-[198%] -translate-x-1/2">
        <Image src={src} alt="" fill sizes={sizes} priority={priority} className="object-cover" />
      </div>
    </div>
  );
}
