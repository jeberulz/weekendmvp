/**
 * engine:research CLI (WP46-S3, contract §10): the real script in a child
 * process, fixture mode only, temp output paths, an environment with no
 * provider keys. Checks the run report on success and failure, the CLI
 * boundary validation, overwrite refusal and that output never shows
 * absolute local paths or stack traces.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { FIXTURE_BRIEF_SLUG } from "./providers/fixtures.ts";
import { parseResearchRecord } from "./research-record.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const script = path.join(root, "scripts/engine-research.mjs");

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "engine-research-cli-"));
  dirs.push(dir);
  return dir;
}

function cli(args: string[], extraEnv: Record<string, string> = {}) {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", script, ...args], {
    cwd: root,
    encoding: "utf8",
    // No provider keys: fixture mode must not need any. The child runs the
    // current node binary directly, so it needs no PATH either.
    env: { NODE_ENV: "test", ...extraEnv },
    timeout: 120_000,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, output: `${result.stdout}\n${result.stderr}` };
}

function readJson(file: string): Record<string, unknown> {
  const value: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${file}: not a JSON object`);
  return value as Record<string, unknown>;
}

function expectNoLocalPaths(text: string, dir: string): void {
  expect(text).not.toContain(dir);
  expect(text).not.toContain(root);
  expect(text).not.toMatch(/\n\s+at .*\.(?:ts|mjs):\d+/);
}

describe("engine:research CLI (fixture mode)", () => {
  it("writes a validated v2 record and an ok report", () => {
    const dir = tempDir();
    const out = path.join(dir, "record.json");
    const run = cli(["--fixture", "rfp-assistant", "--out", out]);
    expect(run.status).toBe(0);

    const record = parseResearchRecord(readJson(out));
    expect(record.mode).toBe("fixture");
    expect(record.contractVersion).toBe(2);
    expect(record.pipelineVersion).toBe(2);

    const report = readJson(`${out}.report.json`);
    expect(report).toMatchObject({ ok: true, mode: "fixture", pipelineVersion: 2, recordContractVersion: 2 });
    expect(report.failedStep).toBeUndefined();
    expect(report.briefSlug).toBe(record.brief.slug);

    expect(run.stdout).toMatch(new RegExp(`engine:research ok · mode fixture · slug ${FIXTURE_BRIEF_SLUG}`));
    // Ruling R12: the report and the record name the same code revision.
    expect(record.provenance.codeRevision).toEqual(report.codeRevision);
    expect(run.stdout).toMatch(/accepted: community_quote 3, market_stat 3, competitor_price 3/);
    expect(run.stdout).toMatch(/rejected: source_unreadable 1, span_not_found 1/);
    expectNoLocalPaths(run.output, dir);
  });

  it("writes a failure report and no record when the run fails, and exits nonzero", () => {
    const dir = tempDir();
    const out = path.join(dir, "thin.json");
    const run = cli(["--fixture", "rfp-assistant-thin-evidence", "--out", out]);
    expect(run.status).toBe(1);
    expect(existsSync(out)).toBe(false);

    const report = readJson(`${out}.report.json`);
    expect(report).toMatchObject({ ok: false, mode: "fixture", failedStep: "evidence_acceptance" });
    expect(String(report.error)).toMatch(/community quotes: 0 distinct accepted, need 2/);
    expect(run.stderr).toMatch(/engine:research FAILED at evidence_acceptance/);
    expectNoLocalPaths(run.output, dir);
  });

  it("writes the report where --report says", () => {
    const dir = tempDir();
    const out = path.join(dir, "record.json");
    const reportPath = path.join(dir, "reports", "run.json");
    expect(cli(["--fixture", "rfp-assistant", "--out", out, "--report", reportPath]).status).toBe(0);
    expect(readJson(reportPath).ok).toBe(true);
    expect(existsSync(`${out}.report.json`)).toBe(false);
  });

  it("refuses to overwrite a record without --force, before running", () => {
    const dir = tempDir();
    const out = path.join(dir, "record.json");
    expect(cli(["--fixture", "rfp-assistant", "--out", out]).status).toBe(0);
    const before = readFileSync(out, "utf8");
    const refused = cli(["--fixture", "rfp-assistant", "--out", out]);
    expect(refused.status).toBe(1);
    expect(refused.stderr).toMatch(/refusing to overwrite .*record\.json \(pass --force/);
    expect(readFileSync(out, "utf8")).toBe(before);
    expect(cli(["--fixture", "rfp-assistant", "--out", out, "--force"]).status).toBe(0);
  });

  it("refuses a fixture run for a live brief or a path outside the fixture briefs (ruling R11)", () => {
    const dir = tempDir();
    const out = path.join(dir, "cr.json");
    const live = cli(["--fixture", "code-reviewer", "--out", out]);
    expect(live.status).toBe(1);
    expect(live.stderr).toMatch(/brief not found: engine\/briefs\/fixtures\/code-reviewer\.json/);
    const escape = cli(["--fixture", "../code-reviewer", "--out", out]);
    expect(escape.status).toBe(1);
    expect(escape.stderr).toMatch(/letters, digits and dashes only/);
    expect(existsSync(out)).toBe(false);
    expect(existsSync(`${out}.report.json`)).toBe(false);
  });

  it("never writes a fixture record into engine/records/, where published records live (ruling R11)", () => {
    const out = path.join(root, "engine", "records", `${FIXTURE_BRIEF_SLUG}.json`);
    const run = cli(["--fixture", "rfp-assistant", "--out", out]);
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/a fixture record never goes to engine\/records\//);
    expect(existsSync(out)).toBe(false);
    expect(existsSync(`${out}.report.json`)).toBe(false);
  });

  it("records an unknown code revision, and still succeeds, when git cannot answer (ruling R12)", () => {
    const dir = tempDir();
    const out = path.join(dir, "record.json");
    // GIT_DIR at an empty directory: every git command fails, as without git.
    const run = cli(["--fixture", "rfp-assistant", "--out", out], { GIT_DIR: path.join(dir, "not-a-repository") });
    expect(run.status, run.stderr).toBe(0);
    expect(readJson(`${out}.report.json`).codeRevision).toEqual({ sha: null, dirty: null });
    expect(parseResearchRecord(readJson(out)).provenance.codeRevision).toEqual({ sha: null, dirty: null });
  });

  // Ruling R12, with git reachable: an absolute PATH entry that holds a git binary, if this machine has one.
  const gitDir = ["/usr/bin", "/usr/local/bin", "/opt/homebrew/bin"].find((dir) => existsSync(path.join(dir, "git")));
  it.skipIf(gitDir === undefined)("names the code revision from git: HEAD and whether tracked files changed", () => {
    const env = { NODE_ENV: "test" as const, PATH: gitDir ?? "" };
    const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", env });
    const dir = tempDir();
    const out = path.join(dir, "record.json");
    const run = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", script, "--fixture", "rfp-assistant", "--out", out], {
      cwd: root,
      encoding: "utf8",
      env,
      timeout: 120_000,
    });
    expect(run.status, run.stderr).toBe(0);
    const report = readJson(`${out}.report.json`);
    const revision = report.codeRevision;
    expect(revision).toMatchObject({ sha: head.stdout.trim() });
    expect(typeof (revision as { dirty?: unknown }).dirty).toBe("boolean");
    expect(parseResearchRecord(readJson(out)).provenance.codeRevision).toEqual(revision);
  });

  it("keeps --fixture and --live mutually exclusive", () => {
    const run = cli(["--fixture", "rfp-assistant", "--live"]);
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/mutually exclusive/);
  });
});
