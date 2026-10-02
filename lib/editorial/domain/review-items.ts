import type { EditorialTarget } from "../contracts/errors";
import type { EditorialClaim, EditorialSource } from "../contracts/evidence";
import { displayDomain } from "../contracts/primitives";
import { SECTION_DEFINITIONS, type SectionKey } from "../contracts/sections";
import type { ReviewItemKind } from "../contracts/views";
import { claimContent, sourceContent } from "./artifact";
import { hashCanonical, sha256Hex } from "./hash";
import type { SectionBlock } from "./structure";

export type ReviewItemDefinition = {
  id: string;
  kind: ReviewItemKind;
  label: string;
  target: EditorialTarget | null;
  dependencyHash: string;
};

export type ReviewItemInput = {
  sections: ReadonlyMap<SectionKey, SectionBlock>;
  claims: readonly (EditorialClaim & { anchorPresent: boolean })[];
  sources: readonly EditorialSource[];
  metadataHash: string;
  artifactHash: string;
};

export function truncateLabel(text: string, max = 90): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

export async function sectionDependencyHash(key: SectionKey, block: SectionBlock): Promise<string> {
  return sha256Hex(`section|${key}|${block.title}|${block.body}`);
}

/**
 * Every item a reviewer must attest to before approval, with the hash of
 * exactly what the attestation covers:
 *
 * - each present section (its heading and body),
 * - each material observed/derived claim (wording, classification, anchor,
 *   supporting source content and every current verification result),
 * - all assumptions together, each source, the metadata, and the final
 *   preview of the whole artifact.
 *
 * Editing one section changes that section's hash and the preview hash; the
 * other sections' attestations stay valid because their hashes are equal.
 */
export async function deriveReviewItems(input: ReviewItemInput): Promise<ReviewItemDefinition[]> {
  const items: ReviewItemDefinition[] = [];
  const sourcesById = new Map(input.sources.map((source) => [source.id, source]));

  for (const definition of SECTION_DEFINITIONS) {
    const block = input.sections.get(definition.key);
    if (!block) continue;
    items.push({
      id: `section:${definition.key}`,
      kind: "section",
      label: definition.title,
      target: { kind: "section", id: definition.key },
      dependencyHash: await sectionDependencyHash(definition.key, block),
    });
  }

  for (const claim of input.claims) {
    if (!claim.material || claim.kind === "assumed") continue;
    const supporting = [...claim.sourceIds, ...claim.contradictingSourceIds]
      .map((id) => sourcesById.get(id))
      .filter((source): source is EditorialSource => source !== undefined)
      .map((source) => ({ content: sourceContent(source), verification: source.verification }));
    items.push({
      id: `claim:${claim.id}`,
      kind: "claim",
      label: truncateLabel(claim.text),
      target: { kind: "claim", id: claim.id },
      dependencyHash: await hashCanonical({
        content: claimContent(claim),
        verification: claim.verification,
        authority: claim.verificationAuthority,
        anchorPresent: claim.anchorPresent,
        sources: supporting,
      }),
    });
  }

  const assumptions = input.claims.filter((claim) => claim.kind === "assumed");
  if (assumptions.length > 0) {
    items.push({
      id: "assumptions",
      kind: "assumptions",
      label: `Assumptions and economics (${assumptions.length})`,
      target: null,
      dependencyHash: await hashCanonical({
        assumptions: assumptions.map((claim) => ({
          content: claimContent(claim),
          anchorPresent: claim.anchorPresent,
        })),
      }),
    });
  }

  for (const source of input.sources) {
    items.push({
      id: `source:${source.id}`,
      kind: "source",
      label: truncateLabel(`${source.publisher ?? displayDomain(source.url)} — ${source.title ?? source.url}`),
      target: { kind: "source", id: source.id },
      dependencyHash: await hashCanonical({
        content: sourceContent(source),
        verification: source.verification,
        authority: source.verificationAuthority,
      }),
    });
  }

  items.push({
    id: "metadata",
    kind: "metadata",
    label: "Title, description, tags and highlights",
    target: { kind: "metadata", id: "metadata" },
    dependencyHash: input.metadataHash,
  });
  items.push({
    id: "preview",
    kind: "preview",
    label: "Final preview of this exact revision",
    target: { kind: "artifact", id: "preview" },
    dependencyHash: input.artifactHash,
  });

  return items;
}
