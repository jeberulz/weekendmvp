import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => undefined }));

import {
  createRevisionAction,
  discardRevisionAction,
  getRevisionAction,
  runChecksAction,
  saveDraftAction,
} from "@/app/admin/editorial/_actions/draft";
import { resetFixtureEnvironment } from "@/lib/editorial/adapters/fixture/singleton";
import type { FixtureEnvironment } from "@/lib/editorial/adapters/fixture/environment";
import type { CommandResult } from "@/lib/editorial/contracts/errors";
import { FIXTURE_MODE_VALUE } from "@/lib/editorial/runtime/workspace";

function unwrap<T>(result: CommandResult<T>): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.value;
}

let env: FixtureEnvironment;

async function working(ideaId: string) {
  const detail = unwrap(await env.editor().getIdea(ideaId));
  const revisionId = detail.idea.workingRevision?.id;
  if (!revisionId) throw new Error("no working revision");
  return unwrap(await env.editor().getRevision(ideaId, revisionId));
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("editorial server actions are closed unless the fixture workspace is explicitly enabled", () => {
  const input = {
    ideaId: "idea_0001",
    revisionId: "rev_0001",
    baseVersion: 1,
    patch: { title: "Probe" },
    idempotencyKey: "probe-key-0001",
  };

  test("no opt-in: unavailable, and the input is not even parsed", async () => {
    vi.stubEnv("EDITORIAL_FIXTURE_MODE", "");
    const result = await saveDraftAction(input);
    expect(result).toEqual({ ok: false, error: { code: "WORKSPACE_UNAVAILABLE", message: "The editorial workspace is not available." } });
    const malformed = await saveDraftAction({ nonsense: true } as unknown as typeof input);
    expect(malformed.ok ? null : malformed.error.code).toBe("WORKSPACE_UNAVAILABLE");
  });

  test("production with the opt-in set is still unavailable, for every action", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EDITORIAL_FIXTURE_MODE", FIXTURE_MODE_VALUE);
    const results = await Promise.all([
      saveDraftAction(input),
      getRevisionAction({ ideaId: "idea_0001", revisionId: "rev_0001" }),
      createRevisionAction({ ideaId: "idea_0001", fromRevisionId: null, idempotencyKey: "probe-key-0002", carry: null }),
      discardRevisionAction({ ideaId: "idea_0001", revisionId: "rev_0001", expectedVersion: 1, reason: "probe" }),
      runChecksAction({ ideaId: "idea_0001", revisionId: "rev_0001", expectedArtifactHash: "0".repeat(64) }),
    ]);
    for (const result of results) expect(result.ok ? null : result.error.code).toBe("WORKSPACE_UNAVAILABLE");
  });
});

