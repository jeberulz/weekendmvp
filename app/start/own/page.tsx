import type { Metadata } from "next";
import { requireWizardAccess } from "@/lib/workspace/wizard-access";
import { WizardPage } from "../WizardPage";

export const metadata: Metadata = { title: "Build your own idea" };

export const instant = false;

/** WP74-S1: the wizard for the founder's own idea (D15). `?session=` resumes after a reload. */
export default async function StartOwnPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string | string[] }>;
}) {
  await requireWizardAccess(null);
  const { session } = await searchParams;
  const sessionId = Array.isArray(session) ? session[0] : session;
  return (
    <WizardPage
      idea={null}
      ideaTitle={null}
      initialSessionId={sessionId && /^[a-z0-9]{1,64}$/.test(sessionId) ? sessionId : null}
    />
  );
}
