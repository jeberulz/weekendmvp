"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { saveDraftAction } from "@/app/admin/editorial/_actions/draft";
import type { SaveDraftPatch } from "@/lib/editorial/contracts/commands";
import type { RevisionView } from "@/lib/editorial/contracts/views";
import {
  SaveController,
  type DraftContent,
  type SaveControllerState,
  type SaveOutcome,
  type SaveRequest,
} from "@/lib/editorial/editor/save-controller";

export function contentOf(view: RevisionView): DraftContent {
  return { title: view.title, markdown: view.markdown, metadata: view.metadata };
}

function newKey(): string {
  return crypto.randomUUID();
}

/** One autosave request through the server action, mapped to a controller outcome. */
async function sendSave(
  ideaId: string,
  revisionId: string,
  request: SaveRequest,
  onView: (view: RevisionView) => void,
): Promise<SaveOutcome> {
  const patch: SaveDraftPatch = {
    ...(request.changed.title ? { title: request.content.title } : {}),
    ...(request.changed.markdown ? { markdown: request.content.markdown } : {}),
    ...(request.changed.metadata ? { metadata: request.content.metadata } : {}),
  };
  let result: Awaited<ReturnType<typeof saveDraftAction>>;
  try {
    result = await saveDraftAction({
      ideaId,
      revisionId,
      baseVersion: request.baseVersion,
      patch,
      idempotencyKey: request.idempotencyKey,
    });
  } catch {
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    return { kind: "unreachable", message: offline ? "You are offline." : "The server could not be reached." };
  }
  if (result.ok) {
    onView(result.value.view);
    return { kind: "saved", version: result.value.ack.version, savedAt: result.value.ack.savedAt };
  }
  const { code, message, conflict } = result.error;
  if (conflict && (code === "VERSION_CONFLICT" || code === "REVISION_READ_ONLY")) {
    // A draft that was approved, discarded or replaced elsewhere cannot take "keep mine".
    return { kind: "conflict", conflict: code === "REVISION_READ_ONLY" ? { ...conflict, frozen: true } : conflict };
  }
  return { kind: "rejected", code, message };
}

type DraftStore = {
  controller: SaveController;
  subscribe(listener: () => void): () => void;
  getSnapshot(): SaveControllerState;
};

function createStore(view: RevisionView, onView: (view: RevisionView) => void): DraftStore {
  const listeners = new Set<() => void>();
  const controller = new SaveController(
    {
      baseVersion: view.version,
      content: contentOf(view),
      lastSavedAt: view.updatedAt,
      readOnlyReason: view.readOnly ? (view.readOnlyReason ?? "This revision is read-only.") : null,
    },
    {
      send: (request) => sendSave(view.ideaId, view.id, request, onView),
      schedule: (callback, ms) => window.setTimeout(callback, ms),
      cancel: (handle) => window.clearTimeout(handle),
      newKey,
      onChange: () => {
        for (const listener of listeners) listener();
      },
    },
  );
  return {
    controller,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => controller.getState(),
  };
}

/**
 * The editor's save state. Text lives in memory only (never browser
 * storage); `reset` starts over from a fresh server view. `onView` receives
 * the server's view after each acknowledged save and must be stable (a
 * state setter).
 */
export function useDraftSaver(initial: RevisionView, onView: (view: RevisionView) => void) {
  const [store, setStore] = useState(() => createStore(initial, onView));
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  useEffect(() => {
    const online = () => store.controller.setOnline(true);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("online", online);
      // Pausing (not disposing) survives React re-running effects in development.
      store.controller.pause();
    };
  }, [store]);

  const reset = useCallback(
    (view: RevisionView) => {
      store.controller.dispose();
      setStore(createStore(view, onView));
    },
    [store, onView],
  );

  return { state, controller: store.controller, reset };
}
