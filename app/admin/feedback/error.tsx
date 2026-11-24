"use client";

/** Generic by design: server error details never reach the page. */
export default function FeedbackError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6">
      <div role="alert" className="rounded-lg border border-red-700 bg-red-50 px-5 py-4 text-red-800">
        <h1 className="text-base font-semibold">The feedback page failed to load</h1>
        <p className="mt-1 text-sm">Nothing was changed. Try again, or reload the page.</p>
      </div>
      <div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center rounded-md border border-neutral-400 bg-white px-4 text-sm font-medium text-neutral-900 outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
