import { AuthPlatformProvider } from "@/app/AuthPlatformProvider";
import { WizardFlow, type WizardFlowProps } from "@/components/workspace/wizard/WizardFlow";
import { newsreaderEditorial } from "@/lib/fonts";

/**
 * Shared page frame for the wizard routes. Render only after `requireWizardAccess`.
 * `WizardFlow` draws the top bar and `<main>` itself: whether "Save & exit" shows depends on the session.
 */
export function WizardPage(props: WizardFlowProps) {
  return (
    <AuthPlatformProvider fallbackClassName="bg-home-paper">
      <div className={`${newsreaderEditorial.variable} theme-desk min-h-dvh bg-home-paper text-home-ink`}>
        <WizardFlow {...props} />
      </div>
    </AuthPlatformProvider>
  );
}
