import { join } from "node:path";
import { createReader } from "@keystatic/core/reader";
import { landingContentDirectory, landingEditorConfig } from "@/keystatic.config";

function shipableReader(root: string) {
  return createReader(join(root, landingContentDirectory), landingEditorConfig("local")).singletons.shipable;
}

export type ShipableCopy = Awaited<ReturnType<ReturnType<typeof shipableReader>["readOrThrow"]>>;
export type ShipableSection = ShipableCopy["sections"][number];
export type ShipableBlock<Kind extends ShipableSection["discriminant"]> =
  Extract<ShipableSection, { discriminant: Kind }>["value"];

export function mapShipable(copy: ShipableCopy) {
  const sections = copy.sections;
  const stack = sections.find((section) => section.discriminant === "valueStack");
  if (!stack || sections.length !== 7 || new Set(sections.map(({ discriminant }) => discriminant)).size !== 7) {
    throw new Error("Shipable requires one of each editorial section");
  }
  if (copy.ticket.accent.split("{price}").length !== 2 || stack.value.accent.split("{stackValue}").length !== 2) {
    throw new Error("Shipable ticket and value stack headings require their price tokens");
  }
  const offerCopy = JSON.stringify({ ticket: copy.ticket, sections: sections.filter(({ discriminant }) =>
    discriminant === "valueStack" || discriminant === "tldr"), faq: copy.faq });
  if (/[$£€]\s*\d/.test(offerCopy)) {
    throw new Error("Shipable offer copy requires tokens for monetary amounts");
  }
  return { copy, sections, stack: stack.value };
}

export async function readShipable(root = process.cwd()) {
  return mapShipable(await shipableReader(root).readOrThrow());
}
