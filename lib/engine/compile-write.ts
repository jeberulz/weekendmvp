/**
 * Write compiled MDX (+ optional manifest merge) to disk.
 * Refuses to overwrite existing MDX unless force=true, and never replaces a
 * handwritten idea (a page without the engine frontmatter marker, or a
 * manifest row whose source is not engine:*) unless replaceHandwritten is
 * also set: the representative briefs share slugs with published handwritten
 * gold pages, and --force alone would have overwritten them and their
 * tagging. The record is a contract v2 record; compileResearchRecord
 * re-validates it and refuses a legacy v1 record, so nothing is written for
 * one.
 */

import fs from "node:fs";
import path from "node:path";
import { ENGINE_DRAFT_PREFIX } from "../engine-drafts.ts";
import {
  compileResearchRecord,
  hasEngineMarker,
  type CompileOptions,
  type CompileResult,
} from "./compile.ts";
import type { ResearchRecordV2 } from "./evidence/contract.ts";

export type WriteCompileOptions = CompileOptions & {
  ideasDir: string;
  manifestPath?: string;
  force?: boolean;
  /** When false, skip manifest write (tests / throwaway). Default true if manifestPath set. */
  writeManifest?: boolean;
  /**
   * With force, also replace a handwritten idea: an existing page without
   * the engine frontmatter marker, or a manifest row whose source is not
   * engine:* (the CLI's --replace-handwritten). Off by default.
   */
  replaceHandwritten?: boolean;
  /**
   * A manifest whose row for the slug says whether the idea is handwritten,
   * read even when no manifest is written (the CLI passes the manifest it
   * would write, so --no-manifest still sees ideas/manifest.json).
   */
  ownershipManifestPath?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A manifest row engine:compile wrote (source engine:*). */
function isEngineRow(row: unknown): boolean {
  return isRecord(row) && typeof row.source === "string" && row.source.startsWith("engine:");
}

/** The row for `slug` in the manifest at `manifestPath`, or null when the file or the row is absent. */
function manifestRowAt(manifestPath: string, slug: string): unknown {
  if (!fs.existsSync(manifestPath)) return null;
  const parsed: unknown = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const ideas = isRecord(parsed) ? parsed.ideas : undefined;
  if (!Array.isArray(ideas)) throw new Error(`invalid manifest (no ideas[]): ${manifestPath}`);
  return ideas.find((row) => isRecord(row) && row.slug === slug) ?? null;
}

function handwrittenRefusal(slug: string, what: string): Error {
  const draft = slug.startsWith(ENGINE_DRAFT_PREFIX) ? slug : `${ENGINE_DRAFT_PREFIX}${slug}`;
  return new Error(
    `refusing to replace the handwritten idea ${slug}: its ${what} was not written by engine:compile. ` +
      `Compile to an engine-draft- slug instead (--slug ${draft}), or pass replaceHandwritten / --replace-handwritten ` +
      "with --force to replace it on purpose",
  );
}

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
  /** The slug's existing manifest rows (the written manifest's, the ownership manifest's). */
  const rows: unknown[] = [];
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
    if (idx >= 0) rows.push(manifest.ideas[idx]);
    if (idx >= 0) manifest.ideas[idx] = compiled.manifestEntry;
    else manifest.ideas.push(compiled.manifestEntry);
  }
  if (options.ownershipManifestPath && !(shouldWriteManifest && options.ownershipManifestPath === options.manifestPath)) {
    const row = manifestRowAt(options.ownershipManifestPath, compiled.slug);
    if (row !== null) rows.push(row);
  }

  // A handwritten idea is replaced only on explicit request, force or not.
  if (!options.replaceHandwritten) {
    if (rows.some((row) => !isEngineRow(row))) throw handwrittenRefusal(compiled.slug, "manifest row");
    if (previousMdx !== null && !hasEngineMarker(previousMdx) && !rows.some(isEngineRow)) {
      throw handwrittenRefusal(compiled.slug, "page");
    }
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
  record: ResearchRecordV2,
  options: Omit<WriteCompileOptions, "record">,
): WriteCompileResult {
  return writeCompiledIdea({ ...options, record });
}
