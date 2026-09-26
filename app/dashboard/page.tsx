import { DashboardHome } from "@/components/platform/home/DashboardHome";
import { WhenConvexReady } from "@/components/platform/client-gates";
import { PreviewClaimRunner } from "@/components/preview/PreviewClaimHandoff";
import { getDashboardEditorial } from "@/lib/dashboard/editorial";

export default async function DashboardPage() {
  // The homepage's hourly cache: idea of the week and newest ideas match `/`.
  const editorial = await getDashboardEditorial();
  return (
    <>
      {/* WP27-S5. Claims a capability stashed on `/login` or `/signup`, if there
          is one. Renders nothing when there is not, so the ordinary dashboard
          is unchanged for everyone who did not arrive from a preview. Gated so
          its `useMutation` never runs on the server (WP44-S3). */}
      <WhenConvexReady>
        <PreviewClaimRunner />
      </WhenConvexReady>
      <DashboardHome editorial={editorial} />
    </>
  );
}
