import type { Metadata } from "next";
import { connection } from "next/server";
import { requireWizardAccess } from "@/lib/workspace/wizard-access";
import { ownIdeaExamplesForRequest } from "@/lib/workspace/wizard/own-idea-examples.server";
import { NotInvited } from "../NotInvited";
import { WizardPage } from "../WizardPage";

export const metadata: Metadata = { title: "Build your own idea" };

export const instant = false;

/**
 * WP74-S1: the wizard for the founder's own idea (D15). `?session=` resumes after a reload.
 * L1-C9: a signed-in founder who is not invited yet gets `NotInvited`, not a 404.
 * WP99: the "Try one of these" chips are three live library ideas, drawn per visit.
 */
export default async function StartOwnPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string | string[] }>;
}) {
  // Render at request time, not a prerendered/edge-cached shell: this is an
  // auth-gated flow, and a cached shell pins the client bundle to an old deploy.
  await connection();
  // WP99: the example chips come from the cached library pool; the draw runs beside the access check.
  const examples = ownIdeaExamplesForRequest();
  const access = await requireWizardAccess(null);
  if (access.kind === "not-invited") return <NotInvited ideaSlug={null} />;
  const { session } = await searchParams;
  const sessionId = Array.isArray(session) ? session[0] : session;
  return (
    <WizardPage
      idea={null}
      ideaTitle={null}
      initialSessionId={sessionId && /^[a-z0-9]{1,64}$/.test(sessionId) ? sessionId : null}
      ownIdeaExamples={await examples}
    />
  );
}
