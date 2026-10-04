import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

import { editorialSubmissionSchema, type EditorialSubmission } from "../lib/editorial/contracts/submission";
import { editorialMetadataSchema } from "../lib/editorial/contracts/metadata";
import { submissionArtifactHash } from "../lib/editorial/domain/artifact";

type LegacyManifestIdea = {
  slug?: unknown;
  title?: unknown;
  description?: unknown;
  category?: unknown;
  buildTime?: unknown;
  revenueGoal?: unknown;
  tools?: unknown;
  audiences?: unknown;
  highlights?: unknown;
  og?: unknown;
  publishedAt?: unknown;
};

export type LegacyImportEntry = {
  slug: string;
  envelope: EditorialSubmission;
};

export type LegacyImportInventory = {
  source: string;
  digest: string;
  total: number;
  entries: LegacyImportEntry[];
  skipped: Array<{ slug: string; reason: string }>;
};

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Read only the canonical checked-in legacy content. This importer never
 * reconstructs a page from public HTML or substitutes a different body when
 * its MDX file is absent. The live deployment must be checked separately.
 */
export async function inventoryLegacyIdeas(root: string): Promise<LegacyImportInventory> {
  const raw = JSON.parse(await readFile(path.join(root, "ideas/manifest.json"), "utf8")) as { ideas?: unknown };
  if (!Array.isArray(raw.ideas)) throw new Error("Idea manifest has no ideas array.");
  const entries: LegacyImportEntry[] = [];
  const skipped: LegacyImportInventory["skipped"] = [];
  const seen = new Set<string>();

  for (const value of raw.ideas) {
    const idea = value as LegacyManifestIdea;
    const slug = typeof idea?.slug === "string" ? idea.slug : "(missing-slug)";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || seen.has(slug)) {
      skipped.push({ slug, reason: "invalid or duplicate manifest slug" });
      continue;
    }
    seen.add(slug);

    let file: string;
    try {
      file = await readFile(path.join(root, "content/ideas", `${slug}.mdx`), "utf8");
    } catch {
      skipped.push({ slug, reason: "canonical MDX body missing" });
      continue;
    }
    const parsed = matter(file);
    if (parsed.data.slug !== slug || parsed.data.title !== idea.title) {
      skipped.push({ slug, reason: "MDX frontmatter disagrees with manifest" });
      continue;
    }

    const og = idea.og && typeof idea.og === "object" ? idea.og as Record<string, unknown> : null;
    const highlights = idea.highlights && typeof idea.highlights === "object" && !Array.isArray(idea.highlights)
      ? idea.highlights as Record<string, unknown>
      : null;
    const metadataResult = editorialMetadataSchema.safeParse({
      description: idea.description,
      category: idea.category,
      buildTime: idea.buildTime,
      revenueGoal: idea.revenueGoal,
      tools: idea.tools,
      audiences: idea.audiences,
      // Public legacy cards may omit competitor tiles entirely. The editorial
      // contract represents that absence as null rather than invented entries.
      highlights: highlights && !("competitors" in highlights)
        ? { ...highlights, competitors: null }
        : idea.highlights ?? null,
      // Pending legacy cards have no subject; they are not an editorial input.
      og: og && typeof og.subject === "string" && og.subject.trim() !== ""
        ? { subject: og.subject, accent: og.accent }
        : null,
    });
    if (!metadataResult.success) {
      skipped.push({ slug, reason: `metadata invalid: ${metadataResult.error.issues.map((issue) => issue.path.join(".")).join(", ")}` });
      continue;
    }

    const title = idea.title as string;
    const markdown = parsed.content;
    const metadata = metadataResult.data;
    const sources: EditorialSubmission["sources"] = [];
    const claims: EditorialSubmission["claims"] = [];
    const envelope: EditorialSubmission = {
      contractVersion: 1,
      submissionId: `legacy-${digest(slug).slice(0, 40)}`,
      producer: "legacy-import",
      mode: "legacy",
      engineRunId: null,
      engineContractVersion: null,
      artifactHash: await submissionArtifactHash({ title, markdown, metadata, sources, claims }),
      title,
      proposedSlug: slug,
      // These were never structured in the legacy manifest. Explicit unknowns
      // avoid making up editorial facts from the article body.
      buyer: "Not recorded in legacy source",
      job: "Not recorded in legacy source",
      wedge: "Not recorded in legacy source",
      recommendation: "unknown",
      recommendationReasons: [],
      markdown,
      metadata,
      sources,
      claims,
      checks: [],
      legacy: {
        firstPublishedAt: typeof idea.publishedAt === "string" ? idea.publishedAt : null,
        bodyOrigin: "mdx",
      },
    };
    const validation = editorialSubmissionSchema.safeParse(envelope);
    if (!validation.success) {
      skipped.push({ slug, reason: `submission invalid: ${validation.error.issues.map((issue) => issue.path.join(".")).join(", ")}` });
      continue;
    }
    entries.push({ slug, envelope: validation.data });
  }

  entries.sort((a, b) => a.slug.localeCompare(b.slug));
  const inventoryDigest = digest(JSON.stringify(entries.map(({ slug, envelope }) => [slug, envelope.artifactHash])));
  return {
    source: "ideas/manifest.json + content/ideas/*.mdx",
    digest: inventoryDigest,
    total: raw.ideas.length,
    entries,
    skipped,
  };
}
