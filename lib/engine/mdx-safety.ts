/**
 * MDX text encoding and a parse gate. Braces and angle brackets become HTML
 * entities, so a preceding backslash cannot reopen an expression. Fence
 * interiors are left literal by the caller.
 */

import { createProcessor, nodeTypes } from "@mdx-js/mdx";

const processor = createProcessor();
const executable = new Set<string>(nodeTypes);

export const MAX_FIELD_CHARS = 100_000;

export function escapeMdxProse(text: string): string {
  const urls: string[] = [];
  const masked = text.replace(/\]\(([^)]*)\)/g, (_match, url: string) => {
    urls.push(url);
    return `](\u0000${urls.length - 1}\u0000)`;
  });
  const escaped = masked
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/^(>)/gm, "\u0001")
    .replace(/>/g, "&gt;")
    .replace(/\u0001/g, ">")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;")
    .replace(/^(import|export)\b/gm, "\u200b$1");
  return escaped.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => {
    return urls[Number(index)] ?? "";
  });
}

export function assertFieldSizes(value: unknown, fieldPath: string): void {
  if (typeof value === "string") {
    if (value.length > MAX_FIELD_CHARS) {
      throw new Error(`${fieldPath} exceeds 100000 characters`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      assertFieldSizes(item, `${fieldPath}[${index}]`);
    });
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      assertFieldSizes(child, `${fieldPath}.${key}`);
    }
  }
}

export function publicHttpUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username !== "" || url.password !== "") return null;
  return raw.replace(
    /[()\s<>{}]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`,
  );
}

export function assertSafeMdx(source: string): void {
  const body = source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  const tree = processor.parse(body);
  const found: string[] = [];
  const badUrls: string[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const record = node as {
      type?: string;
      url?: unknown;
      children?: unknown[];
    };
    if (record.type && executable.has(record.type)) found.push(record.type);
    if (
      (record.type === "link" ||
        record.type === "image" ||
        record.type === "definition") &&
      typeof record.url === "string" &&
      record.url.length > 0
    ) {
      if (!publicHttpUrl(record.url)) badUrls.push(record.url);
    }
    for (const child of record.children ?? []) walk(child);
  };
  walk(tree);
  if (found.length > 0) {
    throw new Error(`refusing executable MDX nodes: ${found.join(", ")}`);
  }
  if (badUrls.length > 0) {
    throw new Error(
      `refusing non-public Markdown destinations: ${badUrls.slice(0, 3).join(", ")}`,
    );
  }
}
