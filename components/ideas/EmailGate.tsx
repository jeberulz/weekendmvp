import { AuthPlatformProvider } from "@/app/AuthPlatformProvider";
import { AuthCard } from "@/components/auth/AuthCard";

/**
 * Anonymous account surface beside the public idea summary. The research body
 * never enters this component; callers render public teasers/prompts as
 * `children` so every logged-out visitor gets identical HTML.
 */
export function EmailGate({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-28 lg:grid-cols-[minmax(0,1fr)_440px] lg:px-8 lg:pt-36">
      {children}
      <aside className="lg:sticky lg:top-28 lg:self-start">
        <h2 className="text-2xl font-medium tracking-tight text-black">
          Create your free account
        </h2>
        <p className="mt-3 text-base leading-relaxed text-neutral-700">
          Sign in to read the complete research and build plan for this idea.
          The public build prompts above stay free.
        </p>
        <div className="mt-6">
          <AuthPlatformProvider fallbackClassName="bg-[#fcfaf7]">
            <AuthCard mode="signup" returnTo={`/ideas/${slug}`} embedded />
          </AuthPlatformProvider>
        </div>
      </aside>
    </main>
  );
}
