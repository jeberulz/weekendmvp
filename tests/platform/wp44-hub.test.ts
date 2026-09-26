/// <reference types="vite/client" />

import { readFileSync } from "node:fs";
import { crc32 as nodeCrc32 } from "node:zlib";
import { describe, expect, test } from "vitest";
import packRouteSource from "../../app/api/ideas/prompt-pack/route.ts?raw";
import comparePageSource from "../../app/dashboard/compare/page.tsx?raw";
import savedPageSource from "../../app/dashboard/saved/page.tsx?raw";
import exportSource from "../../components/platform/hub/ExportPromptPack.tsx?raw";
import toolbarSource from "../../components/platform/hub/SavedToolbar.tsx?raw";
import hubRowSource from "../../components/platform/hub/HubRow.tsx?raw";
import menuSource from "../../components/platform/hub/CollectionMenu.tsx?raw";
import collectionViewSource from "../../components/platform/hub/CollectionView.tsx?raw";
import compareViewSource from "../../components/platform/hub/CompareView.tsx?raw";
import sidebarSource from "../../components/platform/hub/SidebarCollections.tsx?raw";
import gateSource from "../../components/platform/hub/useFeatureGate.tsx?raw";
import savedIdeasSource from "../../components/platform/explore/SavedIdeas.tsx?raw";
import planDetailSource from "../../components/platform/builds/PlanDetail.tsx?raw";
import nextStepSource from "../../components/platform/home/NextStepCard.tsx?raw";
import buildSource from "../../lib/prompt-pack/build.ts?raw";
import zipSource from "../../lib/prompt-pack/zip.ts?raw";
import { buildPromptPack, isPackFormat, packFiles, type PackInput } from "../../lib/prompt-pack/build";
import { crc32 } from "../../lib/prompt-pack/zip";
import { extractIdea } from "../../lib/home/extract";

const hubComponents = import.meta.glob("../../components/platform/hub/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const input: PackInput = {
  slug: "invoice-chaser",
  title: "Invoice Chaser",
  description: "Chases overdue invoices for freelancers.",
  problem: "Freelancers wait weeks to get paid.",
  how: ["Connect Stripe", "Pick a reminder schedule"],
  stack: ["Next.js", "Convex"],
  prompts: [
    { title: "Project Setup", lines: ["Create a Next.js app.", "Add Convex."] },
    { title: "Landing Page", lines: ["Write a hero.", "```js", "console.log(1)", "```"] },
  ],
  siteUrl: "https://www.weekendmvp.app",
};

/** Reads a stored zip: entry names and data, checking each CRC on the way. */
function readZip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const entries: { name: string; text: string }[] = [];
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const local = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));
    const start = local + 30 + view.getUint16(local + 26, true);
    const data = bytes.subarray(start, start + size);
    expect(view.getUint16(local + 8, true), `${name} is stored, not compressed`).toBe(0);
    expect(nodeCrc32(data), `${name} crc`).toBe(crc);
    entries.push({ name, text: new TextDecoder().decode(data) });
    at += 46 + nameLength;
  }
  return entries;
}

