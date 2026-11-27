// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { TicketCheckoutButton } from "@/components/live/TicketCheckoutButton";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

afterEach(() => {
  cleanup();
  router.push.mockReset();
  vi.unstubAllGlobals();
});

test("purchase renders without an auth provider and a signed-out visitor returns via signup", async () => {
  const post = vi.fn().mockResolvedValue(Response.json({ ok: false, code: "AUTHENTICATION_REQUIRED" }, { status: 401 }));
  vi.stubGlobal("fetch", post);

  render(<TicketCheckoutButton label="Get my ticket, $29" />);
  fireEvent.click(screen.getByRole("button", { name: "Get my ticket, $29" }));

  await waitFor(() => expect(router.push).toHaveBeenCalledOnce());
  const url = new URL(router.push.mock.calls[0][0], "https://weekendmvp.app");
  expect(url.pathname).toBe("/signup");
  expect(url.searchParams.get("returnTo")).toBe("/live/build-along?src=live-buildalong#ticket");
  expect(url.searchParams.get("src")).toBe("live-buildalong");

  const [path, options] = post.mock.calls[0];
  expect(path).toBe("/api/live/checkout");
  expect(options.method).toBe("POST");
  expect(JSON.parse(options.body)).toEqual({ idempotencyKey: expect.stringMatching(/^live_/u) });
});

test("a next-session request keeps the checkout error on the page", async () => {
  const post = vi.fn().mockResolvedValue(Response.json({ ok: false, code: "SOLD_OUT" }, { status: 409 }));
  vi.stubGlobal("fetch", post);

  render(<TicketCheckoutButton label="Get a seat for 5 Dec" nextSession />);
  fireEvent.click(screen.getByRole("button", { name: "Get a seat for 5 Dec" }));

  expect((await screen.findByRole("status")).textContent).toBe("Sold out — the next date is Sat 5 Dec.");
  expect(JSON.parse(post.mock.calls[0][1].body)).toEqual({
    idempotencyKey: expect.stringMatching(/^live_/u),
    next: true,
  });
  expect(router.push).not.toHaveBeenCalled();
});
