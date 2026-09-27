import path from "node:path";
import type { ResearchRecord } from "./research-record.ts";

export type CompilePaths = {
  ideasDir: string;
  manifestPath: string;
};

export function defaultDraftPaths(root: string): CompilePaths {
  return resolveCompilePaths({ root });
}

export function assertNotPublicCompileTarget(
  root: string,
  ideasDir: string,
  manifestPath?: string,
): void {
  assertNotPublicIdeaOutput(root, ideasDir, manifestPath);
}

export function assertNotPublicIdeaOutput(
  root: string,
  ideasDir: string,
  manifestPath?: string,
): void {
  const publicIdeas = path.resolve(root, "content", "ideas");
  const publicManifest = path.resolve(root, "ideas", "manifest.json");
  const resolvedIdeas = path.resolve(ideasDir);
  if (
    resolvedIdeas === publicIdeas ||
    resolvedIdeas.startsWith(publicIdeas + path.sep)
  ) {
    throw new Error(`refusing public idea output at ${resolvedIdeas}`);
  }
  if (manifestPath && path.resolve(manifestPath) === publicManifest) {
    throw new Error(`refusing public manifest output at ${publicManifest}`);
  }
}

export function resolveCompilePaths(options: {
  root: string;
  ideasDir?: string | null;
  manifestPath?: string | null;
}): CompilePaths {
  const root = path.resolve(options.root);
  const ideasDir = options.ideasDir
    ? path.resolve(options.ideasDir)
    : path.join(root, "engine", "drafts");
  const manifestPath = options.manifestPath
    ? path.resolve(options.manifestPath)
    : path.join(ideasDir, "manifest.json");
  assertNotPublicIdeaOutput(root, ideasDir, manifestPath);
  return { ideasDir, manifestPath };
}

export function promotionRefusal(record: ResearchRecord): string {
  return `promotion refused for contract v${record.contractVersion}: fixture and v1 records stay private drafts`;
}

export function assertPromotionAllowed(record: ResearchRecord): never {
  throw new Error(promotionRefusal(record));
}
