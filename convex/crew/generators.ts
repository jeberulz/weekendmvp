import { v, type Infer, type ObjectType } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalAction, internalQuery, type ActionCtx } from "../_generated/server";
import { memoryForPrompt } from "../workspace/wrenMemory";
import { emailDraftTarget } from "../growth/drafts/emailSequence";
import { blueprintSchema, brandKitSchema } from "../../lib/workspace/contracts/artifacts";
import { seedFromColumns } from "../../lib/workspace/contracts/seeds";
import { wizardAnswersSchema, type WizardAnswers } from "../../lib/workspace/contracts/wizard";
import { crewBusinessContext, type CrewBusinessFacts } from "../../lib/workspace/crew/context";
import {
  BLUEPRINT_LIBRARY_PROMPT_REF,
  BLUEPRINT_OWN_IDEA_PROMPT_REF,
  BRAND_KIT_PROMPT_REF,
  EMAIL_SEQUENCE_PROMPT_REF,
  SOCIAL_PACK_PROMPT_REF,
  blueprintStepPlan,
  brandKitStepPlan,
  crewSeedFor,
  emailSequenceStepPlan,
  socialPackStepPlan,
  type CrewPromptInputs,
} from "../../lib/workspace/crew/inputs";
import {
  approvedBlueprint,
  approvedBrandKit,
  isLaunchFirstDraftTask,
  launchDraftBlueprint,
  launchDraftBrandKit,
  platformSeedRow,
} from "./jobs";
import { crewStepOutcomeValidator, runCrewStepWith, type CrewRunnerCtx, type CrewRunnerDeps, type CrewStepOutcome } from "./runner";

/**
 * WP75-S3a — the blueprint and brand kit generators (and WP76's email
 * sequence and social pack): build the step's prompt inputs on the server,
 * then run it through the S2a runner.
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
 * - WP76-S1a: the email sequence briefs from the same blueprint rule, plus the
 *   brand kit under the same rule (approved, else the launch's own first-draft
 *   kit for the launch's own email first draft). It reads the kit's name,
 *   tagline and voice. Both documents travel to `finishCrewStep`
 *   (`briefDocumentId`, `brandKitDocumentId`), which re-checks them. A
 *   revision briefs only from approved documents, like a brand kit revision.
 * - WP76-S2a: the social pack briefs exactly like the email sequence (both
 *   documents, both re-checked at the finish) and reads the same brand slice,
 *   without the wizard answers. It has no draft rows, so no preflight
 *   conflict check.
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
    /** WP76-S1a: the brand kit an email sequence (WP76-S2a: or a social pack) reads its voice from; `finishCrewStep` re-checks it. */
    brandKitDocumentId: v.optional(v.id("documents")),
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

/** The prompt a step's refusal names before the project is read (the blueprint's ref depends on the business). */
const STEP_PROMPT_REFS: Partial<Record<Doc<"tasks">["type"], string>> = {
  crew_brand_kit: BRAND_KIT_PROMPT_REF,
  crew_email_sequence: EMAIL_SEQUENCE_PROMPT_REF,
  crew_social_pack: SOCIAL_PACK_PROMPT_REF,
};

