import { v, type Infer, type ObjectType } from "convex/values";

import { internal } from "../_generated/api";
import { internalAction, internalQuery, type ActionCtx } from "../_generated/server";
import { memoryForPrompt } from "../workspace/wrenMemory";
import { blueprintSchema } from "../../lib/workspace/contracts/artifacts";
import { wizardAnswersSchema, type WizardAnswers } from "../../lib/workspace/contracts/wizard";
import { crewBusinessContext, type CrewBusinessFacts } from "../../lib/workspace/crew/context";
import {
  BLUEPRINT_LIBRARY_PROMPT_REF,
  BLUEPRINT_OWN_IDEA_PROMPT_REF,
  BRAND_KIT_PROMPT_REF,
  blueprintStepPlan,
  brandKitStepPlan,
  crewSeedFor,
  type CrewPromptInputs,
} from "../../lib/workspace/crew/inputs";
import { approvedBlueprint, isLaunchBrandKitTask, launchDraftBlueprint, platformSeedRow } from "./jobs";
import { crewStepOutcomeValidator, runCrewStepWith, type CrewRunnerCtx, type CrewRunnerDeps, type CrewStepOutcome } from "./runner";

/**
 * WP75-S3a — the blueprint and brand kit generators: build the step's prompt
 * inputs on the server, then run it through the S2a runner.
 *
 * - `prepareCrewStep` reads only server rows: the task, its project, the
 *   project's wizard session (answers parsed with C-WIZARD), Wren's memory,
 *   the library idea and its platform seed (blueprint), or the approved
 *   blueprint (brand kit; a draft is never used). It picks the prompt by the
 *   project's source (library or own idea).
 * - `runCrewGeneratorStep` runs the step. Inputs that cannot be built (a
 *   project with no wizard session, a brand kit before an approved blueprint) still
 *   open a run, which settles as a `config` failure before any provider call:
 *   the task fails with the usual calm note and a debit is refunded.
 * - Retries scheduled by `settleCrewRun` re-run `runCrewStep` with the inputs
 *   built here, so every retry of one task sends the same prompt. The seed
 *   row's id travels with them (`seedId`): the quality gate stores that row's
 *   market, never a newer seed's. A seed read that cannot see the newest
 *   platform row (the bounded read was full) refuses as `config`.
 * - The brand kit's brief (the approved blueprint document, `briefDocumentId`)
 *   is checked again in `finishCrewStep`, so a blueprint changed or
 *   un-approved mid-step never briefs a stored kit.
 * - WP75-S2b owner ruling ("brand-kit brief in a launch", `docs/wp/RULINGS.md`):
 *   a launch's own brand kit, when no blueprint is approved yet, briefs from
 *   the launch's first-draft blueprint while its card is pending or approved
 *   and the document is unchanged (`isLaunchDraftBrief`). Outside a launch,
 *   S3a's approved-only rule is unchanged.
 *
 * Internal: S1's `startLaunch` and S2b's DAG call it after their own
 * authorisation and task insert.
 */

const promptInputsValidator = v.record(v.string(), v.union(v.string(), v.null()));

const preparedCrewStep = v.union(
  v.object({
    ok: v.literal(true),
    promptRef: v.string(),
    inputs: promptInputsValidator,
    businessContext: v.string(),
    /** The platform seed row the prompt was built from; the gate re-reads exactly it. */
    seedId: v.optional(v.id("idea_crew_seeds")),
    /** The approved blueprint document a brand kit is briefed from; `finishCrewStep` re-checks it. */
    briefDocumentId: v.optional(v.id("documents")),
  }),
  v.object({ ok: v.literal(false), promptRef: v.string(), message: v.string() }),
);

export type PreparedCrewStep = Infer<typeof preparedCrewStep>;

type Refusal = { ok: false; promptRef: string; message: string };

