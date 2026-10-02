import { describe, expect, test } from "vitest";

import type { EditorialMetadata } from "@/lib/editorial/contracts/metadata";
import {
  RETRY_DELAYS_MS,
  SaveController,
  hasUnsavedChanges,
  type DraftContent,
  type SaveOutcome,
  type SaveRequest,
} from "@/lib/editorial/editor/save-controller";

const METADATA: EditorialMetadata = {
  description: "A tool.",
  category: "saas",
  buildTime: "8",
  revenueGoal: "1k-month",
  tools: ["cursor", "claude"],
  audiences: ["freelancers", "creators"],
  highlights: null,
  og: null,
};

const INITIAL: DraftContent = { title: "Title", markdown: "## The Problem\nOriginal.", metadata: METADATA };

/** Deterministic timers: nothing runs until the test advances time. */
function fakeScheduler() {
  let now = 0;
  let nextHandle = 1;
  const timers = new Map<number, { at: number; callback: () => void }>();
  return {
    schedule(callback: () => void, ms: number) {
      const handle = nextHandle++;
      timers.set(handle, { at: now + ms, callback });
      return handle;
    },
    cancel(handle: number) {
      timers.delete(handle);
    },
    async advance(ms: number) {
      const target = now + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        now = due[1].at;
        due[1].callback();
        await flushMicrotasks();
      }
      now = target;
      await flushMicrotasks();
    },
    pending: () => timers.size,
  };
}

async function flushMicrotasks() {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
}

/** A scriptable server: each send resolves with the next queued outcome. */
function fakeServer() {
  const requests: SaveRequest[] = [];
  const outcomes: Array<(request: SaveRequest) => SaveOutcome | Promise<SaveOutcome>> = [];
  let version = 1;
  return {
    requests,
    respond(outcome: (request: SaveRequest) => SaveOutcome | Promise<SaveOutcome>) {
      outcomes.push(outcome);
    },
    ok() {
      outcomes.push(() => {
        version += 1;
        return { kind: "saved", version, savedAt: `t${version}` };
      });
    },
    send: async (request: SaveRequest) => {
      requests.push(request);
      const next = outcomes.shift();
      if (!next) throw new Error("No scripted response");
      return next(request);
    },
  };
}

function setup(options: { readOnlyReason?: string | null } = {}) {
  const timers = fakeScheduler();
  const server = fakeServer();
  let keyCounter = 0;
  const states: string[] = [];
  const controller = new SaveController(
    { baseVersion: 1, content: INITIAL, lastSavedAt: "t1", readOnlyReason: options.readOnlyReason ?? null },
    {
      send: server.send,
      schedule: timers.schedule,
      cancel: timers.cancel,
      newKey: () => `key-${++keyCounter}`,
      onChange: (state) => states.push(state.status),
    },
  );
  return { controller, timers, server, states };
}

