import { describe, expect, test } from "vitest";
import { safePlatformReturn } from "../../lib/auth-return";
import { safeAuthRedirect } from "../../convex/auth";
import { createResendMagicLinkEmail } from "../../convex/resendMagicLink";
import ideaPageSource from "../../app/ideas/[slug]/page.tsx?raw";
import archivePageSource from "../../app/startup-ideas/page.tsx?raw";
import emailGateSource from "../../components/ideas/EmailGate.tsx?raw";

describe("verified-account ideas gate", () => {
  test.each(["/startup-ideas", "/ideas/freelance-scope-creep-detector"])(
    "keeps the intended destination through every auth redirect: %s",
    (path) => {
      expect(safePlatformReturn(path)).toBe(path);
      expect(safeAuthRedirect(path)).toBe(path);
      const email = createResendMagicLinkEmail({
        identifier: "reader@example.test", token: "opaque-token",
        verificationUrl: `https://www.weekendmvp.app${path}`,
        siteUrl: "https://www.weekendmvp.app", from: "Weekend MVP <hello@weekendmvp.app>",
      });
      expect(new URL(email.link).searchParams.get("returnTo")).toBe(path);
    },
  );

  test.each([
    "//evil.example/ideas/example", "/ideas/../dashboard", "/ideas/%65xample",
    "/ideas/example?e=reader@example.test", "/ideas/example?token=secret",
    "/ideas/example/extra", "/signup", "https://evil.example/startup-ideas",
  ])("rejects unsafe public return targets: %s", (path) => {
    expect(safePlatformReturn(path)).toBe("/dashboard");
  });

  test("renders the anonymous branch before passing research to the page", () => {
    expect(archivePageSource).toContain("if (!(await currentIdeaMemberToken())) return <StartupIdeasTeaser />");
    expect(ideaPageSource).toContain("if (!token) {");
    expect(ideaPageSource).toContain("<EmailGate");
    expect(ideaPageSource).toContain("slug={slug}");
    expect(ideaPageSource).toContain("<IdeaPublicHeader");
    expect(ideaPageSource).toContain("IdeaPublicSummary");
    expect(ideaPageSource).toContain("buildPublicSchema");
    expect(emailGateSource).toContain("<AuthCard mode=\"signup\"");
    expect(emailGateSource).toContain("children: React.ReactNode");
    // Deep research stays out of the gate; public children hold teasers/prompts only.
    expect(emailGateSource).not.toContain("title: string");
  });
});
