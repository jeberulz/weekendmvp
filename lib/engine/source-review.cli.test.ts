/**
 * engine:source-review CLI — draft FAIL scaffold + check (fixture record).
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { FIXTURE_BRIEF_SLUG } from "./providers/fixtures.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const researchScript = path.join(root, "scripts/engine-research.mjs");
const reviewScript = path.join(root, "scripts/engine-source-review.mjs");

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function cli(script: string, args: string[]) {
  return spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", script, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { NODE_ENV: "test" },
    timeout: 120_000,
  });
}

describe("engine:source-review CLI", () => {
  it("writes a FAIL draft that --check refuses, without auto-PASS", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "source-review-cli-"));
    dirs.push(dir);
    const recordPath = path.join(dir, "record.json");
    const reviewPath = path.join(dir, "record.source-review.json");

    const research = cli(researchScript, ["--fixture", "rfp-assistant", "--out", recordPath]);
    expect(research.status).toBe(0);

    const draft = cli(reviewScript, [
      "--record",
      recordPath,
      "--draft",
      "--out",
      reviewPath,
      "--json",
    ]);
    expect(draft.status).toBe(0);
    const draftPayload = JSON.parse(draft.stdout) as { verdict: string; items: number };
    expect(draftPayload.verdict).toBe("FAIL");
    expect(draftPayload.items).toBeGreaterThan(0);

    const review = JSON.parse(readFileSync(reviewPath, "utf8")) as {
      verdict: string;
      items: Array<{ checks: { excerptMatchesPage: boolean } }>;
    };
    expect(review.verdict).toBe("FAIL");
    expect(review.items.every((item) => item.checks.excerptMatchesPage === false)).toBe(true);

    const check = cli(reviewScript, [
      "--record",
      recordPath,
      "--check",
      "--source-review",
      reviewPath,
      "--json",
    ]);
    expect(check.status).toBe(1);
    expect(check.stdout + check.stderr).toMatch(/FAIL|FAILED/);

    // No --pass flag in help / argv surface.
    const help = cli(reviewScript, ["--help"]);
    expect(help.stdout + help.stderr).not.toMatch(/--pass/);
    expect(help.stdout + help.stderr).toMatch(/--draft/);
  });

  it("refuses to overwrite a draft without --force", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "source-review-cli-"));
    dirs.push(dir);
    const recordPath = path.join(dir, "record.json");
    const reviewPath = path.join(dir, "record.source-review.json");
    expect(cli(researchScript, ["--fixture", "rfp-assistant", "--out", recordPath]).status).toBe(0);
    expect(
      cli(reviewScript, ["--record", recordPath, "--draft", "--out", reviewPath]).status,
    ).toBe(0);
    writeFileSync(reviewPath, `${readFileSync(reviewPath, "utf8")}\n`, "utf8");
    const again = cli(reviewScript, ["--record", recordPath, "--draft", "--out", reviewPath]);
    expect(again.status).toBe(1);
    expect(again.stderr).toMatch(/refusing to overwrite/);
    expect(FIXTURE_BRIEF_SLUG).toMatch(/^fixture-/);
  });
});
