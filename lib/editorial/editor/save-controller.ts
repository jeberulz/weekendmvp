import type { DraftConflict } from "../contracts/errors";
import type { EditorialMetadata } from "../contracts/metadata";

/**
 * Autosave state machine for one draft, independent of React and the
 * network so every transition is unit-testable with a fake scheduler.
 *
 * Guarantees:
 * - "Saved" only after the server acknowledged exactly the content shown.
 * - Every save carries the server version it was based on; a stale base
 *   becomes a visible conflict, never last-write-wins.
 * - A save whose outcome is unknown (network drop, lost acknowledgement) is
 *   retried with the SAME idempotency key before any newer text is sent, so
 *   a save that did land is recognised instead of conflicting with itself.
 * - Nothing is written to browser storage; unsaved text lives in memory and
 *   the page warns before it is lost.
 */

export type DraftContent = {
  title: string;
  markdown: string;
  metadata: EditorialMetadata;
};

export type SaveStatus = "saved" | "dirty" | "saving" | "offline" | "error" | "conflict" | "read_only";

export type SaveRequest = {
  baseVersion: number;
  content: DraftContent;
  changed: { title: boolean; markdown: boolean; metadata: boolean };
  idempotencyKey: string;
};

export type SaveOutcome =
  | { kind: "saved"; version: number; savedAt: string }
  | { kind: "conflict"; conflict: DraftConflict }
  | { kind: "rejected"; code: string; message: string }
  | { kind: "unreachable"; message: string };

export type SaveControllerState = {
  status: SaveStatus;
  baseVersion: number;
  saved: DraftContent;
  current: DraftContent;
  lastSavedAt: string | null;
  conflict: DraftConflict | null;
  error: { code: string; message: string } | null;
  readOnlyReason: string | null;
  /** Consecutive unreachable attempts for the unresolved save. */
  attempts: number;
};

export type SaveControllerDeps = {
  send(request: SaveRequest): Promise<SaveOutcome>;
  schedule(callback: () => void, ms: number): number;
  cancel(handle: number): void;
  newKey(): string;
  onChange(state: SaveControllerState): void;
  idleMs?: number;
  maxWaitMs?: number;
};

export const RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 16_000, 30_000] as const;

export function sameContent(a: DraftContent, b: DraftContent): boolean {
  return a.title === b.title && a.markdown === b.markdown && JSON.stringify(a.metadata) === JSON.stringify(b.metadata);
}

/** Anything the server has not acknowledged, or anything it refused. */
export function hasUnsavedChanges(state: SaveControllerState): boolean {
  return state.status === "dirty" || state.status === "saving" || state.status === "offline" || state.status === "error" || state.status === "conflict";
}

export class SaveController {
  private state: SaveControllerState;
  private readonly deps: Required<Pick<SaveControllerDeps, "idleMs" | "maxWaitMs">> & SaveControllerDeps;
  private idleTimer: number | null = null;
  private maxTimer: number | null = null;
  private retryTimer: number | null = null;
  private inFlight: SaveRequest | null = null;
  /** A save whose outcome is unknown; resolved before anything newer is sent. */
  private unresolved: SaveRequest | null = null;
  private flushQueued = false;
  /** "Keep mine" sends every field, so nothing of the newer server copy survives by accident. */
  private forceFull = false;
  private disposed = false;

  constructor(
    initial: { baseVersion: number; content: DraftContent; lastSavedAt: string | null; readOnlyReason: string | null },
    deps: SaveControllerDeps,
  ) {
    this.deps = { idleMs: 1_500, maxWaitMs: 10_000, ...deps };
    this.state = {
      status: initial.readOnlyReason ? "read_only" : "saved",
      baseVersion: initial.baseVersion,
      saved: initial.content,
      current: initial.content,
      lastSavedAt: initial.lastSavedAt,
      conflict: null,
      error: null,
      readOnlyReason: initial.readOnlyReason,
      attempts: 0,
    };
  }

  getState(): SaveControllerState {
    return this.state;
  }

  private set(patch: Partial<SaveControllerState>): void {
    this.state = { ...this.state, ...patch };
    this.deps.onChange(this.state);
  }

  private clearTimer(name: "idleTimer" | "maxTimer" | "retryTimer"): void {
    const handle = this[name];
    if (handle !== null) this.deps.cancel(handle);
    this[name] = null;
  }

  /** The editor changed. Nothing is sent until the writer pauses. */
  edit(next: Partial<DraftContent>): void {
    if (this.disposed || this.state.status === "read_only") return;
    const current = { ...this.state.current, ...next };
    const busy = this.state.status === "saving" || this.state.status === "offline";
    const status: SaveStatus =
      this.state.status === "conflict"
        ? "conflict"
        : busy
          ? this.state.status
          : sameContent(current, this.state.saved)
            ? "saved"
            : "dirty";
    this.set({ current, status, error: status === "dirty" ? null : this.state.error });
    if (this.state.status === "conflict") return;
    this.clearTimer("idleTimer");
    this.idleTimer = this.deps.schedule(() => {
      this.idleTimer = null;
      void this.flush();
    }, this.deps.idleMs);
    if (this.maxTimer === null) {
      this.maxTimer = this.deps.schedule(() => {
        this.maxTimer = null;
        void this.flush();
      }, this.deps.maxWaitMs);
    }
  }

