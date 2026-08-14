export default function ExploreLoading() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-9 sm:px-8 sm:py-11" aria-label="Loading ideas">
      <div className="animate-pulse motion-reduce:animate-none">
        <div className="h-9 w-48 rounded-md bg-white/8" />
        <div className="mt-8 h-11 max-w-3xl rounded-lg bg-white/6" />
        <div className="mt-8 space-y-5">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-40 border-b border-white/10 bg-white/[0.015]" />
          ))}
        </div>
      </div>
    </div>
  );
}
