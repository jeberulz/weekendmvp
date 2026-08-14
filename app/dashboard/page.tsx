import { DashboardHome } from "@/components/platform/shell/DashboardHome";
import { PreviewClaimRunner } from "@/components/preview/PreviewClaimHandoff";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-12">
      {/* WP27-S5. Claims a capability stashed on `/signin`, if there is one.
          Renders nothing when there is not, so the ordinary dashboard is
          unchanged for everyone who did not arrive from a preview. */}
      <PreviewClaimRunner />
      <DashboardHome />
    </div>
  );
}
