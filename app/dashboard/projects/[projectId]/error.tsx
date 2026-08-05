"use client";

import { PlatformRouteError } from "@/components/platform/projects/PlatformRouteError";

export default function ProjectError({ reset }: { reset: () => void }) {
  return <PlatformRouteError title="Project unavailable" reset={reset} />;
}
