import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { isValidPlatformConvexUrl } from "@/lib/platform-convex-url";
import { classifyHost } from "@/lib/tenant-host";
import { LEAD_CSV_HEADER, leadCsvRow } from "@/lib/tenant-lead-csv";

/** Auth is rechecked by every Convex page; no project ID is trusted from the URL. */
export async function GET(request: Request) {
  const kind = classifyHost(request.headers.get("host")).kind;
  if (kind !== "www" && kind !== "platform-preview" && kind !== "local") {
    return new Response("Not Found", { status: 404 });
  }
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId || !isValidPlatformConvexUrl(process.env.NEXT_PUBLIC_CONVEX_URL)) {
    return new Response("Not Found", { status: 404 });
  }

  let token: string | null | undefined;
  try {
    token = await convexAuthNextjsToken();
  } catch {
    return new Response("Not Found", { status: 404 });
  }
  if (!token) return new Response("Not Found", { status: 404 });

  const id = projectId as Id<"projects">;
  const load = (cursor: string | null) => fetchQuery(api.platform.sites.leads.exportPage, {
    projectId: id,
    paginationOpts: { cursor, numItems: 100 },
  }, { token });

  let first;
  try {
    first = await load(null);
  } catch {
    return new Response("Not Found", { status: 404 });
  }

  const encoder = new TextEncoder();
  let page: typeof first | null = first;
  let cursor: string | null = null;
  let headerSent = false;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!headerSent) {
        headerSent = true;
        controller.enqueue(encoder.encode(LEAD_CSV_HEADER));
        return;
      }
      try {
        const current = page ?? await load(cursor);
        page = null;
        cursor = current.continueCursor;
        const rows = current.page.map(leadCsvRow).join("");
        if (rows) controller.enqueue(encoder.encode(rows));
        if (current.isDone) controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="waitlist-leads.csv"',
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
