import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { StorageMode } from "@/keystatic.config";
import { actionSchema, pageIdSchema, type Copy, type LandingPageId } from "./blocks";

export const contentBranch = z.string().regex(/^content\/[a-zA-Z0-9][a-zA-Z0-9_-]*(?:\/[a-zA-Z0-9][a-zA-Z0-9_-]*)*$/).max(120);
const expiresAfter = 15 * 60 * 1000;
const runtime = globalThis as typeof globalThis & { landingPreviewKey?: Buffer };

type ProposalTarget = {
  page: LandingPageId; blockId: string; action: z.infer<typeof actionSchema>; branch?: string;
};

const proof = z.strictObject({
  page: pageIdSchema, blockId: z.string(), action: actionSchema, destination: z.string(),
  revision: z.string(), digest: z.string(), beforeDigest: z.string(), expires: z.number(),
});

export function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function copyDigest(copy: Copy) {
  return digest(JSON.stringify(Object.entries(copy).sort(([left], [right]) => left.localeCompare(right))));
}

function signingKey(mode: StorageMode) {
  if (mode === "github") {
    const key = process.env.KEYSTATIC_SECRET;
    if (!key || key.length < 32) throw new Error("The editor signing key is unavailable.");
    return key;
  }
  return runtime.landingPreviewKey ??= randomBytes(32);
}

function signature(mode: StorageMode, payload: string) {
  return createHmac("sha256", signingKey(mode)).update(payload).digest();
}

export function sealProposal(
  mode: StorageMode, target: ProposalTarget, revision: string, before: Copy, after: Copy,
) {
  const payload = Buffer.from(JSON.stringify({
    page: target.page, blockId: target.blockId, action: target.action,
    destination: target.branch ?? "local", revision,
    digest: copyDigest(after), beforeDigest: copyDigest(before), expires: Date.now() + expiresAfter,
  })).toString("base64url");
  return `${payload}.${signature(mode, payload).toString("base64url")}`;
}

export function openProposal(mode: StorageMode, ticket: string, target: ProposalTarget) {
  const [payload, mac, extra] = ticket.split(".");
  if (!payload || !mac || extra !== undefined) return null;
  const expected = signature(mode, payload);
  const actual = Buffer.from(mac, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const data = proof.parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
    if (data.expires <= Date.now() || data.page !== target.page || data.action !== target.action
      || data.blockId !== target.blockId || data.destination !== (target.branch ?? "local")) return null;
    return data;
  } catch {
    return null;
  }
}
