import { COLD_OBJECT_LABEL } from "./signed-in-chrome";
import { getCreditPack } from "../convex/platform/billing/catalog";

export const PUBLISH_PACK_ID = "starter" as const;

export const LIBRARY_SORTS = ["score", "newest"] as const;
export type LibrarySort = (typeof LIBRARY_SORTS)[number];

export const LIBRARY_CATEGORIES = [
  "ai-tools",
  "automation",
  "b2b",
  "creator-tools",
  "developer-tools",
  "ecommerce",
  "education",
  "fintech",
  "health",
  "marketplace",
  "productivity",
  "saas",
] as const;

export type HomeKind = "cold" | "day1" | "dayn";

export function chromeObjectLabel(state: {
  kind: HomeKind;
  title?: string;
  hostname?: string;
}): string {
  if (state.kind === "dayn" && state.hostname) return state.hostname;
  if (state.kind !== "cold" && state.title) return state.title;
  return COLD_OBJECT_LABEL;
}

export function publishPriceLabel(): string {
  const pack = getCreditPack(PUBLISH_PACK_ID);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(pack.amountMinor / 100);
}

export function dollarsFromMinor(amountMinor: bigint | number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(amountMinor) / 100);
}

export function isLibrarySort(value: string | null): value is LibrarySort {
  return value === "score" || value === "newest";
}

export function isLibraryCategory(
  value: string | null,
): value is (typeof LIBRARY_CATEGORIES)[number] {
  return (
    typeof value === "string" &&
    (LIBRARY_CATEGORIES as readonly string[]).includes(value)
  );
}

export function asProjectIdParam(value: string | null): string | undefined {
  if (!value || !/^[a-z0-9]+$/i.test(value) || value.length < 10) {
    return undefined;
  }
  return value;
}
