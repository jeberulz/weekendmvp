"use server";

import { z } from "zod";

import { ok } from "@/lib/editorial/contracts/errors";
import { withWorkspace } from "@/lib/editorial/runtime/action-support";

/*
 * LOCAL DEMO CONTROLS. They exist only on the fixture workspace (the live
 * workspace has no `demo`), and production never resolves a workspace, so
 * every call there returns WORKSPACE_UNAVAILABLE. None of them touches
 * credentials, deployments or the public site: they flip in-memory flags of
 * the simulated adapter so each recovery path can be exercised.
 */

const emptySchema = z.strictObject({});

/** Simulated strong re-authentication: no password or credential is involved. */
export async function demoConfirmStrongAuthAction(input: z.input<typeof emptySchema>) {
  return withWorkspace(emptySchema, input, async ({ demo }) => {
    demo.confirmStrongAuth();
    return ok({ done: true });
  });
}

export async function demoExpireStrongAuthAction(input: z.input<typeof emptySchema>) {
  return withWorkspace(emptySchema, input, async ({ demo }) => {
    demo.expireStrongAuth();
    return ok({ done: true });
  });
}

const killSwitchSchema = z.strictObject({ engaged: z.boolean() });

export async function demoSetKillSwitchAction(input: z.input<typeof killSwitchSchema>) {
  return withWorkspace(killSwitchSchema, input, async ({ demo }, data) => {
    demo.setKillSwitch(data.engaged);
    return ok({ engaged: data.engaged });
  });
}

export async function demoFailNextDeployAction(input: z.input<typeof emptySchema>) {
  return withWorkspace(emptySchema, input, async ({ demo }) => {
    demo.failNextDeploy();
    return ok({ done: true });
  });
}

export async function demoLoseNextAckAction(input: z.input<typeof emptySchema>) {
  return withWorkspace(emptySchema, input, async ({ demo }) => {
    demo.loseNextActivationAck();
    return ok({ done: true });
  });
}

export async function demoBumpPolicyAction(input: z.input<typeof emptySchema>) {
  return withWorkspace(emptySchema, input, async ({ demo }) => ok({ version: await demo.bumpPolicyVersion() }));
}

/** One tick of the simulated release worker: each in-flight release moves one stage. */
export async function demoRunWorkerAction(input: z.input<typeof emptySchema>) {
  return withWorkspace(emptySchema, input, async ({ demo }) => ok(await demo.runWorker()));
}

/** Throw the demo away and seed it again. */
export async function demoResetAction(input: z.input<typeof emptySchema>) {
  return withWorkspace(emptySchema, input, async (workspace) => {
    await workspace.reset();
    return ok({ done: true });
  });
}
