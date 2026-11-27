import { join } from "node:path";
import { createReader } from "@keystatic/core/reader";
import { landingContentDirectory, landingEditorConfig } from "@/keystatic.config";

function homeReader(root: string) {
  return createReader(join(root, landingContentDirectory), landingEditorConfig("local")).singletons.home;
}

export type HomeCopy = Awaited<ReturnType<ReturnType<typeof homeReader>["readOrThrow"]>>;

export function validateHome(copy: HomeCopy) {
  const fields = [
    [copy.seoTitle, "{ideaCount}"],
    [copy.seoDescription, "{ideaCount}"],
    [copy.weekendTest.notes.estimate.title, "{hours}"],
    [copy.weekendTest.notes.estimate.body, "{hours}"],
    [copy.weekendTest.closing, "{hours}"],
  ];
  for (const [text, token] of fields) {
    if (text.split(token).length !== 2) throw new Error(`Homepage copy requires exactly one ${token}`);
  }
  return copy;
}

export async function readHome(root = process.cwd()) {
  return validateHome(await homeReader(root).readOrThrow());
}
