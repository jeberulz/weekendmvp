export default function ExploreLoading() {
  return (
    <div
      className="mx-auto max-w-6xl px-5 py-9 sm:px-8 sm:py-11"
      aria-label="Loading ideas"
    >
      <div className="animate-pulse motion-reduce:animate-none">
        <div className="h-9 w-48 rounded-2xl bg-stone-900/10" />
        <div className="mt-8 h-11 max-w-3xl rounded-2xl bg-stone-900/5" />
        <div className="mt-8 space-y-5">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-40 rounded-2xl border border-stone-900/10 bg-white/40"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
