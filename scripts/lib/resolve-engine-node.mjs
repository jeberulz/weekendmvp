/**
 * JS twin of resolve-engine-node.sh for Node parents (engine-replay.mjs, tests).
 * Safe on Node 20: no strip-types import. Refuses to return an unsupported bin.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const ENGINE_NODE_MIN = Object.freeze({ major: 22, minor: 6, patch: 0 });

export const ENGINE_NODE_INSTALL_HELP = `Idea Engine requires Node.js >= 22.6.0 (CI: 22.x; .nvmrc may pin 22 or 24).

\`--experimental-strip-types\` does not exist on Node 20 (exit 9: bad option).
Node 20 is not supported for engine:research / compile / replay / audit.

Owner setup:
  nvm install && nvm use
  # or: export ENGINE_NODE=/path/to/node-22.6+-or-24
  node --experimental-strip-types -e 'console.log("ok")'
  npm run engine:replay

WP46-E7 public release remains NO-GO independently of this runtime check.`;

export function parseNodeVersion(version) {
  const cleaned = String(version).trim().replace(/^v/i, "");
  const parts = cleaned.split(".").map((p) => Number.parseInt(p, 10));
  return {
    major: Number.isFinite(parts[0]) ? parts[0] : 0,
    minor: Number.isFinite(parts[1]) ? parts[1] : 0,
    patch: Number.isFinite(parts[2]) ? parts[2] : 0,
    raw: cleaned,
  };
}

export function versionMeetsMin(version, min = ENGINE_NODE_MIN) {
  const v = typeof version === "string" ? parseNodeVersion(version) : version;
  if (v.major !== min.major) return v.major > min.major;
  if (v.minor !== min.minor) return v.minor > min.minor;
  return v.patch >= min.patch;
}

function runNode(bin, args) {
  return spawnSync(bin, args, { encoding: "utf8", timeout: 15_000 });
}

export function readNodeVersion(bin) {
  const result = runNode(bin, ["-p", "process.versions.node"]);
  if (result.status !== 0) return null;
  return parseNodeVersion(result.stdout);
}

export function supportsStripTypes(bin) {
  const result = runNode(bin, ["--experimental-strip-types", "-e", 'console.log("ok")']);
  return result.status === 0 && String(result.stdout).includes("ok");
}

function existingFiles(globsOrPaths) {
  const found = [];
  for (const entry of globsOrPaths) {
    if (entry.includes("*")) {
      const dir = path.dirname(entry.split("*")[0]);
      if (!fs.existsSync(dir)) continue;
      // Shallow nvm/fnm scan only — callers pass concrete roots separately.
      continue;
    }
    if (fs.existsSync(entry)) found.push(entry);
  }
  return found;
}

function nvmNodes(nvmDir) {
  const base = path.join(nvmDir, "versions", "node");
  if (!fs.existsSync(base)) return [];
  const versions = fs
    .readdirSync(base)
    .filter((name) => name.startsWith("v"))
    .sort((a, b) => {
      const pa = parseNodeVersion(a);
      const pb = parseNodeVersion(b);
      if (pa.major !== pb.major) return pb.major - pa.major;
      if (pa.minor !== pb.minor) return pb.minor - pa.minor;
      return pb.patch - pa.patch;
    });
  return versions
    .map((ver) => path.join(base, ver, "bin", "node"))
    .filter((bin) => fs.existsSync(bin));
}

export function collectEngineNodeCandidates(env = process.env) {
  const out = [];
  if (env.ENGINE_NODE) out.push(env.ENGINE_NODE);
  out.push(process.execPath);
  try {
    const pathNode = spawnSync("bash", ["-lc", "command -v node"], {
      encoding: "utf8",
      env,
      timeout: 5_000,
    });
    if (pathNode.status === 0 && pathNode.stdout.trim()) out.push(pathNode.stdout.trim());
  } catch {
    // ignore — PATH probe is best-effort
  }

  const nvmDir = env.NVM_DIR || path.join(os.homedir(), ".nvm");
  out.push(...nvmNodes(nvmDir));
  out.push(
    ...existingFiles([
      "/usr/local/bin/node",
      "/opt/homebrew/bin/node",
      "/usr/bin/node",
    ]),
  );

  const seen = new Set();
  return out.filter((bin) => {
    if (!bin || seen.has(bin)) return false;
    seen.add(bin);
    try {
      return fs.existsSync(bin);
    } catch {
      return false;
    }
  });
}

/**
 * @returns {{ bin: string, version: string }}
 * @throws {{ code: 3, message: string, probed: Array<{bin:string,version:string|null}> }}
 */
export function resolveEngineNode(env = process.env) {
  const probed = [];
  for (const bin of collectEngineNodeCandidates(env)) {
    const version = readNodeVersion(bin);
    probed.push({ bin, version: version?.raw ?? null });
    if (!version || !versionMeetsMin(version)) continue;
    if (!supportsStripTypes(bin)) continue;
    return { bin, version: version.raw };
  }
  const detail = probed
    .map((row) => `  - ${row.bin} → ${row.version ? `v${row.version}` : "unreadable"}`)
    .join("\n");
  const error = new Error(
    `no Node >= ${ENGINE_NODE_MIN.major}.${ENGINE_NODE_MIN.minor}.${ENGINE_NODE_MIN.patch} with --experimental-strip-types\n` +
      (detail ? `candidates probed:\n${detail}\n\n` : "") +
      ENGINE_NODE_INSTALL_HELP,
  );
  error.code = 3;
  error.probed = probed;
  throw error;
}

export function assertEngineNodeOrExit(env = process.env) {
  try {
    return resolveEngineNode(env);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`resolve-engine-node: ${message}`);
    process.exit(typeof error?.code === "number" ? error.code : 3);
  }
}
