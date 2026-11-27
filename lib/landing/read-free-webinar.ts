import { join } from "node:path";
import { createReader } from "@keystatic/core/reader";
import { landingContentDirectory, landingEditorConfig } from "@/keystatic.config";

function freeWebinarReader(root: string) {
  return createReader(join(root, landingContentDirectory), landingEditorConfig("local")).singletons["live-48-hours"];
}

export type FreeWebinarCopy = Awaited<ReturnType<ReturnType<typeof freeWebinarReader>["readOrThrow"]>>;

export function validateFreeWebinar(copy: FreeWebinarCopy) {
  for (const [kind, token] of [["tools", "{tools}"], ["support", "{supportEmail}"]] as const) {
    const items = copy.faq.items.filter((item) => item.discriminant === kind);
    if (items.length !== 1 || items[0].value.answer.split(token).length !== 2) {
      throw new Error(`Free webinar FAQ requires one ${kind} answer with ${token}`);
    }
  }
  return copy;
}

export async function readFreeWebinar(root = process.cwd()) {
  return validateFreeWebinar(await freeWebinarReader(root).readOrThrow());
}
