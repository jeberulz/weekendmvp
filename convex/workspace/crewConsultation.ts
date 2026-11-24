import { v, type Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { getOpsSettings } from "../ops/settings";
import { requireBusinessForOwner } from "../platform/authz";
import { readConsultationRoster } from "./consultationRoster";
import { consultationParticipant } from "../schema/workspace";
import { readCrewStatus } from "./crewStatus";
import { newestDraftDocument, newestReviewCard, parseDraftBody } from "../growth/drafts/documentDraft";
import { brandKitSchema, emailSequenceSchema, socialPackSchema } from "../../lib/workspace/contracts/artifacts";
import { consultationAttemptsAvailable, consultationMember, crewConsultationIntent } from "../../lib/workspace/crew/consultation";
import { sliceWellFormed } from "../../lib/workspace/plainText";

const replyScope = {
  ownerId: v.id("users"),
  projectId: v.id("projects"),
  wrenMessageId: v.id("chat_messages"),
  attempt: v.number(),
};
const specialistContext = v.object({ participant: consultationParticipant, evidence: v.string() });
type Participant = Infer<typeof consultationParticipant>;
type CrewStatus = Awaited<ReturnType<typeof readCrewStatus>>;
type Consultation = NonNullable<Doc<"chat_messages">["crewConsultation"]>;

function participant(member: Doc<"crew_members">): Participant {
  return { employeeId: member._id, name: member.displayName, role: member.roleKey };
}

async function excerpts(ctx: MutationCtx, project: Doc<"projects">, role: string) {
  const kind = role === "brand" ? "brand_kit" : role === "email" ? "email_sequence" : role === "social" ? "social_pack" : null;
  if (!kind) return null;
  const business = { ownerId: project.ownerId, projectId: project._id };
  const document = await newestDraftDocument(ctx, business, kind);
  if (!document) return null;
  const card = await newestReviewCard(ctx, business, document._id);
  const review = card?.status === "pending" && card.expiresAt <= Date.now() ? "expired" : card?.status ?? null;
  const shorten = (value: string) => sliceWellFormed(value, 400);
  if (kind === "brand_kit") {
    const kit = parseDraftBody(document.body, brandKitSchema);
    return kit ? { kind, review, tagline: kit.tagline.text, voice: kit.voice, palette: kit.palette } : null;
  }
  if (kind === "email_sequence") {
    const sequence = parseDraftBody(document.body, emailSequenceSchema);
    return sequence ? { kind, review, emails: Object.entries(sequence.emails).map(([kind, { subject, body }]) => ({ kind, subject, body: shorten(body) })) } : null;
  }
  const pack = parseDraftBody(document.body, socialPackSchema);
  return pack ? { kind, review, posts: Object.entries(pack.posts).map(([day, post]) => ({ day, caption: shorten(post.caption) })) } : null;
}

async function specialistEvidence(ctx: MutationCtx, project: Doc<"projects">, crew: CrewStatus, worker: Participant) {
  const status = crew.specialists.find((role) => role.role === worker.role);
  const artifact = await excerpts(ctx, project, worker.role);
  return JSON.stringify({
    business: project.workspace?.name ?? project.title,
    description: sliceWellFormed(project.workspace?.ownIdeaText ?? "", 800),
    goal: project.workspace?.goal ?? null,
    specialistStatus: status ? { status: status.status, detail: status.detail } : null,
    artifact,
  });
}

function receipt(state: Consultation) {
  if (state.colleague) return `Consultation between ${state.recipient.name} and ${state.colleague.name}`;
  return `Question for ${state.recipient.name}`;
}

function consultationBody(state: Consultation, failure?: string) {
  const parts = [receipt(state)];
  if (state.colleague && state.colleagueAnswer) parts.push(`${state.colleague.name} (${state.colleague.role})\n${state.colleagueAnswer}`);
  if (state.recipientAnswer) parts.push(`${state.recipient.name} (${state.recipient.role})\n${state.recipientAnswer}`);
  if (failure) parts.push(failure);
  return parts.join("\n\n");
}

export const start = internalMutation({
  args: { ...replyScope, founderMessageId: v.id("chat_messages") },
  returns: v.union(v.null(), v.object({
    question: v.string(),
    recipient: specialistContext,
    colleague: v.optional(specialistContext),
    colleagueAnswer: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    const project = await requireBusinessForOwner(ctx, args.projectId, args.ownerId);
    const [founder, reply, settings] = await Promise.all([
      ctx.db.get("chat_messages", args.founderMessageId),
      ctx.db.get("chat_messages", args.wrenMessageId),
      getOpsSettings(ctx),
    ]);
    if (!founder || !reply || founder.ownerId !== args.ownerId || founder.projectId !== args.projectId ||
      reply.ownerId !== args.ownerId || reply.projectId !== args.projectId || founder.author !== "founder" ||
      reply.author !== "wren" || reply.replyTo !== founder._id || reply.status !== "streaming" ||
      founder.status !== "done" || founder.createdAt !== reply.createdAt ||
      (reply.crewConsultation?.attempt ?? 0) >= args.attempt) return null;

    const end = async (body: string, status: "done" | "failed" = "done") => {
      await ctx.db.patch("chat_messages", reply._id, { status, body, updatedAt: Date.now() });
      return null;
    };
    if (!settings.workspaceEnabled || settings.killSwitches.ai) {
      return await end("Specialist conversations are paused. You can try again when they resume.", "failed");
    }
    const intent = crewConsultationIntent(founder.body, founder.focusRole);
    if (!intent) return await end("I couldn't resolve who to ask. Try “Ask Iris: what is blocking the brand work?”");

    const roster = await readConsultationRoster(ctx, project);
    const recipientRow = consultationMember(intent.recipient, roster);
    const colleagueRow = intent.colleague ? consultationMember(intent.colleague, roster) : undefined;
    const unknown = !recipientRow ? intent.recipient : intent.colleague && !colleagueRow ? intent.colleague : undefined;
    if (unknown || !recipientRow) {
      const names = roster.map((row) => row.displayName).join(", ");
      return await end(names
        ? `I couldn't find a unique hired specialist named “${unknown}” on this business. The specialists here are ${names}.`
        : "There are no hired specialists for this business yet.");
    }
    if (colleagueRow?._id === recipientRow._id) return await end("Choose two different specialists for a consultation.");

    const recipient = participant(recipientRow);
    const colleague = colleagueRow ? participant(colleagueRow) : undefined;
    const prior = reply.crewConsultation;
    const colleagueAnswer = prior?.recipient.employeeId === recipient.employeeId && prior.colleague?.employeeId === colleague?.employeeId
      ? prior.colleagueAnswer
      : undefined;
    if (!consultationAttemptsAvailable(args.attempt, !!colleague && !colleagueAnswer)) {
      return await end("This conversation has reached its retry limit. Send a new question to try again.", "failed");
    }
    const crew = await readCrewStatus(ctx, project, Date.now());
    const state: Consultation = {
      attempt: args.attempt, state: "working", recipient,
      ...(colleague ? { colleague } : {}),
      ...(colleagueAnswer ? { colleagueAnswer } : {}),
    };
    const [recipientEvidence, colleagueEvidence] = await Promise.all([
      specialistEvidence(ctx, project, crew, recipient),
      colleague && !colleagueAnswer ? specialistEvidence(ctx, project, crew, colleague) : null,
    ]);
    await ctx.db.patch("chat_messages", reply._id, { crewConsultation: state, body: consultationBody(state), updatedAt: Date.now() });
    return {
      question: intent.question,
      recipient: { participant: recipient, evidence: recipientEvidence },
      ...(colleague ? { colleague: { participant: colleague, evidence: colleagueEvidence ?? "" } } : {}),
      ...(colleagueAnswer ? { colleagueAnswer } : {}),
    };
  },
});

export const record = internalMutation({
  args: {
    ...replyScope,
    outcome: v.union(
      v.object({ kind: v.literal("colleague"), answer: v.string() }),
      v.object({ kind: v.literal("recipient"), answer: v.string() }),
      v.object({ kind: v.literal("failed"), reason: v.union(v.literal("paused"), v.literal("budget"), v.literal("failed")) }),
    ),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const reply = await ctx.db.get("chat_messages", args.wrenMessageId);
    const state = reply?.crewConsultation;
    if (!reply || reply.projectId !== args.projectId || reply.ownerId !== args.ownerId || reply.author !== "wren" ||
      reply.status !== "streaming" || state?.state !== "working" || state.attempt !== args.attempt) return false;
    const outcome = args.outcome;
    if (outcome.kind === "failed") {
      const worker = state.colleague && !state.colleagueAnswer ? state.colleague : state.recipient;
      const reason = outcome.reason === "budget" ? "This business has run out of AI budget for now."
        : outcome.reason === "paused" ? "Specialist conversations are paused."
        : `${worker.name} couldn't finish the answer. You can retry this conversation.`;
      await ctx.db.patch("chat_messages", reply._id, {
        crewConsultation: { ...state, state: "failed" }, status: "failed", body: consultationBody(state, reason), updatedAt: Date.now(),
      });
      return true;
    }
    if (outcome.kind === "colleague" ? !state.colleague || !!state.colleagueAnswer : !!state.colleague && !state.colleagueAnswer) {
      return false;
    }
    const answer = sliceWellFormed(outcome.answer.trim(), 1_000);
    if (!answer) return false;
    const next: Consultation = outcome.kind === "colleague"
      ? { ...state, colleagueAnswer: answer }
      : { ...state, recipientAnswer: answer, state: "answered" };
    await ctx.db.patch("chat_messages", reply._id, {
      crewConsultation: next, status: next.state === "answered" ? "done" : "streaming", body: consultationBody(next), updatedAt: Date.now(),
    });
    return true;
  },
});
