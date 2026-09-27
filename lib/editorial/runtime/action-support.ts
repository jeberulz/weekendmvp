import "server-only";

import type { z } from "zod";

import { fail, type CommandResult } from "../contracts/errors";
import { getEditorialWorkspaceForAction } from "./workspace";

/**
 * Shared plumbing for editorial server actions. Actions are public POST
 * endpoints: every call re-resolves the workspace (always unavailable in
 * production), validates its untrusted input, and lets the repository
 * re-check identity and state. Errors carry codes and safe messages only.
 */
export async function withWorkspace<TSchema extends z.ZodType, TResult>(
  schema: TSchema,
  input: unknown,
  run: (
    workspace: Extract<Awaited<ReturnType<typeof getEditorialWorkspaceForAction>>, { status: "fixture" }>,
    data: z.infer<TSchema>,
  ) => Promise<CommandResult<TResult>>,
): Promise<CommandResult<TResult>> {
  const workspace = await getEditorialWorkspaceForAction();
  if (workspace.status !== "fixture") {
    return fail("WORKSPACE_UNAVAILABLE", "The editorial workspace is not available.");
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return fail("INVALID_INPUT", parsed.error.issues[0]?.message?.slice(0, 200) ?? "Invalid request.");
  }
  return run(workspace, parsed.data);
}
