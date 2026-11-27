import { join } from "node:path";
import { createReader } from "@keystatic/core/reader";
import { landingContentDirectory, landingEditorConfig } from "@/keystatic.config";

function liveHubReader(root: string) {
  return createReader(join(root, landingContentDirectory), landingEditorConfig("local")).singletons["live-hub"];
}

export type LiveHubCopy = Awaited<ReturnType<ReturnType<typeof liveHubReader>["readOrThrow"]>>;
export type LiveHubSection = LiveHubCopy["sections"][number];
export type LiveHubBlock<Kind extends LiveHubSection["discriminant"]> =
  Extract<LiveHubSection, { discriminant: Kind }>["value"];

export function validateLiveHub(copy: LiveHubCopy) {
  const { sections } = copy;
  const faq = sections.find((block) => block.discriminant === "faq");
  if (!faq || sections.length !== 7 || new Set(sections.map((block) => block.discriminant)).size !== 7) {
    throw new Error("Live hub requires one of each editorial section");
  }
  for (const [kind, token] of [["timezones", "{sessionTimes}"], ["nextSession", "{nextBuildAlongLabel}"]] as const) {
    const items = faq.value.items.filter((item) => item.discriminant === kind);
    if (items.length !== 1 || items[0].value.answer.split(token).length !== 2) {
      throw new Error(`Live hub FAQ requires one ${kind} answer with ${token}`);
    }
  }
  return copy;
}

export async function readLiveHub(root = process.cwd()) {
  return validateLiveHub(await liveHubReader(root).readOrThrow());
}
