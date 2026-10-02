#!/usr/bin/env node
/**
 * engine:replay — the deterministic research → compile → audit replay, for
 * operators (WP54). It runs the real CLIs on the synthetic RFP fixture
 * (engine/briefs/fixtures/rfp-assistant.json, which --fixture rfp-assistant
 * loads) in a fresh temp dir, prints each step's exit code and the audit
 * verdict, and removes the temp dir:
 *
 *   engine-research.mjs --fixture rfp-assistant --out <tmp>/r.json
 *   engine-compile.mjs  --record <tmp>/r.json --slug engine-draft-replay-rfp
 *                       --ideas-dir <tmp>/ideas --no-manifest --json
 *   audit-idea-mdx.mjs  --file <tmp>/ideas/engine-draft-replay-rfp.mdx
 *                       --record <tmp>/r.json --siblings <tmp>/siblings --json
 *
 * Usage:
 *   npm run engine:replay
 *   npm run engine:replay -- --work-root <dir>   # parent of the temp dir
 *
 * The CLIs get an empty environment, so no provider key, .env value or PATH
 * reaches them: fixture mode spends nothing and cannot call a provider.
 * Nothing is written in the repository and Convex is never touched. Exit 0
 * when every step exits 0 and the page passes the full deep audit, 1
 * otherwise, 2 on a usage error.
 *
 * `npm test` runs the same flow plus authenticity and adversarial checks
 * (lib/engine/replay.test.ts). A pass says the engine's code paths agree on
 * the fixture; it says nothing about live sources or live models.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SLUG = "engine-draft-replay-rfp";
/**
 * The npm scripts' flags for the CLIs: they import TypeScript modules, and the
 * typeless-package warning (which prints an absolute path) is silenced.
 */
const NODE_FLAGS = ["--experimental-strip-types", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON"];
const STEP_TIMEOUT_MS = 120_000;
const TAIL_LINES = 15;

const HELP = `Usage:
  npm run engine:replay [-- --work-root <dir>]

Runs research (fixture) → compile → deep audit in a fresh temp dir under
<dir> (default: the OS temp dir), prints each step's exit code and the audit
verdict, then removes the temp dir. Exit 0 pass, 1 fail, 2 usage error.`;

function usageError(message) {
  console.error(`${message}\n\n${HELP}`);
  process.exit(2);
}

function parseArgs(argv) {
  const args = { workRoot: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      console.log(HELP);
      process.exit(0);
    } else if (a === "--work-root") {
      const value = argv[++i];
      if (value === undefined || value.startsWith("--")) usageError("--work-root needs a directory");
      args.workRoot = path.resolve(value);
    } else {
      usageError(`unknown arg: ${a}`);
    }
  }
  if (args.workRoot && !fs.existsSync(args.workRoot)) usageError("--work-root directory not found");
  return args;
}

/** One CLI as a child process with an empty environment; resolves with its exit code and output. */
function runStep(script, args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [...NODE_FLAGS, path.join(root, "scripts", script), ...args], {
      cwd: root,
      env: {},
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (d) => {
      stdout += d;
    });
    child.stderr.setEncoding("utf8").on("data", (d) => {
      stderr += d;
    });
    const timer = setTimeout(() => child.kill("SIGKILL"), STEP_TIMEOUT_MS);
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: `${stderr}\n${error.message}` });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

/** The last JSON line a --json CLI printed, or null. */
function lastJson(stdout) {
  const lines = stdout.split("\n").filter((line) => line.trim().startsWith("{"));
  const last = lines[lines.length - 1];
  if (!last) return null;
  try {
    return JSON.parse(last);
  } catch {
    // Not JSON after all: the caller prints the raw output instead.
    return null;
  }
}

/** The last lines of a step's output, with the temp dir hidden. */
function tail(run, dir) {
  const text = `${run.stdout}\n${run.stderr}`.split(dir).join("<replay dir>");
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .slice(-TAIL_LINES)
    .map((line) => `      ${line}`)
    .join("\n");
}

function readReport(reportPath) {
  try {
    return JSON.parse(fs.readFileSync(reportPath, "utf8"));
  } catch {
    // A missing or unreadable report is shown as "no report" in the summary.
    return null;
  }
}

function acceptedSummary(report) {
  const accepted = report?.evidence?.accepted;
  if (!accepted) return "no report";
  return `mode ${report.mode}; accepted ${accepted.community_quote} quotes, ${accepted.market_stat} stats, ${accepted.competitor_price} prices`;
}

const pad = (name) => name.padEnd(9);

async function replay(dir) {
  const recordPath = path.join(dir, "r.json");
  const ideasDir = path.join(dir, "ideas");
  const siblings = path.join(dir, "siblings");
  const mdxPath = path.join(ideasDir, `${SLUG}.mdx`);
  fs.mkdirSync(siblings);

  const research = await runStep("engine-research.mjs", ["--fixture", "rfp-assistant", "--out", recordPath]);
  console.log(`  ${pad("research")} exit ${research.code}  (${acceptedSummary(readReport(`${recordPath}.report.json`))})`);
  if (research.code !== 0) {
    console.log(tail(research, dir));
    return "research";
  }

  const compile = await runStep("engine-compile.mjs", [
    "--record",
    recordPath,
    "--slug",
    SLUG,
    "--ideas-dir",
    ideasDir,
    "--no-manifest",
    "--json",
  ]);
  const compiled = lastJson(compile.stdout);
  console.log(`  ${pad("compile")} exit ${compile.code}  (${compiled?.ok ? `${compiled.wordCount} words` : "refused"})`);
  if (compile.code !== 0) {
    if (compiled?.error) console.log(`      ${compiled.error}`);
    for (const issue of compiled?.issues ?? []) console.log(`      - ${issue}`);
    if (!compiled) console.log(tail(compile, dir));
    return "compile";
  }

  const audit = await runStep("audit-idea-mdx.mjs", ["--file", mdxPath, "--record", recordPath, "--siblings", siblings, "--json"]);
  const result = lastJson(audit.stdout);
  const verdict = audit.code === 0 && result?.ok === true ? "PASS" : "FAIL";
  const metrics = result?.metrics;
  const detail = metrics
    ? `deep bar: ${metrics.wordCount} words (floor ${metrics.wordHardFloor}), ${metrics.artifact?.verifiedQuotes ?? 0} verified quotes, ${metrics.artifact?.unboundFigures ?? 0} unbound figures`
    : "no audit result";
  console.log(`  ${pad("audit")} exit ${audit.code}  ${verdict}  (${detail})`);
  if (verdict !== "PASS") {
    for (const error of result?.errors ?? []) console.log(`      - ${error}`);
    if (!result) console.log(tail(audit, dir));
    return "audit";
  }
  for (const warning of result.warnings ?? []) console.log(`      ! ${warning}`);
  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dir = fs.mkdtempSync(path.join(args.workRoot ?? os.tmpdir(), "engine-replay-"));
  console.log("engine:replay: fixture rfp-assistant → compile → deep audit (no provider keys; temp dir removed afterwards)");
  let failedAt;
  try {
    failedAt = await replay(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(failedAt ? `engine:replay FAIL at ${failedAt}` : "engine:replay PASS");
  process.exit(failedAt ? 1 : 0);
}

main().catch((error) => {
  console.error(`engine:replay: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
