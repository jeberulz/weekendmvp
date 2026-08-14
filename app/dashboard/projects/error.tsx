"use client";

import { PlatformRouteError } from "@/components/platform/projects/PlatformRouteError";

export default function ProjectsError({ reset }: { reset: () => void }) {
  return <PlatformRouteError title="Projects unavailable" reset={reset} />;
}
