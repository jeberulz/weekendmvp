import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { inventoryLegacyIdeas } from "@/scripts/editorial-import-legacy-core";
import { editorialSubmissionSchema } from "@/lib/editorial/contracts/submission";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function sampleRoot(slug = "phone-neck-score-app") {
  const root = await mkdtemp(path.join(os.tmpdir(), "editorial-legacy-"));
  roots.push(root);
  await mkdir(path.join(root, "ideas"));
  await mkdir(path.join(root, "content/ideas"), { recursive: true });
  const all = JSON.parse(await readFile("ideas/manifest.json", "utf8")) as { ideas: Array<{ slug: string }> };
  const idea = all.ideas.find((candidate) => candidate.slug === slug);
  if (!idea) throw new Error("Missing stable sample idea");
  await writeFile(path.join(root, "ideas/manifest.json"), JSON.stringify({ ideas: [idea] }));
  const mdx = await readFile(`content/ideas/${idea.slug}.mdx`, "utf8");
  await writeFile(path.join(root, "content/ideas", `${idea.slug}.mdx`), mdx);
  return { root, idea, mdx };
}

describe("legacy editorial import inventory", () => {
  test("preserves canonical body and makes an unverified legacy baseline", async () => {
    const { root } = await sampleRoot();
    const first = await inventoryLegacyIdeas(root);
    const second = await inventoryLegacyIdeas(root);
    expect(first.skipped).toEqual([]);
    expect(first.digest).toBe(second.digest);
    expect(first.entries).toHaveLength(1);
    const envelope = first.entries[0].envelope;
    expect(editorialSubmissionSchema.safeParse(envelope).success).toBe(true);
    expect(envelope.mode).toBe("legacy");
    expect(envelope.markdown).toContain("## The Problem");
    expect(envelope.markdown).not.toContain('slug: "phone-neck-score-app"');
    expect(envelope.sources).toEqual([]);
    expect(envelope.claims).toEqual([]);
    expect(envelope.checks).toEqual([]);
    expect(envelope.buyer).toBe("Not recorded in legacy source");
  });

  test("refuses a missing canonical body instead of inventing an import", async () => {
    const { root } = await sampleRoot();
    await rm(path.join(root, "content/ideas/phone-neck-score-app.mdx"));
    const inventory = await inventoryLegacyIdeas(root);
    expect(inventory.entries).toHaveLength(0);
    expect(inventory.skipped).toEqual([{ slug: "phone-neck-score-app", reason: "canonical MDX body missing" }]);
  });

  test("changes to the body alter the inventory digest but keep the submission ID", async () => {
    const { root, mdx } = await sampleRoot();
    const first = await inventoryLegacyIdeas(root);
    await writeFile(path.join(root, "content/ideas/phone-neck-score-app.mdx"), `${mdx}\nA new factual claim.\n`);
    const second = await inventoryLegacyIdeas(root);
    expect(second.digest).not.toBe(first.digest);
    expect(second.entries[0].envelope.submissionId).toBe(first.entries[0].envelope.submissionId);
  });

  test("retains validated pricing tiers from the current public baseline", async () => {
    const { root } = await sampleRoot("prompt-regression-tests-indie-ai-builders");
    const inventory = await inventoryLegacyIdeas(root);
    expect(inventory.skipped).toEqual([]);
    expect(inventory.entries[0].envelope.metadata.highlights?.tiers).toEqual([
      { name: "Local Sandbox", price: "Free" },
      { name: "Live Project", price: "$29/project/month" },
      { name: "Project Portfolio", price: "$99/month" },
    ]);
  });
});
