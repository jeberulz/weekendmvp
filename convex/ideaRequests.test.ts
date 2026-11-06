/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import {
  compareIdeaRequests,
  getOrCreateAnonymousId,
  normalizeRequestTitle,
  validateIdeaRequest,
} from "../lib/idea-requests";

const modules = import.meta.glob("./**/*.ts");

const ANON_A = "anon-a-1234567890abcdef";
const ANON_B = "anon-b-1234567890abcdef";

async function submit(
  t: TestConvex<typeof schema>,
  overrides: { title?: string; problem?: string; anonymousId?: string; category?: string } = {},
) {
  return t.mutation(api.ideaRequests.submit, {
    title: overrides.title ?? "A CRM for freelance photographers",
    problem: overrides.problem ?? "Freelance photographers lose track of client follow-ups",
    anonymousId: overrides.anonymousId ?? ANON_A,
    ...(overrides.category !== undefined ? { category: overrides.category } : {}),
  });
}

describe("ideaRequests.submit", () => {
  test("creates an open request with zero votes", async () => {
    const t = convexTest(schema, modules);
    const result = await submit(t);
    expect(result.deduped).toBe(false);
    expect(result.voteCount).toBe(0);

    const top = await t.query(api.ideaRequests.listTop, { anonymousId: ANON_A });
    expect(top).toHaveLength(1);
    expect(top[0]).toMatchObject({
      title: "A CRM for freelance photographers",
      problem: "Freelance photographers lose track of client follow-ups",
      voteCount: 0,
      hasVoted: false,
    });
  });

  test("dedupes an identical title regardless of case and spacing", async () => {
    const t = convexTest(schema, modules);
    const first = await submit(t);
    const second = await t.mutation(api.ideaRequests.submit, {
      title: "  a   CRM for FREELANCE photographers ",
      problem: "A different one-line problem",
      anonymousId: ANON_B,
    });
    expect(second.deduped).toBe(true);
    expect(second.requestId).toEqual(first.requestId);

    const top = await t.query(api.ideaRequests.listTop, {});
    expect(top).toHaveLength(1);
  });

  test("rejects empty, over-long, link-bearing and spam-ish submissions", async () => {
    const t = convexTest(schema, modules);
    await expect(submit(t, { title: "  " })).rejects.toThrow("VALIDATION");
    await expect(submit(t, { title: "x".repeat(121) })).rejects.toThrow("VALIDATION");
    await expect(submit(t, { problem: "see https://example.com for details" })).rejects.toThrow(
      "VALIDATION",
    );
    await expect(submit(t, { title: "aaaaaaaaaaaaaa" })).rejects.toThrow("VALIDATION");
    await expect(submit(t, { category: "not-a-category" })).rejects.toThrow("VALIDATION");
  });

  test("rejects anonymous submissions without a valid anonymous id", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.ideaRequests.submit, {
        title: "A CRM for freelance photographers",
        problem: "Freelance photographers lose track of client follow-ups",
      }),
    ).rejects.toThrow("UNAUTHENTICATED");
    await expect(
      t.mutation(api.ideaRequests.submit, {
        title: "A CRM for freelance photographers",
        problem: "Freelance photographers lose track of client follow-ups",
        anonymousId: "too-short",
      }),
    ).rejects.toThrow("UNAUTHENTICATED");
  });

  test("limits a voter to three submissions per hour", async () => {
    const t = convexTest(schema, modules);
    for (let i = 0; i < 3; i += 1) {
      await submit(t, { title: `Distinct idea ${i}` });
    }
    await expect(submit(t, { title: "Distinct idea 3" })).rejects.toThrow("RATE_LIMITED");
  });

  test("accepts a signed-in submission without an anonymous id", async () => {
    const t = convexTest(schema, modules);
    const signedIn = t.withIdentity({ subject: "user-alice" });
    const result = await signedIn.mutation(api.ideaRequests.submit, {
      title: "A CRM for freelance photographers",
      problem: "Freelance photographers lose track of client follow-ups",
    });
    expect(result.deduped).toBe(false);
  });
});

describe("ideaRequests.toggleVote", () => {
  test("toggles one vote per voter and never double-counts", async () => {
    const t = convexTest(schema, modules);
    const { requestId } = await submit(t);

    expect(await t.mutation(api.ideaRequests.toggleVote, { requestId, anonymousId: ANON_A })).toEqual({
      voted: true,
      voteCount: 1,
    });
    // Same voter again removes the vote.
    expect(await t.mutation(api.ideaRequests.toggleVote, { requestId, anonymousId: ANON_A })).toEqual({
      voted: false,
      voteCount: 0,
    });
    // A different voter adds one vote, not two.
    expect(await t.mutation(api.ideaRequests.toggleVote, { requestId, anonymousId: ANON_B })).toEqual({
      voted: true,
      voteCount: 1,
    });
    expect(await t.mutation(api.ideaRequests.toggleVote, { requestId, anonymousId: ANON_B })).toEqual({
      voted: false,
      voteCount: 0,
    });
  });

  test("keeps signed-in and anonymous votes separate", async () => {
    const t = convexTest(schema, modules);
    const { requestId } = await submit(t);
    const signedIn = t.withIdentity({ subject: "user-alice" });

    await t.mutation(api.ideaRequests.toggleVote, { requestId, anonymousId: ANON_A });
    await signedIn.mutation(api.ideaRequests.toggleVote, { requestId });
    const top = await t.query(api.ideaRequests.listTop, { anonymousId: ANON_A });
    expect(top[0].voteCount).toBe(2);
    expect(top[0].hasVoted).toBe(true);
  });

  test("rejects votes for unknown requests and without an identity", async () => {
    const t = convexTest(schema, modules);
    const { requestId } = await submit(t);
    await expect(t.mutation(api.ideaRequests.toggleVote, { requestId })).rejects.toThrow(
      "UNAUTHENTICATED",
    );
    await expect(
      t.mutation(api.ideaRequests.toggleVote, {
        requestId: "00000000000000000000000000000000" as never,
        anonymousId: ANON_A,
      }),
    ).rejects.toThrow();
  });
});

