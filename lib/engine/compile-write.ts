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
} from "./compile.ts";
import type { ResearchRecord } from "./research-record.ts";

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

/**
 * Write via a temp file in the target's directory, then rename. A rename in
 * one directory is atomic, so a failed or interrupted write leaves the old
 * file intact instead of a truncated manifest holding every idea row.
 */
function writeFileAtomic(target: string, data: string): void {
  const tmp = path.join(
    path.dirname(target),
    `.${path.basename(target)}.${process.pid}.${Date.now()}.tmp`,
  );
  try {
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, target);
  } catch (error) {
    fs.rmSync(tmp, { force: true });
    throw error;
  }
}

export function writeCompiledIdea(
  options: WriteCompileOptions,
): WriteCompileResult {
  const compiled = compileResearchRecord(options);
  const ideasDir = path.resolve(options.ideasDir);
  const mdxPath = path.resolve(ideasDir, `${compiled.slug}.mdx`);

  // compile.ts already rejects unsafe slugs; this is the backstop.
  if (path.dirname(mdxPath) !== ideasDir) {
    throw new Error(`refusing to write outside ${ideasDir}: ${mdxPath}`);
  }

  // Run every refusal check before writing anything, so a refused compile
  // never leaves a stray MDX file that the sitemap would pick up.
  const previousMdx = fs.existsSync(mdxPath)
    ? fs.readFileSync(mdxPath, "utf8")
    : null;
  if (previousMdx !== null && !options.force) {
    throw new Error(
      `refusing to overwrite existing MDX at ${mdxPath} (pass force / --force)`,
    );
  }

  const shouldWriteManifest =
    options.writeManifest !== false && Boolean(options.manifestPath);
  let manifest: { ideas: unknown[] } | null = null;
  if (shouldWriteManifest && options.manifestPath) {
    const manifestPath = options.manifestPath;
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
  }

  fs.mkdirSync(ideasDir, { recursive: true });
  writeFileAtomic(mdxPath, compiled.mdx);

  let manifestWritten = false;
  if (manifest && options.manifestPath) {
    try {
      fs.mkdirSync(path.dirname(options.manifestPath), { recursive: true });
      writeFileAtomic(
        options.manifestPath,
        `${JSON.stringify(manifest, null, 2)}\n`,
      );
    } catch (error) {
      // Keep the pair consistent: put back the MDX that was there before
      // (a --force overwrite), or drop the one this call created.
      if (previousMdx !== null) writeFileAtomic(mdxPath, previousMdx);
      else fs.rmSync(mdxPath, { force: true });
      throw error;
    }
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
