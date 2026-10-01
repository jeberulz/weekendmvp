import "server-only";

import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import { isValidPlatformConvexUrl } from "@/lib/platform-convex-url";
import type { FixtureDemoControls } from "../adapters/fixture/demo";
import { ConvexEditorialRepository, readLiveSession, type LiveEditor } from "../adapters/live/repository";
import type { EditorialRepository } from "../contracts/repository";

/**
 * The editorial data access layer. Every page, server action and route
 * handler resolves the workspace here; layouts and client gating are never
 * the only check.
 *
 * - Development with `EDITORIAL_FIXTURE_MODE=local-demo` exactly: the
 *   in-memory fixture workspace. That branch is compiled out of production
 *   builds because `process.env.NODE_ENV` is inlined as "production". No
 *   query parameter, cookie, header or browser-storage switch exists.
 * - Otherwise: the live workspace, only for a signed-in account that Convex
 *   confirms holds the super-admin capability. Everyone else, and anyone the
 *   backend cannot vouch for, gets "unavailable" (a 404 for pages).
 */
export type EditorialWorkspace =
  | {
      status: "fixture";
      repository: EditorialRepository;
      /** Request time, read once per request. */
      nowMs: number;
      demo: FixtureDemoControls;
      reset(): Promise<void>;
    }
  | {
      status: "live";
      repository: EditorialRepository;
      /** Request time, read once per request. */
      nowMs: number;
      editor: LiveEditor;
    }
  | {
      status: "unavailable";
      reason: "not_configured" | "not_signed_in" | "no_capability" | "backend_unavailable";
    };

export type ActiveWorkspace = Extract<EditorialWorkspace, { status: "fixture" | "live" }>;

export const FIXTURE_MODE_VALUE = "local-demo";

async function resolveLiveWorkspace(): Promise<EditorialWorkspace> {
  if (!isValidPlatformConvexUrl(process.env.NEXT_PUBLIC_CONVEX_URL)) {
    return { status: "unavailable", reason: "not_configured" };
  }
  const token = await convexAuthNextjsToken();
  if (!token) return { status: "unavailable", reason: "not_signed_in" };
  const nowMs = Date.now();
  const session = await readLiveSession(token, nowMs);
  if (session === null) return { status: "unavailable", reason: "backend_unavailable" };
  if (session.editor === null) {
    return { status: "unavailable", reason: session.signedIn ? "no_capability" : "not_signed_in" };
  }
  return { status: "live", repository: new ConvexEditorialRepository(token), nowMs, editor: session.editor };
}

async function resolveWorkspace(): Promise<EditorialWorkspace> {
  if (process.env.NODE_ENV !== "production") {
    if (process.env.EDITORIAL_FIXTURE_MODE === FIXTURE_MODE_VALUE) {
      const { getFixtureEnvironment, resetFixtureEnvironment } = await import("../adapters/fixture/singleton");
      const environment = await getFixtureEnvironment();
      return {
        status: "fixture",
        repository: environment.editor(),
        nowMs: environment.clock.now(),
        demo: environment.demo,
        reset: async () => {
          await resetFixtureEnvironment();
        },
      };
    }
  }
  return resolveLiveWorkspace();
}

/** For rendering: request-time only, deduplicated per request. */
export const getEditorialWorkspace = cache(async (): Promise<EditorialWorkspace> => {
  await connection();
  return resolveWorkspace();
});

/** For server actions, which already run per request and must not call `connection()`. */
export function getEditorialWorkspaceForAction(): Promise<EditorialWorkspace> {
  return resolveWorkspace();
}

/** For pages: an unavailable workspace is indistinguishable from a missing page. */
export async function requireEditorialWorkspace(): Promise<ActiveWorkspace> {
  const workspace = await getEditorialWorkspace();
  if (workspace.status === "unavailable") notFound();
  return workspace;
}
