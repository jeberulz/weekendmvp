import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { memberClient, memberErrorCode } from "../_member-client";
import { isSameOriginWrite } from "../saved/_server";
import { NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
import { memberPages } from "@/lib/member-pages";

export async function POST(request: NextRequest) {
  if (!isSameOriginWrite(request) || request.cookies.get("member_activity_consent")?.value !== "true" || request.cookies.get("analytics_consent")?.value !== "true") {
    return new Response(null, { status: 403 });
  }
  const token = await convexAuthNextjsToken();
  if (!token) return new Response(null, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || !memberPages.includes(body.page) || typeof body.key !== "string" || body.key.length !== 36 ||
    !Number.isSafeInteger(body.focusedMs) || body.focusedMs < 0) return new Response(null, { status: 400 });
  const client = memberClient(token);
  if (!client) return new Response(null, { status: 503 });
  try {
    await client.mutation(api.admin.members.record, { key: body.key, page: body.page, focusedMs: body.focusedMs });
  } catch (error) {
    return new Response(null, { status: memberErrorCode(error) === "UNAUTHENTICATED" ? 401 : 503 });
  }
  return new Response(null, { status: 204 });
}
