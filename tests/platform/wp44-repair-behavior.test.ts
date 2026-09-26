import { describe, expect, test } from "vitest";
import { createSaveQueue } from "../../components/platform/save-queue";
import { createVersionedSave } from "../../components/platform/versioned-save";
import { acknowledgePendingSave, readPendingSave, recordPendingSaveAttempt, stashPendingSave, PENDING_SAVE_MAX_ATTEMPTS, persistPendingSave } from "../../lib/pending-save";

const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function queue() {
  const requests: { saved: boolean; work: ReturnType<typeof deferred> }[] = [];
  const states: boolean[] = [];
  const errors: unknown[] = [];
  let database = false;
  const controller = createSaveQueue({
    initial: false,
    read: async () => database,
    write: async (saved) => {
      const work = deferred(); requests.push({ saved, work });
      await work.promise; database = saved;
    },
    changed: (saved) => states.push(saved),
    settled: () => {},
    failed: (error) => errors.push(error),
  });
  return { controller, requests, states, errors, database: () => database };
}

describe("save intent ordering", () => {
  test("serializes Save then Unsave so network completion cannot reverse intent", async () => {
    const q = queue(); q.controller.toggle(); q.controller.toggle();
    expect(q.requests.map((r) => r.saved)).toEqual([true]);
    q.requests[0].work.resolve(); await flush(); await flush();
    expect(q.requests.map((r) => r.saved)).toEqual([true, false]);
    q.requests[1].work.resolve(); await flush(); await flush();
    expect(q.database()).toBe(false); expect(q.states.at(-1)).toBe(false);
  });
  test("coalesces three clicks and ignores obsolete failures", async () => {
    const q = queue(); q.controller.toggle(); q.controller.toggle(); q.controller.toggle();
    q.requests[0].work.reject(new Error("offline")); await flush(); await flush();
    expect(q.errors).toEqual([]); expect(q.requests.map((r) => r.saved)).toEqual([true, true]);
    q.requests[1].work.resolve(); await flush(); await flush();
    expect(q.database()).toBe(true); expect(q.states.at(-1)).toBe(true);
  });
  test("reasserts newer unsave after an ambiguous earlier failure", async () => {
    const q = queue(); q.controller.toggle(); q.controller.toggle();
    q.requests[0].work.reject(new Error("response lost")); await flush(); await flush();
    expect(q.requests.map((r) => r.saved)).toEqual([true, false]);
  });
  test("a lost successful response confirmed by GET settles success without a retry error", async () => {
    let database = false; let shown = false;
    const settled: boolean[] = []; const errors: unknown[] = [];
    const controller = createSaveQueue({ initial: false,
      write: async (saved) => { database = saved; throw new Error("response lost"); },
      read: async () => database, changed: (saved) => { shown = saved; },
      settled: (saved) => { settled.push(saved); }, failed: (error) => { errors.push(error); } });
    controller.toggle(); await flush(); await flush(); await flush();
    expect(database).toBe(true); expect(shown).toBe(true);
    expect(settled).toEqual([true]); expect(errors).toEqual([]);
  });
  test("a final failure restores acknowledged state and reports error", async () => {
    const q = queue(); q.controller.toggle(); q.requests[0].work.reject(new Error("offline"));
    await flush(); await flush(); expect(q.errors).toHaveLength(1); expect(q.states.at(-1)).toBe(false);
  });
});

