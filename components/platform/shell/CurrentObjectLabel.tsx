"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  COLD_OBJECT_LABEL,
  SIGNED_IN_HREF,
  objectHomeHref,
} from "@/lib/signed-in-chrome";
import { asProjectIdParam, chromeObjectLabel } from "@/lib/signed-in-home";

export function CurrentObjectLabel() {
  const searchParams = useSearchParams();
  const requested = searchParams.get("project");
  const projectId = asProjectIdParam(requested) as Id<"projects"> | undefined;
  const current = useQuery(api.platform.home.current, {
    ...(projectId ? { projectId } : {}),
  });

  if (current === undefined) {
    return (
      <p className="min-w-0 flex-1 truncate text-center text-sm font-medium text-stone-500">
        {COLD_OBJECT_LABEL}
      </p>
    );
  }

  const label = chromeObjectLabel({
    kind: current.kind,
    title: current.kind === "cold" ? undefined : current.title,
    hostname: current.kind === "dayn" ? current.hostname : undefined,
  });
  const href =
    current.kind === "cold"
      ? SIGNED_IN_HREF.home
      : objectHomeHref(current.projectId);

  return (
    <Link
      href={href}
      className="min-w-0 flex-1 truncate text-center text-sm font-medium text-stone-500 underline-offset-4 hover:text-stone-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800"
    >
      {label}
    </Link>
  );
}
