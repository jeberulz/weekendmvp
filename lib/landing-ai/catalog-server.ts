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
    blocks: landingBlocks(id, await readLandingSnapshot(id)).map(({ id, label, kind }) => ({ id, label, kind })),
  })));
}

export type PanelCatalog = Awaited<ReturnType<typeof readPanelCatalog>>;
