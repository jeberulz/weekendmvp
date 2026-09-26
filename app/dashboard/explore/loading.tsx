export default function IdeasLoading() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div role="status" className="flex animate-pulse flex-col gap-6 motion-reduce:animate-none">
        <span className="sr-only">Loading ideas</span>
        <div aria-hidden className="h-10 w-40 rounded-md bg-home-sunk" />
        <div aria-hidden className="h-11 w-64 rounded-lg bg-home-sunk" />
        <div aria-hidden className="h-10 w-full max-w-2xl rounded-lg bg-home-sunk" />
        <div aria-hidden className="h-[420px] rounded-[14px] bg-home-sunk" />
      </div>
    </div>
  );
}
