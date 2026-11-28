import { renderToReadableStream } from "react-dom/server";
import { getFunctionName } from "convex/server";
import { expect, test, vi } from "vitest";
import AdminPage from "@/app/admin/page";

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@convex-dev/auth/nextjs/server", () => ({ convexAuthNextjsToken: async () => "local-test-session" }));
vi.mock("convex/nextjs", () => ({
  fetchQuery: vi.fn(async (ref, args, options) => {
    expect(options.token).toBe("local-test-session");
    if (getFunctionName(ref) === "admin/members:week") return { signups: 2, active: 1 };
    expect(args.cursor).toBeNull();
    return { page: [{
      id: "example", name: "Example Member", email: "member@example.test", providers: ["google"],
      joined: 1000, views: 1, focusedMs: 12500, lastSeen: 20000,
      recent: [{ page: "/dashboard/saved", started: 1000, focusedMs: 12500 }],
      events: [{ action: "business.created", actorType: "user", createdAt: 1500 }],
    }], next: "next-page" };
  }),
}));

test("owner overview renders signups, member identity, activity details and the next page", async () => {
  const stream = await renderToReadableStream(<AdminPage searchParams={Promise.resolve({})} />);
  await stream.allReady;
  const html = await new Response(stream).text();
  for (const value of ["Member directory", "Signups in the last 7 days", "member@example.test", "Google",
    "12s", "/dashboard/saved", "business.created", "/admin?cursor=next-page"]) expect(html).toContain(value);
});
