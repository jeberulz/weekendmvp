import { afterEach, expect, test, vi } from "vitest";

const fetchQuery = vi.hoisted(() => vi.fn());
vi.mock("convex/nextjs", () => ({ fetchQuery }));
vi.mock("@convex-dev/auth/nextjs/server", () => ({
  convexAuthNextjsToken: async () => "test-token",
}));

import { GET } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
  fetchQuery.mockReset();
});

test("an aborted CSV request stops before fetching another page", async () => {
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "http://127.0.0.1:3370");
  fetchQuery.mockResolvedValue({
    page: [{ id: "lead-1", email: "lead@example.test", createdAt: 0 }],
    continueCursor: "next", isDone: false,
  });
  const controller = new AbortController();
  const response = await GET(new Request(
    "https://www.weekendmvp.app/api/platform/leads/export?projectId=project-1",
    { headers: { host: "www.weekendmvp.app" }, signal: controller.signal },
  ));
  expect(response.status).toBe(200);
  controller.abort();
  await response.text();
  expect(fetchQuery).toHaveBeenCalledTimes(1);
});

test("a failed later page errors the stream instead of claiming a complete CSV", async () => {
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "http://127.0.0.1:3370");
  fetchQuery
    .mockResolvedValueOnce({
      page: [{ id: "lead-1", email: "lead@example.test", createdAt: 0 }],
      continueCursor: "next", isDone: false,
    })
    .mockRejectedValueOnce(new Error("Convex offline"));
  const response = await GET(new Request(
    "https://www.weekendmvp.app/api/platform/leads/export?projectId=project-1",
    { headers: { host: "www.weekendmvp.app" } },
  ));
  await expect(response.text()).rejects.toThrow("Convex offline");
  expect(fetchQuery).toHaveBeenCalledTimes(2);
});