  /** Cmd/Ctrl-S or the Save button: send now. */
  saveNow(): Promise<void> {
    this.clearTimer("idleTimer");
    this.clearTimer("maxTimer");
    if (this.state.status === "error") this.set({ status: "dirty", error: null });
    return this.flush();
  }

  /** Try the unresolved save again immediately (the "Retry" button, or back online). */
  retryNow(): Promise<void> {
    this.clearTimer("retryTimer");
    return this.flush();
  }

  setOnline(online: boolean): void {
    if (online && this.state.status === "offline") void this.retryNow();
  }

  /** Conflict: overwrite the newer server text with this editor's text. */
  keepMine(): Promise<void> {
    const conflict = this.state.conflict;
    if (!conflict || conflict.frozen) return Promise.resolve();
    this.forceFull = true;
    this.set({
      status: "dirty",
      conflict: null,
      baseVersion: conflict.latestVersion,
      saved: { ...this.state.saved, title: conflict.title, markdown: conflict.markdown },
    });
    return this.flush();
  }

  /** Conflict: discard this editor's text and continue from the server copy. */
  useTheirs(): void {
    const conflict = this.state.conflict;
    if (!conflict) return;
    const theirs = { ...this.state.current, title: conflict.title, markdown: conflict.markdown };
    this.set({
      status: conflict.frozen ? "read_only" : "saved",
      conflict: null,
      baseVersion: conflict.latestVersion,
      saved: theirs,
      current: theirs,
      lastSavedAt: conflict.savedAt,
      readOnlyReason: conflict.frozen ? "This revision was approved in another session. Create a revision to edit." : null,
    });
  }

  markReadOnly(reason: string): void {
    this.clearTimer("idleTimer");
    this.clearTimer("maxTimer");
    this.clearTimer("retryTimer");
    this.set({ status: "read_only", readOnlyReason: reason });
  }

  /**
   * Stop pending timers without discarding anything (the editor unmounted,
   * or React re-ran its effects). The next edit, save or retry resumes.
   */
  pause(): void {
    this.clearTimer("idleTimer");
    this.clearTimer("maxTimer");
    this.clearTimer("retryTimer");
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimer("idleTimer");
    this.clearTimer("maxTimer");
    this.clearTimer("retryTimer");
  }

  private buildRequest(): SaveRequest | null {
    const { current, saved } = this.state;
    const force = this.forceFull;
    this.forceFull = false;
    const changed = {
      title: force || current.title !== saved.title,
      markdown: force || current.markdown !== saved.markdown,
      metadata: force || JSON.stringify(current.metadata) !== JSON.stringify(saved.metadata),
    };
    if (!changed.title && !changed.markdown && !changed.metadata) return null;
    return { baseVersion: this.state.baseVersion, content: current, changed, idempotencyKey: this.deps.newKey() };
  }

  private async flush(): Promise<void> {
    if (this.disposed) return;
    // A refused save waits for an explicit retry or a new edit.
    if (this.state.status === "conflict" || this.state.status === "read_only" || this.state.status === "error") return;
    if (this.inFlight) {
      this.flushQueued = true;
      return;
    }
    const request = this.unresolved ?? this.buildRequest();
    if (!request) {
      if (this.state.status !== "saved") this.set({ status: "saved", error: null });
      return;
    }
    // Sending now: pending autosave timers are moot until the next edit.
    this.clearTimer("idleTimer");
    this.clearTimer("maxTimer");
    this.inFlight = request;
    this.set({ status: "saving", error: null });
    let outcome: SaveOutcome;
    try {
      outcome = await this.deps.send(request);
    } catch (error) {
      outcome = { kind: "unreachable", message: error instanceof Error ? error.message : "Network error" };
    }
    this.inFlight = null;
    if (this.disposed) return;
    this.apply(request, outcome);
  }

  private apply(request: SaveRequest, outcome: SaveOutcome): void {
    switch (outcome.kind) {
      case "saved": {
        this.unresolved = null;
        this.clearTimer("retryTimer");
        const upToDate = sameContent(this.state.current, request.content);
        this.set({
          status: upToDate ? "saved" : "dirty",
          baseVersion: outcome.version,
          saved: request.content,
          lastSavedAt: outcome.savedAt,
          attempts: 0,
          error: null,
        });
        if (!upToDate || this.flushQueued) {
          this.flushQueued = false;
          void this.flush();
        }
        return;
      }
      case "conflict": {
        this.unresolved = null;
        this.flushQueued = false;
        this.clearTimer("idleTimer");
        this.clearTimer("maxTimer");
        this.clearTimer("retryTimer");
        this.set({ status: "conflict", conflict: outcome.conflict, attempts: 0 });
        return;
      }
      case "rejected": {
        this.unresolved = null;
        this.flushQueued = false;
        this.set({ status: "error", error: { code: outcome.code, message: outcome.message }, attempts: 0 });
        return;
      }
      case "unreachable": {
        // The server may or may not have applied it: keep the exact request.
        this.unresolved = request;
        const attempts = this.state.attempts + 1;
        const delay = RETRY_DELAYS_MS[Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)];
        this.set({ status: "offline", attempts, error: { code: "UNREACHABLE", message: outcome.message } });
        this.clearTimer("retryTimer");
        this.retryTimer = this.deps.schedule(() => {
          this.retryTimer = null;
          void this.flush();
        }, delay);
        return;
      }
    }
  }
}
