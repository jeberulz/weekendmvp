/** Read-only release inventory. --local compares the disposable backend too. */
import { readFile, readdir } from "node:fs/promises";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

const manifest = JSON.parse(await readFile("ideas/manifest.json", "utf8")).ideas;
const files = (await readdir("content/ideas")).filter((file) => file.endsWith(".mdx") && !file.startsWith("_"));
const mdx = new Set(files.map((file) => file.slice(0, -4)));
const known = new Set(manifest.map((idea) => idea.slug));
const active = manifest.filter((idea) => !idea._retiredAt);
const retired = manifest.filter((idea) => idea._retiredAt).map((idea) => idea.slug);
const report = { manifest: manifest.length, active: active.length, retired, mdx: mdx.size, activeMissingMdx: active.filter((idea) => !mdx.has(idea.slug)).map((idea) => idea.slug) };
if (process.argv.includes("--local")) {
  const config = JSON.parse(await readFile(".convex/local/default/config.json", "utf8"));
  if (config.ports?.cloud !== 3310 || config.ports?.site !== 3311) throw new Error("Disposable backend required");
  const client = new ConvexHttpClient("http://127.0.0.1:3310", { logger: false });
  const rows = [];
  let cursor = null;
  do {
    const page = await client.query(makeFunctionReference("ideas:list"), { limit: 100, cursor });
    rows.push(...page.page);
    cursor = page.isDone ? null : page.continueCursor;
  } while (cursor !== null);
  const database = new Set(rows.map((row) => row.slug));
  report.database = rows.length;
  report.activeMissingDatabase = active.filter((idea) => !database.has(idea.slug)).map((idea) => idea.slug);
  report.databaseOnly = rows.filter((row) => !known.has(row.slug)).map((row) => row.slug);
  report.retiredInDatabase = retired.filter((slug) => database.has(slug));
  report.noCanonicalBody = rows.filter((row) => !mdx.has(row.slug) && !(row.bodyMode === "convex" && row.body)).map((row) => row.slug);
  if (report.activeMissingDatabase.length || report.noCanonicalBody.length) process.exitCode = 1;
}
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
