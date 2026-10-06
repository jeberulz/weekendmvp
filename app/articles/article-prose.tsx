/**
 * Light reading typography for article and newsletter-issue bodies (WP56).
 * The default map in lib/mdx.tsx is dark; this one sits on the paper ground:
 * serif headings in ink, Geist body in ink-2, orange-ink links, ruled
 * blockquotes (no side stripes) and `home-panel` code blocks. Pair it with
 * `codeTheme="github-dark"` (the Mdx default), which reads on the panel.
 */

import type { MDXComponents } from "next-mdx-remote-client/rsc";

import { cn } from "@/lib/utils";

type ElProps<T extends keyof React.JSX.IntrinsicElements> =
  React.JSX.IntrinsicElements[T];

function isBlockCode(props: ElProps<"code">) {
  // rehype-pretty-code marks fenced blocks with data attributes; inline
  // code reaches us untouched.
  return "data-language" in props || "data-theme" in props;
}

export const articleMdxComponents: MDXComponents = {
  h2: ({ className, ...props }: ElProps<"h2">) => (
    <h2
      className={cn(
        "mb-5 mt-14 scroll-mt-28 font-editorial text-[28px] font-normal leading-[1.12] tracking-[-0.02em] text-balance text-home-ink md:text-[34px]",
        className,
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }: ElProps<"h3">) => (
    <h3
      className={cn(
        "mb-3 mt-10 scroll-mt-28 font-editorial text-[22px] font-normal leading-[1.2] tracking-[-0.01em] text-balance text-home-ink md:text-[26px]",
        className,
      )}
      {...props}
    />
  ),
  h4: ({ className, ...props }: ElProps<"h4">) => (
    <h4
      className={cn("mb-2 mt-8 text-base font-semibold text-home-ink", className)}
      {...props}
    />
  ),
  p: ({ className, ...props }: ElProps<"p">) => (
    <p
      className={cn("mb-6 text-[17px] leading-[1.7] text-home-ink-2", className)}
      {...props}
    />
  ),
  a: ({ className, ...props }: ElProps<"a">) => (
    <a
      className={cn(
        "break-words text-home-orange-ink underline underline-offset-4 transition-colors hover:text-home-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  ),
  strong: ({ className, ...props }: ElProps<"strong">) => (
    <strong className={cn("font-semibold text-home-ink", className)} {...props} />
  ),
  em: ({ className, ...props }: ElProps<"em">) => (
    <em className={cn("italic text-home-ink", className)} {...props} />
  ),
  ul: ({ className, ...props }: ElProps<"ul">) => (
    <ul
      className={cn(
        "mb-6 list-disc space-y-2.5 pl-5 text-[17px] leading-[1.7] text-home-ink-2 marker:text-home-ink-3",
        className,
      )}
      {...props}
    />
  ),
  ol: ({ className, ...props }: ElProps<"ol">) => (
    <ol
      className={cn(
        "mb-6 list-decimal space-y-2.5 pl-5 text-[17px] leading-[1.7] text-home-ink-2 marker:font-mono marker:text-home-ink-3",
        className,
      )}
      {...props}
    />
  ),
  li: ({ className, ...props }: ElProps<"li">) => (
    <li className={cn("pl-1", className)} {...props} />
  ),
  blockquote: ({ className, ...props }: ElProps<"blockquote">) => (
    <blockquote
      className={cn(
        "my-10 border-y border-home-rule py-6 font-editorial text-[22px] italic leading-[1.4] text-home-ink [&>p]:mb-0 [&>p]:text-[inherit] [&>p]:leading-[inherit] [&>p]:text-home-ink",
        className,
      )}
      {...props}
    />
  ),
  hr: ({ className, ...props }: ElProps<"hr">) => (
    <hr className={cn("my-12 border-home-rule", className)} {...props} />
  ),
  pre: ({ className, ...props }: ElProps<"pre">) => (
    <pre
      className={cn(
        "mb-6 overflow-x-auto whitespace-pre-wrap rounded-xl border border-home-panel-rule bg-home-panel! p-4 font-mono text-[13px] leading-relaxed text-home-d1",
        className,
      )}
      {...props}
    />
  ),
  code: ({ className, ...props }: ElProps<"code">) =>
    isBlockCode(props) ? (
      <code className={className} {...props} />
    ) : (
      <code
        className={cn(
          "break-words rounded border border-home-rule bg-home-sunk px-1.5 py-0.5 font-mono text-[0.85em] text-home-ink",
          className,
        )}
        {...props}
      />
    ),
  table: (props: ElProps<"table">) => (
    <div className="mb-8 overflow-x-auto rounded-xl border border-home-rule bg-home-card">
      <table className="w-full text-sm" {...props} />
    </div>
  ),
  thead: ({ className, ...props }: ElProps<"thead">) => (
    <thead
      className={cn("border-b border-home-rule bg-home-sunk", className)}
      {...props}
    />
  ),
  tbody: ({ className, ...props }: ElProps<"tbody">) => (
    <tbody className={cn("divide-y divide-home-rule", className)} {...props} />
  ),
  th: ({ className, ...props }: ElProps<"th">) => (
    <th
      className={cn(
        "px-5 py-4 text-left font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-home-ink-3",
        className,
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }: ElProps<"td">) => (
    <td className={cn("px-5 py-4 text-home-ink-2", className)} {...props} />
  ),
  img: ({ alt, className, ...props }: ElProps<"img">) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt ?? ""}
      loading="lazy"
      decoding="async"
      className={cn("my-8 w-full rounded-2xl border border-home-rule", className)}
      {...props}
    />
  ),
};
