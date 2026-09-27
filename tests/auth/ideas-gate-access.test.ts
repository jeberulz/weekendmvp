import { describe, expect, test } from "vitest";
import {
  hasImmediateGateAccess,
} from "../../components/ideas/gate-access";
import { SESSION_HINT_COOKIE } from "../../lib/auth-session-cookie";
import gateAccessSource from "../../components/ideas/gate-access.ts?raw";
import emailGateSource from "../../components/ideas/EmailGate.tsx?raw";
import weeklyPickSource from "../../components/platform/home/WeeklyPick.tsx?raw";

describe("idea email gate — signed-in members skip lead capture", () => {
  test("a WP44 session hint unlocks without ideas_email localStorage", () => {
    expect(
      hasImmediateGateAccess({
        storedEmail: null,
        cookieSource: `${SESSION_HINT_COOKIE}=1`,
        hostname: "www.weekendmvp.app",
      }),
    ).toBe(true);
  });

  test("anonymous visitors on production stay locked without a stored email", () => {
    expect(
      hasImmediateGateAccess({
        storedEmail: null,
        cookieSource: "unrelated=1",
        hostname: "www.weekendmvp.app",
      }),
    ).toBe(false);
  });

  test("stored ideas_email still unlocks when there is no session hint", () => {
    expect(
      hasImmediateGateAccess({
        storedEmail: "reader@example.com",
        cookieSource: "",
        hostname: "www.weekendmvp.app",
      }),
    ).toBe(true);
  });

  test("localhost keeps the existing dev bypass for anonymous browsers", () => {
    expect(
      hasImmediateGateAccess({
        storedEmail: null,
        cookieSource: "",
        hostname: "localhost",
      }),
    ).toBe(true);
    expect(
      hasImmediateGateAccess({
        storedEmail: null,
        cookieSource: "",
        hostname: "127.0.0.1",
      }),
    ).toBe(true);
  });

  test("a forged-looking hint value other than =1 does not unlock", () => {
    expect(
      hasImmediateGateAccess({
        storedEmail: null,
        cookieSource: `${SESSION_HINT_COOKIE}=0`,
        hostname: "www.weekendmvp.app",
      }),
    ).toBe(false);
  });

  test("resolveAccess wires the session hint through hasImmediateGateAccess", () => {
    expect(gateAccessSource).toContain('from "@/lib/auth-session-cookie"');
    expect(gateAccessSource).toContain("hasSessionHintCookie");
    expect(gateAccessSource).toContain("hasImmediateGateAccess");
    expect(gateAccessSource).toContain("cookieSource: document.cookie");
    // Dashboard research stays on the public canonical URL — no second corpus.
    expect(weeklyPickSource).toContain("href={`/ideas/${idea.slug}`}");
    expect(weeklyPickSource).toContain("Read the research");
    expect(emailGateSource).toContain("session hint");
  });
});