export const prepareCrewStep = internalQuery({
  args: {
    taskId: v.id("tasks"),
    /** The calling action's clock, for a launch brief's pending-card TTL (queries do not read the clock). */
    now: v.optional(v.number()),
  },
  returns: preparedCrewStep,
  handler: async (ctx, args): Promise<PreparedCrewStep> => {
    const task = await ctx.db.get("tasks", args.taskId);
    const fallbackRef = task === null ? BLUEPRINT_LIBRARY_PROMPT_REF : (STEP_PROMPT_REFS[task.type] ?? BLUEPRINT_LIBRARY_PROMPT_REF);
    if (task === null || (task.type !== "crew_blueprint" && task.type !== "crew_brand_kit" && task.type !== "crew_email_sequence" &&
      task.type !== "crew_social_pack")) {
      return refuse(fallbackRef, "this task is not a blueprint, brand kit, email sequence or social pack step");
    }
    const project = await ctx.db.get("projects", task.projectId);
    const workspace = project?.workspace;
    if (project === null || project.ownerId !== task.ownerId || workspace === undefined) {
      return refuse(fallbackRef, "the business has no workspace set-up");
    }
    const ownIdea = project.source === "own_idea";
    const blueprintRef = ownIdea ? BLUEPRINT_OWN_IDEA_PROMPT_REF : BLUEPRINT_LIBRARY_PROMPT_REF;
    const promptRef = task.type === "crew_blueprint" ? blueprintRef : fallbackRef;

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
      // S2b: a launch's own kit (and, WP76-S1a/S2a, its own email sequence and social pack) may brief from the
      // launch's first draft while no blueprint is approved.
      const inLaunch = await isLaunchFirstDraftTask(ctx, task);
      const stored = (await approvedBlueprint(ctx, project)) ??
        (inLaunch ? await launchDraftBlueprint(ctx, project, args.now) : null);
      const blueprint = stored?.body === undefined ? null : blueprintSchema.safeParse(parseJson(stored.body));
      if (blueprint === null || !blueprint.success) {
        const step = task.type === "crew_email_sequence" ? "email sequence" : task.type === "crew_social_pack" ? "social pack" : "brand kit";
        return refuse(promptRef, `the ${step} needs the business's approved blueprint first`);
      }
      // WP90-S5: a library business's copy steps also read the idea seed's
      // angles. A seed that cannot be read (row overflow, pre-WP90 row) means
      // no angles, never a refusal: the step works as it did before WP90.
      const seedSlug =
        answers.idea.source === "library" && workspace.ideaSlug === answers.idea.ideaSlug ? workspace.ideaSlug : undefined;
      const seedRead = seedSlug === undefined ? null : await platformSeedRow(ctx, seedSlug);
      const ideaSeed =
        seedSlug !== undefined && seedRead?.ok === true && seedRead.row !== null ? seedFromColumns(seedSlug, seedRead.row) : null;
      if (task.type === "crew_email_sequence" || task.type === "crew_social_pack") {
        const kitRow = (await approvedBrandKit(ctx, project)) ?? (inLaunch ? await launchDraftBrandKit(ctx, project, args.now) : null);
        const kit = kitRow?.body === undefined ? null : brandKitSchema.safeParse(parseJson(kitRow.body));
        const step = task.type === "crew_email_sequence" ? "email sequence" : "social pack";
        if (kitRow === null || kit === null || !kit.success) return refuse(promptRef, `the ${step} needs the business's brand kit first`);
        const briefs = { ...(stored === null ? {} : { briefDocumentId: stored._id }), brandKitDocumentId: kitRow._id };
        if (task.type === "crew_social_pack") {
          return {
            ok: true,
            promptRef,
            inputs: socialPackStepPlan({ blueprint: blueprint.data, brandKit: kit.data, seed: ideaSeed }).inputs,
            businessContext: crewBusinessContext({ ...facts, blueprint: blueprint.data }),
            ...briefs,
          };
        }
        // Review m4: the finish's draft-conflict check, run first so a conflict costs no model call.
        if (!(await emailDraftTarget(ctx, { ownerId: project.ownerId, projectId: project._id })).ok) {
          return refuse(promptRef, "the business's email sequence drafts conflict, so none can be rewritten");
        }
        return {
          ok: true,
          promptRef,
          inputs: emailSequenceStepPlan({ answers, blueprint: blueprint.data, brandKit: kit.data, seed: ideaSeed }).inputs,
          businessContext: crewBusinessContext({ ...facts, blueprint: blueprint.data }),
          ...briefs,
        };
      }
      inputs = brandKitStepPlan({ answers, blueprint: blueprint.data, seed: ideaSeed }).inputs;
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
  /** L1 launch sweep: the DAG's enqueue marker this execution runs under (`runCrewStepArgs.markerId`). */
  markerId: v.optional(v.id("task_steps")),
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
      ...(plan.brandKitDocumentId === undefined ? {} : { brandKitDocumentId: plan.brandKitDocumentId }),
      ...rest,
    },
    deps,
  );
}

/**
 * Runs a blueprint, brand kit, email sequence (WP76-S1a) or social pack
 * (WP76-S2a) step with server-built inputs. Internal: S2b's
 * launch DAG enqueues it on `crewWorkpool` with `retryMode: "return"`
 * (`./launch.ts`, `stepDone` re-invokes), and tests call it directly.
 */
export const runCrewGeneratorStep = internalAction({
  args: runCrewGeneratorStepArgs,
  returns: crewStepOutcomeValidator,
  handler: async (ctx, args): Promise<CrewStepOutcome> => await runCrewGeneratorStepWith(ctx, args),
});
