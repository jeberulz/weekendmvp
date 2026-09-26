export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div
        role="status"
        className="flex animate-pulse flex-col gap-8 motion-reduce:animate-none"
      >
        <span className="sr-only">Loading your workspace</span>
        <div aria-hidden className="flex flex-col gap-2">
          <div className="h-3.5 w-40 rounded bg-home-sunk" />
          <div className="h-10 w-72 max-w-full rounded-md bg-home-sunk" />
        </div>
        <div aria-hidden className="h-[260px] max-w-3xl rounded-[14px] bg-home-sunk" />
        <div aria-hidden className="h-[320px] max-w-3xl rounded-[14px] bg-home-sunk" />
      </div>
    </div>
  );
}
