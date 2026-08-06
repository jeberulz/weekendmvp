import Link from "next/link";

/**
 * WP27-S4. The single generic outcome for every preview that does not
 * render.
 *
 * A malformed token, a token that never existed, an expired capability, and
 * a stored spec that no longer parses all reach this page with the same 404.
 * The copy is deliberately non-committal: saying "expired" would confirm the
 * token was once valid, which is the enumeration signal the whole
 * capability design exists to withhold. It is one component precisely so no
 * future edit can make one case read differently from another.
 */
export default function PreviewNotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
        This preview link isn&rsquo;t available
      </h1>
      <p className="mt-3 text-zinc-400">
        Preview links are private and last seven days. Build a new one from any
        idea in the library.
      </p>
      <div className="mt-8 flex justify-center">
        <Link
          href="/startup-ideas"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/15 px-5 font-medium text-zinc-200 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          Browse ideas
        </Link>
      </div>
    </main>
  );
}
