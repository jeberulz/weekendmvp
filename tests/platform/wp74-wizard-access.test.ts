import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const auth = vi.hoisted(() => ({
  readToken: async (): Promise<string | null> => "session-token",
}));
const fetchQuery = vi.hoisted(() => vi.fn());

vi.mock("@convex-dev/auth/nextjs/server", () => ({
  convexAuthNextjsToken: () => auth.readToken(),
}));
vi.mock("convex/nextjs", () => ({ fetchQuery }));
vi.mock("next/server", () => ({ connection: async () => undefined }));

import { api } from "../../convex/_generated/api";
import { requireWizardAccess, type WizardAccess } from "../../lib/workspace/wizard-access";

async function outcome(ideaSlug: string | null): Promise<"not-found" | WizardAccess> {
  try {
    return await requireWizardAccess(ideaSlug);
  } catch (error) {
    const digest = (error as { digest?: unknown }).digest;
    if (typeof digest === "string" && digest.endsWith(";404")) return "not-found";
    throw error;
  }
}

describe("WP74-S1 requireWizardAccess (/start/* gate)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://example-test-123.convex.cloud");
    auth.readToken = async () => "session-token";
    fetchQuery.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  test("allowed returns the idea title and passes the session token and slug", async () => {
    fetchQuery.mockResolvedValue({ allowed: true, ideaTitle: "HydroTrail" });
    await expect(outcome("hydrotrail")).resolves.toEqual({ kind: "allowed", ideaTitle: "HydroTrail" });
    const [ref, args, options] = fetchQuery.mock.calls[0] ?? [];
    expect(getFunctionName(ref)).toBe(getFunctionName(api.workspace.wizard.getWizardAccess));
    expect(args).toEqual({ ideaSlug: "hydrotrail" });
    expect(options).toEqual({ token: "session-token" });
  });

  test("the own-idea route asks without a slug", async () => {
    fetchQuery.mockResolvedValue({ allowed: true, ideaTitle: null });
    await expect(outcome(null)).resolves.toEqual({ kind: "allowed", ideaTitle: null });
    expect(fetchQuery.mock.calls[0]?.[1]).toEqual({});
  });

  test("a denial (workspace off, closed cohort, unknown idea) is a 404", async () => {
    // getWizardAccess refuses, then awaitingInvite says no.
    fetchQuery.mockResolvedValueOnce({ allowed: false }).mockResolvedValueOnce(false);
    await expect(outcome("hydrotrail")).resolves.toBe("not-found");
  });

  test("L1-C9: a signed-in founder off the allowlist is not-invited, asked with the same token", async () => {
    fetchQuery.mockResolvedValueOnce({ allowed: false }).mockResolvedValueOnce(true);
    await expect(outcome("hydrotrail")).resolves.toEqual({ kind: "not-invited" });
    const [ref, args, options] = fetchQuery.mock.calls[1] ?? [];
    expect(getFunctionName(ref)).toBe(getFunctionName(api.buildCta.awaitingInvite));
    expect(args).toEqual({});
    expect(options).toEqual({ token: "session-token" });
  });

  test("L1-C9: an allowed founder never triggers the invite read", async () => {
    fetchQuery.mockResolvedValue({ allowed: true, ideaTitle: null });
    await outcome(null);
    expect(fetchQuery).toHaveBeenCalledTimes(1);
  });

  test("L1-C9: a failing invite read keeps the 404", async () => {
    fetchQuery.mockResolvedValueOnce({ allowed: false }).mockRejectedValueOnce(new Error("backend down"));
    await expect(outcome(null)).resolves.toBe("not-found");
  });

  test("signed out is a 404 without asking Convex", async () => {
    auth.readToken = async () => null;
    await expect(outcome("hydrotrail")).resolves.toBe("not-found");
    expect(fetchQuery).not.toHaveBeenCalled();
  });

  test("a token or backend failure is the same 404", async () => {
    auth.readToken = async () => {
      throw new Error("cookie decode failed");
    };
    await expect(outcome(null)).resolves.toBe("not-found");
    auth.readToken = async () => "session-token";
    fetchQuery.mockRejectedValue(new Error("backend down"));
    await expect(outcome(null)).resolves.toBe("not-found");
  });

  test("no valid Convex URL is a 404 without asking Convex", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "");
    await expect(outcome(null)).resolves.toBe("not-found");
    expect(fetchQuery).not.toHaveBeenCalled();
  });
});
