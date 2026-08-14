export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-12" aria-label="Loading workspace">
      <div className="animate-pulse space-y-8 motion-reduce:animate-none">
        <div className="h-8 w-52 rounded-md bg-white/8" />
        <div className="h-28 max-w-3xl rounded-xl bg-white/5" />
        <div className="h-16 max-w-3xl rounded-lg bg-white/5" />
      </div>
    </div>
  );
}