describe("autosave", () => {
  test("edits wait for an idle pause, then save; 'saved' only after the server acknowledges", async () => {
    const { controller, timers, server, states } = setup();
    server.ok();
    controller.edit({ markdown: "## The Problem\nEdited." });
    expect(controller.getState().status).toBe("dirty");
    await timers.advance(1_000);
    expect(server.requests).toHaveLength(0);
    controller.edit({ markdown: "## The Problem\nEdited more." });
    await timers.advance(1_499);
    expect(server.requests).toHaveLength(0);
    await timers.advance(1);
    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]).toMatchObject({ baseVersion: 1, changed: { markdown: true, title: false, metadata: false } });
    expect(controller.getState()).toMatchObject({ status: "saved", baseVersion: 2, lastSavedAt: "t2" });
    expect(states).toEqual(["dirty", "dirty", "saving", "saved"]);
  });

  test("continuous typing still saves at the maximum wait", async () => {
    const { controller, timers, server } = setup();
    server.ok();
    for (let i = 0; i < 12; i += 1) {
      controller.edit({ markdown: `text ${i}` });
      await timers.advance(1_000);
    }
    expect(server.requests.length).toBeGreaterThanOrEqual(1);
  });

  test("text typed while a save is in flight is saved next, against the new version", async () => {
    const { controller, timers, server } = setup();
    let release: (outcome: SaveOutcome) => void = () => undefined;
    server.respond(() => new Promise<SaveOutcome>((resolve) => (release = resolve)));
    server.respond(() => ({ kind: "saved", version: 3, savedAt: "t3" }));
    controller.edit({ markdown: "first" });
    await timers.advance(1_500);
    expect(controller.getState().status).toBe("saving");
    controller.edit({ markdown: "second" });
    expect(controller.getState().status).toBe("saving");
    release({ kind: "saved", version: 2, savedAt: "t2" });
    await flushMicrotasks();
    expect(server.requests).toHaveLength(2);
    expect(server.requests[1]).toMatchObject({ baseVersion: 2, content: { markdown: "second" } });
    expect(controller.getState()).toMatchObject({ status: "saved", baseVersion: 3, saved: { markdown: "second" } });
  });

  test("Cmd/Ctrl-S saves immediately", async () => {
    const { controller, server } = setup();
    server.ok();
    controller.edit({ title: "New title" });
    await controller.saveNow();
    expect(server.requests[0].changed).toEqual({ title: true, markdown: false, metadata: false });
    expect(controller.getState().status).toBe("saved");
  });

  test("reverting to the saved text needs no save", async () => {
    const { controller, timers, server } = setup();
    controller.edit({ markdown: "changed" });
    controller.edit({ markdown: INITIAL.markdown });
    expect(controller.getState().status).toBe("saved");
    await timers.advance(20_000);
    expect(server.requests).toHaveLength(0);
  });
});

