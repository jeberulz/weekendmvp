"use client";

import { PlatformRouteError } from "@/components/platform/projects/PlatformRouteError";

export default function NewIdeaError({ reset }: { reset: () => void }) {
  return <PlatformRouteError title="Draft unavailable" reset={reset} />;
}
