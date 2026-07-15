export default function LinksLoading() {
  return (
    <main
      className="min-h-[100dvh] bg-[#050505] text-neutral-100"
      aria-busy="true"
      aria-label="Loading released startup ideas"
    >
      <div className="mx-auto w-full max-w-5xl px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="h-6 w-40 animate-pulse rounded-md bg-white/10 motion-reduce:animate-none" />
          <div className="size-11 animate-pulse rounded-xl bg-white/10 motion-reduce:animate-none" />
        </div>

        <div className="mt-12 max-w-2xl border-b border-white/10 pb-10 sm:mt-16 sm:pb-12">
          <div className="h-3 w-44 animate-pulse rounded bg-[#cc5500]/20 motion-reduce:animate-none" />
          <div className="mt-6 h-12 w-full max-w-xl animate-pulse rounded-2xl bg-white/10 motion-reduce:animate-none sm:h-16" />
          <div className="mt-6 h-5 w-full max-w-md animate-pulse rounded bg-white/5 motion-reduce:animate-none" />
        </div>

        <div className="mt-12 max-w-2xl">
          <div className="h-8 w-56 animate-pulse rounded-lg bg-white/10 motion-reduce:animate-none" />
          <div className="mt-6 h-36 animate-pulse rounded-2xl border border-[#cc5500]/20 bg-[#cc5500]/[0.045] motion-reduce:animate-none" />
        </div>

        <div className="mt-16">
          <div className="h-8 w-64 animate-pulse rounded-lg bg-white/10 motion-reduce:animate-none" />
          <div className="mt-8 h-12 animate-pulse rounded-xl bg-white/5 motion-reduce:animate-none" />
          <div className="mt-4 flex gap-2 overflow-hidden">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="h-9 w-28 shrink-0 animate-pulse rounded-full bg-white/5 motion-reduce:animate-none"
              />
            ))}
          </div>
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="h-36 animate-pulse rounded-2xl border border-white/5 bg-white/[0.035] motion-reduce:animate-none"
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
