import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";

/** Preserve the difference between invalid credentials and backend outages. */
export function memberClient(token: string) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  return new ConvexHttpClient(url, {
    auth: token,
    logger: false,
    fetch: async (input, init) => {
      const response = await fetch(input, init);
      // JWT validation happens before the function and responds with HTTP 401.
      // Revoked sessions fail inside the function with the same typed code.
      if (response.status === 401) throw new ConvexError({ code: "UNAUTHENTICATED" });
      return response;
    },
  });
}

export function memberErrorCode(error: unknown): string | undefined {
  return error instanceof ConvexError ? (error.data as { code?: string } | null)?.code : undefined;
}
