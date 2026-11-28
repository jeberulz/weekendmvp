import { join } from "node:path";
import { createReader } from "@keystatic/core/reader";
import { landingContentDirectory, landingEditorConfig } from "@/keystatic.config";
import type { KitContents } from "@/app/(marketing)/starter-kit/StarterKitShell";

function kitReader(root: string) {
  return createReader(join(root, landingContentDirectory), landingEditorConfig("local")).singletons["starter-kit"];
}

export type StarterKitCopy = Awaited<ReturnType<ReturnType<typeof kitReader>["readOrThrow"]>>;
type ResourceKind = StarterKitCopy["resources"][number]["discriminant"];

function withCount(value: string, count: number) {
  if (value.split("{count}").length !== 2) throw new Error("Starter Kit headings and labels for ideas and prompts require one {count} token");
  return value.replace("{count}", String(count));
}

export function mapStarterKit(copy: StarterKitCopy) {
  if (copy.resources.length !== 3 || new Set(copy.resources.map(({ discriminant }) => discriminant)).size !== 3) {
    throw new Error("Starter Kit requires one of each resource section");
  }
  let step = 4;
  const resources = copy.resources.map((resource) => {
    switch (resource.discriminant) {
      case "templates":
        return { ...resource, href: "#templates", navLabel: resource.value.navLabel };
      case "ideas": {
        const count = resource.value.ideas.length;
        const current = step++;
        return { ...resource, href: "#step-4", step: current, heading: withCount(resource.value.heading, count),
          navLabel: `${current}. ${withCount(resource.value.navLabel, count)}` };
      }
      case "prompts": {
        const count = resource.value.prompts.length;
        const current = step++;
        return { ...resource, href: "#step-5", step: current, heading: withCount(resource.value.heading, count),
          navLabel: `${current}. ${withCount(resource.value.navLabel, count)}` };
      }
    }
  });

  const contents: KitContents = [
    [{ href: "#intro", label: copy.hero.navLabel }, { href: "#rules", label: copy.rules.navLabel }],
    [
      { href: "#step-1", label: `1. ${copy.scorecard.navLabel}` },
      { href: "#step-2", label: `2. ${copy.spec.navLabel}` },
      { href: "#step-3", label: `3. ${copy.plan.navLabel}` },
    ],
    resources.map(({ href, navLabel }) => ({ href, label: navLabel })),
  ];
  return { ...copy, resources, contents };
}

export async function readStarterKit(root = process.cwd()) {
  return mapStarterKit(await kitReader(root).readOrThrow());
}

export type StarterKit = Awaited<ReturnType<typeof readStarterKit>>;
export type StarterKitResource<Kind extends ResourceKind> = Extract<StarterKit["resources"][number], { discriminant: Kind }>;
