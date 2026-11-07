import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

export type BrandKitView = FunctionReturnType<typeof api.growth.drafts.brandKit.brandKitDraft>;
export type ReadyView = Extract<BrandKitView, { state: "ready" }>;
export type Kit = ReadyView["kit"];

/**
 * Tailwind reads class names as whole strings, so each palette role's tile fill is written out here, never built.
 * The fills read the `--t-*` variables the scoped kit stylesheet defines. Ink uses `--t-dark`: it is the kit's ink
 * unless the contrast check fell back, in which case the tile shows the fallback and the hex is left off.
 */
export const ROLE_FILL = {
  primary: "bg-(--t-primary)",
  secondary: "bg-(--t-secondary)",
  accent: "bg-(--t-accent)",
  ground: "bg-(--t-ground)",
  ink: "bg-(--t-dark)",
} as const;

export const ROLE_VAR = {
  primary: "--t-primary",
  secondary: "--t-secondary",
  accent: "--t-accent",
  ground: "--t-ground",
  ink: "--t-dark",
} as const;
