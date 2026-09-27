import type { FixtureDemoControls } from "../adapters/fixture/demo";
import type { FixtureState } from "../adapters/fixture/state";
import type { CommandResult } from "../contracts/errors";
import type { IngestionCredential } from "../contracts/principal";
import type { EditorialRepository } from "../contracts/repository";
import type { ReleaseState } from "../contracts/states";
import {
  allergenLabelChecker,
  bikePartsLookup,
  coldChainLogger,
  cryptoTaxBot,
  grantDeadlineTracker,
  groomerWaitlist,
  lessonScheduler,
  paymentRemindersDuplicate,
  receiptSplitter,
  shiftSwapBoard,
  shopifyOnboarding,
  warrantyTracker,
} from "./articles/catalog";
import { invoiceFollowUp } from "./articles/invoice-follow-up";
import { legacyFillers, listingCaptionWriter, menuCostCalculator, podcastShowNotes } from "./articles/legacy";
import { buildFixtureEnvelope } from "./envelopes";
import type { ArticleSpec } from "./spec";

export type SeedClock = {
  now(): number;
  set(ms: number): void;
  advance(ms: number): void;
};

export const FIXTURE_SCENARIOS = [
  "flagshipLiveWithDraft",
  "newCandidate",
  "acceptedAwaitingReview",
  "duplicateRejected",
  "evidenceUnavailable",
  "changedSource",
  "legacyNoRecord",
  "legacyQuarantined",
  "conflictingAutosave",
  "staleApproval",
  "failedDeployment",
  "uncertainActivation",
  "unpublished",
  "trashed",
  "previewReady",
  "changesRequested",
] as const;
export type FixtureScenario = (typeof FIXTURE_SCENARIOS)[number];
export type FixtureScenarioIds = Record<FixtureScenario, string>;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

function must<T>(result: CommandResult<T>, step: string): T {
  if (!result.ok) throw new Error(`Fixture seed failed at "${step}": ${result.error.code} ${result.error.message}`);
  return result.value;
}

type Context = {
  state: FixtureState;
  editor: EditorialRepository;
  demo: FixtureDemoControls;
  clock: SeedClock;
  engine: IngestionCredential;
  legacy: IngestionCredential;
  counter: number;
};

async function importEngine(
  ctx: Context,
  spec: ArticleSpec,
  options: { recommendation?: "accept" | "needs_research" | "reject"; reasons?: string[]; proposedSlug?: string } = {},
) {
  ctx.counter += 1;
  const envelope = await buildFixtureEnvelope(spec, {
    submissionId: `fixture-sub-${ctx.counter}`,
    nowMs: ctx.clock.now(),
    policyVersion: ctx.state.policyVersion,
    producer: "engine",
    engineRunId: `run-2026-09-${String(10 + (ctx.counter % 15)).padStart(2, "0")}-${ctx.counter}`,
    recommendation: options.recommendation ?? "accept",
    recommendationReasons: options.reasons ?? [],
    proposedSlug: options.proposedSlug,
  });
  return must(await ctx.editor.importSubmission(envelope, ctx.engine), `import ${spec.slug}`);
}

async function importLegacy(ctx: Context, spec: ArticleSpec & { firstPublishedAt: string }) {
  ctx.counter += 1;
  const envelope = await buildFixtureEnvelope(spec, {
    submissionId: `fixture-legacy-${ctx.counter}`,
    nowMs: ctx.clock.now(),
    policyVersion: ctx.state.policyVersion,
    producer: "legacy-import",
    firstPublishedAt: spec.firstPublishedAt,
  });
  return must(await ctx.editor.importSubmission(envelope, ctx.legacy), `legacy import ${spec.slug}`);
}

async function ideaVersion(ctx: Context, ideaId: string) {
  return must(await ctx.editor.getIdea(ideaId), "get idea").idea.version;
}

async function accept(ctx: Context, ideaId: string, rationale: string) {
  must(
    await ctx.editor.setCandidateDecision(ideaId, await ideaVersion(ctx, ideaId), { decision: "accepted", rationale }),
    "accept",
  );
}

