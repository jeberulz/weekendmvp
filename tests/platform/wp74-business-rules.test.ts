import { describe, expect, test } from "vitest";

import { RESERVED_SUBDOMAINS } from "@/lib/tenant-host";
import {
  DISPOSABLE_EMAIL_DOMAINS,
  emailAddressDomain,
  emailDomain,
  isDisposableEmailDomain,
} from "@/lib/workspace/disposable-domains";
import {
  TENANT_SLUG_BASE_MAX,
  TENANT_SLUG_MAX_ATTEMPTS,
  isReservedTenantBase,
  pickTenantSlug,
  tenantSlugBase,
  tenantSlugCandidate,
} from "@/lib/workspace/wizard/tenant-slug";

describe("WP74-S4 disposable email domains", () => {
  test("the starter list is curated: 50 to 150 lowercase domains", () => {
    expect(DISPOSABLE_EMAIL_DOMAINS.size).toBeGreaterThanOrEqual(50);
    expect(DISPOSABLE_EMAIL_DOMAINS.size).toBeLessThanOrEqual(150);
    for (const domain of DISPOSABLE_EMAIL_DOMAINS) {
      expect(domain).toMatch(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/);
    }
  });

  test.each([
    "someone@mailinator.com",
    "someone@guerrillamail.com",
    "someone@10minutemail.com",
    "someone@yopmail.com",
    "someone@temp-mail.org",
    "mailinator.com",
  ])("%s is disposable", (value) => {
    expect(isDisposableEmailDomain(value)).toBe(true);
  });

  test.each([
    "someone@inbox.mailinator.com",
    "someone@a.b.yopmail.com",
    "someone@MAILINATOR.COM",
    "someone@Inbox.YopMail.Com.",
    "  someone@mailinator.com  ",
    "odd@name@mailinator.com",
  ])("%s is disposable (subdomain, case, trailing dot, spaces)", (value) => {
    expect(isDisposableEmailDomain(value)).toBe(true);
  });

  test.each([
    "someone@gmail.com",
    "someone@outlook.com",
    "founder@hydrotrail.co.uk",
    "team@acme-industries.com",
    "someone@gmail.tm",
    "someone@notmailinator.com",
    "someone@mailinator.com.evil.example",
    "someone@bücher.example",
    "someone@ＭＡＩＬ.example",
  ])("%s is not disposable", (value) => {
    expect(isDisposableEmailDomain(value)).toBe(false);
  });

  test("full-width letters fold with NFKC before matching", () => {
    expect(emailDomain("x@ＭＡＩＬＩＮＡＴＯＲ.ＣＯＭ")).toBe("mailinator.com");
    expect(isDisposableEmailDomain("x@ＭＡＩＬＩＮＡＴＯＲ.ＣＯＭ")).toBe(true);
  });

  test.each([
    ["a@x.yopmail\u3002com", "x.yopmail.com"],
    ["a@x\uFF0Eyopmail\uFF0Ecom", "x.yopmail.com"],
    ["a@x\uFF61yopmail\uFF61com", "x.yopmail.com"],
  ])("look-alike full stops in %s become dots", (value, domain) => {
    expect(emailDomain(value)).toBe(domain);
    expect(isDisposableEmailDomain(value)).toBe(true);
  });

  test.each([
    "",
    "@",
    "someone@",
    "someone@.",
    "someone@a..b",
    "someone@ex ample.com",
    "someone@yopmail.com..",
    "someone@.yopmail.com",
    "someone@localhost",
    "someone@yopmail\u3002\u3002com",
  ])("%s has no parseable domain, so the caller must refuse it", (value) => {
    expect(emailAddressDomain(value)).toBeNull();
    expect(isDisposableEmailDomain(value)).toBe(false);
  });

  test("an address needs an @ before its domain counts", () => {
    expect(emailAddressDomain("yopmail.com")).toBeNull();
    expect(emailAddressDomain("a@yopmail.com")).toBe("yopmail.com");
  });
});

describe("WP74-S4 tenant slug", () => {
  test.each([
    ["HydroTrail", "hydrotrail"],
    ["Café Ünïcode!!", "cafe-unicode"],
    ["  Trail -- Water  ", "trail-water"],
    ["AI", "ai-business"],
    ["X", "x-business"],
    ["水の道", "business"],
    ["!!!", "business"],
  ])("%s has base %s", (name, base) => {
    expect(tenantSlugBase(name)).toBe(base);
  });

  test("the base is length-bounded so a suffix still fits a DNS label", () => {
    const base = tenantSlugBase(`${"a".repeat(47)} ${"b".repeat(30)}`);
    expect(base).toBe("a".repeat(47));
    expect(base.length).toBeLessThanOrEqual(TENANT_SLUG_BASE_MAX);
    expect(tenantSlugCandidate(base, TENANT_SLUG_MAX_ATTEMPTS).length).toBeLessThanOrEqual(63);
    expect(tenantSlugBase("c".repeat(80))).toBe("c".repeat(TENANT_SLUG_BASE_MAX));
  });

  test("candidates are deterministic: base, base-2, base-3", () => {
    expect([1, 2, 3].map((n) => tenantSlugCandidate("hydrotrail", n))).toEqual(["hydrotrail", "hydrotrail-2", "hydrotrail-3"]);
  });

  test.each(["support", "admin", "www", "billing", "login", "weekendmvp", "weekend-mvp", "weekendmvp-tools", "the-weekend-mvp-team"])(
    "the reserved base %s is refused, never suffixed",
    async (base) => {
      expect(isReservedTenantBase(base)).toBe(true);
      await expect(pickTenantSlug(base, async () => false)).resolves.toEqual({ kind: "reserved" });
    },
  );

  test("reserved names read through normalisation are refused too", async () => {
    for (const name of ["Support", "BILLING!", "Weekend MVP", "Login", "Wéekend-MVP Labs"]) {
      expect(isReservedTenantBase(tenantSlugBase(name))).toBe(true);
    }
    expect(RESERVED_SUBDOMAINS.has(tenantSlugBase("Support"))).toBe(true);
    await expect(pickTenantSlug("Support", async () => false)).resolves.toEqual({ kind: "reserved" });
    await expect(pickTenantSlug("WeekendMVP Studio", async () => false)).resolves.toEqual({ kind: "reserved" });
  });

  test("ordinary names that merely contain a reserved word are fine", async () => {
    for (const name of ["Support Bot Co", "Trail Help", "Billingsgate Fish"]) {
      expect(isReservedTenantBase(tenantSlugBase(name))).toBe(false);
    }
  });

  test("collisions take the first free suffix, the same way every time", async () => {
    const taken = new Set(["hydrotrail", "hydrotrail-2"]);
    const checked: string[] = [];
    const isTaken = async (slug: string) => {
      checked.push(slug);
      return taken.has(slug);
    };
    await expect(pickTenantSlug("HydroTrail", isTaken)).resolves.toEqual({ kind: "ok", slug: "hydrotrail-3" });
    expect(checked).toEqual(["hydrotrail", "hydrotrail-2", "hydrotrail-3"]);
    await expect(pickTenantSlug("HydroTrail", async (slug) => taken.has(slug))).resolves.toEqual({ kind: "ok", slug: "hydrotrail-3" });
  });

  test("gives up after the attempt limit", async () => {
    await expect(pickTenantSlug("HydroTrail", async () => true)).resolves.toEqual({ kind: "exhausted" });
  });
});
