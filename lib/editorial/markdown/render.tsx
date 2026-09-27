import type { Nodes, Root, RootContent } from "mdast";
import type { ReactNode } from "react";

import { checkPublicHttpUrl } from "../contracts/primitives";
import { parseArticleMarkdown } from "./parse";

/**
 * Safe editorial preview.
 *
 * Markdown is parsed as CommonMark + GFM only (no MDX), then mapped node by
 * node through an allowlist to React elements. React escapes every string,
 * so nothing is ever injected as HTML:
 *
 * - raw HTML, JSX-looking tags, `{expressions}` and import/export lines are
 *   shown as literal text; nothing is evaluated or imported;
 * - links keep an `href` only for public http(s) or mailto targets;
 * - images are never fetched, so a draft cannot make the admin's browser
 *   call an arbitrary host;
 * - rendering depth is capped so hostile nesting cannot exhaust the stack.
 */

export type ClaimMarker = { id: string; anchorText: string; label: string };

export type PreviewNotice = {
  kind: "raw_markup" | "unsafe_link" | "image_not_loaded" | "depth_limited";
  line: number | null;
  detail: string;
};

export type RenderOptions = {
  claims?: readonly ClaimMarker[];
  onClaim?: (claimId: string) => void;
  /** Prefix for heading and footnote ids, unique per preview on the page. */
  idPrefix?: string;
};

const MAX_DEPTH = 48;

type Context = {
  options: RenderOptions;
  definitions: Map<string, { url: string; title: string | null }>;
  notices: PreviewNotice[];
  bodyStartLine: number;
  footnoteOrder: string[];
  keySeq: number;
  claimsSeen: Set<string>;
};

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function lineOf(ctx: Context, node: Nodes): number | null {
  return node.position ? ctx.bodyStartLine + node.position.start.line - 1 : null;
}

export function nodeText(node: Nodes): string {
  if ("value" in node && typeof node.value === "string") return node.value;
  if ("children" in node) return (node.children as Nodes[]).map(nodeText).join("");
  return "";
}

/** Links: public http(s) and mailto only. Everything else keeps its text and loses its target. */
export function safeHref(url: string): string | null {
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(url)) return url;
  return checkPublicHttpUrl(url) === null ? url : null;
}

function key(ctx: Context): string {
  ctx.keySeq += 1;
  return `n${ctx.keySeq}`;
}

function withClaims(text: string, ctx: Context): ReactNode {
  const claims = ctx.options.claims ?? [];
  if (claims.length === 0 || text.length === 0) return text;
  const parts: ReactNode[] = [];
  let rest = text;
  for (;;) {
    let best: { claim: ClaimMarker; index: number } | null = null;
    for (const claim of claims) {
      if (!claim.anchorText) continue;
      const index = rest.indexOf(claim.anchorText);
      if (index !== -1 && (!best || index < best.index)) best = { claim, index };
    }
    if (!best) break;
    const { claim, index } = best;
    ctx.claimsSeen.add(claim.id);
    if (index > 0) parts.push(rest.slice(0, index));
    parts.push(
      <mark key={key(ctx)} data-claim-id={claim.id}>
        {claim.anchorText}
      </mark>,
    );
    parts.push(
      <button
        key={key(ctx)}
        type="button"
        data-claim-button={claim.id}
        onClick={ctx.options.onClaim ? () => ctx.options.onClaim?.(claim.id) : undefined}
        className="ml-0.5 inline-flex min-h-6 min-w-6 items-center justify-center rounded border border-(--ed-warning) bg-(--ed-surface) px-1 align-super text-[0.625rem] font-semibold leading-none text-(--ed-warning) outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-(--ed-focus)"
      >
        <span aria-hidden="true">claim</span>
        <span className="sr-only">Show evidence for claim: {claim.label}</span>
      </button>,
    );
    rest = rest.slice(index + claim.anchorText.length);
  }
  if (rest) parts.push(rest);
  return parts.length === 1 ? parts[0] : parts;
}

