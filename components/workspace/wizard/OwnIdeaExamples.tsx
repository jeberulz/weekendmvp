"use client";

import Link from "next/link";
import { useState } from "react";
import { FOCUS } from "@/components/workspace/kit/styles";
import { wizardPath } from "@/lib/workspace/build-cta";
import { cn } from "@/lib/utils";
import type { OwnIdeaExample } from "@/lib/workspace/wizard/own-idea-examples";

/**
 * WP99. The "Try one of these" chips under the own-idea field, plus the offer of a chip's researched version.
 *
 * Data comes in as a prop (`examples`, drawn per visit by `ownIdeaExamplesForRequest`). The host owns the
 * field: it passes the field's current `value` and fills and focuses the field in `onApply`. A tap replaces
 * the field's value with the chip's text.
 *
 * While the field still holds a library chip's exact text, a polite status line offers "Build the
 * researched version" (`/start/{slug}`). Any edit makes it the founder's idea and the line goes. Fallback
 * chips have no slug and never offer it.
 */
export function OwnIdeaExamples({
  examples,
  value,
  onApply,
}: {
  examples: readonly OwnIdeaExample[];
  /** The field's current text. */
  value: string;
  /** Fill the field with `text` and focus it. */
  onApply: (text: string) => void;
}) {
  const [tapped, setTapped] = useState<OwnIdeaExample | null>(null);
  const researched = tapped !== null && tapped.ideaSlug !== null && value === tapped.text ? tapped.ideaSlug : null;
  if (examples.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] text-home-ink-3">Try one of these</p>
      <div className="flex flex-wrap gap-2">
        {examples.map((example) => (
          <button
            key={example.text}
            type="button"
            onClick={() => {
              setTapped(example);
              onApply(example.text);
            }}
            className={cn(
              "rounded-full border border-home-rule bg-home-card px-3 py-1.5 text-[13px] text-home-ink-2 hover:bg-home-sunk",
              FOCUS,
            )}
          >
            {example.text}
          </button>
        ))}
      </div>
      {/* Always mounted and in the accessibility tree, so screen readers hear the line when it appears.
          Empty, it takes no space: the negative margin cancels the column gap. */}
      <p role="status" className="text-[13px] text-home-ink-2 empty:-mt-2">
        {researched ? (
          <>
            That one is already researched in the library.{" "}
            <Link
              href={wizardPath(researched)}
              className={cn("whitespace-nowrap text-home-orange-ink underline underline-offset-2", FOCUS)}
            >
              Build the researched version
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}