describe("failures are visible and never report success early", () => {
  test("a stale base version becomes a conflict and autosave stops", async () => {
    const { controller, timers, server } = setup();
    server.respond(() => ({
      kind: "conflict",
      conflict: { revisionId: "rev_1", latestVersion: 5, savedAt: "t5", savedBy: "Other tab", title: "Title", markdown: "theirs", frozen: false },
    }));
    controller.edit({ markdown: "mine" });
    await timers.advance(1_500);
    expect(controller.getState()).toMatchObject({ status: "conflict", current: { markdown: "mine" } });
    controller.edit({ markdown: "mine, more" });
    await timers.advance(60_000);
    expect(server.requests).toHaveLength(1);
    expect(hasUnsavedChanges(controller.getState())).toBe(true);
  });

  test("keep mine re-saves against the newer version with a fresh key", async () => {
    const { controller, timers, server } = setup();
    server.respond(() => ({
      kind: "conflict",
      conflict: { revisionId: "rev_1", latestVersion: 5, savedAt: "t5", savedBy: "Other tab", title: "Title", markdown: "theirs", frozen: false },
    }));
    server.respond(() => ({ kind: "saved", version: 6, savedAt: "t6" }));
    controller.edit({ markdown: "mine" });
    await timers.advance(1_500);
    await controller.keepMine();
    expect(server.requests[1]).toMatchObject({ baseVersion: 5, content: { markdown: "mine" } });
    // Every field is sent, so no part of the newer server copy survives by accident.
    expect(server.requests[1].changed).toEqual({ title: true, markdown: true, metadata: true });
    expect(server.requests[1].idempotencyKey).not.toBe(server.requests[0].idempotencyKey);
    expect(controller.getState()).toMatchObject({ status: "saved", baseVersion: 6 });
  });

  test("use theirs replaces the editor text with the server copy", async () => {
    const { controller, timers, server } = setup();
    server.respond(() => ({
      kind: "conflict",
      conflict: { revisionId: "rev_1", latestVersion: 5, savedAt: "t5", savedBy: "Other tab", title: "Theirs", markdown: "theirs", frozen: false },
    }));
    controller.edit({ markdown: "mine" });
    await timers.advance(1_500);
    controller.useTheirs();
    expect(controller.getState()).toMatchObject({ status: "saved", baseVersion: 5, current: { markdown: "theirs", title: "Theirs" } });
  });

  test("an approval elsewhere freezes the draft; the editor becomes read-only, not silently discarded", async () => {
    const { controller, timers, server } = setup();
    server.respond(() => ({
      kind: "conflict",
      conflict: { revisionId: "rev_1", latestVersion: 3, savedAt: "t3", savedBy: "Other tab", title: "Title", markdown: "approved", frozen: true },
    }));
    controller.edit({ markdown: "mine" });
    await timers.advance(1_500);
    expect(controller.getState().conflict?.frozen).toBe(true);
    await controller.keepMine();
    expect(server.requests).toHaveLength(1);
    expect(controller.getState().current.markdown).toBe("mine");
  });

  test("a lost acknowledgement is retried with the same key before newer text is sent", async () => {
    const { controller, timers, server } = setup();
    server.respond(() => ({ kind: "unreachable", message: "Failed to fetch" }));
    server.respond(() => ({ kind: "saved", version: 2, savedAt: "t2" }));
    server.respond(() => ({ kind: "saved", version: 3, savedAt: "t3" }));
    controller.edit({ markdown: "first" });
    await timers.advance(1_500);
    expect(controller.getState()).toMatchObject({ status: "offline", attempts: 1 });
    controller.edit({ markdown: "second" });
    await timers.advance(RETRY_DELAYS_MS[0]);
    expect(server.requests[1].idempotencyKey).toBe(server.requests[0].idempotencyKey);
    expect(server.requests[1].content.markdown).toBe("first");
    expect(server.requests[2]).toMatchObject({ baseVersion: 2, content: { markdown: "second" } });
    expect(server.requests[2].idempotencyKey).not.toBe(server.requests[0].idempotencyKey);
    expect(controller.getState()).toMatchObject({ status: "saved", baseVersion: 3 });
  });

  test("retries back off and coming back online retries at once", async () => {
    const { controller, timers, server } = setup();
    server.respond(() => ({ kind: "unreachable", message: "offline" }));
    server.respond(() => ({ kind: "unreachable", message: "offline" }));
    server.respond(() => ({ kind: "saved", version: 2, savedAt: "t2" }));
    controller.edit({ markdown: "x" });
    await timers.advance(1_500);
    await timers.advance(RETRY_DELAYS_MS[0]);
    expect(controller.getState().attempts).toBe(2);
    controller.setOnline(true);
    await flushMicrotasks();
    expect(controller.getState().status).toBe("saved");
    expect(server.requests).toHaveLength(3);
  });

  test("a refused save is an error with its reason and is not retried automatically", async () => {
    const { controller, timers, server } = setup();
    server.respond(() => ({ kind: "rejected", code: "INVALID_INPUT", message: "Article body is too long" }));
    controller.edit({ markdown: "y".repeat(10) });
    await timers.advance(1_500);
    expect(controller.getState()).toMatchObject({ status: "error", error: { code: "INVALID_INPUT" } });
    await timers.advance(120_000);
    expect(server.requests).toHaveLength(1);
    expect(hasUnsavedChanges(controller.getState())).toBe(true);
  });

  test("pausing (unmount or an effect re-run) cancels timers but keeps the text, and the next edit resumes", async () => {
    const { controller, timers, server } = setup();
    server.ok();
    controller.edit({ markdown: "## The Problem\nKept." });
    controller.pause();
    expect(timers.pending()).toBe(0);
    await timers.advance(20_000);
    expect(server.requests).toHaveLength(0);
    expect(controller.getState()).toMatchObject({ status: "dirty", current: { markdown: "## The Problem\nKept." } });
    controller.edit({ title: "Title again" });
    await timers.advance(1_500);
    expect(server.requests).toHaveLength(1);
    expect(controller.getState().status).toBe("saved");
  });

  test("read-only drafts never send", async () => {
    const { controller, timers, server } = setup({ readOnlyReason: "Approved revisions are frozen." });
    controller.edit({ markdown: "nope" });
    await timers.advance(20_000);
    expect(server.requests).toHaveLength(0);
    expect(controller.getState().status).toBe("read_only");
  });
});
