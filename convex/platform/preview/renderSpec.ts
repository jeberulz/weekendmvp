import { ConvexError, v, type Infer } from "convex/values";
import {
  parseSiteInputPayload,
  type SiteInputPayload,
} from "../engine/contracts";
import { assertGeneratedDocumentBody } from "../validators";

/**
 * WP27-S1. The render spec is the contract WP27's templates render from.
 *
 * Template choice is a *rendering* property, not content, so it deliberately
 * does not live inside WP26-S1's frozen `SiteInputPayload` (which stays at
 * v1, unchanged) and needs no `templateId` column on the frozen
 * `site_configs`. Wrapping instead of amending also carries the selection
 * through the anonymous -> claimed transition for free, because the wrapper
 * is what gets persisted in both places.
 *
 * The enum is defined here rather than in the WP22-frozen
 * `platform/validators.ts` so that WP27's only edit to a frozen file is the
 * one owner-authorized `preview_capabilities` table in `schema.ts`.
 */

export const PREVIEW_TEMPLATE_VALUES = [
  "editorial",
  "product",
  "minimal",
] as const;

export const previewTemplateValidator = v.union(
  v.literal("editorial"),
  v.literal("product"),
  v.literal("minimal"),
);

export type PreviewTemplate = Infer<typeof previewTemplateValidator>;

export const SITE_RENDER_SPEC_CONTRACT_VERSION = 1;

export type SiteRenderSpec = {
  contractVersion: 1;
  templateId: PreviewTemplate;
  siteInput: SiteInputPayload;
};

function fail(code: string, extra?: Record<string, unknown>): never {
  throw new ConvexError({ code, ...extra });
}

/**
 * The template set is a closed enum checked against a literal allowlist. It
 * is never a free string: a caller-supplied template identifier that reached
 * a component lookup or a path would be an arbitrary-render primitive, which
 * is exactly what the manifest's structured-content guardrail exists to
 * prevent.
 */
export function isPreviewTemplate(value: unknown): value is PreviewTemplate {
  return (
    typeof value === "string" &&
    (PREVIEW_TEMPLATE_VALUES as readonly string[]).includes(value)
  );
}

export function parseSiteRenderSpec(body: string | undefined): SiteRenderSpec {
  if (!body) fail("INVALID_SITE_RENDER_SPEC");
  // Enforced on read as well as write. The schema stores `renderSpec` as a
  // bare `v.string()` and cannot compel a writer to go through
  // `serializeSiteRenderSpec`, so the ceiling has to hold on the way out too
  // — otherwise an oversized row parses happily on every anonymous read.
  assertGeneratedDocumentBody(body);
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    fail("INVALID_SITE_RENDER_SPEC");
  }
  if (typeof value !== "object" || value === null) {
    fail("INVALID_SITE_RENDER_SPEC");
  }
  const record = value as Record<string, unknown>;
  if (record.contractVersion !== SITE_RENDER_SPEC_CONTRACT_VERSION) {
    fail("UNSUPPORTED_SITE_RENDER_SPEC_CONTRACT_VERSION", {
      received: record.contractVersion,
    });
  }
  if (!isPreviewTemplate(record.templateId)) {
    fail("UNKNOWN_PREVIEW_TEMPLATE");
  }
  // Delegate rather than re-validate: the nested payload must satisfy the
  // exact frozen WP26-S1 contract, including its citation and completeness
  // rules, so a spec can never carry content the report contract rejects.
  parseSiteInputPayload(JSON.stringify(record.siteInput));
  return value as SiteRenderSpec;
}

export function serializeSiteRenderSpec(spec: SiteRenderSpec): string {
  if (spec.contractVersion !== SITE_RENDER_SPEC_CONTRACT_VERSION) {
    fail("UNSUPPORTED_SITE_RENDER_SPEC_CONTRACT_VERSION", {
      received: spec.contractVersion,
    });
  }
  // Round-trip through the reader so a spec that would fail to parse can
  // never be persisted, even when constructed in code rather than parsed.
  const body = JSON.stringify(spec);
  parseSiteRenderSpec(body);
  // Reuse the WP22 generated-document ceiling: a render spec is stored
  // generated content and gets the same byte-accurate cap.
  return assertGeneratedDocumentBody(body);
}
