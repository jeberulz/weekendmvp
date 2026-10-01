import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("@convex-dev/auth/react", () => ({ useAuthActions: () => ({ signIn: vi.fn(), signOut: vi.fn() }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/admin/editorial/_actions/demo", () => ({ demoConfirmStrongAuthAction: vi.fn() }));

import { StepUpProvider, type StepUp } from "@/components/admin/editorial/common/StepUpContext";
import { StrongAuthStep } from "@/components/admin/editorial/common/StrongAuthStep";

/*
 * WP46-E4e. The live step starts a fresh sign-in with the account's own
 * method; only the local demo offers the simulated confirmation. Neither asks
 * for a password or code.
 */

function render(stepUp: StepUp | null, fresh = false) {
  const step = <StrongAuthStep fresh={fresh} mechanism="Mechanism text" onConfirmed={() => {}} />;
  return renderToStaticMarkup(stepUp ? <StepUpProvider value={stepUp}>{step}</StepUpProvider> : step);
}

describe("Confirm it's you", () => {
  test("live Google accounts sign in again with Google", () => {
    const html = render({ method: "google", email: null });
    expect(html).toContain("Sign in again with Google");
    expect(html).not.toMatch(/simulated/i);
  });

  test("live email accounts get a sign-in link at their own address", () => {
    const html = render({ method: "email", email: "owner@example.test" });
    expect(html).toContain("Email me a sign-in link");
    expect(html).not.toMatch(/simulated/i);
  });

  test("an account with no known method is told how to sign in again", () => {
    expect(render({ method: null, email: null })).toContain("Sign out, sign in again with this account");
  });

  test("a recent sign-in is shown as confirmed", () => {
    expect(render({ method: "google", email: null }, true)).toContain("Confirmed within the last 10 minutes.");
  });

  test("only the local demo simulates it, and never asks for a secret", () => {
    const html = render(null);
    expect(html).toContain("Confirm it’s me (simulated)");
    for (const live of [render({ method: "google", email: null }), render({ method: "email", email: "o@example.test" }), html]) {
      expect(live).not.toMatch(/type="password"|one-time code|<input/i);
    }
  });
});
