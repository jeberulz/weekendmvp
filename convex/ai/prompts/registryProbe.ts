/**
 * WP71-S3. INTERNAL registry probe: not a crew prompt.
 *
 * Neither C-PROMPT nor `02` §5.3 names a first real spec (the crew prompts land
 * with the crew pipelines), so the registry ships with this minimal probe. It
 * gives the registry, the router and `scripts/check-prompt-versions.mjs` one
 * real entry to resolve, hash and lock. It is registered with `internal: true`
 * and no crew job may use it.
 *
 * Any change to the system text, the task template or the output schema needs a
 * version bump, then `node --experimental-strip-types
 * scripts/check-prompt-versions.mjs --write` to lock the new version.
 */

import { z } from "zod";

import { definePromptSpec } from "../../../lib/workspace/contracts/prompts.ts";

export type RegistryProbeInput = { readonly label: string };

export const registryProbeOutput = z.object({ echo: z.string().min(1).max(200) });

export type RegistryProbeOutput = z.infer<typeof registryProbeOutput>;

export const registryProbeSpec = definePromptSpec<RegistryProbeInput, RegistryProbeOutput>({
  id: "internal-registry-probe",
  version: 1,
  tier: "fast",
  effort: "low",
  thinking: { type: "disabled" },
  maxTokens: 256,
  system:
    "You are an internal registry probe for the Weekend MVP AI gateway. You are not a crew member. " +
    "Reply with only JSON that matches the required output schema.",
  buildUser: (inputs) => `Return JSON whose "echo" field is this label, unchanged:\n${inputs.label}`,
  outputSchema: registryProbeOutput,
  cacheLayout: { system: "stable", business: "none", ttl: "5m" },
  evalSuite: "internal-registry-probe",
  mode: "realtime",
  fallbacks: "none",
});
