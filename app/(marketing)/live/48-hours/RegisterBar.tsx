"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Bottom bar pinned to the viewport (the fixed MegaNav owns the top edge).
 * With `afterId`, it stays hidden until that element has scrolled above the
 * viewport, so it never doubles the hero's own register button.
 */
export function RegisterBar({ afterId, children }: { afterId?: string; children: ReactNode }) {
  const [visible, setVisible] = useState(!afterId);

  useEffect(() => {
    if (!afterId) return;
    const target = document.getElementById(afterId);
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [afterId]);

  return (
    <div
      data-visible={visible}
      aria-hidden={!visible}
      inert={!visible}
      className="sticky bottom-0 z-40 bg-home-ink pb-[env(safe-area-inset-bottom)] text-home-paper transition-[translate,opacity,visibility] duration-300 ease-out data-[visible=false]:invisible data-[visible=false]:translate-y-full data-[visible=false]:opacity-0 motion-reduce:transition-none"
    >
      <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-3 px-5 py-2.5 sm:justify-center sm:gap-7 sm:px-10">
        {children}
      </div>
    </div>
  );
}
