import { renderMarkdown } from "@/lib/editorial/markdown/render";

/** Activated editorial text is CommonMark/GFM, never executable MDX. */
export function SafeEditorialBody({ markdown }: { markdown: string }) {
  const { node } = renderMarkdown(markdown, { idPrefix: "idea" });
  return (
    <div className="[&_h2]:mt-12 [&_h2]:mb-6 [&_h2]:text-2xl [&_h2]:font-medium [&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:text-lg [&_p]:mb-6 [&_p]:leading-relaxed [&_a]:underline [&_a]:break-words [&_ul]:mb-6 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-6 [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:mb-6 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-neutral-100 [&_pre]:p-4 [&_blockquote]:border-l-2 [&_blockquote]:pl-4">
      {node}
    </div>
  );
}
