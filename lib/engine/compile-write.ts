/**
 * Write compiled MDX (+ optional manifest merge) to disk.
 * Refuses to overwrite existing MDX unless force=true.
 */

import fs from "node:fs";
import path from "node:path";
import {
  compileResearchRecord,
  type CompileOptions,
  type CompileResult,
} from "./compile";
import type { ResearchRecord } from "./research-record";

export type WriteCompileOptions = CompileOptions & {
  ideasDir: string;
  manifestPath?: string;
  force?: boolean;
  /** When false, skip manifest write (tests / throwaway). Default true if manifestPath set. */
  writeManifest?: boolean;
};

export type WriteCompileResult = CompileResult & {
  mdxPath: string;
  manifestWritten: boolean;
};

export function writeCompiledIdea(
  options: WriteCompileOptions,
): WriteCompileResult {
  const compiled = compileResearchRecord(options);
  const mdxPath = path.join(options.ideasDir, `${compiled.slug}.mdx`);

  if (fs.existsSync(mdxPath) && !options.force) {
    throw new Error(
      `refusing to overwrite existing MDX at ${mdxPath} (pass force / --force)`,
    );
  }

  fs.mkdirSync(options.ideasDir, { recursive: true });
  fs.writeFileSync(mdxPath, compiled.mdx);

  let manifestWritten = false;
  const shouldWriteManifest =
    options.writeManifest !== false && Boolean(options.manifestPath);
  if (shouldWriteManifest && options.manifestPath) {
    const manifestPath = options.manifestPath;
    let manifest: { ideas: unknown[] };
    if (fs.existsSync(manifestPath)) {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
        ideas: unknown[];
      };
      if (!Array.isArray(manifest.ideas)) {
        throw new Error(`invalid manifest (no ideas[]): ${manifestPath}`);
      }
    } else {
      manifest = { ideas: [] };
    }

    const idx = manifest.ideas.findIndex(
      (row) =>
        typeof row === "object" &&
        row !== null &&
        (row as { slug?: string }).slug === compiled.slug,
    );
    if (idx >= 0 && !options.force) {
      throw new Error(
        `refusing to overwrite manifest entry for ${compiled.slug} (pass force / --force)`,
      );
    }
    if (idx >= 0) manifest.ideas[idx] = compiled.manifestEntry;
    else manifest.ideas.push(compiled.manifestEntry);

    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    manifestWritten = true;
  }

  return { ...compiled, mdxPath, manifestWritten };
}

export function compileAndWrite(
  record: ResearchRecord,
  options: Omit<WriteCompileOptions, "record">,
): WriteCompileResult {
  return writeCompiledIdea({ ...options, record });
}
