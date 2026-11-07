import { ButtonLink, Container, Em } from "@/components/home/ui";
import { PublicShell } from "@/components/public/PublicShell";

/**
 * L1-C9: what `/start/*` shows a signed-in founder who is not on the beta
 * allowlist yet (`requireWizardAccess` → `kind: "not-invited"`). In
 * `allowlist` mode the public "Build this idea" CTAs show to signed-out
 * visitors, so a new account can land here; before L1-C9 it was a bare 404.
 * It promises nothing that is not built: no waitlist, no email.
 */
export function NotInvited({ ideaSlug }: { ideaSlug: string | null }) {
  return (
    <PublicShell footerCta={false}>
      <Container className="flex flex-col items-center gap-[22px] pb-24 pt-32 text-center md:pt-40">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-home-orange-ink md:text-xs">
          Private beta
        </p>
        <h1 className="font-editorial text-[40px] font-normal leading-none tracking-[-0.03em] text-balance text-home-ink md:text-[60px]">
          You&apos;re not in the beta <Em>yet.</Em>
        </h1>
        <p className="max-w-[560px] text-pretty text-lg leading-[1.55] text-home-ink-2">
          Your account is ready. Building with your AI co-founder is open to invited testers only while we
          test it, and it will open to more founders soon. Until then, every idea&apos;s research and build
          prompts are yours to read.
        </p>
        <div className="flex w-full flex-col items-center justify-center gap-3 pt-1.5 sm:w-auto sm:flex-row">
          {ideaSlug ? (
            <ButtonLink href={`/ideas/${ideaSlug}`} tone="primary" arrow={false} className="w-full sm:w-auto">
              Back to the idea
            </ButtonLink>
          ) : null}
          <ButtonLink
            href="/startup-ideas"
            tone={ideaSlug ? "secondary" : "primary"}
            arrow={false}
            className="w-full sm:w-auto"
          >
            Browse all ideas
          </ButtonLink>
          <ButtonLink href="/dashboard" tone="secondary" arrow={false} className="w-full sm:w-auto">
            Go to your dashboard
          </ButtonLink>
        </div>
      </Container>
    </PublicShell>
  );
}