function children(node: Nodes, ctx: Context, depth: number): ReactNode[] {
  if (!("children" in node)) return [];
  return (node.children as Nodes[]).map((child) => render(child, ctx, depth + 1));
}

function render(node: Nodes, ctx: Context, depth: number): ReactNode {
  if (depth > MAX_DEPTH) {
    ctx.notices.push({ kind: "depth_limited", line: lineOf(ctx, node), detail: "Deeply nested content shown as plain text." });
    return <span key={key(ctx)}>{nodeText(node)}</span>;
  }
  switch (node.type) {
    case "root":
      return <>{children(node, ctx, depth)}</>;
    case "paragraph":
      return <p key={key(ctx)}>{children(node, ctx, depth)}</p>;
    case "heading": {
      const level = Math.min(6, Math.max(2, node.depth)) as 2 | 3 | 4 | 5 | 6;
      const Tag = `h${level}` as const;
      const id = `${ctx.options.idPrefix ?? "preview"}-${slugify(nodeText(node))}`;
      return (
        <Tag key={key(ctx)} id={id}>
          {children(node, ctx, depth)}
        </Tag>
      );
    }
    case "thematicBreak":
      return <hr key={key(ctx)} />;
    case "blockquote":
      return <blockquote key={key(ctx)}>{children(node, ctx, depth)}</blockquote>;
    case "list":
      return node.ordered ? (
        <ol key={key(ctx)} start={node.start ?? undefined}>
          {children(node, ctx, depth)}
        </ol>
      ) : (
        <ul key={key(ctx)}>{children(node, ctx, depth)}</ul>
      );
    case "listItem":
      return (
        <li key={key(ctx)}>
          {typeof node.checked === "boolean" ? (
            <span className="mr-1 font-mono">
              <span aria-hidden="true">{node.checked ? "[x]" : "[ ]"}</span>
              <span className="sr-only">{node.checked ? "Done: " : "Not done: "}</span>
            </span>
          ) : null}
          {children(node, ctx, depth)}
        </li>
      );
    case "table": {
      const [head, ...body] = node.children;
      const align = node.align ?? [];
      const cellClass = (index: number) =>
        align[index] === "center" ? "text-center" : align[index] === "right" ? "text-right" : undefined;
      return (
        <div key={key(ctx)} className="overflow-x-auto">
          <table>
            {head ? (
              <thead>
                <tr>
                  {head.children.map((cell, index) => (
                    <th key={key(ctx)} scope="col" className={cellClass(index)}>
                      {children(cell, ctx, depth + 1)}
                    </th>
                  ))}
                </tr>
              </thead>
            ) : null}
            <tbody>
              {body.map((row) => (
                <tr key={key(ctx)}>
                  {row.children.map((cell, index) => (
                    <td key={key(ctx)} className={cellClass(index)}>
                      {children(cell, ctx, depth + 1)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "html":
      ctx.notices.push({ kind: "raw_markup", line: lineOf(ctx, node), detail: "Raw markup shown as text, not rendered." });
      return (
        <code key={key(ctx)} data-raw-markup="" className="block whitespace-pre-wrap border-l-2 border-(--ed-warning) pl-2">
          {node.value}
        </code>
      );
    case "code":
      return (
        <figure key={key(ctx)}>
          {node.lang ? (
            <figcaption className="font-mono text-xs text-(--ed-text-2)">{node.lang}</figcaption>
          ) : null}
          <pre>
            <code>{node.value}</code>
          </pre>
        </figure>
      );
    case "definition":
      return null;
    case "footnoteDefinition":
      return null;
    case "text":
      return withClaims(node.value, ctx);
    case "emphasis":
      return <em key={key(ctx)}>{children(node, ctx, depth)}</em>;
    case "strong":
      return <strong key={key(ctx)}>{children(node, ctx, depth)}</strong>;
    case "delete":
      return <del key={key(ctx)}>{children(node, ctx, depth)}</del>;
    case "inlineCode":
      return <code key={key(ctx)}>{node.value}</code>;
    case "break":
      return <br key={key(ctx)} />;
    case "link":
    case "linkReference": {
      const target = node.type === "link" ? node.url : ctx.definitions.get(node.identifier.toLowerCase())?.url ?? null;
      const href = target ? safeHref(target) : null;
      if (!href) {
        ctx.notices.push({ kind: "unsafe_link", line: lineOf(ctx, node), detail: "A link target was removed (not a public http(s) address)." });
        return (
          <span key={key(ctx)} className="underline decoration-dotted">
            {children(node, ctx, depth)}
            <span className="sr-only"> (link removed: unsafe address)</span>
          </span>
        );
      }
      return (
        <a key={key(ctx)} href={href} target="_blank" rel="noopener noreferrer nofollow">
          {children(node, ctx, depth)}
          <span className="sr-only"> (opens in new tab)</span>
        </a>
      );
    }
    case "image":
    case "imageReference": {
      const alt = node.alt ?? "";
      ctx.notices.push({ kind: "image_not_loaded", line: lineOf(ctx, node), detail: "Images are not fetched in the editorial preview." });
      return (
        <span key={key(ctx)} className="inline-block rounded border border-dashed border-(--ed-border-strong) px-2 py-1 text-sm text-(--ed-text-2)">
          Image not loaded in preview{alt ? `: ${alt}` : ""}
        </span>
      );
    }
    case "footnoteReference": {
      const id = node.identifier.toLowerCase();
      if (!ctx.footnoteOrder.includes(id)) ctx.footnoteOrder.push(id);
      const number = ctx.footnoteOrder.indexOf(id) + 1;
      return (
        <sup key={key(ctx)}>
          <a href={`#${ctx.options.idPrefix ?? "preview"}-fn-${slugify(id)}`}>
            <span className="sr-only">Footnote </span>
            {number}
          </a>
        </sup>
      );
    }
    default:
      // Anything unexpected (future syntax extensions) degrades to text.
      return <span key={key(ctx)}>{nodeText(node)}</span>;
  }
}

function collectDefinitions(tree: Root, ctx: Context) {
  const footnotes = new Map<string, RootContent>();
  const stack: Nodes[] = [tree];
  while (stack.length) {
    const node = stack.pop();
    if (!node) break;
    if (node.type === "definition") ctx.definitions.set(node.identifier.toLowerCase(), { url: node.url, title: node.title ?? null });
    if (node.type === "footnoteDefinition") footnotes.set(node.identifier.toLowerCase(), node);
    if ("children" in node) stack.push(...(node.children as Nodes[]));
  }
  return footnotes;
}

export function renderMarkdown(
  markdown: string,
  options: RenderOptions = {},
): { node: ReactNode; notices: PreviewNotice[]; claimsShown: string[] } {
  const { tree, bodyStartLine } = parseArticleMarkdown(markdown);
  const ctx: Context = {
    options,
    definitions: new Map(),
    notices: [],
    bodyStartLine,
    footnoteOrder: [],
    keySeq: 0,
    claimsSeen: new Set(),
  };
  const footnotes = collectDefinitions(tree, ctx);
  const body = render(tree, ctx, 0);
  const footnoteList =
    ctx.footnoteOrder.length > 0 ? (
      <section aria-label="Footnotes">
        <ol>
          {ctx.footnoteOrder.map((id) => {
            const definition = footnotes.get(id);
            return (
              <li key={id} id={`${options.idPrefix ?? "preview"}-fn-${slugify(id)}`}>
                {definition ? children(definition as Nodes, ctx, 1) : "Missing footnote"}
              </li>
            );
          })}
        </ol>
      </section>
    ) : null;
  return {
    node: (
      <>
        {body}
        {footnoteList}
      </>
    ),
    notices: ctx.notices,
    claimsShown: [...ctx.claimsSeen],
  };
}
