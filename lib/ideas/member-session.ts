import "server-only";

import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@/convex/_generated/api";
import { memberClient } from "@/app/api/platform/_member-client";

/** The readable session hint is never an access decision. */
export async function currentIdeaMemberToken(): Promise<string | null> {
  const token = await convexAuthNextjsToken();
  if (!token) return null;
  const client = memberClient(token);
  if (!client) return null;
  try {
    await client.mutation(api.ideas.requireVerifiedMember, {});
    return token;
  } catch {
    return null;
  }
}
