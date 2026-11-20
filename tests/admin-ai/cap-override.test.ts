import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  CAP_OVERRIDE_CEILING_MICRO_USD,
  CAP_OVERRIDE_LIVE,
  capOverrideRefusal,
  effectiveDailyCap,
  endOfUtcDay,
  expiryFor,
  isActive,
  type CapOverride,
} from "@/lib/admin/ai-costs/cap-override";
import { readCapOverrides, resolveControlsBackend, type ControlsBackend } from "@/lib/admin/ai-costs/controls-server";
import { fixtureData } from "@/lib/admin/ai-costs/fixtures";

const HOUR = 60 * 60 * 1000;
const NOON = Date.UTC(2026, 10, 20, 12, 0, 0);
const MIDNIGHT = Date.UTC(2026, 10, 21, 0, 0, 0);

describe("cap override rules", () => {
  test("an override ends by midnight UTC at the latest", () => {
    expect(endOfUtcDay(NOON)).toBe(MIDNIGHT);
    expect(endOfUtcDay(MIDNIGHT)).toBe(MIDNIGHT + 24 * HOUR);
    expect(expiryFor("1h", NOON)).toBe(NOON + HOUR);
    expect(expiryFor("4h", NOON)).toBe(NOON + 4 * HOUR);
    expect(expiryFor("end_of_day", NOON)).toBe(MIDNIGHT);
    const late = MIDNIGHT - 30 * 60 * 1000;
    expect(expiryFor("1h", late)).toBe(MIDNIGHT);
    expect(expiryFor("4h", late)).toBe(MIDNIGHT);
  });

  test("only a raise up to $25 is accepted", () => {
    const plan = 1_000_000;
    expect(capOverrideRefusal(5_000_000, plan)).toBeNull();
    expect(capOverrideRefusal(CAP_OVERRIDE_CEILING_MICRO_USD, plan)).toBeNull();
    expect(capOverrideRefusal(CAP_OVERRIDE_CEILING_MICRO_USD + 1, plan)).toBe("CAP_TOO_HIGH");
    expect(capOverrideRefusal(plan, plan)).toBe("CAP_NOT_A_RAISE");
    expect(capOverrideRefusal(500_000, plan)).toBe("CAP_NOT_A_RAISE");
    expect(capOverrideRefusal(-1, plan)).toBe("INVALID_BUDGET");
    expect(capOverrideRefusal(1.5, plan)).toBe("INVALID_BUDGET");
  });

  test("the effective cap is the override only while it lasts", () => {
    const override: CapOverride = { ownerId: "o", capMicroUsd: 10_000_000, expiresAt: NOON + HOUR, setAt: NOON, reason: "demo" };
    expect(isActive(override, NOON)).toBe(true);
    expect(isActive(override, NOON + HOUR)).toBe(false);
    expect(isActive(null, NOON)).toBe(false);
    expect(effectiveDailyCap(1_000_000, override, NOON)).toBe(10_000_000);
    expect(effectiveDailyCap(1_000_000, override, NOON + HOUR)).toBe(1_000_000);
    expect(effectiveDailyCap(1_000_000, null, NOON)).toBe(1_000_000);
  });
});

const STORE_KEY = Symbol.for("weekendmvp.wp93.fixtureControls");

describe("cap override on local fixtures", () => {
  let backend: ControlsBackend;
  let founder: { ownerId: string; email: string | null; dayCapMicroUsd: number };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOON);
    vi.stubEnv("EDITORIAL_FIXTURE_MODE", "local-demo");
    delete (globalThis as Record<symbol, unknown>)[STORE_KEY];
    const resolved = await resolveControlsBackend();
    if (!resolved) throw new Error("fixture backend expected");
    backend = resolved;
    const summary = fixtureData(NOON).summaries.find((candidate) => candidate.plan === "free");
    if (!summary) throw new Error("a free fixture founder expected");
    founder = summary;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    delete (globalThis as Record<symbol, unknown>)[STORE_KEY];
  });

  const raise = (overrides: Partial<Parameters<ControlsBackend["setCapOverride"]>[0]> = {}) =>
    backend.setCapOverride({ ownerId: founder.ownerId, capMicroUsd: 5_000_000, expiry: "1h", reason: "Demo for an investor", confirm: "confirm", ...overrides });

  test("a raise needs a reason, a real raise, a recent sign-in and the typed confirm", async () => {
    expect(backend.mode).toBe("fixture");
    expect(await backend.capOverrides()).toEqual({ available: true, overrides: [] });

    expect(await raise({ reason: "  " })).toMatchObject({ ok: false, code: "CAP_REASON_REQUIRED" });
    expect(await raise({ capMicroUsd: founder.dayCapMicroUsd })).toMatchObject({ ok: false, code: "CAP_NOT_A_RAISE" });
    expect(await raise({ capMicroUsd: 26_000_000 })).toMatchObject({ ok: false, code: "CAP_TOO_HIGH" });
    expect(await raise({ ownerId: "fixture-nobody" })).toMatchObject({ ok: false, code: "RESOURCE_NOT_FOUND" });
    // The fixture sign-in is an hour old.
    expect(await raise()).toMatchObject({ ok: false, code: "REAUTH_REQUIRED" });
    await backend.simulateSignIn();
    expect(await raise({ confirm: null })).toMatchObject({ ok: false, code: "CONFIRM_REQUIRED" });

    const result = await raise();
    expect(result).toEqual({
      ok: true,
      value: { override: { ownerId: founder.ownerId, capMicroUsd: 5_000_000, expiresAt: NOON + HOUR, setAt: NOON, reason: "Demo for an investor" } },
    });
    expect((await backend.capOverrides()).overrides).toHaveLength(1);

    const recent = (await backend.view()).recent;
    expect(recent[0]).toMatchObject({ action: "ops.cap_override.set", subjectId: founder.ownerId, subjectEmail: founder.email });
    expect(JSON.parse(recent[0].metadata ?? "{}")).toMatchObject({ capMicroUsd: "5000000", expiresAt: NOON + HOUR, reason: "Demo for an investor", risky: true });
  });

  test("an override ends on its own, or early with one click", async () => {
    await backend.simulateSignIn();
    expect(await raise()).toMatchObject({ ok: true });

    vi.setSystemTime(NOON + HOUR);
    expect((await backend.capOverrides()).overrides).toEqual([]);
    expect(await backend.clearCapOverride(founder.ownerId)).toEqual({ ok: true, value: { changed: false } });

    vi.setSystemTime(NOON + HOUR + 1000);
    await backend.simulateSignIn();
    expect(await raise({ expiry: "end_of_day" })).toMatchObject({ ok: true });
    // Ending early needs no fresh sign-in.
    vi.setSystemTime(NOON + 3 * HOUR);
    expect(await backend.clearCapOverride(founder.ownerId)).toEqual({ ok: true, value: { changed: true } });
    expect((await backend.capOverrides()).overrides).toEqual([]);
    const recent = (await backend.view()).recent;
    expect(recent.map((row) => row.action)).toEqual(["ops.cap_override.cleared", "ops.cap_override.set", "ops.cap_override.set"]);
  });

  test("live mode reads nothing while the meter cannot use overrides", async () => {
    expect(CAP_OVERRIDE_LIVE).toBe(false);
    expect(await readCapOverrides("live")).toEqual({ caps: { available: false, overrides: [] }, backend: null });
  });
});
