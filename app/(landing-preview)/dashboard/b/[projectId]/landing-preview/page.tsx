import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { AuthPlatformProvider } from "@/app/AuthPlatformProvider";
import { TenantSite } from "@/components/tenant-site";
import { TestWaitlist } from "@/components/workspace/landing/TestWaitlist";
import { api } from "@/convex/_generated/api";
import { requireWorkspaceAccess } from "@/lib/workspace/access";
import { brandKitSchema, landingSpecSchema } from "@/lib/workspace/contracts/artifacts";
import { workspacePath } from "@/lib/workspace/routes";

export const instant = false;
export const metadata: Metadata = {
  title: "Private landing preview",
  robots: { index: false, follow: false, noarchive: true, nocache: true },
};

export default async function PrivateLandingPreview({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await requireWorkspaceAccess(projectId);
  const token = await convexAuthNextjsToken();
  if (!token) notFound();
  const preview = await fetchQuery(api.growth.drafts.landing.privateLandingPreview, { projectId: project._id }, { token });
  const back = workspacePath(projectId, "landing");
  if (preview.state !== "ready") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-semibold">This preview is unavailable</h1>
        <p className="mt-3">Open Landing page to check Leo’s work and the latest draft.</p>
        <Link className="mt-5 inline-block underline" href={back}>Back to Landing page</Link>
      </main>
    );
  }
  const spec = landingSpecSchema.safeParse(preview.spec);
  const kit = brandKitSchema.safeParse(preview.kit);
  if (!spec.success || !kit.success) notFound();

  return (
    <AuthPlatformProvider fallbackClassName="bg-home-paper">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-home-rule bg-home-paper px-5 py-3 text-sm text-home-ink sm:px-8">
        <p><strong>Private preview</strong> · Draft {preview.version.toString()}</p>
        <Link className="underline underline-offset-4" href={back}>Back to Landing page</Link>
      </div>
      <TenantSite
        spec={spec.data}
        kit={kit.data}
        platform={{ year: new Date().getFullYear() }}
        waitlistSlot={<TestWaitlist projectId={project._id} versionId={preview.versionId} initialCount={preview.testLeadCount} />}
      />
    </AuthPlatformProvider>
  );
}
