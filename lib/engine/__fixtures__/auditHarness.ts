/**
 * Test harness for the final-artifact audit (WP46-S4): compile a fixture
 * record, mutate the MDX like an operator's "polish" would, and audit the
 * result through the real scripts/audit-idea-mdx.mjs — in-process via its
 * exported auditIdeaFile, or as a child process with the npm script's node
 * flags. Everything is written to temp dirs; cross-idea comparison uses an
 * empty sibling set so the result does not depend on other repo drafts.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { compileResearchRecord } from "../compile.ts";
import type { ResearchRecordV2 } from "../evidence/contract.ts";
import { buildFixtureRecord, FIXTURE_PAGE_SLUG } from "./recordV2.ts";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const AUDITOR = path.join(REPO_ROOT, "scripts", "audit-idea-mdx.mjs");
export const COMPILER = path.join(REPO_ROOT, "scripts", "engine-compile.mjs");
/** The same flags the npm scripts use (audit:idea, engine:compile). */
export const NODE_FLAGS = ["--experimental-strip-types"];

export type AuditResult = {
  ok: boolean;
  slug: string;
  errors: string[];
  warnings: string[];
  metrics: Record<string, unknown> | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

/** Validate an auditor result read from JS (in-process) or JSON (CLI). */
export function toAuditResult(raw: unknown): AuditResult {
  if (
    !isRecord(raw) ||
    typeof raw.ok !== "boolean" ||
    typeof raw.slug !== "string" ||
    !isStringArray(raw.errors) ||
    !isStringArray(raw.warnings)
  ) {
    throw new Error(`unexpected audit result: ${JSON.stringify(raw).slice(0, 200)}`);
  }
  return {
    ok: raw.ok,
    slug: raw.slug,
    errors: raw.errors,
    warnings: raw.warnings,
    metrics: isRecord(raw.metrics) ? raw.metrics : null,
  };
}

type AuditFn = (
  filePath: string,
  slug: string,
  options: { recordPath?: string; engine?: boolean; otherBodies?: Record<string, string> },
) => AuditResult;

let auditor: AuditFn | null = null;

/** The real auditor's exported auditIdeaFile, with its result validated. */
export async function loadAuditor(): Promise<AuditFn> {
  if (auditor) return auditor;
  const mod: unknown = await import(pathToFileURL(AUDITOR).href);
  if (!isRecord(mod) || typeof mod.auditIdeaFile !== "function") throw new Error("auditIdeaFile export missing");
  const fn = mod.auditIdeaFile;
  auditor = (filePath, slug, options) => toAuditResult(fn(filePath, slug, options));
  return auditor;
}

const tempDirs: string[] = [];

export function makeTempDir(prefix = "engine-audit-"): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

/** Remove every temp dir this harness created (call from afterEach/afterAll). */
export function cleanupTempDirs(): void {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
}

/** Compiled MDX for a fixture record (default: the base fixture). */
export function compiledPage(record: ResearchRecordV2 = buildFixtureRecord()): string {
  return compileResearchRecord({ record, slug: FIXTURE_PAGE_SLUG, publishedAt: "2026-10-01" }).mdx;
}

/** Replace exactly one occurrence of `from` (a mutation must hit its target). */
export function replaceOnce(text: string, from: string, to: string): string {
  const at = text.indexOf(from);
  if (at < 0 || text.indexOf(from, at + 1) >= 0) {
    throw new Error(`mutation target must occur exactly once: ${JSON.stringify(from.slice(0, 80))}`);
  }
  return `${text.slice(0, at)}${to}${text.slice(at + from.length)}`;
}

export type PageFiles = { dir: string; file: string; recordPath: string; siblings: string };

/** Write the page, its record and an empty sibling dir to a fresh temp dir. */
export function writePage(mdx: string, record: ResearchRecordV2): PageFiles {
  const dir = makeTempDir();
  const file = path.join(dir, `${FIXTURE_PAGE_SLUG}.mdx`);
  const recordPath = path.join(dir, "record.json");
  const siblings = path.join(dir, "siblings");
  fs.writeFileSync(file, mdx);
  fs.writeFileSync(recordPath, JSON.stringify(record, null, 2));
  fs.mkdirSync(siblings);
  return { dir, file, recordPath, siblings };
}

/** Audit MDX in-process with the engine bar and its record (no repo siblings). */
export async function auditPage(mdx: string, record: ResearchRecordV2 = buildFixtureRecord()): Promise<AuditResult> {
  const audit = await loadAuditor();
  const { file, recordPath } = writePage(mdx, record);
  return audit(file, FIXTURE_PAGE_SLUG, { engine: true, recordPath, otherBodies: {} });
}

export type CliRun = { code: number | null; stdout: string; stderr: string };

/** Run a repo script under node with the npm script's flags. */
export function runNodeScript(script: string, args: string[], timeoutMs = 60_000): Promise<CliRun> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [...NODE_FLAGS, script, ...args], {
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (d: string) => {
      stdout += d;
    });
    child.stderr.setEncoding("utf8").on("data", (d: string) => {
      stderr += d;
    });
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

/** The last JSON line a --json CLI run printed. */
export function lastJson(stdout: string): unknown {
  const lines = stdout.split("\n").filter((l) => l.trim().startsWith("{"));
  const last = lines[lines.length - 1];
  if (!last) throw new Error(`no JSON output: ${stdout.slice(0, 200)}`);
  return JSON.parse(last);
}

/** Audit a written page through the real CLI: --file, --record, --siblings, --json. */
export async function auditCli(files: PageFiles): Promise<{ code: number | null; result: AuditResult; stderr: string }> {
  const run = await runNodeScript(AUDITOR, [
    "--file",
    files.file,
    "--record",
    files.recordPath,
    "--siblings",
    files.siblings,
    "--json",
  ]);
  return { code: run.code, result: toAuditResult(lastJson(run.stdout)), stderr: run.stderr };
}
