import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { handleApprove } from "@/lib/landing-ai/approve";
import { beforeCopy, landingBlocks, landingPageOptions, type Copy } from "@/lib/landing-ai/blocks";
import { sealProposal } from "@/lib/landing-ai/draft";
import { githubDraftStore, localDraftStore } from "@/lib/landing-ai/storage";
import { validateLandingDocument } from "@/lib/landing-ai/validate-document";

vi.mock("server-only", () => ({}));

const homePath = "content/landing-pages/home/index.json";
const origin = "https://editor.example";
const target = { page: "home", blockId: "whatIs", action: "rewrite" } as const;
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  vi.unstubAllEnvs();
});

function approveRequest(body: object, from = origin) {
  return new Request(origin + "/api/admin/page-ai/approve", {
    method: "POST",
    headers: { origin: from, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function localFixture() {
  const root = await mkdtemp(join(tmpdir(), "landing-approve-"));
  roots.push(root);
  await mkdir(join(root, "content/landing-pages/home"), { recursive: true });
  const filename = join(root, homePath);
  await copyFile(homePath, filename);
  const store = localDraftStore(root);
  const initial = await store.read("home");
  const block = landingBlocks("home", initial.document).find(({ id }) => id === target.blockId)!;
  const before = beforeCopy(block);
  const after = { ...before, "whatIs.intro": String(before["whatIs.intro"]).replace("researched startup ideas", "researched ideas") };
  expect(after).not.toEqual(before);
  const input = { ...target, after, approval: sealProposal("local", target, initial.revision, before, after) };
  const deps = { authorised: async () => true, destination: { mode: "local" as const, open: async () => store } };
  return { input, filename, store, initial, deps };
}

test("the production write validator accepts all nine current editor documents", async () => {
  for (const { id } of landingPageOptions()) {
    const fixture = JSON.parse(await readFile(`content/landing-pages/${id}/index.json`, "utf8"));
    expect(() => validateLandingDocument(id, fixture), id).not.toThrow();
  }
});

test("unauthenticated requests get private 404 and cross-origin requests cannot open storage", async () => {
  const open = vi.fn();
  const destination = { mode: "local" as const, open };
  const anonymous = await handleApprove(approveRequest({}), { authorised: async () => false, destination });
  expect(anonymous.status).toBe(404);
  expect(anonymous.headers.get("cache-control")).toContain("no-store");
  const crossSite = await handleApprove(approveRequest({}, "https://other.example"), { authorised: async () => true, destination });
  expect(crossSite.status).toBe(403);
  expect(open).not.toHaveBeenCalled();
});

test("local approval writes only the reviewed field and simultaneous replay is rejected", async () => {
  const { input, store, initial, deps, filename } = await localFixture();
  const [left, right] = await Promise.all([handleApprove(approveRequest(input), deps), handleApprove(approveRequest(input), deps)]);
  expect([left.status, right.status].sort()).toEqual([200, 409]);
  const saved = left.ok ? left : right;
  expect(await saved.json()).toEqual({ saved: true, href: "/admin/pages/singleton/home", branch: null });
  const expected = structuredClone(initial.document) as { whatIs: { intro: string } };
  expected.whatIs.intro = input.after["whatIs.intro"];
  expect((await store.read("home")).document).toEqual(expected);
  expect(await readdir(join(filename, ".."))).toEqual(["index.json"]);
});

test("approval refuses altered proposal data, changed targets and stale content", async () => {
  const { input, filename, store, initial, deps } = await localFixture();
  const changed = { ...input, after: { ...input.after, "whatIs.intro": "A different sentence entirely." } };
  expect((await handleApprove(approveRequest(changed), deps)).status).toBe(422);
  expect((await handleApprove(approveRequest({ ...input, action: "shorten" }), deps)).status).toBe(409);
  expect(await store.read("home")).toEqual(initial);
  await writeFile(filename, JSON.stringify(initial.document) + "\n");
  const concurrent = await store.read("home");
  expect((await handleApprove(approveRequest(input), deps)).status).toBe(409);
  expect(await store.read("home")).toEqual(concurrent);
});

test("approved optional checklist appends to the typed homepage section list", async () => {
  const { store, deps, initial } = await localFixture();
  const selection = { page: "home", blockId: "add:checklist", action: "add" } as const;
  const after: Copy = { title: "Before you start", items: ["Pick an idea."] };
  const approval = sealProposal("local", selection, initial.revision, {}, after);
  const response = await handleApprove(approveRequest({ ...selection, approval, after }), deps);
  expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
  expect((await store.read("home")).document).toMatchObject({
    additionalSections: [{ discriminant: "checklist", value: after }],
  });
});

test("a reviewed GitHub proposal cannot be switched to another branch", async () => {
  vi.stubEnv("KEYSTATIC_SECRET", "fixture-signing-key-for-landing-approval-tests");
  const branchTarget = { ...target, branch: "content/home-refresh" };
  const after = { "whatIs.intro": "Try a practical idea." };
  const approval = sealProposal("github", branchTarget, "b".repeat(40), {}, after);
  const open = vi.fn();
  const deps = { authorised: async () => true, destination: { mode: "github" as const, open } };
  for (const branch of ["main", "content/another-draft"]) {
    const response = await handleApprove(approveRequest({ ...branchTarget, branch, after, approval }), deps);
    expect(response.status).toBe(409);
  }
  expect(open).not.toHaveBeenCalled();
});

test("a GitHub draft can be created and written only under the selected content branch", async () => {
  const commit = "a".repeat(40);
  const sha = "b".repeat(40);
  const document = { sample: "Before" };
  const fetcher = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(null, { status: 404 }))
    .mockResolvedValueOnce(Response.json({ object: { sha: commit } }))
    .mockResolvedValueOnce(Response.json({
      sha, encoding: "base64", content: Buffer.from(JSON.stringify(document)).toString("base64"),
    }))
    .mockResolvedValueOnce(new Response(null, { status: 201 }))
    .mockResolvedValueOnce(new Response(null, { status: 200 }));
  expect(() => githubDraftStore("main", "fixture-token", fetcher)).toThrow();
  expect(fetcher).not.toHaveBeenCalled();
  const store = githubDraftStore("content/home-refresh", "fixture-token", fetcher);
  const reviewed = await store.read("home");
  expect(reviewed.document).toEqual(document);
  await store.save("home", reviewed, { sample: "After" });
  const calls = fetcher.mock.calls.map(([url, options]) => ({
    url: new URL(String(url)), method: options?.method, body: typeof options?.body === "string" ? JSON.parse(options.body) : undefined,
  }));
  expect(calls.slice(0, 3).map(({ method, url }) => [method, url.pathname.split("/repos/jeberulz/weekendmvp")[1], url.search])).toEqual([
    ["GET", "/git/ref/heads/content/home-refresh", ""],
    ["GET", "/git/ref/heads/main", ""],
    ["GET", "/contents/" + homePath, "?ref=" + commit],
  ]);
  expect(calls[3]).toMatchObject({ method: "POST", body: { ref: "refs/heads/content/home-refresh", sha: commit } });
  expect(calls[4]).toMatchObject({ method: "PUT", body: { branch: "content/home-refresh", sha } });
  expect(JSON.parse(Buffer.from(calls[4].body.content, "base64").toString())).toEqual({ sample: "After" });
});

test("a competing GitHub branch creation refuses the stale save before a contents write", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null, { status: 422 }));
  const store = githubDraftStore("content/home-refresh", "fixture-token", fetcher);
  await expect(store.save("home", { document: {}, revision: "b".repeat(40), exists: false, baseCommit: "a".repeat(40) }, {}))
    .rejects.toMatchObject({ status: 409 });
  expect(fetcher).toHaveBeenCalledOnce();
});
