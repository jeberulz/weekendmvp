import { config, fields, singleton } from "@keystatic/core";

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
      "guide-5-to-9-builder": singleton({
        label: "5-to-9 Builder guide (staging)",
        path: prefix + "guide-5-to-9-builder/",
        format: "json",
        schema: {
          seoTitle: fields.text({ label: "Search title", validation: { isRequired: true } }),
          seoDescription: fields.text({
            label: "Search description",
            multiline: true,
            description: "Edits are staged here until this guide is connected to the editor.",
            validation: { isRequired: true },
          }),
        },
      }),
    },
  });
}
