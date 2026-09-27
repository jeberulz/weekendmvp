import type { Nodes, Root } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";

import { splitFrontmatter } from "../domain/structure";

/**
 * Parse article Markdown as CommonMark + GFM. MDX syntax extensions are
 * deliberately NOT enabled: `{expressions}`, `<Components />` and
 * `import`/`export` lines stay plain text or inert `html` nodes. Nothing
 * produced here is ever evaluated; the renderer maps an allowlist of node
 * types to React elements.
 */
export function parseArticleMarkdown(markdown: string): { tree: Root; bodyStartLine: number } {
  const { body, bodyStartLine } = splitFrontmatter(markdown);
  const tree = fromMarkdown(body, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });
  return { tree, bodyStartLine };
}

type Visitor = (node: Nodes, ancestors: readonly Nodes[]) => void;

/** Depth-first walk without recursion limits tied to input nesting depth. */
export function walk(tree: Root, visit: Visitor): void {
  const stack: Array<{ node: Nodes; ancestors: readonly Nodes[] }> = [{ node: tree, ancestors: [] }];
  while (stack.length > 0) {
    const entry = stack.pop();
    if (!entry) break;
    visit(entry.node, entry.ancestors);
    if ("children" in entry.node) {
      const nextAncestors = [...entry.ancestors, entry.node];
      const children = entry.node.children as Nodes[];
      for (let index = children.length - 1; index >= 0; index -= 1) {
        stack.push({ node: children[index], ancestors: nextAncestors });
      }
    }
  }
}