describe("WP44-S11 prompt pack", () => {
  test("the zip is valid, complete and byte-for-byte deterministic", () => {
    const first = buildPromptPack(input, "all");
    const second = buildPromptPack(input, "all");
    expect(first.filename).toBe("invoice-chaser-prompt-pack.zip");
    expect(first.contentType).toBe("application/zip");
    expect(Buffer.from(first.body).equals(Buffer.from(second.body))).toBe(true);
    const entries = readZip(first.body);
    expect(entries.map((entry) => entry.name)).toEqual([
      "README.md",
      "CLAUDE.md",
      ".cursor/rules/invoice-chaser.mdc",
      ".windsurf/rules/invoice-chaser.md",
      "briefs/lovable.md",
      "briefs/bolt.md",
      "briefs/v0.md",
      "briefs/replit.md",
    ]);
    expect(entries.map((entry) => entry.text)).toEqual(packFiles(input).map((file) => file.text));
  });

  test("our crc32 matches Node's", () => {
    for (const text of ["", "a", "Weekend MVP", "é∑"]) {
      const bytes = new TextEncoder().encode(text);
      expect(crc32(bytes)).toBe(nodeCrc32(bytes));
    }
  });

  test("each tool gets the file it reads", () => {
    const claude = new TextDecoder().decode(buildPromptPack(input, "claude").body);
    expect(claude.startsWith("# Invoice Chaser\n")).toBe(true);
    expect(claude).toContain("## How it works\n\n1. Connect Stripe\n2. Pick a reminder schedule");
    expect(claude).toContain("### 1. Project Setup\n\n```text\nCreate a Next.js app.\nAdd Convex.\n```");
    // A prompt holding ``` gets a longer fence, so it cannot break out.
    expect(claude).toContain("````text\nWrite a hero.\n```js\nconsole.log(1)\n```\n````");
    expect(claude).toContain("https://www.weekendmvp.app/ideas/invoice-chaser");

    const cursor = buildPromptPack(input, "cursor");
    expect(cursor.filename).toBe("invoice-chaser.mdc");
    expect(new TextDecoder().decode(cursor.body)).toMatch(/^---\ndescription: .+\nalwaysApply: true\n---\n# Invoice Chaser/);
    expect(buildPromptPack(input, "lovable").filename).toBe("invoice-chaser-lovable-brief.md");
    expect(new TextDecoder().decode(buildPromptPack(input, "v0").body)).toContain("# Build brief for v0: Invoice Chaser");
    expect(isPackFormat("claude")).toBe(true);
    expect(isPackFormat("../etc")).toBe(false);
  });

  test("a real idea builds a full pack", () => {
    const extract = extractIdea(readFileSync("content/ideas/adspark.mdx", "utf8"));
    expect(extract.prompts.length).toBeGreaterThan(0);
    const pack = buildPromptPack(
      { ...input, slug: "adspark", title: "AdSpark", problem: extract.problem, how: extract.how, stack: extract.stack, prompts: extract.prompts },
      "claude",
    );
    const text = new TextDecoder().decode(pack.body);
    for (const prompt of extract.prompts) expect(text).toContain(prompt.title);
  });

  test("no AI call, clock or randomness in the builder", () => {
    for (const source of [buildSource, zipSource]) {
      expect(source).not.toMatch(/Date\.now|new Date|Math\.random|fetch\(|anthropic|openai/i);
    }
  });

  test("the route checks the plan in Convex before it builds anything", () => {
    expect(packRouteSource).toContain("isIdeaSlug(slug)");
    expect(packRouteSource).toContain("isPackFormat(format)");
    expect(packRouteSource).toContain("await convexAuthNextjsToken()");
    const gate = packRouteSource.indexOf("api.platform.promptPack.source");
    expect(gate).toBeGreaterThan(-1);
    expect(packRouteSource.indexOf("buildPromptPack(")).toBeGreaterThan(gate);
    expect(packRouteSource).toContain('if (data?.code === "UPGRADE_REQUIRED") return json({ code: data.code, feature: data.feature }, 403);');
    expect(packRouteSource).toContain('"Cache-Control": "private, no-store"');
    expect(packRouteSource).toContain("attachment; filename=");
    expect(readFileSync("next.config.ts", "utf8")).toContain('"/api/ideas/prompt-pack": ["./content/ideas/**/*.mdx"]');
  });
});

describe("WP44-S11 screens", () => {
  test("every Builder's Hub surface sits behind the flag", () => {
    expect(exportSource).toContain("if (!BUILDERS_HUB_UI) return null;");
    expect(sidebarSource).toContain("if (!BUILDERS_HUB_UI || collapsed) return null;");
    expect(savedIdeasSource).toContain("if (BUILDERS_HUB_UI && collectionId) return <CollectionView");
    expect(savedIdeasSource).toContain("const toolbar = BUILDERS_HUB_UI ? (");
    expect(compareViewSource).toContain("if (!BUILDERS_HUB_UI) {");
    expect(gateSource).toContain("const sheet = BUILDERS_HUB_UI ? (");
  });

  test("the server answers before a form or view opens", () => {
    expect(gateSource).toContain("await convex.query(api.platform.entitlements.check, { feature: next });");
    expect(toolbarSource).toContain('gate.run("collections"');
    expect(toolbarSource).toContain('gate.run("compare"');
    expect(exportSource).toContain('gate.run("prompt_pack"');
    // And again at the end: a refused download opens the sheet too.
    expect(exportSource).toContain('if (response.status === 403) {');
  });

  test("tags only where upsells may show; row tools only for Builder's Hub", () => {
    for (const source of [toolbarSource, exportSource]) {
      expect(source).toContain("{showUpsell && <BuildersHubTag");
    }
    expect(savedIdeasSource).toContain('const hub = entitlements?.plan === "builders_hub";');
    expect(savedIdeasSource).toContain("{hub && item.card.saved ? (");
  });

  test("export sits on the plan page and the Home building card", () => {
    expect(planDetailSource).toContain("<ExportPromptPack slug={idea.slug} title={idea.title} />");
    expect(nextStepSource).toContain("<ExportPromptPack slug={plan.slug} title={plan.title} />");
  });

  test("accessible names, landmarks and keyboard reach", () => {
    expect(menuSource).not.toContain("DropdownMenu.Portal");
    expect(menuSource).toContain('<span className="sr-only">Collections for {title}</span>');
    expect(hubRowSource).toContain("aria-expanded={editing}");
    expect(hubRowSource).toContain("Private note for {title}");
    expect(collectionViewSource).toContain("Remove {item.card.title} from {collection.name}");
    expect(compareViewSource).toContain('role="region"');
    expect(compareViewSource).toContain("tabIndex={0}");
    expect(compareViewSource).toContain('<th key={idea.slug} scope="col"');
    expect(compareViewSource).toContain('<th scope="row"');
    expect(toolbarSource).toContain('<nav aria-label="Collections">');
  });

  test("pages validate what they read from the URL", () => {
    expect(comparePageSource).toContain(".filter(isIdeaSlug).slice(0, 4)");
    expect(comparePageSource).toContain("robots: { index: false, follow: false }");
    expect(savedPageSource).toContain("/^[a-z0-9]{10,64}$/");
  });

  test("no hosting, credits or publishing in the Builder's Hub screens (R5, R9)", () => {
    for (const [path, source] of Object.entries(hubComponents)) {
      const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect(code, path).not.toMatch(/hosting|credit|publish/i);
    }
  });
});
