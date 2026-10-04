/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";

import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("/convex/**/*.ts");
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

test("revalidation sends the shared secret only in a header", async () => {
  vi.stubEnv("REVALIDATE_SECRET", "test-only-revalidation-secret");
  vi.stubEnv("SITE_URL", "https://www.weekendmvp.app");
  const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  const t = convexTest(schema, modules);

  await t.action(internal.revalidate.run, { tags: ["idea:example", "ideas"] });

  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock).toHaveBeenNthCalledWith(1,
    "https://www.weekendmvp.app/api/revalidate?tag=idea%3Aexample",
    { method: "POST", headers: { "x-weekendmvp-revalidate-secret": "test-only-revalidation-secret" } },
  );
  expect(fetchMock).toHaveBeenNthCalledWith(2,
    "https://www.weekendmvp.app/api/revalidate?tag=ideas",
    { method: "POST", headers: { "x-weekendmvp-revalidate-secret": "test-only-revalidation-secret" } },
  );
});

test("revalidation makes no request when the shared secret is absent", async () => {
  vi.stubEnv("REVALIDATE_SECRET", "");
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const t = convexTest(schema, modules);
  await t.action(internal.revalidate.run, { tags: ["ideas"] });
  expect(fetchMock).not.toHaveBeenCalled();
});
