"use client";

import { useEffect, useRef } from "react";
import { ErrorState } from "@/components/workspace/kit/states";

/** The skip link target (`WorkspaceFrame`'s `MAIN_ID`; repeated here so the two files do not import each other). */
const MAIN_ID = "workspace-main";

/**
 * The page area when a workspace page crashes: the shell (nav, chat) stays, and
 * this stands in for the page's single `<main>` so the skip link still lands.
 * Focus moves to the heading so the change is announced.
 */
export function WorkspaceCrash({ reset }: { reset: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  return (
    <main
      id={MAIN_ID}
      tabIndex={-1}
      className="mx-auto w-full max-w-[1080px] px-5 py-8 focus:outline-none sm:px-8 lg:px-10 lg:py-10"
    >
      <div className="flex max-w-2xl flex-col gap-4">
        <h1 ref={headingRef} tabIndex={-1} className="font-editorial text-[28px] font-normal leading-[1.15] text-home-ink focus:outline-none">
          This page hit a problem
        </h1>
        <ErrorState
          message="Nothing was changed. Try again, or use the menu to open another page. Your team's work is safe."
          onRetry={reset}
        />
      </div>
    </main>
  );
}
