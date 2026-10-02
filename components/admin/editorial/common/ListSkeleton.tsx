/** Loading placeholder with a real status message; the bars are decorative. */
export function ListSkeleton({ label, rows = 6 }: { label: string; rows?: number }) {
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      <p role="status" className="sr-only">
        {label}
      </p>
      <div aria-hidden="true" className="flex flex-col gap-2 rounded-lg border border-(--ed-border) bg-(--ed-surface) p-4">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-4">
            <div className="h-4 w-1/3 rounded bg-(--ed-sunk)" />
            <div className="h-4 w-1/6 rounded bg-(--ed-sunk)" />
            <div className="h-4 flex-1 rounded bg-(--ed-sunk)" />
          </div>
        ))}
      </div>
    </div>
  );
}
