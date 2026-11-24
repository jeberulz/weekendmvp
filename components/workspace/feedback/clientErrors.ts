import type { ErrorSource } from "@/lib/feedback/contracts";
import { errorClassOf, sanitizeRoute } from "@/lib/feedback/contracts";
import { BUILD_VERSION } from "@/components/workspace/feedback/buildVersion";

/**
 * WP95-S3. Browser side of the private error log.
 *
 * `reportClientError` can be called from anywhere (a boundary, a catch block)
 * without a Convex hook: `ErrorReporterMount`, rendered once inside the Convex
 * provider, registers the real mutation. A report made before that is queued
 * (a handful at most). A report never throws and never waits, and what it
 * sends is the source, the error class, the route and the business id from the
 * path: never a message, a stack or text the founder typed.
 */

export type ErrorReport = {
  readonly source: ErrorSource;
  readonly errorClass: string;
  readonly route: string;
  readonly projectId?: string;
  readonly buildVersion: string;
  readonly dedupeKey?: string;
};

export type ErrorReporter = (report: ErrorReport) => Promise<unknown>;

const QUEUE_MAX = 5;
/** The same source, class and route within this window is one error. */
const REPEAT_WINDOW_MS = 5_000;

let reporter: ErrorReporter | null = null;
const queue: ErrorReport[] = [];
const recent = new Map<string, number>();

/** The business id in a workspace path (`/dashboard/b/{id}/…`), else undefined. */
export function projectIdFromPath(pathname: string): string | undefined {
  const match = /^\/dashboard\/b\/([a-z0-9]{20,})(?:\/|$)/.exec(pathname);
  return match?.[1];
}

function send(report: ErrorReport): void {
  const active = reporter;
  if (active === null) {
    if (queue.length < QUEUE_MAX) queue.push(report);
    return;
  }
  try {
    void active(report).catch(() => undefined);
  } catch {
    // A failure to report is not the founder's problem.
  }
}

/** Registers the mutation, flushes anything queued, and returns the unregister function. */
export function registerErrorReporter(next: ErrorReporter): () => void {
  reporter = next;
  for (const queued of queue.splice(0)) send(queued);
  return () => {
    if (reporter === next) reporter = null;
  };
}

export function reportClientError(input: {
  source: ErrorSource;
  /** The thrown value; its class is read from its shape. Omit when `errorClass` says it. */
  error?: unknown;
  /** A fixed class for a failure that was not thrown (a Wren reply that ended as failed). */
  errorClass?: string;
  dedupeKey?: string;
  /** Pass for a business the path does not name; the path's own id is used otherwise. */
  projectId?: string;
}): void {
  if (typeof window === "undefined") return;
  try {
    const pathname = window.location.pathname;
    const errorClass = input.errorClass ?? errorClassOf(input.error);
    const route = sanitizeRoute(pathname);
    const key = `${input.source}|${errorClass}|${route}|${input.dedupeKey ?? ""}`;
    const now = Date.now();
    const last = recent.get(key);
    if (last !== undefined && now - last < REPEAT_WINDOW_MS) return;
    recent.set(key, now);
    if (recent.size > 50) recent.delete(recent.keys().next().value ?? key);
    const projectId = input.projectId ?? projectIdFromPath(pathname);
    send({
      source: input.source,
      errorClass,
      route,
      ...(projectId === undefined ? {} : { projectId }),
      buildVersion: BUILD_VERSION,
      ...(input.dedupeKey === undefined ? {} : { dedupeKey: input.dedupeKey }),
    });
  } catch {
    // Reporting must never throw into the code that is already handling an error.
  }
}

/** Test seam: forget the queue, the repeat window and the reporter. */
export function resetClientErrorsForTests(): void {
  reporter = null;
  queue.length = 0;
  recent.clear();
}
