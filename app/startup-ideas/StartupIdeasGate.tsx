import { AuthPlatformProvider } from "@/app/AuthPlatformProvider";
import { AuthCard } from "@/components/auth/AuthCard";
import { Container, Em } from "@/components/home/ui";
import { Breadcrumbs } from "@/components/public/PageHeader";

/** Public introduction. The full library data is never passed here. */
export function StartupIdeasTeaser() {
  return (
    <section aria-labelledby="ideas-teaser-heading" className="relative overflow-hidden pb-20 pt-24 md:pt-36">
      <div aria-hidden="true" className="home-dots absolute inset-0 opacity-60 [mask-image:linear-gradient(#000_40%,transparent)]" />
      <Container className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-start lg:gap-12">
        <div className="flex max-w-2xl flex-col gap-5">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Startup Ideas" }]} />
          <h1 id="ideas-teaser-heading" className="font-editorial text-[42px] leading-[1.02] tracking-[-0.03em] text-home-ink md:text-[68px]">
            Startup Ideas <Em>sized for a weekend.</Em>
          </h1>
          <p className="text-lg leading-relaxed text-home-ink-2">
            Explore research-backed startup ideas with the market evidence, build plan, and prompts you need to ship. Create a free account or sign in to browse the full library.
          </p>
        </div>
        <AuthPlatformProvider fallbackClassName="bg-home-paper">
          <AuthCard mode="signup" returnTo="/startup-ideas" embedded />
        </AuthPlatformProvider>
      </Container>
    </section>
  );
}