// Each test reseeds the whole demo (about two seconds), so allow for a busy machine.
describe("editorial server actions against the fixture workspace", { timeout: 30_000 }, () => {
  beforeEach(async () => {
    vi.stubEnv("EDITORIAL_FIXTURE_MODE", FIXTURE_MODE_VALUE);
    env = await resetFixtureEnvironment();
  });

  test("untrusted input is validated before it reaches the repository", async () => {
    const draft = await working(env.scenarios.flagshipLiveWithDraft);
    const valid = {
      ideaId: draft.ideaId,
      revisionId: draft.id,
      baseVersion: draft.version,
      patch: { title: "Edited" },
      idempotencyKey: "key-valid-0001",
    };
    const cases: unknown[] = [
      { ...valid, extra: "field" },
      { ...valid, ideaId: "../etc/passwd" },
      { ...valid, baseVersion: -1 },
      { ...valid, patch: {} },
      { ...valid, patch: { title: "two\nlines" } },
      { ...valid, patch: { markdown: "x".repeat(200_001) } },
      { ...valid, idempotencyKey: "short" },
    ];
    for (const candidate of cases) {
      const result = await saveDraftAction(candidate as typeof valid);
      expect(result.ok ? null : result.error.code, JSON.stringify(candidate).slice(0, 80)).toBe("INVALID_INPUT");
    }
    // Nothing was written.
    expect((await working(env.scenarios.flagshipLiveWithDraft)).version).toBe(draft.version);
  });

  test("a save returns the acknowledgement and the fresh view; a retried key is not applied twice", async () => {
    const draft = await working(env.scenarios.flagshipLiveWithDraft);
    const input = {
      ideaId: draft.ideaId,
      revisionId: draft.id,
      baseVersion: draft.version,
      patch: { markdown: `${draft.markdown}\n\nA new closing line.` },
      idempotencyKey: "key-save-0001",
    };
    const first = unwrap(await saveDraftAction(input));
    expect(first.ack.version).toBe(draft.version + 1);
    expect(first.view.markdown.endsWith("A new closing line.")).toBe(true);
    const retried = unwrap(await saveDraftAction(input));
    expect(retried.ack).toEqual(first.ack);
    expect((await working(env.scenarios.flagshipLiveWithDraft)).version).toBe(draft.version + 1);
  });

  test("a stale base version is a conflict carrying the newer copy, never a silent overwrite", async () => {
    const draft = await working(env.scenarios.flagshipLiveWithDraft);
    unwrap(
      await saveDraftAction({
        ideaId: draft.ideaId,
        revisionId: draft.id,
        baseVersion: draft.version,
        patch: { title: "Saved in the other tab" },
        idempotencyKey: "key-tab-b-0001",
      }),
    );
    const stale = await saveDraftAction({
      ideaId: draft.ideaId,
      revisionId: draft.id,
      baseVersion: draft.version,
      patch: { title: "Typed in this tab" },
      idempotencyKey: "key-tab-a-0001",
    });
    expect(stale.ok).toBe(false);
    if (stale.ok) return;
    expect(stale.error.code).toBe("VERSION_CONFLICT");
    expect(stale.error.conflict).toMatchObject({ latestVersion: draft.version + 1, title: "Saved in the other tab", frozen: false });
    expect((await working(env.scenarios.flagshipLiveWithDraft)).title).toBe("Saved in the other tab");
  });

  test("create revision forks the working snapshot and can carry unsaved text into it", async () => {
    const ideaId = env.scenarios.newCandidate;
    const snapshot = await working(ideaId);
    expect(snapshot.kind).not.toBe("draft");
    const created = unwrap(
      await createRevisionAction({
        ideaId,
        fromRevisionId: null,
        idempotencyKey: "key-fork-0001",
        carry: {
          title: snapshot.title,
          markdown: `${snapshot.markdown}\n\nCarried text.`,
          metadata: snapshot.metadata,
          idempotencyKey: "key-carry-0001",
        },
      }),
    );
    const draft = unwrap(await env.editor().getRevision(ideaId, created.revisionId));
    expect(draft.kind).toBe("draft");
    expect(draft.parentRevisionId).toBe(snapshot.id);
    expect(draft.markdown.endsWith("Carried text.")).toBe(true);
    // The snapshot it came from is untouched.
    expect(unwrap(await env.editor().getRevision(ideaId, snapshot.id)).markdown).toBe(snapshot.markdown);
    // A second fork is refused while this draft is the working revision.
    const again = await createRevisionAction({ ideaId, fromRevisionId: snapshot.id, idempotencyKey: "key-fork-0002", carry: null });
    expect(again.ok ? null : again.error.code).toBe("PRECONDITION_FAILED");
  });

  test("discarding needs the current version and returns to the parent; live content is unchanged", async () => {
    const ideaId = env.scenarios.flagshipLiveWithDraft;
    const draft = await working(ideaId);
    const before = unwrap(await env.editor().getIdea(ideaId));
    const stale = await discardRevisionAction({ ideaId, revisionId: draft.id, expectedVersion: draft.version - 1, reason: "Start over" });
    expect(stale.ok ? null : stale.error.code).toBe("VERSION_CONFLICT");
    const done = unwrap(await discardRevisionAction({ ideaId, revisionId: draft.id, expectedVersion: draft.version, reason: "Start over" }));
    expect(done.workingRevisionId).toBe(draft.parentRevisionId);
    const after = unwrap(await env.editor().getIdea(ideaId));
    expect(after.idea.liveRevision).toEqual(before.idea.liveRevision);
    expect(after.idea.publication).toBe(before.idea.publication);
  });

  test("checks run only against the saved artifact the caller saw", async () => {
    const draft = await working(env.scenarios.flagshipLiveWithDraft);
    const stale = await runChecksAction({ ideaId: draft.ideaId, revisionId: draft.id, expectedArtifactHash: "0".repeat(64) });
    expect(stale.ok ? null : stale.error.code).toBe("STALE_REVIEW_TARGET");
    const ran = unwrap(await runChecksAction({ ideaId: draft.ideaId, revisionId: draft.id, expectedArtifactHash: draft.hashes.artifact }));
    expect(ran.policy.checksCurrent).toBe(true);
  });
});
