"use client";

import { useEffect, useState } from "react";
import type { PlanPrompt } from "@/lib/dashboard/weekend-prompts";
import { isResearchWithheld } from "@/components/platform/RetiredResearch";

export type PromptsState =
  | { status: "loading" }
  | { status: "ready"; prompts: PlanPrompt[] }
  | { status: "failed" }
  /** The idea is a retired engine draft (WP46-S5): its prompts are not published. */
  | { status: "retired" };

/** An idea's build prompts, from the members-only prompts route. */
export function usePlanPrompts(slug: string | null): PromptsState {
  const retired = slug !== null && isResearchWithheld(slug);
  const [state, setState] = useState<{ slug: string | null; value: PromptsState }>({
    slug: null,
    value: { status: "loading" },
  });

  useEffect(() => {
    // A retired draft's prompts route answers 404, so there is nothing to fetch.
    if (!slug || retired) return;
    const controller = new AbortController();
    fetch(`/api/ideas/prompts?slug=${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((data: { prompts: PlanPrompt[] }) => {
        setState({ slug, value: { status: "ready", prompts: data.prompts } });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("Loading prompts failed", error);
        setState({ slug, value: { status: "failed" } });
      });
    return () => controller.abort();
  }, [slug, retired]);

  if (retired) return { status: "retired" };
  return state.slug === slug ? state.value : { status: "loading" };
}
