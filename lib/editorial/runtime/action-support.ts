import "server-only";

import type { z } from "zod";

import { fail, type CommandResult } from "../contracts/errors";
import { getEditorialWorkspaceForAction, type ActiveWorkspace, type EditorialWorkspace } from "./workspace";

/**
 * Shared plumbing for editorial server actions. Actions are public POST
 * endpoints: every call re-resolves the workspace (unavailable to anyone the
 * backend does not confirm), validates its untrusted input, and lets the
 * repository re-check identity and state. Errors carry codes and safe
 * messages only.
 */
async function withResolved<TSchema extends z.ZodType, TResult, TWorkspace extends ActiveWorkspace>(
  accepts: (workspace: EditorialWorkspace) => workspace is TWorkspace,
  schema: TSchema,
  input: unknown,
  run: (workspace: TWorkspace, data: z.infer<TSchema>) => Promise<CommandResult<TResult>>,
): Promise<CommandResult<TResult>> {
  const workspace = await getEditorialWorkspaceForAction();
  if (!accepts(workspace)) {
    return fail("WORKSPACE_UNAVAILABLE", "The editorial workspace is not available.");
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return fail("INVALID_INPUT", parsed.error.issues[0]?.message?.slice(0, 200) ?? "Invalid request.");
  }
  return run(workspace, parsed.data);
}

const isActive = (workspace: EditorialWorkspace): workspace is ActiveWorkspace => workspace.status !== "unavailable";

const isFixture = (workspace: EditorialWorkspace): workspace is Extract<EditorialWorkspace, { status: "fixture" }> =>
  workspace.status === "fixture";

/** Editorial commands: the fixture or the live workspace. */
export function withWorkspace<TSchema extends z.ZodType, TResult>(
  schema: TSchema,
  input: unknown,
  run: (workspace: ActiveWorkspace, data: z.infer<TSchema>) => Promise<CommandResult<TResult>>,
): Promise<CommandResult<TResult>> {
  return withResolved(isActive, schema, input, run);
}

/** Local-demo controls: they exist only on the fixture workspace. */
export function withFixtureWorkspace<TSchema extends z.ZodType, TResult>(
  schema: TSchema,
  input: unknown,
  run: (workspace: Extract<EditorialWorkspace, { status: "fixture" }>, data: z.infer<TSchema>) => Promise<CommandResult<TResult>>,
): Promise<CommandResult<TResult>> {
  return withResolved(isFixture, schema, input, run);
}
