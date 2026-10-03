import type { Metadata } from "next";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { api } from "@/convex/_generated/api";
import { SafeEditorialBody } from "@/components/ideas/SafeEditorialBody";
import { assertEditorialRoutesEnabled } from "@/lib/editorial/runtime/route-guard";
import { requireEditorialWorkspace } from "@/lib/editorial/runtime/workspace";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  assertEditorialRoutesEnabled();
  return { title: { absolute: "Protected release preview — Editorial" }, robots: { index: false, follow: false } };
}

export default async function ReleasePreview({ params }: { params: Promise<{ releaseId: string }> }) {
  assertEditorialRoutesEnabled();
  await connection();
  await requireEditorialWorkspace();
  const { releaseId } = await params;
  const token = await convexAuthNextjsToken();
  if (!token) notFound();
  const preview = await fetchQuery(api.editorial.reads.stagedPreview, { releaseId }, { token });
  if (!preview) notFound();
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Protected preview · revision {preview.revisionNumber} · staged artifact {preview.artifactHash.slice(0, 16)}
      </p>
      <Link href="/admin/editorial/releases" className="text-sm underline">Back to releases</Link>
      <h1 className="mt-8 text-4xl font-semibold">{preview.title}</h1>
      <p className="mt-4 text-lg">{preview.description}</p>
      <p className="mt-2 text-sm text-neutral-500">Proposed public path: /ideas/{preview.slug}</p>
      <div className="mt-10 border-t pt-8"><SafeEditorialBody markdown={preview.markdown} /></div>
    </main>
  );
}
