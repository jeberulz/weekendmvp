/**
 * Shared MDX pipeline for filesystem content (articles now; ideas/newsletter
 * reuse it in U8/U10).
 *
 * - <Mdx source components /> — RSC renderer (next-mdx-remote-client/rsc)
 *   with remark-gfm + rehype-pretty-code (github-dark) and a default
 *   component map matching the legacy article typography (explicit Tailwind
 *   classes per element, e.g. text-neutral-300 leading-relaxed).
 * - readMdxFile(dir, slug) / listMdxSlugs(dir) — gray-matter filesystem
 *   helpers rooted at process.cwd().
 */

import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import remarkGfm from "remark-gfm";
import rehypePrettyCode from "rehype-pretty-code";
import {
  MDXRemote,
  type MDXRemoteOptions,
} from "next-mdx-remote-client/rsc";
import type { MDXComponents } from "next-mdx-remote-client/rsc";

/* ------------------------------------------------------------------ */
/* Filesystem helpers                                                  */
/* ------------------------------------------------------------------ */

export type MdxFile = {
  slug: string;
  frontmatter: Record<string, unknown>;
  content: string;
};

const SLUG_RE = /^[a-z0-9-]+$/i;

/** Read + frontmatter-parse `{dir}/{slug}.mdx`. Returns null when missing. */
export async function readMdxFile(
  dir: string,
  slug: string,
): Promise<MdxFile | null> {
  if (!SLUG_RE.test(slug)) return null;
  const file = path.join(process.cwd(), dir, `${slug}.mdx`);
  try {
    const raw = await fs.readFile(file, "utf8");
    const { data, content } = matter(raw);
    return { slug, frontmatter: data, content };
  } catch {
    return null;
  }
}

/** All publishable slugs in a content dir (skips _private files/dirs). */
export async function listMdxSlugs(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(path.join(process.cwd(), dir));
    return entries
      .filter((f) => f.endsWith(".mdx") && !f.startsWith("_"))
      .map((f) => f.slice(0, -".mdx".length))
      .sort();
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Default component map (legacy article prose styling)                */
/* ------------------------------------------------------------------ */

type ElProps<T extends keyof React.JSX.IntrinsicElements> =
  React.JSX.IntrinsicElements[T];

function isBlockCode(props: ElProps<"code">) {
  // rehype-pretty-code marks fenced blocks with data attributes; inline
  // code reaches us untouched.
  return "data-language" in props || "data-theme" in props;
}

export const defaultMdxComponents: MDXComponents = {
  h2: (props: ElProps<"h2">) => (
    <h2
      className="text-2xl font-medium text-white tracking-tight mt-12 mb-6"
      {...props}
    />
  ),
  h3: (props: ElProps<"h3">) => (
    <h3 className="text-lg text-white font-medium mt-8 mb-3" {...props} />
  ),
  h4: (props: ElProps<"h4">) => (
    <h4 className="text-base text-white font-medium mt-6 mb-2" {...props} />
  ),
  p: (props: ElProps<"p">) => (
    <p className="text-neutral-300 leading-relaxed mb-6" {...props} />
  ),
  a: (props: ElProps<"a">) => (
    <a className="text-white hover:underline" {...props} />
  ),
  strong: (props: ElProps<"strong">) => (
    <strong className="text-white font-medium" {...props} />
  ),
  em: (props: ElProps<"em">) => <em className="text-neutral-200" {...props} />,
  ul: (props: ElProps<"ul">) => (
    <ul
      className="space-y-2 text-neutral-300 leading-relaxed mb-6 list-disc pl-5 marker:text-neutral-600"
      {...props}
    />
  ),
  ol: (props: ElProps<"ol">) => (
    <ol
      className="space-y-2 text-neutral-300 leading-relaxed mb-6 list-decimal pl-5 marker:text-neutral-600"
      {...props}
    />
  ),
  li: (props: ElProps<"li">) => <li className="pl-1" {...props} />,
  blockquote: (props: ElProps<"blockquote">) => (
    <blockquote
      className="border-l-2 border-white/20 pl-4 italic text-neutral-400 mb-6"
      {...props}
    />
  ),
  hr: (props: ElProps<"hr">) => (
    <hr className="border-white/10 my-12" {...props} />
  ),
  pre: (props: ElProps<"pre">) => (
    <pre
      className="p-4 bg-[#0A0A0A] border border-white/5 rounded-xl mb-6 font-mono text-xs text-neutral-300 leading-relaxed overflow-x-auto whitespace-pre-wrap"
      {...props}
    />
  ),
  code: (props: ElProps<"code">) =>
    isBlockCode(props) ? (
      <code {...props} />
    ) : (
      <code
        className="font-mono text-[0.85em] text-neutral-200 bg-white/5 border border-white/10 rounded px-1.5 py-0.5"
        {...props}
      />
    ),
  table: (props: ElProps<"table">) => (
    <div className="overflow-x-auto rounded-xl border border-white/[0.06] mb-8">
      <table className="w-full text-sm" {...props} />
    </div>
  ),
  thead: (props: ElProps<"thead">) => (
    <thead className="border-b border-white/[0.06] bg-white/[0.02]" {...props} />
  ),
  tbody: (props: ElProps<"tbody">) => (
    <tbody className="divide-y divide-white/[0.04]" {...props} />
  ),
  th: (props: ElProps<"th">) => (
    <th
      className="text-left px-5 py-4 text-xs font-mono text-neutral-500 uppercase tracking-wider"
      {...props}
    />
  ),
  td: (props: ElProps<"td">) => (
    <td className="px-5 py-4 text-neutral-300" {...props} />
  ),
};

/* ------------------------------------------------------------------ */
/* Renderer                                                            */
/* ------------------------------------------------------------------ */

const MDX_OPTIONS: MDXRemoteOptions = {
  parseFrontmatter: true,
  mdxOptions: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [[rehypePrettyCode, { theme: "github-dark" }]],
  },
};

/**
 * Server component rendering an MDX source string with the shared pipeline.
 * `components` overrides/extends the default prose map.
 */
export function Mdx({
  source,
  components,
}: {
  source: string;
  components?: MDXComponents;
}) {
  return (
    <MDXRemote
      source={source}
      components={{ ...defaultMdxComponents, ...components }}
      options={MDX_OPTIONS}
    />
  );
}

/** Convenience wrapper kept for symmetry with the migration plan. */
export function compileMdx(source: string) {
  return <Mdx source={source} />;
}
