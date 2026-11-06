import { Resend, type ResendOptions } from "@convex-dev/resend";
import { components } from "../../_generated/api";
import { env } from "../../_generated/server";

type TenantMailEnv = {
  TENANT_RESEND_API_KEY?: string;
  TENANT_RESEND_WEBHOOK_SECRET?: string;
  TENANT_RESEND_FROM?: string;
  TENANT_EMAIL_LIVE_ENABLED?: string;
};

/** Explicit keys avoid the component's generic RESEND_* fallback. */
export function tenantResendOptions(source: TenantMailEnv): ResendOptions {
  return {
    apiKey: source.TENANT_RESEND_API_KEY?.trim() ?? "",
    webhookSecret: source.TENANT_RESEND_WEBHOOK_SECRET?.trim() ?? "",
    testMode: source.TENANT_EMAIL_LIVE_ENABLED !== "true",
  };
}

/** A configured, verified tenant sender is required before enqueueing. */
export function tenantFromAddress(source: TenantMailEnv): string {
  const address = source.TENANT_RESEND_FROM?.trim() ?? "";
  if (!source.TENANT_RESEND_API_KEY?.trim() ||
      !address ||
      !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(address) ||
      address.toLowerCase().endsWith("@resend.dev")) {
    throw new Error("TENANT_EMAIL_NOT_CONFIGURED");
  }
  return address;
}

// The generated Env type catches up when Convex codegen runs against the
// additive config declaration; runtime env still comes from Convex.
export const tenantResend = new Resend(components.resend, tenantResendOptions(env as TenantMailEnv));
