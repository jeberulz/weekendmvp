"use client";

import { buttonClass } from "@/components/admin/editorial/common/primitives";

/** Generic by design: server error details never reach the page. */
export default function EditorialError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <div role="alert" className="rounded-lg border border-(--ed-danger) bg-(--ed-danger-bg) px-5 py-4 text-(--ed-danger)">
        <h1 className="text-base font-semibold">This part of the editorial workspace failed to load</h1>
        <p className="mt-1 text-sm">
          Nothing was saved or published by this error. Try again, or reload the page.
          {error.digest ? <span className="font-mono"> Reference {error.digest}.</span> : null}
        </p>
      </div>
      <div>
        <button type="button" onClick={reset} className={buttonClass.secondary}>
          Try again
        </button>
      </div>
    </div>
  );
}
