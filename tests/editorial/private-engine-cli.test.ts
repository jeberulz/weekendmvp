import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";

import { buildPassingSourceReview } from "../../lib/engine/source-review";
import { parseResearchRecord } from "../../lib/engine/research-record";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const slug = "prompt-regression-tests-indie-ai-builders";
const temporary: string[] = [];

afterEach(async () => {
  for (const directory of temporary.splice(0)) await rm(directory, { recursive: true, force: true });
});

function run(args: string[]) {
  return spawnSync(process.execPath, ["scripts/editorial-submit-engine.mjs", `--slug=${slug}`, ...args], {
    cwd: root,
    encoding: "utf8",
    timeout: 30_000,
  });
}

async function writeSealedReview(directory: string, recordJson: string): Promise<string> {
  const record = parseResearchRecord(JSON.parse(recordJson));
  const reviewPath = path.join(directory, "source-review.json");
  await writeFile(reviewPath, JSON.stringify(buildPassingSourceReview(record)), { mode: 0o600 });
  return reviewPath;
}

describe("private engine submission CLI", () => {
  test("deep-audits ignored private files with a standalone manifest row", async () => {
    await mkdir(path.join(root, "tmp"), { recursive: true });
    const directory = await mkdtemp(path.join(root, "tmp", "editorial-private-test-"));
    temporary.push(directory);
    const record = path.join(directory, "record.json");
    const mdx = path.join(directory, "idea.mdx");
    const manifest = path.join(directory, "manifest-row.json");
    const fullManifest = JSON.parse(await readFile(path.join(root, "ideas/manifest.json"), "utf8")) as { ideas: Array<{ slug: string }> };
    const row = fullManifest.ideas.find((idea) => idea.slug === slug);
    expect(row).toBeDefined();
    const recordJson = await readFile(path.join(root, "engine/records", `${slug}.json`), "utf8");
    await Promise.all([
      writeFile(record, recordJson, { mode: 0o600 }),
      writeFile(mdx, await readFile(path.join(root, "content/ideas", `${slug}.mdx`)), { mode: 0o600 }),
      writeFile(manifest, JSON.stringify(row), { mode: 0o600 }),
    ]);
    const sourceReview = await writeSealedReview(directory, recordJson);

    const result = run([
      `--record=${record}`,
      `--mdx=${mdx}`,
      `--manifest=${manifest}`,
      `--source-review=${sourceReview}`,
    ]);
    expect(result.status, result.stderr).toBe(0);
    const output = JSON.parse(result.stdout) as { source: string; slug: string; action: string; artifactHash: string };
    expect(output).toMatchObject({ source: "private-files", slug, action: "dry run only" });
    expect(output.artifactHash).toMatch(/^[0-9a-f]{64}$/);

    await writeFile(manifest, JSON.stringify({ ideas: [row] }));
    const wrapped = run([
      `--record=${record}`,
      `--mdx=${mdx}`,
      `--manifest=${manifest}`,
      `--source-review=${sourceReview}`,
    ]);
    expect(wrapped.status, wrapped.stderr).toBe(0);
    expect((JSON.parse(wrapped.stdout) as { artifactHash: string }).artifactHash).toBe(output.artifactHash);
  });

  test("refuses private submission without a Source Critic review", async () => {
    await mkdir(path.join(root, "tmp"), { recursive: true });
    const directory = await mkdtemp(path.join(root, "tmp", "editorial-private-noreview-"));
    temporary.push(directory);
    const record = path.join(directory, "record.json");
    const mdx = path.join(directory, "idea.mdx");
    const manifest = path.join(directory, "manifest-row.json");
    const fullManifest = JSON.parse(await readFile(path.join(root, "ideas/manifest.json"), "utf8")) as { ideas: Array<{ slug: string }> };
    const row = fullManifest.ideas.find((idea) => idea.slug === slug);
    expect(row).toBeDefined();
    await Promise.all([
      writeFile(record, await readFile(path.join(root, "engine/records", `${slug}.json`)), { mode: 0o600 }),
      writeFile(mdx, await readFile(path.join(root, "content/ideas", `${slug}.mdx`)), { mode: 0o600 }),
      writeFile(manifest, JSON.stringify(row), { mode: 0o600 }),
    ]);
    const missing = run([`--record=${record}`, `--mdx=${mdx}`, `--manifest=${manifest}`]);
    expect(missing.status).not.toBe(0);
    expect(missing.stderr).toContain("requires --source-review=PATH");
  });

  test("refuses incomplete or repository-public private input paths", async () => {
    const incomplete = run([`--record=engine/records/${slug}.json`]);
    expect(incomplete.status).not.toBe(0);
    expect(incomplete.stderr).toContain("requires --record=PATH, --mdx=PATH and --manifest=PATH together");

    const publicPaths = run([
      `--record=engine/records/${slug}.json`,
      `--mdx=content/ideas/${slug}.mdx`,
      "--manifest=ideas/manifest.json",
    ]);
    expect(publicPaths.status).not.toBe(0);
    expect(publicPaths.stderr).toContain("Private submission files must be outside the repository");

    await mkdir(path.join(root, "tmp"), { recursive: true });
    const directory = await mkdtemp(path.join(root, "tmp", "editorial-private-symlink-test-"));
    temporary.push(directory);
    const alias = path.join(directory, "public-record.json");
    const privateMdx = path.join(directory, "idea.mdx");
    const privateManifest = path.join(directory, "manifest.json");
    const privateReview = path.join(directory, "source-review.json");
    await symlink(path.join(root, "engine/records", `${slug}.json`), alias);
    await Promise.all([
      writeFile(privateMdx, await readFile(path.join(root, "content/ideas", `${slug}.mdx`))),
      writeFile(privateManifest, await readFile(path.join(root, "ideas/manifest.json"))),
      writeFile(privateReview, "{}"),
    ]);
    const disguisedPublicPath = run([
      `--record=${alias}`,
      `--mdx=${privateMdx}`,
      `--manifest=${privateManifest}`,
      `--source-review=${privateReview}`,
    ]);
    expect(disguisedPublicPath.status).not.toBe(0);
    expect(disguisedPublicPath.stderr).toContain("Private submission files must be outside the repository");
  });
});
