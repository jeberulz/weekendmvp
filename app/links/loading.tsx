export default function LinksLoading() {
  return (
    <main
      className="min-h-[100dvh] bg-[#050505] text-neutral-100"
      aria-busy="true"
      aria-label="Loading daily video links"
    >
      <div className="mx-auto w-full max-w-5xl px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:px-8">
        <div className="h-6 w-40 animate-pulse rounded-md bg-white/10 motion-reduce:animate-none" />

        <div className="mt-12 grid items-end gap-8 border-b border-white/10 pb-12 md:grid-cols-[minmax(0,1fr)_14rem] md:gap-14">
          <div>
            <div className="h-3 w-44 animate-pulse rounded bg-[#cc5500]/20 motion-reduce:animate-none" />
            <div className="mt-6 h-12 w-full max-w-xl animate-pulse rounded-2xl bg-white/10 motion-reduce:animate-none sm:h-16" />
            <div className="mt-6 h-5 w-full max-w-md animate-pulse rounded bg-white/5 motion-reduce:animate-none" />
          </div>
          <div className="size-20 animate-pulse rounded-2xl bg-white/10 motion-reduce:animate-none md:size-56" />
        </div>

        <div className="mt-14">
          <div className="h-8 w-56 animate-pulse rounded-lg bg-white/10 motion-reduce:animate-none" />
          <div className="mt-10 h-32 max-w-2xl animate-pulse rounded-2xl border border-white/5 bg-white/[0.035] motion-reduce:animate-none" />
        </div>
      </div>
    </main>
  );
}
