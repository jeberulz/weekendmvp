import type { Metadata } from "next";
import { requireWizardAccess } from "@/lib/workspace/wizard-access";
import { WizardPage } from "../WizardPage";

export const metadata: Metadata = { title: "Build this idea" };

export const instant = false;

/**
 * WP74-S1: the wizard for a library idea. The gate runs before any JSX, so a
 * refusal (workspace off, signed out, closed cohort, unknown idea) renders
 * nothing of the wizard.
 */
export default async function StartIdeaPage({ params }: { params: Promise<{ ideaSlug: string }> }) {
  const { ideaSlug } = await params;
  const access = await requireWizardAccess(ideaSlug);
  return (
    <WizardPage
      idea={{ source: "library", ideaSlug }}
      ideaTitle={access.ideaTitle}
      initialSessionId={null}
    />
  );
}
