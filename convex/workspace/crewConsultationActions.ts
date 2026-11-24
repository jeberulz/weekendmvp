import { v, type ObjectType } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, type ActionCtx } from "../_generated/server";
import { crewConsultationOutput, crewConsultationSpec } from "../ai/prompts/crewConsultation";
import type { GatewayRunResult, RunPromptArgs } from "../ai/gatewayActions";
import { promptRef } from "../../lib/workspace/contracts/prompts";
import { dropLoneSurrogates } from "../../lib/workspace/plainText";
import { runWrenTurnArgs } from "./chatActions";

type Turn = ObjectType<typeof runWrenTurnArgs>;
type Call = (args: RunPromptArgs) => Promise<GatewayRunResult>;
type Fault = "budget" | "paused" | "failed";

function failed(result: Extract<GatewayRunResult, { ok: false }>): Fault {
  if (result.failure.kind !== "meter_refused") return "failed";
  return result.failure.error.code === "BUDGET_EXHAUSTED" ? "budget" : "paused";
}

export async function runCrewConsultationWith(
  ctx: Pick<ActionCtx, "runMutation">,
  args: Turn,
  runPrompt: Call,
): Promise<null> {
  const { ownerId, projectId, wrenMessageId, founderMessageId, attempt } = args;
  const scope = { ownerId, projectId, wrenMessageId, attempt };
  const plan = await ctx.runMutation(internal.workspace.crewConsultation.start, { ...scope, founderMessageId });
  if (!plan) return null;

  const ask = async (
    worker: typeof plan.recipient,
    attemptNumber: number,
    colleague: string | null,
    colleagueAnswer: string | null,
  ) => {
    const result = await runPrompt({
      promptRef: promptRef(crewConsultationSpec),
      ownerId, projectId, attempt: attemptNumber,
      attemptKey: { kind: "chat", chatMessageId: wrenMessageId },
      inputs: {
        specialist: worker.participant.name, role: worker.participant.role, question: plan.question,
        evidence: worker.evidence, colleague, colleagueAnswer,
      },
    });
    if (!result.ok) return { ok: false as const, fault: failed(result) };
    const parsed = crewConsultationOutput.safeParse(JSON.parse(result.outputJson));
    const answer = parsed.success ? dropLoneSurrogates(parsed.data.answer).trim() : "";
    return answer.length > 0
      ? { ok: true as const, answer, nextAttempt: result.nextAttempt }
      : { ok: false as const, fault: "failed" as const };
  };
  const finishFailure = (reason: Fault) => ctx.runMutation(internal.workspace.crewConsultation.record, {
    ...scope, outcome: { kind: "failed", reason },
  });

  try {
    let colleagueAnswer = plan.colleagueAnswer ?? null;
    let nextAttempt = attempt;
    // The colleague replies first. Commit their answer before the recipient
    // receives it, so a founder retry can resume without paying twice for it.
    if (plan.colleague && colleagueAnswer === null) {
      const first = await ask(plan.colleague, nextAttempt, null, null);
      if (!first.ok) {
        await finishFailure(first.fault);
        return null;
      }
      const accepted = await ctx.runMutation(internal.workspace.crewConsultation.record, {
        ...scope, outcome: { kind: "colleague", answer: first.answer },
      });
      if (!accepted) return null;
      colleagueAnswer = first.answer;
      nextAttempt = first.nextAttempt;
    }
    const answer = await ask(plan.recipient, nextAttempt, plan.colleague?.participant.name ?? null, colleagueAnswer);
    if (!answer.ok) {
      await finishFailure(answer.fault);
      return null;
    }
    await ctx.runMutation(internal.workspace.crewConsultation.record, {
      ...scope, outcome: { kind: "recipient", answer: answer.answer },
    });
  } catch {
    await finishFailure("failed");
  }
  return null;
}

export const run = internalAction({
  args: runWrenTurnArgs,
  returns: v.null(),
  handler: async (ctx, args): Promise<null> =>
    await runCrewConsultationWith(ctx, args, (prompt) => ctx.runAction(internal.ai.gatewayActions.runPrompt, prompt)),
});
