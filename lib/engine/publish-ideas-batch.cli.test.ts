/**
 * publish:ideas batch driver — hermetic smoke + coverage (no live providers).
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const script = path.join(root, "scripts/publish-ideas-batch.mjs");

function cli(args: string[], extraEnv: Record<string, string> = {}) {
  return spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", script, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { NODE_ENV: "test", ...extraEnv },
    timeout: 180_000,
  });
}

describe("publish:ideas CLI", () => {
  it("prints coverage, GSC-not-integrated, and provider failure map without spending", () => {
    const run = cli(["--coverage", "--json"], {
      OPENAI_API_KEY: "",
      PERPLEXITY_API_KEY: "",
      DATAFORSEO_LOGIN: "",
      DATAFORSEO_PASSWORD: "",
      GSC_KEY_FILE: "",
      GSC_SITE_URL: "",
    });
    expect(run.status).toBe(0);
    const payload = JSON.parse(run.stdout) as {
      coverage: {
        totalIdeas: number;
        searchConsole: { integratedForCandidateSelection: boolean };
        e7: { status: string };
      };
      providers: { failureMap: { openai_429: string } };
    };
    expect(payload.coverage.totalIdeas).toBeGreaterThan(0);
    expect(payload.coverage.searchConsole.integratedForCandidateSelection).toBe(false);
    expect(payload.coverage.e7.status).toBe("NO-GO");
    expect(payload.providers.failureMap.openai_429).toMatch(/retryable=true/);
    expect(run.stdout + run.stderr).not.toMatch(/sk-[A-Za-z0-9]/);
  });

  it("fixture-smoke runs research → FAIL draft → fixture compile without keys", () => {
    const run = cli(["--fixture-smoke", "--json"], {
      OPENAI_API_KEY: "",
      PERPLEXITY_API_KEY: "",
      DATAFORSEO_LOGIN: "",
      DATAFORSEO_PASSWORD: "",
    });
    expect(run.status, run.stderr + run.stdout).toBe(0);
    const payload = JSON.parse(run.stdout) as { ok: boolean; results: Array<{ stage: string; status: number }> };
    expect(payload.ok).toBe(true);
    expect(payload.results.map((r) => r.stage)).toEqual([
      "research",
      "source-review-draft",
      "source-review-check-expects-fail",
      "fixture-compile-exempt",
    ]);
    expect(payload.results.every((r) => r.status === 0)).toBe(true);
  });

  it("refuses a live batch without --live", () => {
    const run = cli(["--briefs", "engine/briefs/fixtures/rfp-assistant.json", "--stop-at", "research"]);
    expect(run.status).toBe(2);
    expect(run.stderr).toMatch(/require --live/);
  });

  it("refuses live spend without --confirm-semantic-dedupe", () => {
    const run = cli([
      "--briefs",
      "engine/briefs/fixtures/rfp-assistant.json",
      "--live",
      "--stop-at",
      "research",
    ]);
    expect(run.status).toBe(2);
    expect(run.stderr).toMatch(/semantic-dedupe|Corpus Guardian|JTBD/i);
  });
});
