import { describe, expect, test } from "vitest";

import type { EditorialClaim, EditorialSource } from "@/lib/editorial/contracts/evidence";
import { assessmentDigest, computeRevisionHashes } from "@/lib/editorial/domain/artifact";
import { countWords, measureContent } from "@/lib/editorial/domain/counts";
import { canonicalJson, sha256Hex } from "@/lib/editorial/domain/hash";
import { deriveReviewItems } from "@/lib/editorial/domain/review-items";
import { containsNormalized, sectionsByKey, splitFrontmatter, splitSections } from "@/lib/editorial/domain/structure";
import { receiptSplitter } from "@/lib/editorial/fixtures/articles/catalog";
import { buildFixtureEnvelope } from "@/lib/editorial/fixtures/envelopes";
import { buildArticleMarkdown } from "@/lib/editorial/fixtures/spec";

describe("hashing", () => {
  test("SHA-256 matches the standard test vector", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  test("canonical JSON ignores key order and omits undefined members", () => {
    expect(canonicalJson({ b: 1, a: [true, null, "x"], c: undefined })).toBe('{"a":[true,null,"x"],"b":1}');
    expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }));
  });
});

describe("structure", () => {
  const doc = [
    "---",
    'title: "x"',
    "---",
    "## The Problem",
    "Pain.",
    "```text",
    "## Not a heading inside a prompt",
    "```",
    "## The Solution",
    "Fix.",
  ].join("\n");

  test("frontmatter is split from the body with its line offset", () => {
    const split = splitFrontmatter(doc);
    expect(split.frontmatter).toBe('title: "x"');
    expect(split.bodyStartLine).toBe(4);
  });

  test("headings inside fenced code never create sections", () => {
    const sections = splitSections(doc);
    expect(sections.blocks.map((block) => block.title)).toEqual(["The Problem", "The Solution"]);
    expect(sections.blocks[0].headingLine).toBe(4);
    expect(sections.blocks[0].body).toContain("## Not a heading inside a prompt");
  });

  test("claim anchors match regardless of line wrapping", () => {
    expect(containsNormalized("paid an average\nof 47 days late.", "paid an average of 47 days late")).toBe(true);
    expect(containsNormalized("paid an average of 48 days late.", "paid an average of 47 days late")).toBe(false);
  });
});

describe("measured counts", () => {
  test("prose excludes frontmatter, code and raw markup; prompts are fences in the prompts section", () => {
    // Blank lines matter: a CommonMark HTML block runs until the next blank line.
    const markdown = [
      "---",
      "title: many words in frontmatter should not count",
      "---",
      "## The Problem",
      "",
      "One two three.",
      "",
      "<div>markup words</div>",
      "",
      "Inline `code words` are excluded.",
      "",
      "## AI Prompts to Build This",
      "",
      "```text",
      "prompt words are code",
      "```",
      "",
      "```text",
      "another prompt",
      "```",
    ].join("\n");
    const counts = measureContent(markdown);
    expect(counts.codeBlocks).toBe(2);
    expect(counts.prompts).toBe(2);
    // "The Problem" + "One two three." + "Inline" + "are excluded." + "AI Prompts to Build This"
    expect(counts.proseWords).toBe(2 + 3 + 1 + 2 + 5);
    expect(countWords("don’t stop — e-mail 3.5 times")).toBe(5);
  });
});

describe("artifact and review dependencies", () => {
  async function fixture() {
    const envelope = await buildFixtureEnvelope(receiptSplitter, {
      submissionId: "domain-test",
      nowMs: Date.parse("2026-09-27T12:00:00Z"),
      policyVersion: "test",
      producer: "engine",
    });
    const sources: EditorialSource[] = envelope.sources.map((source) => ({
      ...source,
      excerptHash: null,
      verificationAuthority: "fixture_simulated",
    }));
    const claims: EditorialClaim[] = envelope.claims.map((claim) => ({
      ...claim,
      verificationAuthority: "fixture_simulated",
    }));
    return { envelope, sources, claims };
  }

  async function items(markdown: string, sources: EditorialSource[], claims: EditorialClaim[], title = "T") {
    const hashes = await computeRevisionHashes({ title, markdown, metadata: (await fixture()).envelope.metadata, sources, claims });
    const sections = sectionsByKey(splitSections(markdown));
    const list = await deriveReviewItems({
      sections,
      claims: claims.map((claim) => ({ ...claim, anchorPresent: true })),
      sources,
      metadataHash: hashes.metadata,
      artifactHash: hashes.artifact,
    });
    return { hashes, byId: new Map(list.map((item) => [item.id, item.dependencyHash])) };
  }

  test("verification changes the assessment and claim/source items, never the artifact", async () => {
    const { envelope, sources, claims } = await fixture();
    const before = await items(envelope.markdown, sources, claims);
    const changedSources = sources.map((source, index) =>
      index === 0 ? { ...source, verification: { ...source.verification, status: "changed" as const } } : source,
    );
    const after = await items(envelope.markdown, changedSources, claims);
    expect(after.hashes.artifact).toBe(before.hashes.artifact);
    expect(await assessmentDigest(changedSources, claims)).not.toBe(await assessmentDigest(sources, claims));
    expect(after.byId.get(`source:${sources[0].id}`)).not.toBe(before.byId.get(`source:${sources[0].id}`));
    const claimOnFirstSource = claims.find((claim) => claim.sourceIds.includes(sources[0].id));
    if (claimOnFirstSource) {
      expect(after.byId.get(`claim:${claimOnFirstSource.id}`)).not.toBe(before.byId.get(`claim:${claimOnFirstSource.id}`));
    }
    expect(after.byId.get("section:problem")).toBe(before.byId.get("section:problem"));
  });

  test("one edited section changes that section, the content hash and the preview only", async () => {
    const { envelope, sources, claims } = await fixture();
    const before = await items(envelope.markdown, sources, claims);
    const edited = envelope.markdown.replace("## Recommended Tech Stack\n", "## Recommended Tech Stack\n\n- Extra line\n");
    const after = await items(edited, sources, claims);
    const changed = [...before.byId.keys()].filter((id) => before.byId.get(id) !== after.byId.get(id));
    expect(changed.sort()).toEqual(["preview", "section:tech-stack"]);
  });

  test("a title change is a metadata change", async () => {
    const { envelope, sources, claims } = await fixture();
    const before = await items(envelope.markdown, sources, claims, "Original title");
    const after = await items(envelope.markdown, sources, claims, "New title");
    const changed = [...before.byId.keys()].filter((id) => before.byId.get(id) !== after.byId.get(id));
    expect(changed.sort()).toEqual(["metadata", "preview"]);
  });

  test("the builder output keeps the eight-heading shape", () => {
    const sections = splitSections(buildArticleMarkdown(receiptSplitter)).blocks.map((block) => block.key);
    expect(sections).toEqual([
      "problem",
      "solution",
      "market",
      "competition",
      "business-model",
      "tech-stack",
      "prompts",
      "sources",
    ]);
  });
});
