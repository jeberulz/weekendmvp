import type { ComponentType, ReactNode } from "react";
import type { RoleKey } from "@/lib/workspace/contracts/roster";

/** Employee status set (Team HQ). One of three typed status sets. */
export const EMPLOYEE_STATUSES = ["queued", "working", "needs_you", "done"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

/** Output status set (workstream panel). */
export const OUTPUT_STATUSES = ["draft", "ready", "approved", "changes_requested"] as const;
export type OutputStatus = (typeof OUTPUT_STATUSES)[number];

/** Site status set. */
export const SITE_STATUSES = ["live"] as const;
export type SiteStatus = (typeof SITE_STATUSES)[number];

/** The eight workstream kinds drawn on the canvas (WP72 decision 2). */
export const WORKSTREAM_KINDS = [
  "brand",
  "landing",
  "seo",
  "marketing",
  "email",
  "social",
  "engineering",
  "ads",
] as const satisfies readonly RoleKey[];
export type WorkstreamKind = (typeof WORKSTREAM_KINDS)[number];

export const ROLE_LABELS: Record<RoleKey, string> = {
  lead: "Crew Lead",
  brand: "Brand",
  landing: "Landing",
  seo: "SEO",
  marketing: "Marketing",
  email: "Email",
  social: "Social",
  engineering: "Engineering",
  ads: "Ads",
  curriculum: "Curriculum",
  community: "Community",
  merch: "Merch",
  outbound: "Outbound",
};

/** Link-like component so pages can pass `next/link`; defaults to `<a>`. */
export type LinkComponent = ComponentType<{
  href: string;
  className?: string;
  children?: ReactNode;
}>;

export type EmployeeIdentity = {
  name: string;
  role: RoleKey;
};

/** Approval cost badge (WP72 decision 1). */
export type ApprovalCost =
  | { kind: "free" }
  | { kind: "credits"; credits: number; balance: number };

export type CostState = "free" | "credits" | "not-enough";

/** 0 credits counts as free. Over the balance is its own state. */
export function costState(cost: ApprovalCost): CostState {
  if (cost.kind === "free" || cost.credits <= 0) return "free";
  return cost.credits > cost.balance ? "not-enough" : "credits";
}

export function pluralize(count: number, one: string, many: string): string {
  return count === 1 ? `${count} ${one}` : `${count} ${many}`;
}

export function costLabel(cost: ApprovalCost): string {
  const state = costState(cost);
  if (state === "free" || cost.kind === "free") return "Free";
  const base = pluralize(cost.credits, "credit", "credits");
  return state === "not-enough" ? `${base} · not enough` : base;
}
