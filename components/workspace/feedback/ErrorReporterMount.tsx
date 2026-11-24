"use client";

import { useMutation } from "convex/react";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import { registerErrorReporter } from "@/components/workspace/feedback/clientErrors";

/**
 * Binds the error log mutation to `reportClientError`. Render it once inside
 * the Convex provider, behind `WhenConvexReady`. It draws nothing.
 */
export function ErrorReporterMount() {
  const report = useMutation(api.feedback.errors.report);
  useEffect(
    () =>
      registerErrorReporter((entry) =>
        report({
          source: entry.source,
          errorClass: entry.errorClass,
          route: entry.route,
          buildVersion: entry.buildVersion,
          ...(entry.projectId === undefined ? {} : { projectId: entry.projectId }),
          ...(entry.dedupeKey === undefined ? {} : { dedupeKey: entry.dedupeKey }),
        })),
    [report],
  );
  return null;
}
