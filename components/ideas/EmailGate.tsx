import { AuthPlatformProvider } from "@/app/AuthPlatformProvider";
import { AuthCard } from "@/components/auth/AuthCard";

/**
 * Anonymous account surface after the short introduction on mobile and beside
 * the public content on desktop. The research body never enters this component;
 * callers supply public introduction and teaser/prompt nodes only.
 * AuthCard (embedded) owns the "Create your free account" H2.
 */
export function EmailGate({
  slug,
  intro,
  children,
}: {
  slug: string;
  intro: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto grid max-w-6xl gap-y-8 px-6 pb-20 pt-24 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-x-12 lg:gap-y-0 lg:px-8 lg:pt-36">
      {intro}
      <aside className="lg:sticky lg:top-28 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:self-start">
        <p className="mb-6 hidden text-base leading-relaxed text-neutral-700 lg:block">
          Sign in to read the complete research and build plan for this idea.
          The public build prompts above stay free.
        </p>
        <AuthPlatformProvider fallbackClassName="bg-[#fcfaf7]">
          <AuthCard mode="signup" returnTo={`/ideas/${slug}`} embedded />
        </AuthPlatformProvider>
      </aside>
      <div className="min-w-0 lg:col-start-1 lg:row-start-2">{children}</div>
    </main>
  );
}
