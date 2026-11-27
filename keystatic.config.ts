import { config, singleton } from "@keystatic/core";
import { freeWebinarFields } from "@/lib/landing/free-webinar-fields";
import { liveHubFields } from "@/lib/landing/live-hub-fields";
import { dareFields } from "@/lib/landing/dare-fields";
import { shipableFields } from "@/lib/landing/shipable-fields";
import { starterKitFields } from "@/lib/landing/starter-kit-fields";
import { starterFields } from "@/lib/landing/starter-fields";
import { builderGuideFields } from "@/lib/landing/builder-guide-fields";

export type StorageMode = "local" | "github";

// The local API's filesystem root is already content/landing-pages.
// GitHub paths are relative to the root of the repository.
export const landingContentDirectory = "content/landing-pages";

export function landingEditorConfig(mode: StorageMode) {
  const prefix = mode === "github" ? landingContentDirectory + "/" : "";
  return config({
    storage: mode === "github"
      ? { kind: "github", repo: "jeberulz/weekendmvp", branchPrefix: "content/" }
      : { kind: "local" },
    ui: { brand: { name: "Weekend MVP" } },
    singletons: {
      "live-48-hours": singleton({
        label: "Free webinar",
        path: prefix + "live-48-hours/",
        format: "json",
        schema: freeWebinarFields,
      }),
      "live-hub": singleton({
        label: "Live hub",
        path: prefix + "live-hub/",
        format: "json",
        schema: liveHubFields,
      }),
      dare: singleton({
        label: "Dare (draft)",
        path: prefix + "dare/",
        format: "json",
        schema: dareFields,
      }),
      shipable: singleton({
        label: "Shipable",
        path: prefix + "shipable/",
        format: "json",
        schema: shipableFields,
      }),
      "starter-kit": singleton({
        label: "Starter Kit",
        path: prefix + "starter-kit/",
        format: "json",
        schema: starterKitFields,
      }),
      "starter-5-to-9": singleton({
        label: "5-to-9 Starter",
        path: prefix + "starter-5-to-9/",
        format: "json",
        schema: starterFields,
      }),
      "guide-5-to-9-builder": singleton({
        label: "5-to-9 Builder guide",
        path: prefix + "guide-5-to-9-builder/",
        format: "json",
        schema: builderGuideFields,
      }),
    },
  });
}
