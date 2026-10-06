import { CopyButton } from "@/components/home/client/CopyButton";

/**
 * One starter prompt as a row inside the page's prompt panel (`bg-home-panel`,
 * on the ink band): mono label, copy button, then the prompt text. Rows are
 * divided by hairlines; the panel itself is drawn by the page.
 */
export function HubPromptCard({
  index,
  label,
  prompt,
  location,
}: {
  /** 1-based position in the list. */
  index: number;
  label: string;
  prompt: string;
  /** Analytics location for the copy event. */
  location: string;
}) {
  return (
    <li className="flex flex-col gap-3 border-t border-home-panel-rule px-5 py-5 first:border-t-0 md:px-6">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 font-mono text-[11px] uppercase tracking-[0.08em] text-home-d3">
          <span className="text-home-orange-light">{index}</span> · {label}
        </p>
        <CopyButton
          text={prompt}
          label={`Copy prompt ${index}: ${label}`}
          location={location}
          className="-mr-2 min-h-11 shrink-0 px-3 text-home-d2 hover:text-home-d1"
        />
      </div>
      <p className="font-mono text-[13px] leading-[1.7] text-home-d1 [overflow-wrap:anywhere] md:text-sm">{prompt}</p>
    </li>
  );
}
