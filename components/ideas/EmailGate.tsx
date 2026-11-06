import { AuthPlatformProvider } from "@/app/AuthPlatformProvider";
import { AuthCard } from "@/components/auth/AuthCard";
import { buildHref } from "@/lib/workspace/build-cta";

/**
 * Anonymous account surface after the short introduction on mobile and beside
 * the public content on desktop. The research body never enters this component;
 * callers supply public introduction and teaser/prompt nodes only.
 * AuthCard gate mode owns the "Read the full research, free" H2 plus Sign in link.
 */
export function EmailGate({
  slug,
  intro,
  children,
  buildFirst = false,
}: {
  slug: string;
  intro: React.ReactNode;
  children: React.ReactNode;
  /**
   * WP74-S5, behind the launch-workspace flag only: the card signs the visitor
   * in and returns to `/start/{slug}` instead of this page. The card keeps its
   * place and its heading.
   */
  buildFirst?: boolean;
}) {
  return (
    <main className="mx-auto grid max-w-6xl gap-y-8 px-6 pb-20 pt-24 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-x-12 lg:gap-y-0 lg:px-8 lg:pt-36">
      {intro}
      <aside className="lg:sticky lg:top-28 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:self-start">
        <AuthPlatformProvider fallbackClassName="bg-[#fcfaf7]">
          {buildFirst ? (
            <AuthCard
              mode="signup"
              returnTo={buildHref(slug)}
              signInReturnTo={`/ideas/${slug}`}
              embedded
              gate
              buildFirst
            />
          ) : (
            <AuthCard mode="signup" returnTo={`/ideas/${slug}`} embedded gate />
          )}
        </AuthPlatformProvider>
      </aside>
      <div className="min-w-0 lg:col-start-1 lg:row-start-2">{children}</div>
    </main>
  );
}
