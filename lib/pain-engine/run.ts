/**
 * Pain Engine — the orchestrator.
 *
 * listen -> extract (in listeners) -> cluster -> score -> write -> review queue.
 *
 * Isolation is the point: listeners run with Promise.allSettled, so one
 * source failing (timeout, 403, missing key) is reported in the run report
 * and the rest of the batch still completes. A listener that is skipped
 * (e.g. Product Hunt with no token) is reported as skipped, not failed.
 * Only the top-scored clusters reach the writer, and the writer costs $0
 * (no LLM, no paid API anywhere in Phase 1).
 */
import { createFetcher } from "./fetch.ts";
import { createIdeaRequestsListener, PHASE1_LISTENERS } from "./listeners.ts";
import { clusterFindings } from "./cluster.ts";
import { decideReview, listReviewRecords, saveReviewRecord } from "./review.ts";
import { writeDraft } from "./writer.ts";
import type {
  IdeaRequestRow,
  ListenerReport,
  PainListener,
  PainRunReport,
  ReviewRecord,
} from "./types.ts";

export interface RunOptions {
  /** Repo root (review records go under engine/pain/review/). */
  rootDir: string;
  /** On-disk cache directory (engine/pain/cache/ by default). */
  cacheDir: string;
  /** How many top-scored clusters become drafts. Default 3. */
  topN?: number;
  /** Extra listeners (e.g. the idea-requests adapter). */
  extraListeners?: PainListener[];
  /** Pre-exported listForSuggest rows, when the idea-requests feed is used. */
  ideaRequestRows?: IdeaRequestRow[];
  /** Injectable fetch for tests / offline mode. */
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
  log?: (message: string) => void;
}

export async function runPainEngine(options: RunOptions): Promise<PainRunReport> {
  const startedAt = new Date().toISOString();
  const log = options.log ?? (() => {});
  const env = options.env ?? process.env;
  const topN = options.topN ?? 3;

  const { fetchText, fetchJson } = createFetcher({
    cacheDir: options.cacheDir,
    fetchImpl: options.fetchImpl,
    log,
  });

  const listeners: PainListener[] = [...PHASE1_LISTENERS, ...(options.extraListeners ?? [])];
  if (options.ideaRequestRows && options.ideaRequestRows.length > 0) {
    listeners.push(createIdeaRequestsListener(options.ideaRequestRows));
  }

  const settled = await Promise.allSettled(
    listeners.map(async (listener) => {
      try {
        const findings = await listener.listen({ fetchJson, fetchText, env, log });
        return { source: listener.source, status: "ok" as const, findings };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return {
          source: listener.source,
          status: "failed" as const,
          findings: [],
          reason,
        };
      }
    }),
  );

  const sourceReports: ListenerReport[] = settled.map((result) => {
    if (result.status === "fulfilled") return result.value;
    return {
      source: "unknown",
      status: "failed",
      findings: [],
      reason: result.reason instanceof Error ? result.reason.message : String(result.reason),
    };
  });

  const allFindings = sourceReports.flatMap((r) => r.findings);
  log(`listeners: ${allFindings.length} findings from ${sourceReports.length} sources`);

  const clusters = clusterFindings(allFindings);
  const winners = clusters.slice(0, topN);
  log(`clusters: ${clusters.length} found, ${winners.length} drafted`);

  const drafts: ReviewRecord[] = [];
  for (const cluster of winners) {
    const draft = writeDraft(cluster);
    log(
      `draft ${draft.slug}: verdict ${draft.scorecard.verdict} ` +
        `(${draft.scorecard.composite}/10) — ${draft.scorecard.rationale}`,
    );
    const record: ReviewRecord = {
      slug: draft.slug,
      status: "pending",
      createdAt: new Date().toISOString(),
      cluster,
      draft,
      runCostUsd: 0,
    };
    saveReviewRecord(options.rootDir, record);
    drafts.push(record);
  }

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    sourceReports,
    clustersFound: clusters.length,
    drafts,
    costUsd: 0,
  };
}

export { decideReview, listReviewRecords };
