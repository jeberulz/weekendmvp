import type { Metadata } from "next";
import { requireWizardAccess } from "@/lib/workspace/wizard-access";
import { WizardPage } from "../WizardPage";

export const metadata: Metadata = { title: "Build this idea" };

export const instant = false;

/**
 * WP74-S1: the wizard for a library idea. The gate runs before any JSX, so a
 * refusal (workspace off, signed out, closed cohort, unknown idea) renders
 * nothing of the wizard. `?session=` (set after "Create my business", WP74-S4)
 * reopens that session after a reload; the session query re-checks ownership.
 */
export default async function StartIdeaPage({
  params,
  searchParams,
}: {
  params: Promise<{ ideaSlug: string }>;
  searchParams: Promise<{ session?: string | string[] }>;
}) {
  const { ideaSlug } = await params;
  const access = await requireWizardAccess(ideaSlug);
  const { session } = await searchParams;
  const sessionId = Array.isArray(session) ? session[0] : session;
  return (
    <WizardPage
      idea={{ source: "library", ideaSlug }}
      ideaTitle={access.ideaTitle}
      initialSessionId={sessionId && /^[a-z0-9]{1,64}$/.test(sessionId) ? sessionId : null}
    />
  );
}
