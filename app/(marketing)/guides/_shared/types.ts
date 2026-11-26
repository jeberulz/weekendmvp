/**
 * Types for the shared guide blocks (WP103). `GuideSpec` is inferred from the zod schema in
 * `lib/guides/spec-schema.ts`, so the type and the audit cannot drift.
 */
import type { GuideSpec } from "@/lib/guides/spec-schema";

export type { GuideSpec };

/** A copy deck: slot name to prose. Slot names follow `lib/guides/slots.ts`. */
export type GuideDeck = Readonly<Record<string, string>>;

export type GuideSectionDef = GuideSpec["sections"][number];

/** The serialisable slice of a section that client components receive. */
export type GuideNavSection = { id: string; title: string };

/** Gate copy and links. The `mode` flag stays on the server. */
export type GuideGateConfig = Omit<GuideSpec["gate"], "mode">;
