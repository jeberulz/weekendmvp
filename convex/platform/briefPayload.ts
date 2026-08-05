import { ConvexError, v, type Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { assertGeneratedDocumentBody } from "./validators";

export const briefInputValidator = v.object({
  title: v.string(),
  problem: v.string(),
  audience: v.string(),
  outcome: v.string(),
  constraints: v.string(),
});

export type BriefInput = Infer<typeof briefInputValidator>;

export type RepositorySourceSnapshot = {
  ideaId: string;
  slug: string;
  title: string;
  description: string;
  publishedAt: number;
  category: string;
  buildTime: string;
  revenueGoal: string;
  applicationCategory: string;
  tools: string[];
  audiences: string[];
  scores?: {
    opportunity: number;
    pain: number;
    timing: number;
    builder_confidence: number;
  };
};

export type BriefPayload = {
  contractVersion: 1;
  source: "repository_idea" | "own_idea";
  sourceSnapshot?: RepositorySourceSnapshot;
  brief: BriefInput;
};

const LIMITS = {
  title: [3, 120],
  problem: [20, 2_000],
  audience: [3, 500],
  outcome: [10, 1_500],
  constraints: [0, 1_500],
} as const;

function normalizeField(
  field: keyof BriefInput,
  value: string,
): string {
  const normalized = value.trim().replace(/\r\n/g, "\n");
  const [min, max] = LIMITS[field];
  if (normalized.length < min || normalized.length > max) {
    throw new ConvexError({
      code: "INVALID_BRIEF_FIELD",
      field,
      min,
      max,
    });
  }
  return normalized;
}

function normalizeDraftField(
  field: keyof BriefInput,
  value: string,
): string {
  const normalized = value.trim().replace(/\r\n/g, "\n");
  const [, max] = LIMITS[field];
  if (normalized.length > max) {
    throw new ConvexError({
      code: "INVALID_BRIEF_FIELD",
      field,
      min: 0,
      max,
    });
  }
  return normalized;
}

export function normalizeBriefInput(input: BriefInput): BriefInput {
  return {
    title: normalizeField("title", input.title),
    problem: normalizeField("problem", input.problem),
    audience: normalizeField("audience", input.audience),
    outcome: normalizeField("outcome", input.outcome),
    constraints: normalizeField("constraints", input.constraints),
  };
}

/** Drafts may be partial, but retain the same byte and per-field ceilings. */
export function normalizeDraftBriefInput(input: BriefInput): BriefInput {
  return {
    title: normalizeDraftField("title", input.title),
    problem: normalizeDraftField("problem", input.problem),
    audience: normalizeDraftField("audience", input.audience),
    outcome: normalizeDraftField("outcome", input.outcome),
    constraints: normalizeDraftField("constraints", input.constraints),
  };
}

export function briefDisplayTitle(input: BriefInput): string {
  return input.title || "Untitled idea";
}

export function repositorySnapshot(
  idea: Doc<"ideas">,
): RepositorySourceSnapshot {
  return {
    ideaId: idea._id,
    slug: idea.slug,
    title: idea.title,
    description: idea.description,
    publishedAt: idea.publishedAt,
    category: idea.category,
    buildTime: idea.buildTime,
    revenueGoal: idea.revenueGoal,
    applicationCategory: idea.applicationCategory,
    tools: [...idea.tools],
    audiences: [...idea.audiences],
    ...(idea.scores ? { scores: { ...idea.scores } } : {}),
  };
}

export function initialRepositoryBrief(
  snapshot: RepositorySourceSnapshot,
): BriefInput {
  return normalizeBriefInput({
    title: snapshot.title,
    problem: snapshot.description,
    audience:
      snapshot.audiences.length > 0
        ? snapshot.audiences.join(", ")
        : "People affected by this problem",
    outcome: `Create a focused first version of ${snapshot.title} and test demand with a real audience.`,
    constraints: `Target build time: ${snapshot.buildTime} hours. Initial revenue goal: ${snapshot.revenueGoal}.`,
  });
}

export function serializeBriefPayload(payload: BriefPayload): string {
  return assertGeneratedDocumentBody(JSON.stringify(payload));
}

export function parseBriefPayload(body: string | undefined): BriefPayload {
  if (!body) {
    throw new ConvexError({ code: "INVALID_BRIEF_DOCUMENT" });
  }
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    throw new ConvexError({ code: "INVALID_BRIEF_DOCUMENT" });
  }
  if (
    typeof value !== "object" ||
    value === null ||
    !("contractVersion" in value) ||
    value.contractVersion !== 1 ||
    !("source" in value) ||
    (value.source !== "repository_idea" && value.source !== "own_idea") ||
    !("brief" in value) ||
    typeof value.brief !== "object" ||
    value.brief === null
  ) {
    throw new ConvexError({ code: "INVALID_BRIEF_DOCUMENT" });
  }
  const raw = value.brief as Record<string, unknown>;
  if (
    typeof raw.title !== "string" ||
    typeof raw.problem !== "string" ||
    typeof raw.audience !== "string" ||
    typeof raw.outcome !== "string" ||
    typeof raw.constraints !== "string"
  ) {
    throw new ConvexError({ code: "INVALID_BRIEF_DOCUMENT" });
  }
  return value as BriefPayload;
}

export function assertBriefPayloadSource(
  payload: BriefPayload,
  project: Pick<Doc<"projects">, "source" | "sourceIdeaId">,
): BriefPayload {
  const repositoryMatches =
    project.source === "repository_idea" &&
    project.sourceIdeaId !== undefined &&
    payload.source === "repository_idea" &&
    payload.sourceSnapshot?.ideaId === project.sourceIdeaId;
  const ownIdeaMatches =
    project.source === "own_idea" &&
    project.sourceIdeaId === undefined &&
    payload.source === "own_idea" &&
    payload.sourceSnapshot === undefined;
  if (!repositoryMatches && !ownIdeaMatches) {
    throw new ConvexError({ code: "INVALID_BRIEF_DOCUMENT" });
  }
  return payload;
}

export function nextTimestamp(previous: number): number {
  return Math.max(Date.now(), previous + 1);
}

export function normalizeIdempotencyKey(raw: string): string {
  const key = raw.trim();
  if (!/^[A-Za-z0-9:_-]{8,128}$/.test(key)) {
    throw new ConvexError({ code: "INVALID_IDEMPOTENCY_KEY" });
  }
  return key;
}
