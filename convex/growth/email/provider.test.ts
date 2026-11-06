import { describe, expect, it } from "vitest";
import { tenantFromAddress, tenantResendOptions } from "./provider";

describe("tenant Resend isolation", () => {
  it("does not inherit the generic component or auth-mail key", () => {
    expect(tenantResendOptions({})).toEqual({ apiKey: "", webhookSecret: "", testMode: true });
    expect(tenantResendOptions({
      TENANT_RESEND_API_KEY: " tenant-key ",
      TENANT_RESEND_WEBHOOK_SECRET: " tenant-hook ",
    })).toEqual({ apiKey: "tenant-key", webhookSecret: "tenant-hook", testMode: true });
  });

  it("needs an explicit live setting and a tenant sender", () => {
    expect(tenantResendOptions({ TENANT_EMAIL_LIVE_ENABLED: "TRUE" }).testMode).toBe(true);
    expect(tenantResendOptions({ TENANT_EMAIL_LIVE_ENABLED: "true" }).testMode).toBe(true);
    expect(tenantResendOptions({
      TENANT_EMAIL_LIVE_ENABLED: "true",
      TENANT_RESEND_API_KEY: "key",
      TENANT_RESEND_FROM: "hi@send.weekendmvp.app",
    }).testMode).toBe(true);
    expect(tenantResendOptions({
      TENANT_EMAIL_LIVE_ENABLED: "true",
      TENANT_RESEND_API_KEY: "key",
      TENANT_RESEND_FROM: "hi@send.weekendmvp.app",
      TENANT_RESEND_WEBHOOK_SECRET: "hook",
    }).testMode).toBe(false);
    expect(() => tenantFromAddress({ TENANT_RESEND_API_KEY: "key" })).toThrow("TENANT_EMAIL_NOT_CONFIGURED");
    expect(() => tenantFromAddress({ TENANT_RESEND_API_KEY: "key", TENANT_RESEND_FROM: "onboarding@resend.dev" }))
      .toThrow("TENANT_EMAIL_NOT_CONFIGURED");
    expect(tenantFromAddress({ TENANT_RESEND_API_KEY: "key", TENANT_RESEND_FROM: "hi@send.weekendmvp.app" }))
      .toBe("hi@send.weekendmvp.app");
  });
});
