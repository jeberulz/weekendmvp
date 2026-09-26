import { afterEach, expect, test, vi } from "vitest";

const state = vi.hoisted(() => ({ subscribe: vi.fn(), mutation: vi.fn(), after: vi.fn() }));
vi.mock("next/server", () => ({ after: state.after }));
vi.mock("@/lib/beehiiv", () => ({ beehiivSubscribe: state.subscribe }));
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class { mutation = state.mutation; },
}));
import { POST } from "../../app/api/subscribe/route";

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

test("subscribe HTTP sends the same canonical NFKC email to Beehiiv and the event log", async () => {
  vi.stubEnv("BEEHIIV_API_KEY", "test-only");
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "http://127.0.0.1:3310");
  state.subscribe.mockResolvedValue({ ok: true, status: 200, data: {} });
  const response = await POST(new Request("http://localhost/api/subscribe", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "　Ｍｅｍｂｅｒ＠Ｅｘａｍｐｌｅ．ＴＥＳＴ　" }),
  }));
  expect(response.status).toBe(200);
  expect(state.subscribe).toHaveBeenCalledWith(expect.objectContaining({ email: "member@example.test" }));
  expect(state.after).toHaveBeenCalledOnce();
  await state.after.mock.calls[0][0]();
  expect(state.mutation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ email: "member@example.test" }));
});

test("normalization does not accept an invalid email or send an enrollment", async () => {
  const response = await POST(new Request("http://localhost/api/subscribe", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "　＠　" }),
  }));
  expect(response.status).toBe(400);
  expect(state.subscribe).not.toHaveBeenCalled();
  expect(state.after).not.toHaveBeenCalled();
});
