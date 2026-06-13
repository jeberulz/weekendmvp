/**
 * Light/cream-theme MDX component map for idea pages. The default map in
 * lib/mdx.tsx is dark-themed (articles); this variant mirrors the legacy
 * idea-page typography (ideas/_template.html: neutral-600 body on #fcfaf7)
 * and adds:
 *   - legacy section ids on h2 (so #section-problem deep links still work)
 *   - copy buttons on fenced code blocks (prompt boxes)
 */

import * as React from "react";
import type { MDXComponents } from "next-mdx-remote-client/rsc";

import { CopyablePre } from "@/components/ideas/PromptCopyButton";
import { ideaHeadingId } from "@/components/ideas/idea-meta";

type ElProps<T extends keyof React.JSX.IntrinsicElements> =
  React.JSX.IntrinsicElements[T];

function childrenToText(children: React.ReactNode): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) return children.map(childrenToText).join("");
  if (React.isValidElement(children)) {
    const props = children.props as { children?: React.ReactNode };
    return childrenToText(props.children);
  }
  return "";
}

function isBlockCode(props: ElProps<"code">) {
  return "data-language" in props || "data-theme" in props;
}

export const ideaMdxComponents: MDXComponents = {
  h2: ({ children, ...props }: ElProps<"h2">) => (
    <h2
      id={ideaHeadingId(childrenToText(children))}
      className="text-2xl font-medium text-black tracking-tight mt-12 mb-6 scroll-mt-[7.5rem]"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: (props: ElProps<"h3">) => (
    <h3
      className="text-lg text-black font-medium mt-8 mb-3 scroll-mt-[7.5rem]"
      {...props}
    />
  ),
  h4: (props: ElProps<"h4">) => (
    <h4 className="text-base text-black font-medium mt-6 mb-2" {...props} />
  ),
  p: (props: ElProps<"p">) => (
    <p className="text-neutral-600 leading-relaxed mb-6" {...props} />
  ),
  a: (props: ElProps<"a">) => (
    <a
      className="text-black underline underline-offset-2 hover:text-neutral-600 transition-colors"
      {...props}
    />
  ),
  strong: (props: ElProps<"strong">) => (
    <strong className="text-black font-medium" {...props} />
  ),
  em: (props: ElProps<"em">) => <em className="text-neutral-700" {...props} />,
  ul: (props: ElProps<"ul">) => (
    <ul
      className="space-y-3 text-neutral-600 leading-relaxed mb-6 list-disc pl-5 marker:text-neutral-400"
      {...props}
    />
  ),
  ol: (props: ElProps<"ol">) => (
    <ol
      className="space-y-3 text-neutral-600 leading-relaxed mb-6 list-decimal pl-5 marker:text-neutral-400"
      {...props}
    />
  ),
  li: (props: ElProps<"li">) => <li className="pl-1" {...props} />,
  blockquote: (props: ElProps<"blockquote">) => (
    <blockquote
      className="border-l-2 border-black/15 pl-4 italic text-neutral-500 mb-6"
      {...props}
    />
  ),
  hr: (props: ElProps<"hr">) => (
    <hr className="border-neutral-200 my-12" {...props} />
  ),
  pre: (props: ElProps<"pre">) => <CopyablePre {...props} />,
  code: (props: ElProps<"code">) =>
    isBlockCode(props) ? (
      <code {...props} />
    ) : (
      <code
        className="font-mono text-[0.85em] text-neutral-800 bg-black/5 border border-black/10 rounded px-1.5 py-0.5"
        {...props}
      />
    ),
  table: (props: ElProps<"table">) => (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 mb-8">
      <table className="w-full text-sm" {...props} />
    </div>
  ),
  thead: (props: ElProps<"thead">) => (
    <thead className="border-b border-neutral-200 bg-neutral-100" {...props} />
  ),
  tbody: (props: ElProps<"tbody">) => (
    <tbody className="divide-y divide-neutral-200" {...props} />
  ),
  th: (props: ElProps<"th">) => (
    <th
      className="text-left px-5 py-4 text-xs font-mono text-neutral-500 uppercase tracking-wider"
      {...props}
    />
  ),
  td: (props: ElProps<"td">) => (
    <td className="px-5 py-4 text-neutral-600" {...props} />
  ),
};
