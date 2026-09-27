import "server-only";

import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import type { FixtureDemoControls } from "../adapters/fixture/demo";
import type { EditorialRepository } from "../contracts/repository";

/**
 * The editorial data access layer. Every page, server action and route
 * handler resolves the workspace here; layouts and client gating are never
 * the only check.
 *
 * - Production builds: always unavailable. There is no live adapter yet
 *   (WP46-E4), and the fixture branch below is compiled out because
 *   `process.env.NODE_ENV` is inlined as "production".
 * - Development and tests: unavailable unless the operator explicitly sets
 *   `EDITORIAL_FIXTURE_MODE=local-demo`. There is no query parameter, cookie,
 *   header or browser-storage switch.
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
  | { status: "unavailable"; reason: "live_adapter_not_built" | "fixture_not_enabled" };

export const FIXTURE_MODE_VALUE = "local-demo";

async function resolveWorkspace(): Promise<EditorialWorkspace> {
  if (process.env.NODE_ENV !== "production") {
    if (process.env.EDITORIAL_FIXTURE_MODE !== FIXTURE_MODE_VALUE) {
      return { status: "unavailable", reason: "fixture_not_enabled" };
    }
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
  return { status: "unavailable", reason: "live_adapter_not_built" };
}

/** For rendering: request-time only (the demo store is mutable), deduplicated per request. */
export const getEditorialWorkspace = cache(async (): Promise<EditorialWorkspace> => {
  await connection();
  return resolveWorkspace();
});

/** For server actions, which already run per request and must not call `connection()`. */
export function getEditorialWorkspaceForAction(): Promise<EditorialWorkspace> {
  return resolveWorkspace();
}

/** For pages: an unavailable workspace is indistinguishable from a missing page. */
export async function requireEditorialWorkspace() {
  const workspace = await getEditorialWorkspace();
  if (workspace.status !== "fixture") notFound();
  return workspace;
}
