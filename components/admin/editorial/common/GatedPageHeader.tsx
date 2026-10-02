import type { ComponentProps } from "react";

import { requireEditorialWorkspace } from "@/lib/editorial/runtime/workspace";
import { PageHeader } from "./primitives";

/**
 * Page headings render only after access is confirmed, so no editorial copy
 * reaches a response (or its static shell) that is about to be denied.
 */
export async function GatedPageHeader(props: ComponentProps<typeof PageHeader>) {
  await requireEditorialWorkspace();
  return <PageHeader {...props} />;
}
