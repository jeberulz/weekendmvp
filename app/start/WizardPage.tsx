import { AuthPlatformProvider } from "@/app/AuthPlatformProvider";
import { WizardFlow, type WizardFlowProps } from "@/components/workspace/wizard/WizardFlow";
import { newsreaderEditorial } from "@/lib/fonts";

/** Shared page frame for the wizard routes. Render only after `requireWizardAccess`. */
export function WizardPage(props: WizardFlowProps) {
  return (
    <AuthPlatformProvider fallbackClassName="bg-home-paper">
      <div className={`${newsreaderEditorial.variable} theme-desk min-h-dvh bg-home-paper text-home-ink`}>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-[720px] px-5 py-10 focus:outline-none sm:px-8 lg:py-14"
        >
          <WizardFlow {...props} />
        </main>
      </div>
    </AuthPlatformProvider>
  );
}
