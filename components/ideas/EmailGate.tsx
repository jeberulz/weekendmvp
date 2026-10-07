import Link from "next/link";
import { AuthPlatformProvider } from "@/app/AuthPlatformProvider";
import { AuthCard } from "@/components/auth/AuthCard";

/** Anonymous teaser. The research body never enters this component. */
export function EmailGate({ slug, title, description }: { slug: string; title: string; description: string }) {
  return (
    <main className="mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-28 lg:grid-cols-[minmax(0,1fr)_440px] lg:px-8 lg:pt-36">
      <div className="max-w-2xl">
        <Link href="/startup-ideas" className="text-sm text-neutral-500 underline underline-offset-4 hover:text-black">All Startup Ideas</Link>
        <h1 className="mt-8 text-4xl font-medium leading-tight tracking-tight text-black md:text-5xl">{title}</h1>
        <p className="mt-5 text-xl leading-relaxed text-neutral-600">{description}</p>
        <p className="mt-8 text-base leading-relaxed text-neutral-700">Create a free account or sign in to read the complete research, build plan and prompts for this idea.</p>
      </div>
      <AuthPlatformProvider fallbackClassName="bg-[#fcfaf7]">
        <AuthCard mode="signup" returnTo={`/ideas/${slug}`} embedded />
      </AuthPlatformProvider>
    </main>
  );
}
