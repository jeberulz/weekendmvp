import { join } from "node:path";
import { createReader } from "@keystatic/core/reader";
import { landingContentDirectory, landingEditorConfig } from "@/keystatic.config";

function dareReader(root: string) {
  return createReader(join(root, landingContentDirectory), landingEditorConfig("local")).singletons.dare;
}

export type DareCopy = Awaited<ReturnType<ReturnType<typeof dareReader>["readOrThrow"]>>;
export type DareSection = DareCopy["sections"][number];
export type DareBlock<Kind extends DareSection["discriminant"]> =
  Extract<DareSection, { discriminant: Kind }>["value"];

export function mapDare(copy: DareCopy) {
  const sections = copy.sections;
  const stack = sections.find((section) => section.discriminant === "valueStack");
  const summary = sections.find((section) => section.discriminant === "tldr");
  if (!stack || !summary || sections.length !== 7 || new Set(sections.map(({ discriminant }) => discriminant)).size !== 7) {
    throw new Error("Dare requires one of each editorial section");
  }
  if (!summary.value.points.some(({ body }) => ["[[DATE]]", "[[TIME]]", "[[TZ]]"].every((token) => body.includes(token)))
    || !copy.timezones.remainder.includes("[[DATE]]")
    || !copy.teacher.yearsChip.includes("[[STAT_YEARS]]")
    || !copy.teacher.shippedChip.includes("[[STAT_SHIPPED]]")) {
    throw new Error("Dare copy must preserve the draft placeholders");
  }
  if (copy.ticket.accent.split("{price}").length !== 2 || stack.value.accent.split("{approxValue}").length !== 2) {
    throw new Error("Dare requires its price and approximate value tokens");
  }
  const offerCopy = JSON.stringify({
    ticket: copy.ticket, stack: stack.value, summary: summary.value, seat: copy.seatSection,
  });
  if (/[$£€]\s*\d/.test(offerCopy)) {
    throw new Error("Dare offer copy requires tokens for monetary amounts");
  }
  return { copy, sections, stack: stack.value };
}

export async function readDare(root = process.cwd()) {
  return mapDare(await dareReader(root).readOrThrow());
}
