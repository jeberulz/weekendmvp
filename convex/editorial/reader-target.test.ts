import { describe, expect, it } from "vitest";

import { matchesReaderHealth, readerTarget } from "./reader-target";

const canonical = "https://www.weekendmvp.app/";
const preview = "https://weekendmvp-ab123456-john-iseghohis-projects.vercel.app/";
const stagingBackend = "https://wonderful-armadillo-159.eu-west-1.convex.cloud";
const productionBackend = "https://first-squirrel-244.eu-west-1.convex.cloud";

describe("editorial release reader target", () => {
  it("keeps the production reader canonical and sends no bypass header", () => {
    expect(readerTarget({ EDITORIAL_PUBLIC_SITE_URL: canonical })).toMatchObject({
      site: new URL(canonical), headers: {}, expectedBackend: null,
    });
    expect(readerTarget({ EDITORIAL_PUBLIC_SITE_URL: "http://127.0.0.1:3000/" }).headers).toEqual({});
  });

  it("allows one protected immutable preview only for its matching isolated backend", () => {
    const target = readerTarget({
      EDITORIAL_PUBLIC_SITE_URL: preview,
      CONVEX_CLOUD_URL: stagingBackend,
      EDITORIAL_STAGING_BACKEND_URL: stagingBackend,
      EDITORIAL_STAGING_BYPASS_SECRET: "private-staging-token",
    });
    expect(target).toEqual({
      site: new URL(preview),
      headers: { "x-vercel-protection-bypass": "private-staging-token" },
      expectedBackend: stagingBackend,
    });
    expect(matchesReaderHealth({ protocol: 1, commit: "abc1234", backend: stagingBackend }, "abc1234", target)).toBe(true);
    expect(matchesReaderHealth({ protocol: 1, commit: "abc1234", backend: productionBackend }, "abc1234", target)).toBe(false);
    expect(matchesReaderHealth({ protocol: 1, commit: "stale", backend: stagingBackend }, "abc1234", target)).toBe(false);
  });

  it.each([
    ["wrong backend", { CONVEX_CLOUD_URL: stagingBackend, EDITORIAL_STAGING_BACKEND_URL: "https://other.convex.cloud", EDITORIAL_STAGING_BYPASS_SECRET: "token" }],
    ["serving backend", { CONVEX_CLOUD_URL: productionBackend, EDITORIAL_STAGING_BACKEND_URL: productionBackend, EDITORIAL_STAGING_BYPASS_SECRET: "token" }],
    ["no bypass", { CONVEX_CLOUD_URL: stagingBackend, EDITORIAL_STAGING_BACKEND_URL: stagingBackend }],
  ])("refuses %s", (_label, config) => {
    expect(() => readerTarget({ EDITORIAL_PUBLIC_SITE_URL: preview, ...config })).toThrow();
  });

  it.each([
    "https://example.com/",
    "https://weekendmvp-git-main-john-iseghohis-projects.vercel.app/",
    "https://weekendmvp-ab123456-other-team.vercel.app/",
    "http://weekendmvp-ab123456-john-iseghohis-projects.vercel.app/",
    "https://weekendmvp-ab123456-john-iseghohis-projects.vercel.app:444/",
    "https://www.weekendmvp.app:444/",
    "https://weekendmvp-ab123456-john-iseghohis-projects.vercel.app/path",
    "https://weekendmvp-ab123456-john-iseghohis-projects.vercel.app/?x-vercel-protection-bypass=token",
  ])("refuses unapproved or non-bare origin %s", (url) => {
    expect(() => readerTarget({ EDITORIAL_PUBLIC_SITE_URL: url })).toThrow();
  });

  it("never sends the staging bypass to the canonical host", () => {
    expect(() => readerTarget({
      EDITORIAL_PUBLIC_SITE_URL: canonical,
      EDITORIAL_STAGING_BACKEND_URL: stagingBackend,
      EDITORIAL_STAGING_BYPASS_SECRET: "token",
    })).toThrow(/immutable staging deployment/);
  });
});
