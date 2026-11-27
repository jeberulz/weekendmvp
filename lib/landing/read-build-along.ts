import { join } from "node:path";
import { createReader } from "@keystatic/core/reader";
import { landingContentDirectory, landingEditorConfig } from "@/keystatic.config";

function buildAlongReader(root: string) {
  return createReader(join(root, landingContentDirectory), landingEditorConfig("local")).singletons["live-build-along"];
}

export type BuildAlongCopy = Awaited<ReturnType<ReturnType<typeof buildAlongReader>["readOrThrow"]>>;

export function validateBuildAlong(copy: BuildAlongCopy) {
  if (/[$£€]\s*\d/.test(JSON.stringify(copy))) {
    throw new Error("Build-Along prices must use code-owned tokens");
  }
  for (const kind of ["tools", "refund", "cancellation", "currency"] as const) {
    const items = copy.faq.items.filter((item) => item.discriminant === kind);
    if (items.length !== 1) throw new Error(`Build-Along requires one ${kind} answer`);
  }

  const currency = copy.faq.items.find((item) => item.discriminant === "currency");
  const tools = copy.faq.items.find((item) => item.discriminant === "tools");
  const fields = [
    [currency?.value.answer, "{priceLine}"],
    [tools?.value.answer, "{tools}"],
    [copy.deal.tools.configured, "{tools}"],
    [copy.personalNote.earlyBird, "{priceLine}"],
    [copy.personalNote.standard, "{sessionStartWithAt}"],
    [copy.ticket.earlyBirdNote, "{earlyPrice}"],
    [copy.ticket.earlyBirdNote, "{earlyCutoff}"],
  ];
  for (const [text, token] of fields) {
    if (!text || !token || text.split(token).length !== 2) {
      throw new Error(`Build-Along copy requires exactly one ${token} token`);
    }
  }
  return copy;
}

export async function readBuildAlong(root = process.cwd()) {
  return validateBuildAlong(await buildAlongReader(root).readOrThrow());
}
