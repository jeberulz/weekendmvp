import { readFile } from "node:fs/promises";
import { expect, test, vi } from "vitest";
import { beforeCopy, landingBlocks, type LandingPageId } from "@/lib/landing-ai/blocks";
import { handleGenerate } from "@/lib/landing-ai/generate";
import { createPreviewLimiter } from "@/lib/landing-ai/rate-limit";
import type { Model } from "@/lib/landing-ai/proposal";

const origin = "http://127.0.0.1:3000";
const input = { page: "home", blockId: "hero", action: "rewrite" };
const usage = { inputTokens: 42, outputTokens: 16 };

function request(body: unknown = input, source = origin) {
  return new Request(origin + "/api/admin/page-ai/generate", {
    method: "POST",
    headers: { origin: source, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function setup() {
  const path = "content/landing-pages/home/index.json";
  const original = await readFile(path, "utf8");
  const document = JSON.parse(original);
  const block = landingBlocks("home", document).find(({ id }) => id === "hero")!;
  const before = beforeCopy(block);
  const after = { ...before, "hero.intro": "Build a small idea with your usual AI tools." };
  const model = vi.fn<Model>().mockResolvedValue({ output: after, usage });
  const dependencies = {
    authorised: vi.fn(async () => true),
    limit: vi.fn(() => 0),
    model: vi.fn<() => Model | null>(() => model),
    read: vi.fn(async (_id: LandingPageId) => document),
  };
  return { path, original, before, after, model, dependencies };
}

test("the generate route hides from anyone without the operator check", async () => {
  const { dependencies, model } = await setup();
  dependencies.authorised.mockResolvedValue(false);
  const response = await handleGenerate(request(), dependencies);
  expect(response.status).toBe(404);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(dependencies.model).not.toHaveBeenCalled();
  expect(dependencies.read).not.toHaveBeenCalled();
  expect(model).not.toHaveBeenCalled();
});

test("the generate route fails closed without a configured key and rejects cross-origin requests", async () => {
  const { dependencies, model } = await setup();
  expect((await handleGenerate(request(input, "https://example.com"), dependencies)).status).toBe(403);
  dependencies.model.mockReturnValue(null);
  const response = await handleGenerate(request(), dependencies);
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ error: expect.stringContaining("Anthropic key") });
  expect(dependencies.limit).not.toHaveBeenCalled();
  expect(dependencies.read).not.toHaveBeenCalled();
  expect(model).not.toHaveBeenCalled();
});

test("a valid preview reports usage and preserves the content file", async () => {
  const { dependencies, path, original, before, after } = await setup();
  const response = await handleGenerate(request(), dependencies);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ before, after, costEstimate: usage });
  expect(await readFile(path, "utf8")).toBe(original);
});

test("the limiter returns a retry time and stops an excess invocation", async () => {
  const { dependencies, model } = await setup();
  const limit = createPreviewLimiter(2, 60_000);
  let clock = 0;
  dependencies.limit.mockImplementation(() => limit(clock));
  expect((await handleGenerate(request(), dependencies)).status).toBe(200);
  expect((await handleGenerate(request(), dependencies)).status).toBe(200);
  const response = await handleGenerate(request(), dependencies);
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("60");
  expect(model).toHaveBeenCalledTimes(2);
  clock = 60_000;
  expect((await handleGenerate(request(), dependencies)).status).toBe(200);
  expect(model).toHaveBeenCalledTimes(3);
});

test("model output validation returns a safe error without reflecting the output", async () => {
  const { dependencies, model } = await setup();
  model.mockResolvedValue({ output: { unexpected: "UNTRUSTED MODEL STRING" }, usage });
  const response = await handleGenerate(request(), dependencies);
  expect(response.status).toBe(422);
  expect(await response.text()).not.toContain("UNTRUSTED MODEL STRING");
});