async function workingRevisionId(ctx: Context, ideaId: string) {
  const detail = must(await ctx.editor.getIdea(ideaId), "get idea");
  const working = detail.idea.workingRevision;
  if (!working) throw new Error("No working revision");
  return working.id;
}

async function runChecks(ctx: Context, ideaId: string, revisionId: string) {
  const view = must(await ctx.editor.getRevision(ideaId, revisionId), "get revision");
  must(await ctx.editor.runChecks(revisionId, view.hashes.artifact), "run checks");
}

/** Attest every open item and resolve warnings, as a thorough reviewer would. */
async function reviewEverything(ctx: Context, ideaId: string, revisionId: string, limit = Number.POSITIVE_INFINITY) {
  const view = must(await ctx.editor.getRevision(ideaId, revisionId), "get revision");
  let reviewed = 0;
  for (const item of view.reviewItems) {
    if (item.status === "reviewed" || reviewed >= limit) continue;
    must(await ctx.editor.markReviewed(revisionId, item.id, item.dependencyHash, null), `review ${item.id}`);
    reviewed += 1;
    ctx.clock.advance(2 * MINUTE);
  }
  if (limit !== Number.POSITIVE_INFINITY) return;
  const after = must(await ctx.editor.getRevision(ideaId, revisionId), "get revision");
  for (const issue of after.issues) {
    if (issue.severity !== "warning" || !issue.resolvable || issue.resolution) continue;
    must(
      await ctx.editor.resolveIssue(
        revisionId,
        issue.id,
        issue.dependencyHash,
        issue.id === "check:content-length"
          ? "Concise by design: every section is covered; length is not the quality bar."
          : "Checked and acceptable for this idea.",
      ),
      `resolve ${issue.id}`,
    );
  }
}

async function approve(ctx: Context, ideaId: string, revisionId: string, note: string | null = null) {
  const view = must(await ctx.editor.getRevision(ideaId, revisionId), "get revision");
  return must(await ctx.editor.approveRevision(revisionId, view.hashes.artifact, { attest: true, note }), "approve")
    .approvalId;
}

async function runWorkerUntil(ctx: Context, releaseId: string, states: ReleaseState[]) {
  for (let tick = 0; tick < 12; tick += 1) {
    const release = [...ctx.state.releases.values()].find((candidate) => candidate.id === releaseId);
    if (release && states.includes(release.state)) return;
    ctx.clock.advance(MINUTE);
    await ctx.demo.runWorker();
  }
  throw new Error(`Release ${releaseId} never reached ${states.join("/")}`);
}

async function prepareAndPublish(
  ctx: Context,
  ideaId: string,
  revisionId: string,
  approvalId: string,
  stopAt: ReleaseState[],
) {
  const detail = must(await ctx.editor.getIdea(ideaId), "get idea");
  const liveReleaseId =
    detail.releases.find((release) => release.state === "succeeded" && release.id === currentLive(ctx, ideaId))?.id ?? null;
  ctx.counter += 1;
  const { releaseId } = must(
    await ctx.editor.prepareRelease(revisionId, liveReleaseId, `seed-prepare-${ctx.counter}`),
    "prepare",
  );
  await runWorkerUntil(ctx, releaseId, ["preview_ready"]);
  if (stopAt.includes("preview_ready")) return releaseId;
  ctx.demo.confirmStrongAuth();
  ctx.counter += 1;
  must(await ctx.editor.publishRelease(releaseId, "preview_ready", approvalId, `seed-publish-${ctx.counter}`), "publish");
  await runWorkerUntil(ctx, releaseId, stopAt);
  return releaseId;
}

function currentLive(ctx: Context, ideaId: string): string | null {
  return ctx.state.ideas.get(ideaId)?.publication.liveReleaseId ?? null;
}

async function edit(ctx: Context, ideaId: string, revisionId: string, transform: (markdown: string) => string) {
  const view = must(await ctx.editor.getRevision(ideaId, revisionId), "get revision");
  ctx.counter += 1;
  must(
    await ctx.editor.saveDraft(ideaId, revisionId, view.version, { markdown: transform(view.markdown) }, `seed-save-${ctx.counter}`),
    "save",
  );
}

