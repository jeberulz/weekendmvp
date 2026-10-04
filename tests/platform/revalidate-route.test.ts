import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag }));

import { POST } from "../../app/api/revalidate/route";

const secret = "test-only-revalidation-secret";

function request(tag: string | null, header?: string, querySecret?: string): Request {
  const url = new URL("https://www.weekendmvp.app/api/revalidate");
  if (tag !== null) url.searchParams.set("tag", tag);
  if (querySecret) url.searchParams.set("secret", querySecret);
  return new Request(url, {
    method: "POST",
    headers: header ? { "x-weekendmvp-revalidate-secret": header } : {},
  });
}

describe("cache revalidation authentication", () => {
  beforeEach(() => {
    process.env.REVALIDATE_SECRET = secret;
    revalidateTag.mockClear();
  });

  afterEach(() => {
    delete process.env.REVALIDATE_SECRET;
  });

  it("refuses the old query-string credential, missing and wrong headers", async () => {
    expect((await POST(request("ideas", undefined, secret))).status).toBe(401);
    expect((await POST(request("ideas"))).status).toBe(401);
    expect((await POST(request("ideas", "wrong"))).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("fails closed if the server secret is missing", async () => {
    delete process.env.REVALIDATE_SECRET;
    expect((await POST(request("ideas", secret))).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("requires a tag after authentication", async () => {
    expect((await POST(request(null, secret))).status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("revalidates only an authenticated tag", async () => {
    const response = await POST(request("idea:example", secret));
    expect(response.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledExactlyOnceWith("idea:example", "max");
  });
});
