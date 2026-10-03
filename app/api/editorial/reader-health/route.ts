import { connection } from "next/server";

/** Public capability probe: only protocol and deployment identity, never drafts. */
export async function GET() {
  // A static route would bake in a null/local commit during `next build`, so
  // the worker could verify a build other than the one actually serving it.
  await connection();
  return Response.json(
    {
      protocol: 1,
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.EDITORIAL_READER_COMMIT ?? null,
    },
    { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
  );
}