async function fork(ctx: Context, ideaId: string) {
  const from = await workingRevisionId(ctx, ideaId);
  ctx.counter += 1;
  return must(await ctx.editor.createRevision(ideaId, from, `seed-fork-${ctx.counter}`), "create revision").revisionId;
}

/**
 * Put the fixture workspace into every documented state by driving the
 * public repository interface — the same commands the UI uses — plus the
 * demo controls for time and failure. Nothing here edits records directly.
 */
export async function seedFixtureScenarios(input: {
  state: FixtureState;
  editor: EditorialRepository;
  demo: FixtureDemoControls;
  clock: SeedClock;
  startMs: number;
}): Promise<FixtureScenarioIds> {
  const ctx: Context = {
    ...input,
    engine: input.demo.issueIngestionCredential("engine"),
    legacy: input.demo.issueIngestionCredential("legacy-import"),
    counter: 0,
  };
  const { clock, demo } = ctx;
  clock.set(input.startMs);

  /* Legacy pages that were live before the workspace ------------------ */
  for (const filler of legacyFillers) {
    await importLegacy(ctx, filler);
    clock.advance(7 * MINUTE);
  }
  const legacyNoRecord = (await importLegacy(ctx, menuCostCalculator)).ideaId;
  const legacyQuarantined = (await importLegacy(ctx, podcastShowNotes)).ideaId;
  const unpublished = (await importLegacy(ctx, listingCaptionWriter)).ideaId;
  clock.advance(6 * HOUR);

  /* Stale approval: approved under the old policy, then the policy moves on. */
  const staleApproval = (await importEngine(ctx, coldChainLogger)).ideaId;
  await accept(ctx, staleApproval, "Clear buyer and a proof-of-care wedge florists already ask for.");
  const coldRevision = await workingRevisionId(ctx, staleApproval);
  await reviewEverything(ctx, staleApproval, coldRevision);
  await approve(ctx, staleApproval, coldRevision, "Evidence is thin but specific.");
  clock.advance(2 * HOUR);
  await demo.bumpPolicyVersion();
  clock.advance(HOUR);

  /* Flagship: live v2 with an edited v3 draft ------------------------------ */
  const flagship = (
    await importEngine(ctx, invoiceFollowUp, {
      reasons: ["Two independent pain sources", "First-party competitor pricing", "Narrow approval-first wedge"],
    })
  ).ideaId;
  await accept(ctx, flagship, "Specific buyer, measurable pain and a wedge incumbents ignore.");
  const flagshipV2 = await fork(ctx, flagship);
  await edit(ctx, flagship, flagshipV2, (markdown) =>
    markdown.replace("It is a drafting and timing tool, not a collections agency.", "It drafts and times reminders; it is not a collections agency."),
  );
  await runChecks(ctx, flagship, flagshipV2);
  await reviewEverything(ctx, flagship, flagshipV2);
  const flagshipApproval = await approve(ctx, flagship, flagshipV2, "Reviewed every claim against its excerpt.");
  await prepareAndPublish(ctx, flagship, flagshipV2, flagshipApproval, ["succeeded"]);
  clock.advance(3 * HOUR);
  const flagshipV3 = await fork(ctx, flagship);
  await edit(ctx, flagship, flagshipV3, (markdown) =>
    markdown
      .replace(
        "sizes the freelance invoicing software market at $1.8 billion in 2025",
        "puts spending on freelance invoicing tools near $2 billion",
      )
      .replace("Charge a flat monthly fee rather than a share of recovered money", "Charge a flat monthly fee, never a share of recovered money"),
  );
  await runChecks(ctx, flagship, flagshipV3);
  clock.advance(HOUR);

  /* New engine candidate awaiting your decision ------------------------------ */
  const newCandidate = (
    await importEngine(ctx, shiftSwapBoard, {
      reasons: ["Licence rule is a real constraint", "Owner covers shifts personally", "Cheap to reach through associations"],
    })
  ).ideaId;
  clock.advance(40 * MINUTE);

  /* Accepted, awaiting copy review (3 items reviewed) -------------------------- */
  const acceptedAwaitingReview = (await importEngine(ctx, allergenLabelChecker)).ideaId;
  await accept(ctx, acceptedAwaitingReview, "Regulated pain with a clear, bounded weekend build.");
  await reviewEverything(ctx, acceptedAwaitingReview, await workingRevisionId(ctx, acceptedAwaitingReview), 3);
  clock.advance(50 * MINUTE);

  /* Duplicate rejected ------------------------------------------------------------ */
  const duplicateRejected = (
    await importEngine(ctx, paymentRemindersDuplicate, {
      recommendation: "accept",
      reasons: ["High search volume for payment reminders"],
      proposedSlug: invoiceFollowUp.slug,
    })
  ).ideaId;
  must(
    await ctx.editor.setCandidateDecision(duplicateRejected, await ideaVersion(ctx, duplicateRejected), {
      decision: "rejected",
      reasonCategory: "duplicate",
      note: "Same buyer and job as Invoice follow-up for freelancers, with a weaker wedge.",
    }),
    "reject duplicate",
  );
  clock.advance(30 * MINUTE);

  /* Evidence unavailable → needs research ------------------------------------------ */
  const evidenceUnavailable = (
    await importEngine(ctx, grantDeadlineTracker, {
      recommendation: "needs_research",
      reasons: ["Key sources unreadable", "Market size unverified"],
    })
  ).ideaId;
  must(
    await ctx.editor.setCandidateDecision(evidenceUnavailable, await ideaVersion(ctx, evidenceUnavailable), {
      decision: "needs_research",
      question: "Find a readable primary source for missed grant reports, and a count of small charities we can cite.",
    }),
    "needs research",
  );
  clock.advance(45 * MINUTE);

  /* Changed source after review ------------------------------------------------------- */
  const changedSource = (await importEngine(ctx, warrantyTracker)).ideaId;
  await accept(ctx, changedSource, "Recoverable money with a simple capture flow.");
  const warrantyRevision = await workingRevisionId(ctx, changedSource);
  await reviewEverything(ctx, changedSource, warrantyRevision);
  clock.advance(2 * HOUR);
  await demo.simulateSourceChange(warrantyRevision, "src-homeledger-pricing");
  clock.advance(30 * MINUTE);

  /* Conflicting autosave ------------------------------------------------------------------ */
  const conflictingAutosave = (await importEngine(ctx, lessonScheduler)).ideaId;
  await accept(ctx, conflictingAutosave, "Lost lessons are lost income; the fix is narrow.");
  const lessonDraft = await fork(ctx, conflictingAutosave);
  demo.simulateConcurrentEdit(lessonDraft);
  clock.advance(35 * MINUTE);

  /* Failed deployment of a republication (v1 stays live) ----------------------------------- */
  const failedDeployment = (await importEngine(ctx, bikePartsLookup)).ideaId;
  await accept(ctx, failedDeployment, "Counter-side pain with measurable minutes saved.");
  const bikeV1 = await workingRevisionId(ctx, failedDeployment);
  await reviewEverything(ctx, failedDeployment, bikeV1);
  const bikeApprovalV1 = await approve(ctx, failedDeployment, bikeV1);
  await prepareAndPublish(ctx, failedDeployment, bikeV1, bikeApprovalV1, ["succeeded"]);
  clock.advance(2 * HOUR);
  const bikeV2 = await fork(ctx, failedDeployment);
  await edit(ctx, failedDeployment, bikeV2, (markdown) =>
    markdown.replace("Scan the frame or type the model;", "Scan the frame, or type the model,"),
  );
  await runChecks(ctx, failedDeployment, bikeV2);
  await reviewEverything(ctx, failedDeployment, bikeV2);
  const bikeApprovalV2 = await approve(ctx, failedDeployment, bikeV2);
  demo.failNextDeploy();
  await prepareAndPublish(ctx, failedDeployment, bikeV2, bikeApprovalV2, ["failed"]);
  clock.advance(HOUR);

  /* Uncertain activation (acknowledgement lost) ---------------------------------------------- */
  const uncertainActivation = (await importEngine(ctx, groomerWaitlist)).ideaId;
  await accept(ctx, uncertainActivation, "Route-aware offers are a real wedge for mobile groomers.");
  const groomerRevision = await workingRevisionId(ctx, uncertainActivation);
  await reviewEverything(ctx, uncertainActivation, groomerRevision);
  const groomerApproval = await approve(ctx, uncertainActivation, groomerRevision);
  demo.loseNextActivationAck();
  await prepareAndPublish(ctx, uncertainActivation, groomerRevision, groomerApproval, ["needs_reconciliation"]);
  clock.advance(HOUR);

  /* Unpublished legacy idea ------------------------------------------------------------------- */
  demo.confirmStrongAuth();
  const liveRelease = currentLive(ctx, unpublished);
  if (!liveRelease) throw new Error("Legacy idea is not live");
  const { releaseId: unpublishRelease } = must(
    await ctx.editor.unpublishIdea(
      unpublished,
      liveRelease,
      "Advertising-wording claims need a legal review before this stays public.",
      "seed-unpublish-1",
    ),
    "unpublish",
  );
  await runWorkerUntil(ctx, unpublishRelease, ["succeeded"]);
  clock.advance(40 * MINUTE);

  /* Rejected, then moved to Trash ---------------------------------------------------------------- */
  const trashed = (
    await importEngine(ctx, cryptoTaxBot, { recommendation: "reject", reasons: ["Regulated trading activity"] })
  ).ideaId;
  must(
    await ctx.editor.setCandidateDecision(trashed, await ideaVersion(ctx, trashed), {
      decision: "rejected",
      reasonCategory: "infeasible",
      note: "Automated trading on users' behalf is regulated and not a weekend build.",
    }),
    "reject crypto",
  );
  demo.confirmStrongAuth();
  must(
    await ctx.editor.trashIdea(trashed, await ideaVersion(ctx, trashed), "Out of scope for Weekend MVP: regulated activity."),
    "trash",
  );
  clock.advance(30 * MINUTE);

  /* Approved with a protected preview ready to publish ------------------------------------------ */
  const previewReady = (await importEngine(ctx, receiptSplitter)).ideaId;
  await accept(ctx, previewReady, "Itemised splitting is the gap competitors leave.");
  const receiptRevision = await workingRevisionId(ctx, previewReady);
  await reviewEverything(ctx, previewReady, receiptRevision);
  const receiptApproval = await approve(ctx, previewReady, receiptRevision, "Short but complete.");
  await prepareAndPublish(ctx, previewReady, receiptRevision, receiptApproval, ["preview_ready"]);
  clock.advance(25 * MINUTE);

  /* Changes requested ----------------------------------------------------------------------------- */
  const changesRequested = (await importEngine(ctx, shopifyOnboarding)).ideaId;
  await accept(ctx, changesRequested, "Launch mistakes are costly and easy to detect.");
  const shopifyRevision = await workingRevisionId(ctx, changesRequested);
  await reviewEverything(ctx, changesRequested, shopifyRevision, 2);
  must(
    await ctx.editor.requestChanges(
      shopifyRevision,
      "Market Research has no evidence. Add a sourced count of new stores, or cut the section's claim.",
    ),
    "request changes",
  );
  clock.advance(20 * MINUTE);

  demo.expireStrongAuth();
  return {
    flagshipLiveWithDraft: flagship,
    newCandidate,
    acceptedAwaitingReview,
    duplicateRejected,
    evidenceUnavailable,
    changedSource,
    legacyNoRecord,
    legacyQuarantined,
    conflictingAutosave,
    staleApproval,
    failedDeployment,
    uncertainActivation,
    unpublished,
    trashed,
    previewReady,
    changesRequested,
  };
}