const refuse = (promptRef: string, message: string): Refusal => ({ ok: false, promptRef, message });

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export const prepareCrewStep = internalQuery({
  args: {
    taskId: v.id("tasks"),
    /** The calling action's clock, for a launch brief's pending-card TTL (queries do not read the clock). */
    now: v.optional(v.number()),
  },
  returns: preparedCrewStep,
  handler: async (ctx, args): Promise<PreparedCrewStep> => {
    const task = await ctx.db.get("tasks", args.taskId);
    const fallbackRef = task?.type === "crew_brand_kit" ? BRAND_KIT_PROMPT_REF : BLUEPRINT_LIBRARY_PROMPT_REF;
    if (task === null || (task.type !== "crew_blueprint" && task.type !== "crew_brand_kit")) {
      return refuse(fallbackRef, "this task is not a blueprint or brand kit step");
    }
    const project = await ctx.db.get("projects", task.projectId);
    const workspace = project?.workspace;
    if (project === null || project.ownerId !== task.ownerId || workspace === undefined) {
      return refuse(fallbackRef, "the business has no workspace set-up");
    }
    const ownIdea = project.source === "own_idea";
    const blueprintRef = ownIdea ? BLUEPRINT_OWN_IDEA_PROMPT_REF : BLUEPRINT_LIBRARY_PROMPT_REF;
    const promptRef = task.type === "crew_blueprint" ? blueprintRef : BRAND_KIT_PROMPT_REF;

    const session = await ctx.db.get("wizard_sessions", workspace.wizardSessionId);
    const parsedAnswers = session === null || session.ownerId !== project.ownerId ? null : wizardAnswersSchema.safeParse(session.answers);
    if (parsedAnswers === null || !parsedAnswers.success) return refuse(promptRef, "the business's wizard answers are missing or incomplete");
    const answers: WizardAnswers = parsedAnswers.data;
    if ((answers.idea.source === "own_idea") !== ownIdea) return refuse(promptRef, "the wizard idea does not match the business");

    const memoryRow = await ctx.db
      .query("wren_memory")
      .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
      .first();
    const facts: CrewBusinessFacts = {
      name: workspace.name,
      source: ownIdea ? "own_idea" : "library",
      ...(workspace.ideaSlug === undefined ? {} : { ideaSlug: workspace.ideaSlug }),
      ...(workspace.ownIdeaText === undefined ? {} : { ownIdeaText: workspace.ownIdeaText }),
      choices: { platform: workspace.platform, commercialModel: workspace.commercialModel, goal: workspace.goal },
      memory: memoryRow !== null && memoryRow.ownerId === project.ownerId ? memoryForPrompt(memoryRow) : null,
    };

    let inputs: CrewPromptInputs;
    if (task.type === "crew_blueprint") {
      if (answers.idea.source === "own_idea") {
        inputs = blueprintStepPlan({ source: "own_idea", answers, ownIdeaText: workspace.ownIdeaText ?? answers.idea.text }).inputs;
      } else {
        const ideaSlug = workspace.ideaSlug;
        if (ideaSlug === undefined || ideaSlug !== answers.idea.ideaSlug) return refuse(promptRef, "the business has no library idea");
        const idea = await ctx.db.query("ideas").withIndex("by_slug", (q) => q.eq("slug", ideaSlug)).first();
        const seedRead = await platformSeedRow(ctx, ideaSlug);
        if (!seedRead.ok) return refuse(promptRef, "the idea's research seed could not be read");
        const seedRow = seedRead.row;
        inputs = blueprintStepPlan({
          source: "library",
          answers,
          idea: idea === null
            ? { slug: ideaSlug, title: ideaSlug.replace(/-/gu, " "), description: "" }
            : {
              slug: idea.slug,
              title: idea.title,
              description: idea.description,
              ...(idea.summary === undefined ? {} : { summary: idea.summary }),
              category: idea.category,
              audiences: idea.audiences,
            },
          seed: crewSeedFor(ideaSlug, seedRow?.blueprint),
        }).inputs;
        const seedId = seedRow?._id;
        return { ok: true, promptRef, inputs, businessContext: crewBusinessContext(facts), ...(seedId === undefined ? {} : { seedId }) };
      }
    } else {
      // S2b: a launch's own kit may brief from the launch's first draft while no blueprint is approved.
      const stored = (await approvedBlueprint(ctx, project)) ??
        ((await isLaunchBrandKitTask(ctx, task)) ? await launchDraftBlueprint(ctx, project, args.now) : null);
      const blueprint = stored?.body === undefined ? null : blueprintSchema.safeParse(parseJson(stored.body));
      if (blueprint === null || !blueprint.success) return refuse(promptRef, "the brand kit needs the business's approved blueprint first");
      inputs = brandKitStepPlan({ answers, blueprint: blueprint.data }).inputs;
      return {
        ok: true,
        promptRef,
        inputs,
        businessContext: crewBusinessContext({ ...facts, blueprint: blueprint.data }),
        ...(stored === null ? {} : { briefDocumentId: stored._id }),
      };
    }
    return { ok: true, promptRef, inputs, businessContext: crewBusinessContext(facts) };
  },
});

export type CrewGeneratorCtx = CrewRunnerCtx & Pick<ActionCtx, "runQuery">;

export const runCrewGeneratorStepArgs = {
  taskId: v.id("tasks"),
  timeoutMs: v.optional(v.number()),
  resume: v.optional(v.boolean()),
  retryMode: v.optional(v.union(v.literal("schedule"), v.literal("return"))),
};

type RunCrewGeneratorStepArgs = ObjectType<typeof runCrewGeneratorStepArgs>;

/** The generator step's body; `runCrewGeneratorStep` is this with the registered actions. */
export async function runCrewGeneratorStepWith(
  ctx: CrewGeneratorCtx,
  args: RunCrewGeneratorStepArgs,
  deps: CrewRunnerDeps = {},
): Promise<CrewStepOutcome> {
  const { taskId, ...rest } = args;
  const plan = await ctx.runQuery(internal.crew.generators.prepareCrewStep, { taskId, now: Date.now() });
  if (!plan.ok) {
    return await runCrewStepWith(ctx, { taskId, promptRef: plan.promptRef, inputs: {}, ...rest }, {
      ...deps,
      preflight: { kind: "config", message: plan.message },
    });
  }
  return await runCrewStepWith(
    ctx,
    {
      taskId,
      promptRef: plan.promptRef,
      inputs: plan.inputs,
      businessContext: plan.businessContext,
      ...(plan.seedId === undefined ? {} : { seedId: plan.seedId }),
      ...(plan.briefDocumentId === undefined ? {} : { briefDocumentId: plan.briefDocumentId }),
      ...rest,
    },
    deps,
  );
}

/**
 * Runs a blueprint or brand kit step with server-built inputs. Internal: S2b's
 * launch DAG enqueues it on `crewWorkpool` with `retryMode: "return"`
 * (`./launch.ts`, `stepDone` re-invokes), and tests call it directly.
 */
export const runCrewGeneratorStep = internalAction({
  args: runCrewGeneratorStepArgs,
  returns: crewStepOutcomeValidator,
  handler: async (ctx, args): Promise<CrewStepOutcome> => await runCrewGeneratorStepWith(ctx, args),
});
