#!/usr/bin/env node
/**
 * Compile CLI: contract v2 research record JSON → content/ideas/{slug}.mdx
 * (+ manifest stub with generated highlights and the research mode).
 *
 * Usage:
 *   npm run engine:compile -- --record engine/records/{slug}.json
 *   npm run engine:compile -- --record path.json --slug engine-draft-x --force
 *   npm run engine:compile -- --record path.json --ideas-dir /tmp/ideas --no-manifest --json
 *
 * The record is validated with parseResearchRecord before anything is
 * written. A contract v1 (legacy) record is refused with the re-research
 * message; an invalid record or one missing the editorial fields the deep
 * audit needs is refused with its issues. Exit 0 on success, 1 on any
 * refusal or error, 2 on a usage error.
 *
 * Slugs starting with engine-draft- are spot-check drafts: they default to
 * engine/drafts/{slug}.mdx + engine/drafts/manifest.json and are refused in
 * content/ideas/, so a draft can never reach the live site. A mode
 * "fixture" record (synthetic research) compiles only to an engine-draft-*
 * or _temp slug unless the test-only --allow-fixture flag is passed (ruling
 * R11).
 *
 * Refuses to overwrite existing MDX unless --force.
 * Does not seed Convex, generate OG, or push git. Output never includes a
 * stack trace; paths in messages are repo-relative or reduced to a file name.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const HELP = `Usage:
  npm run engine:compile -- --record path.json [options]

Flags:
  --record path       Contract v2 research record JSON from engine:research
  --slug name         Override output slug (throwaway compiles)
  --ideas-dir path    MDX output directory (default: content/ideas;
                      engine/drafts for engine-draft-* slugs)
  --manifest path     Manifest JSON (default: ideas/manifest.json;
                      engine/drafts/manifest.json for engine-draft-* slugs)
  --no-manifest       Do not write/update the manifest
  --force             Overwrite existing MDX / manifest row
  --allow-fixture     Test only: compile a mode "fixture" record to any slug
                      (otherwise only engine-draft-* or _temp slugs; R11)
  --json              Print one JSON result line (ok, mdxPath, slug, wordCount,
                      manifestWritten, researchMode; or ok:false with error
                      and issues)
Exit codes: 0 compiled, 1 refused or failed, 2 usage error.
`;

function usage(exit) {
  (exit === 0 ? console.log : console.error)(HELP);
  process.exit(exit);
}

/** Absolute local paths out of a message (this runs even if the TS modules failed to load). */
function scrubPaths(text) {
  return String(text).replace(/(?:\/(?:Users|home|private|tmp|var|opt|root)\/|[A-Za-z]:\\)[^\s'"<>)]*/g, "[path]");
}

/** A path for terminal output: repo-relative inside the repo, else only the file name. */
function displayPath(p) {
  const rel = path.relative(root, path.resolve(p));
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel) ? rel : `…/${path.basename(p)}`;
}

function parseArgs(argv) {
  const out = {
    recordPath: null,
    slug: null,
    ideasDir: null,
    manifestPath: null,
    noManifest: false,
    force: false,
    allowFixture: false,
    json: false,
  };
  const value = (i, flag) => {
    const v = argv[i];
    if (v === undefined || v.startsWith("--")) {
      console.error(`${flag} needs a value`);
      usage(2);
    }
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") usage(0);
    else if (a === "--record") out.recordPath = value(++i, a);
    else if (a === "--slug") out.slug = value(++i, a);
    else if (a === "--ideas-dir") out.ideasDir = path.resolve(value(++i, a));
    else if (a === "--manifest") out.manifestPath = path.resolve(value(++i, a));
    else if (a === "--no-manifest") out.noManifest = true;
    else if (a === "--force") out.force = true;
    else if (a === "--allow-fixture") out.allowFixture = true;
    else if (a === "--json") out.json = true;
    else {
      console.error(`unknown arg: ${a}`);
      usage(2);
    }
  }
  return out;
}

/** Report a refusal (human text or one JSON line) and exit 1. */
function refuse(args, error, issues = []) {
  const message = scrubPaths(error);
  const details = issues.map(scrubPaths);
  if (args.json) {
    console.log(JSON.stringify({ ok: false, error: message, issues: details }));
  } else {
    console.error(message);
    for (const issue of details) console.error(`  - ${issue}`);
  }
  process.exit(1);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.recordPath) usage(2);
  if (!fs.existsSync(args.recordPath)) refuse(args, `record not found: ${displayPath(args.recordPath)}`);

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(args.recordPath, "utf8"));
  } catch (err) {
    refuse(args, `record is not valid JSON: ${displayPath(args.recordPath)} (${err instanceof Error ? err.message : err})`);
  }

  // Loaded here, not statically, so a module failure is reported like any
  // other error: one scrubbed line, no stack.
  const [compileModule, writeModule, draftsModule, recordModule] = await Promise.all([
    import(pathToFileURL(path.join(root, "lib/engine/compile.ts")).href),
    import(pathToFileURL(path.join(root, "lib/engine/compile-write.ts")).href),
    import(pathToFileURL(path.join(root, "lib/engine-drafts.ts")).href),
    import(pathToFileURL(path.join(root, "lib/engine/research-record.ts")).href),
  ]);
  const { CompileError } = compileModule;
  const { writeCompiledIdea } = writeModule;
  const { ENGINE_DRAFT_PREFIX } = draftsModule;
  const { LegacyResearchRecordError, parseResearchRecord, ResearchRecordParseError } = recordModule;

  let record;
  try {
    record = parseResearchRecord(raw);
  } catch (err) {
    if (err instanceof LegacyResearchRecordError) refuse(args, err.message);
    if (err instanceof ResearchRecordParseError) {
      refuse(args, `record is not a valid contract v2 research record: ${displayPath(args.recordPath)}`, err.issues);
    }
    throw err;
  }

  const slug = (args.slug ?? record.brief.slug).trim().toLowerCase();
  const isDraft = slug.startsWith(ENGINE_DRAFT_PREFIX);
  const publicIdeasDir = path.join(root, "content", "ideas");
  const draftsDir = path.join(root, "engine", "drafts");
  const ideasDir = args.ideasDir ?? (isDraft ? draftsDir : publicIdeasDir);
  const manifestPath =
    args.manifestPath ??
    (isDraft
      ? path.join(draftsDir, "manifest.json")
      : path.join(root, "ideas", "manifest.json"));
  const publicManifest = path.join(root, "ideas", "manifest.json");
  if (
    isDraft &&
    (path.resolve(ideasDir) === publicIdeasDir ||
      (!args.noManifest && path.resolve(manifestPath) === publicManifest))
  ) {
    refuse(
      args,
      `refusing to write draft ${slug} into content/ideas/ or ideas/manifest.json (drafts live in engine/drafts/)`,
    );
  }

  let result;
  try {
    result = writeCompiledIdea({
      record,
      slug: args.slug ?? undefined,
      ideasDir,
      manifestPath: args.noManifest ? undefined : manifestPath,
      writeManifest: !args.noManifest,
      force: args.force,
      allowFixture: args.allowFixture,
    });
  } catch (err) {
    if (err instanceof CompileError) refuse(args, "record cannot compile into a publishable page", err.issues);
    if (err instanceof Error && /^refusing to/.test(err.message)) refuse(args, err.message);
    throw err;
  }

  if (!result.manifestEntry.source.startsWith("engine:")) {
    refuse(args, `refusing non-engine source: ${result.manifestEntry.source}`);
  }

  if (args.json) {
    console.log(
      JSON.stringify({
        ok: true,
        mdxPath: result.mdxPath,
        slug: result.slug,
        source: result.manifestEntry.source,
        wordCount: result.manifestEntry.provenance.wordCount,
        manifestWritten: result.manifestWritten,
        researchMode: result.manifestEntry.provenance.researchMode,
      }),
    );
  } else {
    console.log(
      `wrote ${displayPath(result.mdxPath)} (source=${result.manifestEntry.source} mode=${result.manifestEntry.provenance.researchMode} words≈${result.manifestEntry.provenance.wordCount} manifest=${result.manifestWritten})`,
    );
  }
}

main().catch((err) => {
  // Never print a stack trace: it carries local paths.
  console.error(`engine:compile: unexpected error: ${scrubPaths(err instanceof Error ? err.message : String(err))}`);
  process.exit(1);
});
