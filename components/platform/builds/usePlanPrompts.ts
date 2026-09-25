"use client";

import { useEffect, useState } from "react";
import type { PlanPrompt } from "@/lib/dashboard/weekend-prompts";

export type PromptsState =
  | { status: "loading" }
  | { status: "ready"; prompts: PlanPrompt[] }
  | { status: "failed" };

/** An idea's build prompts, from the members-only prompts route. */
export function usePlanPrompts(slug: string | null): PromptsState {
  const [state, setState] = useState<{ slug: string | null; value: PromptsState }>({
    slug: null,
    value: { status: "loading" },
  });

  useEffect(() => {
    if (!slug) return;
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
  }, [slug]);

  return state.slug === slug ? state.value : { status: "loading" };
}
