/**
 * Prompt standard audit (WP61). Read-only. Lints each idea's build prompts
 * against `scripts/lib/prompt-standard.mjs` and prints a summary.
 *
 *   npm run audit:prompts                       every live idea, summary and worst first
 *   npm run audit:prompts -- --slug meeting-mood-ai
 *   npm run audit:prompts -- --source ideabrowser   only ideas from one manifest source
 *   npm run audit:prompts -- --slugs a,b,c          only these slugs
 *   npm run audit:prompts -- --json                 machine-readable rows
 *   npm run audit:prompts -- --report               never exit 1 (inventory mode)
 *   npm run audit:prompts -- --enforced             only the ideas on ideas/prompt-standard.json (the CI gate)
 *
 * Exit 1 when any selected idea has an error, unless `--report`.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PROMPT_STANDARD_VERSION, lintIdeaMdx } from "./lib/prompt-standard.mjs";
import { readEnforcedSlugs } from "./lib/prompt-standard-enforced.mjs";

const root = process.cwd();
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : (args[i + 1] ?? null);
};

const manifest = JSON.parse(readFileSync(path.join(root, "ideas/manifest.json"), "utf8")).ideas ?? [];
const sourceOf = (idea) => String(idea.source ?? "none").split(":")[0];

let ideas = manifest.filter((i) => !i._retiredAt && !String(i.slug).startsWith("engine-draft-"));
if (value("--slug")) ideas = ideas.filter((i) => i.slug === value("--slug"));
if (value("--slugs")) {
  const wanted = new Set(value("--slugs").split(",").map((s) => s.trim()).filter(Boolean));
  ideas = ideas.filter((i) => wanted.has(i.slug));
}
if (value("--source")) ideas = ideas.filter((i) => sourceOf(i) === value("--source"));
if (flag("--enforced")) {
  const enforced = readEnforcedSlugs();
  ideas = ideas.filter((i) => enforced.has(i.slug));
}

const rows = ideas.map((idea) => {
  const file = path.join(root, "content/ideas", `${idea.slug}.mdx`);
  if (!existsSync(file)) {
    return { slug: idea.slug, source: sourceOf(idea), errors: [{ code: "no-mdx", message: "no MDX file" }], warnings: [], prompts: 0 };
  }
  const { errors, warnings, blocks } = lintIdeaMdx(readFileSync(file, "utf8"));
  return { slug: idea.slug, source: sourceOf(idea), errors, warnings, prompts: blocks.length };
});

rows.sort((a, b) => b.errors.length - a.errors.length || b.warnings.length - a.warnings.length || a.slug.localeCompare(b.slug));

if (flag("--json")) {
  process.stdout.write(`${JSON.stringify({ standard: PROMPT_STANDARD_VERSION, rows }, null, 2)}\n`);
} else {
  const failing = rows.filter((r) => r.errors.length > 0);
  const byCode = new Map();
  for (const r of rows) for (const e of r.errors) byCode.set(e.code, (byCode.get(e.code) ?? 0) + 1);

  console.log(`prompt standard v${PROMPT_STANDARD_VERSION}: ${rows.length - failing.length}/${rows.length} ideas pass`);
  if (byCode.size > 0) {
    console.log("\nerrors by rule:");
    for (const [code, n] of [...byCode].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${code}`);
  }
  const shown = rows.length <= 12 || value("--slug") || value("--slugs") ? failing : failing.slice(0, 12);
  if (shown.length > 0) console.log(`\n${shown.length === failing.length ? "failing" : "worst 12 of " + failing.length}:`);
  for (const r of shown) {
    console.log(`  FAIL ${r.slug} [${r.source}] ${r.errors.length} error(s)`);
    for (const e of r.errors) console.log(`       - ${e.code}: ${e.message}`);
  }
  if (value("--slug") || value("--slugs")) {
    for (const r of rows.filter((x) => x.errors.length === 0)) console.log(`  PASS ${r.slug}${r.warnings.length ? ` (${r.warnings.length} warning(s): ${r.warnings.map((w) => w.code).join(", ")})` : ""}`);
  }
}

const failed = rows.some((r) => r.errors.length > 0);
// Set the code and let Node exit on its own: `process.exit` right after a large write to a pipe cuts the output off.
process.exitCode = failed && !flag("--report") ? 1 : 0;
