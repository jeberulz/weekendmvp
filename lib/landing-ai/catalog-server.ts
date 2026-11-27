import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { landingContentDirectory } from "@/keystatic.config";
import { landingBlocks, landingPageOptions, type LandingPageId } from "./blocks";

export async function readLandingSnapshot(page: LandingPageId, root = process.cwd()): Promise<unknown> {
  return JSON.parse(await readFile(join(root, landingContentDirectory, page, "index.json"), "utf8"));
}

export async function readPanelCatalog() {
  return Promise.all(landingPageOptions().map(async ({ id, label }) => ({
    id, label,
    blocks: landingBlocks(id, await readLandingSnapshot(id)).map((block) => ({
      id: block.id, label: block.label, kind: block.kind,
      characters: block.kind === "edit" ? block.fields.reduce((sum, field) => sum + field.text.length, 0) : 0,
      fieldCount: block.kind === "edit" ? block.fields.length : 2,
    })),
  })));
}

export type PanelCatalog = Awaited<ReturnType<typeof readPanelCatalog>>;
