import { ConvexError } from "convex/values";
import type { LaunchView } from "@/lib/workspace/crew/launch";

/**
 * Launch-state helpers shared by Meet your co-founder (`teamView`,
 * `teamAnnouncement`, `launchErrorMessage`, `launchStateKey`). The old "Your
 * team" card that lived here is gone: Meet draws the T1 screen and Team HQ
 * draws its own.
 */

export type TeamView = "assembling" | "start_failed" | "failed" | "terminal" | "ready";

export function teamView(launch: LaunchView | undefined, error: string | null): TeamView {
  if (launch === undefined || launch.state === "not_started") return error === null ? "assembling" : "start_failed";
  if (launch.state === "assembling") return "assembling";
  if (launch.state === "failed") return launch.retryable ? "failed" : "terminal";
  return "ready";
}

/** What the polite live region says for each state (always mounted, so each change is read once). */
export function teamAnnouncement(launch: LaunchView | undefined, partnerName: string, error: string | null = null): string {
  switch (teamView(launch, error)) {
    case "assembling":
      return `${partnerName} is putting your team together.`;
    case "start_failed":
      return `${partnerName} could not start putting your team together. You can try again.`;
    case "failed":
      return launch?.state === "failed" && launch.paused
        ? `${partnerName} paused putting your team together. You can try again.`
        : `${partnerName} could not put your team together. You can try again.`;
    case "terminal":
      return `${partnerName} could not put your team together for this business.`;
    case "ready":
      return launch?.state === "ready"
        ? `Your team is ready: ${launch.hired.length} hired, ${launch.skipped.length} skipped for now.`
        : "";
  }
}

const LAUNCH_ERROR_COPY: Record<string, string> = {
  AI_DISABLED: "AI work is switched off right now. Try again later.",
  WORKSPACE_DISABLED: "Building is switched off right now. Try again later.",
  UNAUTHENTICATED: "Your session ended. Sign in again to carry on.",
  RESOURCE_NOT_FOUND: "We could not find this business.",
};

/** A start or retry refusal in plain words; never the raw error. */
export function launchErrorMessage(error: unknown): string {
  if (error instanceof ConvexError && typeof error.data === "object" && error.data !== null) {
    const data: { code?: unknown; kind?: unknown } = error.data;
    if (data.kind === "RateLimited") return "You have started a lot of crew work this hour. Try again in a little while.";
    if (typeof data.code === "string" && LAUNCH_ERROR_COPY[data.code]) return LAUNCH_ERROR_COPY[data.code];
  }
  return "Something went wrong. Try again.";
}

/** The launch state a refusal belongs to: loading and not started are the same (nothing started yet). */
export function launchStateKey(launch: LaunchView | undefined): string {
  if (launch === undefined || launch.state === "not_started") return "not_started";
  return launch.state === "failed" ? `failed:${launch.paused}:${launch.retryable}` : launch.state;
}