describe("ideaRequests.listTop / listForSuggest", () => {
  test("sorts by votes then newest, and honours the limit", async () => {
    const t = convexTest(schema, modules);
    await submit(t, { title: "Idea A" });
    const b = await submit(t, { title: "Idea B", anonymousId: ANON_B });
    const c = await submit(t, { title: "Idea C", anonymousId: ANON_B });
    // B gets two votes, C gets one, A gets none.
    await t.mutation(api.ideaRequests.toggleVote, { requestId: b.requestId, anonymousId: ANON_A });
    await t.mutation(api.ideaRequests.toggleVote, { requestId: b.requestId, anonymousId: ANON_B });
    await t.mutation(api.ideaRequests.toggleVote, { requestId: c.requestId, anonymousId: ANON_A });

    const top = await t.query(api.ideaRequests.listTop, { anonymousId: ANON_A });
    expect(top.map((row) => row.title)).toEqual(["Idea B", "Idea C", "Idea A"]);
    expect(top.map((row) => row.voteCount)).toEqual([2, 1, 0]);
    expect(top[0].hasVoted).toBe(true);
    expect(top[1].hasVoted).toBe(true);
    expect(top[2].hasVoted).toBe(false);

    const limited = await t.query(api.ideaRequests.listTop, { limit: 1 });
    expect(limited).toHaveLength(1);
    expect(limited[0].title).toBe("Idea B");
    expect(await t.query(api.ideaRequests.listTop, { limit: 0 })).toEqual([]);
  });

  test("newest wins on a vote tie", async () => {
    const t = convexTest(schema, modules);
    await submit(t, { title: "Older idea" });
    await submit(t, { title: "Newer idea", anonymousId: ANON_B });
    const top = await t.query(api.ideaRequests.listTop, {});
    expect(top.map((row) => row.title)).toEqual(["Newer idea", "Older idea"]);
  });

  test("listForSuggest returns the Stage-0 read shape, votes first", async () => {
    const t = convexTest(schema, modules);
    const { requestId } = await submit(t);
    await t.mutation(api.ideaRequests.toggleVote, { requestId, anonymousId: ANON_A });
    await submit(t, { title: "Unvoted idea", anonymousId: ANON_B });

    const rows = await t.query(api.ideaRequests.listForSuggest, {});
    expect(rows.map((row) => row.title)).toEqual([
      "A CRM for freelance photographers",
      "Unvoted idea",
    ]);
    expect(rows[0]).toMatchObject({
      normalizedTitle: "a crm for freelance photographers",
      voteCount: 1,
    });
    expect(typeof rows[0].createdAt).toBe("number");
  });
});

describe("lib/idea-requests helpers", () => {
  test("normalises titles for dedupe", () => {
    expect(normalizeRequestTitle("  AI   CRM for Dentists ")).toBe("ai crm for dentists");
  });

  test("validates length, category and links", () => {
    expect(validateIdeaRequest({ title: "Hi", problem: "x" }).ok).toBe(false);
    expect(
      validateIdeaRequest({
        title: "A CRM for dentists",
        problem: "Dentists lose track of recalls",
        category: "health",
      }),
    ).toEqual({
      ok: true,
      title: "A CRM for dentists",
      problem: "Dentists lose track of recalls",
      category: "health",
    });
    expect(
      validateIdeaRequest({ title: "A CRM for dentists", problem: "Dentists lose track" }).ok,
    ).toBe(true);
  });

  test("sorts by votes then newest", () => {
    const rows = [
      { voteCount: 0, createdAt: 200 },
      { voteCount: 2, createdAt: 100 },
      { voteCount: 0, createdAt: 300 },
    ];
    expect([...rows].sort(compareIdeaRequests)).toEqual([
      { voteCount: 2, createdAt: 100 },
      { voteCount: 0, createdAt: 300 },
      { voteCount: 0, createdAt: 200 },
    ]);
  });

  test("reuses a stored anonymous id and creates a valid one", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };
    const first = getOrCreateAnonymousId(storage);
    expect(first).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    expect(getOrCreateAnonymousId(storage)).toBe(first);
  });
});