describe("HTTP save version fence", () => {
  test("three toggles during conflict refresh still persist the final matching value", async () => {
    const refresh = deferred(); let posts = 0; let saved = false; const completed = deferred();
    const request = (async (_url, init) => {
      if (!init?.body) { await refresh.promise; return Response.json({ signedIn: true, saved, version: 1 }); }
      posts++;
      if (posts === 1) return Response.json({}, { status: 409 });
      saved = JSON.parse(String(init.body)).saved;
      return Response.json({ saved, version: 2 });
    }) as typeof fetch;
    const client = createVersionedSave("first", 0, request);
    const controller = createSaveQueue({ initial: false, ...client, changed: () => {}, settled: () => completed.resolve(), failed: (error) => completed.reject(error as Error) });
    controller.toggle(); await flush(); await flush();
    controller.toggle(); controller.toggle(); refresh.resolve();
    await completed.promise;
    expect(posts).toBe(2); expect(saved).toBe(true);
  });
  test("a request committing after its transport failed cannot reverse the newer choice", async () => {
    let saved = false; let version = 0; let delayed: { saved: boolean; expectedVersion: number } | undefined;
    const apply = (body: { saved: boolean; expectedVersion: number }) => {
      if (body.expectedVersion !== version) return Response.json({ saved, version }, { status: 409 });
      saved = body.saved; version++;
      return Response.json({ saved, version });
    };
    const request = (async (_url, init) => {
      if (!init?.body) return Response.json({ signedIn: true, saved, version });
      const body = JSON.parse(String(init.body));
      if (!delayed) { delayed = body; throw new Error("connection lost before commit"); }
      return apply(body);
    }) as typeof fetch;
    const client = createVersionedSave("first", 0, request);
    await expect(client.write(true, () => true)).rejects.toThrow("connection lost");
    await client.write(false, () => true);
    expect(apply(delayed!).status).toBe(409);
    expect(saved).toBe(false); expect(version).toBe(1);
  });
  test("conflicts refresh the version and retry only the current choice", async () => {
    const sent: number[] = []; let currentVersion = 1;
    const request = (async (_url, init) => {
      if (!init?.body) return Response.json({ signedIn: true, saved: true, version: currentVersion });
      const body = JSON.parse(String(init.body)); sent.push(body.expectedVersion);
      if (body.expectedVersion !== currentVersion) return Response.json({}, { status: 409 });
      return Response.json({ saved: body.saved, version: ++currentVersion });
    }) as typeof fetch;
    await createVersionedSave("first", 0, request).write(false, () => true);
    expect(sent).toEqual([0, 1]);
    await expect(createVersionedSave("first", 0, request).write(true, () => false)).rejects.toThrow("superseded");
    expect(sent).toEqual([0, 1, 0]);
  });
  test("repeated conflicts stop after three writes and an unavailable read never becomes unsaved", async () => {
    let writes = 0;
    const request = (async (_url, init) => {
      if (!init?.body) return Response.json({ signedIn: true, saved: true, version: writes });
      writes++; return Response.json({}, { status: 409 });
    }) as typeof fetch;
    await expect(createVersionedSave("first", 0, request).write(false, () => true)).rejects.toThrow("conflict");
    expect(writes).toBe(3);
    await expect(createVersionedSave("first", 0, async () => Response.json({}, { status: 503 })).read()).rejects.toThrow("unavailable");
  });
});

function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}

describe("durable pending save", () => {
  test("failed attempts survive reload, remain bounded and clear only on acknowledgement", () => {
    const store = storage(); const save = { slug: "first", title: "First", at: 1000 };
    stashPendingSave(store, save);
    for (let i = 0; i < PENDING_SAVE_MAX_ATTEMPTS; i++) recordPendingSaveAttempt(store, save, 1001);
    expect(readPendingSave(store, 1002)?.attempts).toBe(PENDING_SAVE_MAX_ATTEMPTS);
    acknowledgePendingSave(store, save, 1003); expect(readPendingSave(store, 1004)).toBeNull();
  });
  test("a replaced intent is never sent when an old banner retries", async () => {
    const store = storage(); const old = { slug: "old", title: "Old", at: 1000 };
    stashPendingSave(store, { slug: "new", title: "New", at: 1001 });
    const writes: string[] = [];
    expect(await persistPendingSave(store, old, 1002, async (slug) => { writes.push(slug); })).toBe("replaced");
    expect(writes).toEqual([]); expect(readPendingSave(store, 1002)?.slug).toBe("new");
  });
  test("storage failure rejects before writing and requires visible retry", async () => {
    const store = storage(); const save = { slug: "first", title: "First", at: 1000 };
    stashPendingSave(store, save); const writes: string[] = [];
    const blocked = { ...store, setItem: () => { throw new Error("blocked"); } };
    await expect(persistPendingSave(blocked, save, 1001, async (slug) => { writes.push(slug); })).rejects.toThrow("blocked");
    expect(writes).toEqual([]);
  });
  test("an authenticated failure exhausts automatic retry before a later account can consume it", async () => {
    const store = storage(); const save = { slug: "first", title: "First", at: 1000 };
    stashPendingSave(store, save);
    await expect(persistPendingSave(store, save, 1001, async () => { throw new Error("offline"); })).rejects.toThrow("offline");
    expect(readPendingSave(store, 1002)!.attempts! >= PENDING_SAVE_MAX_ATTEMPTS).toBe(true);
  });
  test("failed persistence retains intent and success acknowledges it", async () => {
    const store = storage(); const save = { slug: "first", title: "First", at: 1000 };
    stashPendingSave(store, save);
    await expect(persistPendingSave(store, save, 1001, async () => { throw new Error("offline"); })).rejects.toThrow("offline");
    expect(readPendingSave(store, 1002)?.attempts).toBe(1);
    await persistPendingSave(store, save, 1003, async () => {});
    expect(readPendingSave(store, 1004)).toBeNull();
  });
  test("an old response does not remove a newer intent from another tab", () => {
    const store = storage(); const first = { slug: "first", title: "First", at: 1000 };
    stashPendingSave(store, first); stashPendingSave(store, { slug: "second", title: "Second", at: 1001 });
    acknowledgePendingSave(store, first, 1002); expect(readPendingSave(store, 1002)?.slug).toBe("second");
  });
});
