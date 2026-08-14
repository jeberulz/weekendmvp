export default function DashboardLoading() {
  return (
    <div
      className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-12"
      aria-label="Loading"
    >
      <div className="animate-pulse space-y-8 motion-reduce:animate-none">
        <div className="h-8 w-52 rounded-2xl bg-stone-900/10" />
        <div className="h-28 max-w-3xl rounded-2xl bg-stone-900/5" />
        <div className="h-16 max-w-3xl rounded-2xl bg-stone-900/5" />
      </div>
    </div>
  );
}
