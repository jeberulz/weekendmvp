/** Run after next build. Audit and optionally materialize sensitive route traces. */
import assert from "node:assert/strict";
import { readFile, readdir, stat, mkdir, copyFile, mkdtemp } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const root = process.cwd();
const routes = ["api/ideas/prompts/route", "api/ideas/prompt-pack/route", "sitemap.xml/route"];
const packageRoot = process.argv.includes("--package") ? await mkdtemp(path.join(os.tmpdir(), "weekendmvp-server-artifacts-")) : null;
const reports = [];
const canonicalIdeas = (await readdir(path.join(root, "content/ideas")))
  .filter(file => file.endsWith(".mdx") && !file.startsWith("_"))
  .map(file => path.join(root, "content/ideas", file));
assert(canonicalIdeas.length > 0, "Canonical idea corpus is empty");
for (const route of routes) {
  const entry = path.join(root, ".next/server/app", `${route}.js`);
  const tracePath = `${entry}.nft.json`;
  const trace = JSON.parse(await readFile(tracePath, "utf8"));
  const sources = [...new Set([entry, ...trace.files.map((file) => path.resolve(path.dirname(tracePath), file))])];
  const required = route === "sitemap.xml/route"
    ? [...canonicalIdeas, path.join(root, "ideas/manifest.json")]
    : canonicalIdeas;
  for (const file of required) {
    assert(sources.includes(file), `Required canonical content missing from ${route}: ${path.relative(root, file)}`);
  }
  let bytes = 0;
  for (const source of sources) {
    const relative = path.relative(root, source);
    assert(!relative.startsWith("../") && !path.isAbsolute(relative), "Trace escaped project root");
    assert(!/^(public|docs|tests|scripts)\//.test(relative), `Unrelated source in ${route}: ${relative}`);
    assert(!/(^|\/)\.env(?:\.|$)|(^|\/)\.(git|convex|vercel)\//.test(relative), "Sensitive configuration in server trace");
    bytes += (await stat(source)).size;
    if (packageRoot) {
      const target = path.join(packageRoot, route.replaceAll("/", "-"), relative);
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(source, target);
    }
  }
  assert(bytes < 32 * 1024 * 1024, `Server artifact too large: ${route}`);
  reports.push({ route: `/${route.replace(/\/route$/, "")}`, files: sources.length, bytes, canonicalIdeas: canonicalIdeas.length, manifestRequired: route === "sitemap.xml/route" });
}
process.stdout.write(JSON.stringify({ artifacts: reports, materializedDirectory: packageRoot, note: "Next traced server files, including route entry. Hosting-provider repackaging is not measured." }, null, 2) + "\n");
