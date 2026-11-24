/**
 * WP92. `scripts/crew-seeds.mjs --auto` end to end against a fake `npx` on
 * PATH: the script reads the real library pages, and every `npx convex run`
 * is answered from a scripted state and logged. Nothing reaches Convex.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, test } from "vitest";

const root = process.cwd();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wp92-npx-"));
const log = path.join(dir, "calls.log");

// The fake answers each function from FAKE_* env vars and logs the function name.
fs.writeFileSync(
  path.join(dir, "npx"),
  `#!/usr/bin/env node
const fs = require("node:fs");
const [, , tool, verb, fn, json] = process.argv;
if (tool !== "convex" || verb !== "run") { console.error("unexpected npx call"); process.exit(9); }
fs.appendFileSync(${JSON.stringify(log)}, fn + "\\n");
const args = JSON.parse(json);
const changed = new Set((process.env.FAKE_CHANGED || "").split(",").filter(Boolean));
const answers = {
  "crew/seeds:estimateItems": () => args.items.map((item) => changed.has(item.ideaSlug)
    ? { ideaSlug: item.ideaSlug, status: "new", reservedMicroUsd: 230000, validated: true }
    : { ideaSlug: item.ideaSlug, status: "unchanged" }),
  "crew/seeds:autoRunState": () => JSON.parse(process.env.FAKE_STATE),
  "crew/seeds:createRun": () => "run_1",
  "crew/seeds:addItems": () => ({ added: args.items.length, unchanged: 0 }),
  "crew/seedsBatch:submitRun": () => ({ status: "submitted", submitted: changed.size, notReserved: 0 }),
};
process.stdout.write(JSON.stringify(answers[fn]()));
`,
  { mode: 0o755 },
);

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const manifest = JSON.parse(fs.readFileSync(path.join(root, "ideas", "manifest.json"), "utf8"));
const rows: { slug: string }[] = Array.isArray(manifest) ? manifest : manifest.ideas;
const published = rows.map((row) => row.slug).filter((slug) => fs.existsSync(path.join(root, "content", "ideas", `${slug}.mdx`)));
const [first, second] = published;

const liveState = { openRun: false, providerLive: true, freePoolBudgetMicroUsd: 7_000_000, freePoolUsedMicroUsd: 0 };

function run(options: { changed: string[]; state?: object; apply?: boolean; cap?: string; env?: Record<string, string> }) {
  fs.rmSync(log, { force: true });
  const args = [
    "--experimental-strip-types", "scripts/crew-seeds.mjs", "--auto",
    "--seed-version", "2026-11-08.1", "--max-reserve-usd", options.cap ?? "2.50", "--keep-free-pool", "0.5",
    "--slugs", [first, second].join(","),
    ...(options.apply ? ["--apply"] : []),
  ];
  const res = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: "utf8",
    env: {
      NODE_ENV: "test",
      PATH: `${dir}${path.delimiter}${process.env.PATH ?? ""}`,
      CONVEX_DEPLOY_KEY: "prod:first-squirrel-244|not-a-real-secret",
      FAKE_CHANGED: options.changed.join(","),
      FAKE_STATE: JSON.stringify(options.state ?? liveState),
      ...options.env,
    },
  });
  const calls = fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n") : [];
  return { status: res.status, out: `${res.stdout}${res.stderr}`, calls };
}

describe("WP92 crew-seeds --auto", () => {
  test("the library has pages to drive the script", () => {
    expect(published.length).toBeGreaterThanOrEqual(2);
  });

  test("submits only the changed page when live, switched on and under every limit", () => {
    const result = run({ changed: [second], apply: true });
    expect(result.status).toBe(0);
    expect(result.out).toContain(`auto: sending 1 idea(s), worst case $0.23: ${second}`);
    expect(result.out).toContain("target: deploy key prod:first-squirrel-244;");
    expect(result.out).not.toContain("not-a-real-secret");
    expect(result.calls).toEqual([
      "crew/seeds:estimateItems",
      "crew/seeds:autoRunState",
      "crew/seeds:createRun",
      "crew/seeds:addItems",
      "crew/seedsBatch:submitRun",
    ]);
  });

  test("without --apply it reports what it would send and writes nothing", () => {
    const result = run({ changed: [first, second] });
    expect(result.status).toBe(0);
    expect(result.out).toContain("Live spend is off");
    expect(result.calls).not.toContain("crew/seeds:createRun");
  });

  test("an open run, fixture mode or a busy pool each stop it before any write", () => {
    for (const state of [{ ...liveState, openRun: true }, { ...liveState, providerLive: false }, { ...liveState, freePoolUsedMicroUsd: 3_400_000 }]) {
      const result = run({ changed: [first], apply: true, state });
      expect(result.status).toBe(0);
      expect(result.calls).toEqual(["crew/seeds:estimateItems", "crew/seeds:autoRunState"]);
    }
  });

  test("over the cap it exits 3 so the workflow fails and the owner runs it by hand", () => {
    // Two changed pages at $0.23 each against a $0.30 cap.
    const result = run({ changed: [first, second], apply: true, cap: "0.30" });
    expect(result.status).toBe(3);
    expect(result.out).toContain("over the $0.30 cap");
    expect(result.calls).not.toContain("crew/seeds:createRun");
  });

  test("refuses to run against the retired deployment", () => {
    const result = run({ changed: [first], apply: true, env: { CONVEX_DEPLOY_KEY: "prod:vibrant-jackal-308|x" } });
    expect(result.status).toBe(2);
    expect(result.calls).toEqual([]);
  });

  test("refuses to run unattended without its limits", () => {
    fs.rmSync(log, { force: true });
    const res = spawnSync(process.execPath, ["--experimental-strip-types", "scripts/crew-seeds.mjs", "--auto", "--seed-version", "2026-11-08.1", "--slugs", first], {
      cwd: root,
      encoding: "utf8",
      env: { NODE_ENV: "test", PATH: `${dir}${path.delimiter}${process.env.PATH ?? ""}`, CONVEX_DEPLOY_KEY: "prod:first-squirrel-244|x", FAKE_CHANGED: first, FAKE_STATE: JSON.stringify(liveState) },
    });
    expect(res.status).toBe(2);
    expect(res.stderr).toContain("--auto needs --max-reserve-usd and --keep-free-pool");
  });
});
