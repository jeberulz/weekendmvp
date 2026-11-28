// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { MemberActivity } from "@/components/consent/MemberActivity";

const state = vi.hoisted(() => ({ path: "/dashboard/b/private-id/email", consent: true }));
vi.mock("next/navigation", () => ({ usePathname: () => state.path }));
vi.mock("@/components/consent/ConsentProvider", () => ({ useConsent: () => ({ consent: state.consent }) }));

test("a consented visit excludes background time, raw identifiers and admin navigation", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const send = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", send);
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  const now = vi.spyOn(performance, "now").mockReturnValue(0);
  const root = createRoot(document.createElement("div"));
  const tick = () => act(async () => { await vi.advanceTimersByTimeAsync(1); });
  try {
    document.cookie = "wmvp_signed_in=1; path=/";
    await act(async () => root.render(<MemberActivity />));
    await tick();
    expect(send).not.toHaveBeenCalled(); // Legacy consent has no account-linked opt-in.
    document.cookie = "member_activity_consent=true; path=/";
    state.path = "/dashboard/b/another-id/email";
    await act(async () => root.render(<MemberActivity />));
    await tick();
    const report = () => JSON.parse(send.mock.lastCall![1].body);
    expect(report()).toMatchObject({ page: "/dashboard/b/[id]/email", focusedMs: 0 });
    now.mockReturnValue(2500);
    window.dispatchEvent(new Event("blur"));
    expect(report().focusedMs).toBe(2500);
    now.mockReturnValue(90_000);
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(send).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new Event("focus"));
    now.mockReturnValue(91_000);
    state.path = "/admin";
    await act(async () => root.render(<MemberActivity />));
    expect(report().focusedMs).toBe(3500);
    await tick();
    expect(send).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(send.mock.calls)).not.toContain("another-id");
  } finally {
    await act(async () => root.unmount());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  }
});
