import Link from "next/link";

import { EmptyState, PageBody, buttonClass } from "@/components/admin/editorial/common/primitives";
import { EDITORIAL_BASE } from "@/components/admin/editorial/shell/nav-items";

/**
 * Inside the workspace (fixture mode only): a missing idea or revision. When
 * the workspace itself is unavailable, the layout's `notFound()` falls through
 * to the site's standard 404 instead, so the path reveals nothing.
 */
export default function EditorialNotFound() {
  return (
    <PageBody>
      <EmptyState
        title="Not found"
        action={
          <Link href={EDITORIAL_BASE} className={buttonClass.secondary}>
            Back to the review queue
          </Link>
        }
      >
        That idea, revision or release does not exist in this workspace.
      </EmptyState>
    </PageBody>
  );
}
