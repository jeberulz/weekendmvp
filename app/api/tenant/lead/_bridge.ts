import { createHmac } from "node:crypto";

const MIN_SECRET_LENGTH = 32;

export function tenantLeadBridgeSecret(source: Readonly<Record<string, string | undefined>>) {
  const secret = source.TENANT_LEAD_BRIDGE_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error("TENANT_LEAD_BRIDGE_NOT_CONFIGURED");
  }
  return secret;
}

/** The raw client IP never crosses into Convex or its rate-limiter records. */
export function signTenantLeadPayload(
  hostname: string,
  clientKey: string,
  secret: string,
  issuedAt = Date.now(),
) {
  const rateLimitKey = `client:${createHmac("sha256", secret)
    .update(clientKey)
    .digest("base64url")}`;
  const payload = JSON.stringify({ hostname, rateLimitKey, issuedAt });
  return {
    payload,
    signature: createHmac("sha256", secret).update(payload).digest("base64url"),
  };
}
