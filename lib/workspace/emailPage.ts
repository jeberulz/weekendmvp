import { APPROVAL_NOTE_MAX_LENGTH, normalizeApprovalNote } from "./contracts/approvals";
import { EMAIL_CTA_TARGETS, EMAIL_KINDS, EMAIL_MERGE_TAGS } from "./contracts/artifacts";
import { approvalDecisionCopy, CHANGED_CODES } from "./wrenCards";

/**
 * WP76-S1b: the words on the Email page. Pure, so the wording is unit-tested.
 * The label maps are `Record`s over the contract unions, so a new kind, target
 * or status is a type error here until it has words.
 */

export type EmailKindKey = (typeof EMAIL_KINDS)[number];
export type EmailCtaTarget = (typeof EMAIL_CTA_TARGETS)[number];
export type SequenceStatus = "draft" | "approved" | "active" | "paused";

export const EMAIL_KIND_LABELS: Record<EmailKindKey, string> = {
  welcome: "Welcome",
  value: "Value",
  offer: "Offer",
  follow_up: "Follow-up",
};

export const EMAIL_CTA_TARGET_LABELS: Record<EmailCtaTarget, string> = {
  site: "your site",
  waitlist: "your waitlist",
  reply: "a reply",
};

export const SEQUENCE_STATUS_LABELS: Record<SequenceStatus, string> = {
  draft: "Draft",
  approved: "Approved",
  active: "Active",
  paused: "Paused",
};

export const EMAIL_NONE_COPY = "Your email sequence is on its way. Your team writes it after your brand kit.";
export const EMAIL_UNAVAILABLE_COPY = "Your email sequence can't be shown right now. Check back in a little while.";
export const EMAIL_APPROVED_NOTE = "Nothing is sent yet.";
export const EMAIL_CHANGES_PENDING_COPY = "Your team is working on your changes.";
export const EMAIL_CLOSED_COPY = "This review closed without a decision. Your emails stay as they are.";
export const EMAIL_MERGE_TAG = EMAIL_MERGE_TAGS[0];

/** When an email goes: the welcome at once, the rest after the previous email (days when whole). */
export function emailDelayCopy(delayHours: number): string {
  if (delayHours <= 0) return "As soon as someone confirms";
  if (Number.isInteger(delayHours) && delayHours % 24 === 0) {
    const days = delayHours / 24;
    return `${days} ${days === 1 ? "day" : "days"} after the previous email`;
  }
  return `${delayHours} ${delayHours === 1 ? "hour" : "hours"} after the previous email`;
}

/** The body's paragraphs, split on blank lines; single line breaks stay inside a paragraph. */
export function emailBodyParagraphs(body: string): string[] {
  return body
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** Splits text around the merge tag so the page can show it as a token. Pieces alternate text, tag, text. */
export function splitMergeTags(text: string): { text: string; tag: boolean }[] {
  return text
    .split(EMAIL_MERGE_TAG)
    .flatMap((piece, index) => (index === 0 ? [{ text: piece, tag: false }] : [{ text: EMAIL_MERGE_TAG, tag: true }, { text: piece, tag: false }]))
    .filter((piece) => piece.text.length > 0);
}

export function emailCtaCopy(cta: { label: string; target: EmailCtaTarget }): { label: string; destination: string } {
  return { label: cta.label, destination: EMAIL_CTA_TARGET_LABELS[cta.target] };
}

export const EMAIL_NOTE_MAX_LENGTH = APPROVAL_NOTE_MAX_LENGTH;
const NOTE_LIMIT_TEXT = EMAIL_NOTE_MAX_LENGTH.toLocaleString("en-US");

export type EmailNoteCheck =
  | { readonly ok: true; readonly note: string }
  | { readonly ok: false; readonly error: string };

/** The same rule as the server (`normalizeApprovalNote`), checked before anything is sent. */
export function checkEmailNote(raw: string): EmailNoteCheck {
  const note = normalizeApprovalNote(raw);
  if (note === undefined) return { ok: false, error: "Write what you would like changed before you send." };
  if (note === null) return { ok: false, error: `Keep it under ${NOTE_LIMIT_TEXT} characters.` };
  return { ok: true, note };
}

/** The trimmed length the server counts. */
export function emailNoteLength(raw: string): number {
  return raw.trim().length;
}

export type ChangeRoundAnswer =
  | { readonly outcome: "free" }
  | { readonly outcome: "spend_required"; readonly costCredits?: number }
  | { readonly outcome: "not_available"; readonly reason: string };

/** What `previewChangeRound` says "Ask for changes" would be, before the founder clicks. */
export type ChangePreview =
  | { readonly outcome: "free"; readonly freeRoundsLeft: number }
  | { readonly outcome: "spend_required"; readonly costCredits: number }
  | { readonly outcome: "not_available"; readonly reason: string };

export type PreviewState =
  | { readonly kind: "loading" }
  | { readonly kind: "failed" }
  | { readonly kind: "ready"; readonly preview: ChangePreview };

const creditsText = (credits: number): string => `${credits} ${credits === 1 ? "credit" : "credits"}`;

/**
 * A paid round is not open yet (no surface raises or pays a `spend` card), so
 * the page says the cost and what the founder can still do, and never offers it.
 */
export function spendRoundCopy(costCredits: number | undefined, where: "pending" | "changes_requested" | "result"): string {
  const cost = costCredits === undefined ? "credits" : creditsText(costCredits);
  const next = where === "changes_requested" ? "The next" : "Another";
  const after = where === "pending" ? "so you can approve these emails as they are" : "so your emails stay as they are";
  return `${next} round of changes costs ${cost}. Paying for changes isn't open yet, ${after}.`;
}

export function freeRoundsCopy(freeRoundsLeft: number): string {
  if (freeRoundsLeft <= 0) return "";
  return `${freeRoundsLeft} free ${freeRoundsLeft === 1 ? "round" : "rounds"} of changes left.`;
}

export function notAvailableCopy(reason: string): string {
  if (reason === "busy") return "Your team is still working on this. You can ask again when they are done.";
  return "Changes can't be asked for on this right now.";
}

/** Ask for changes is offered only when the preview is `free`; loading and failed show nothing. */
export function canOfferAsk(state: PreviewState): boolean {
  return state.kind === "ready" && state.preview.outcome === "free";
}

/** The line under the review status that comes from the preview (null: nothing to add). */
export function previewLine(state: PreviewState, cardStatus: "pending" | "changes_requested"): string | null {
  if (state.kind !== "ready") return null;
  const { preview } = state;
  switch (preview.outcome) {
    case "free": {
      const left = freeRoundsCopy(preview.freeRoundsLeft);
      return cardStatus === "changes_requested" ? `You can ask for changes again. ${left}`.trim() : left || null;
    }
    case "spend_required":
      return spendRoundCopy(preview.costCredits, cardStatus);
    case "not_available":
      return notAvailableCopy(preview.reason);
  }
}

/** A revision is running when the preview says the artifact is busy. */
export function previewIsBusy(state: PreviewState): boolean {
  return state.kind === "ready" && state.preview.outcome === "not_available" && state.preview.reason === "busy";
}

/**
 * What the server answered to "Ask for changes", in words. Without a
 * change-round answer the decision's own status speaks (an expired card, or a
 * re-ask that changed nothing because the team is already on it).
 */
export function changesOutcomeCopy(answer: ChangeRoundAnswer | undefined, status: string, changed: boolean): string {
  if (answer === undefined) {
    if (!changed && status === "changes_requested") {
      return "Your team is still working on your earlier changes. This note wasn't sent; try again when they're done.";
    }
    return approvalDecisionCopy(status);
  }
  switch (answer.outcome) {
    case "free":
      return "Changes requested. Your team is rewriting the emails.";
    case "spend_required":
      return spendRoundCopy(answer.costCredits, "result");
    case "not_available":
      return notAvailableCopy(answer.reason);
  }
}

/** The form stays open, with the note, when the server could not take the request (or it changed nothing). */
export function keepsFormOpen(answer: ChangeRoundAnswer | undefined, status: string, changed: boolean): boolean {
  if (answer === undefined) return !changed && status === "changes_requested";
  return answer.outcome === "not_available";
}

/** The line when a decision is refused; null falls through to the shared card copy. */
export function emailDecisionErrorCopy(code: string | null, rateLimited: boolean): string | null {
  if (rateLimited) return "You've made a lot of changes this hour. Try again later.";
  if (code !== null && CHANGED_CODES.has(code)) return "These emails changed since this was raised. Look at the newest version, then decide again.";
  if (code === "APPROVAL_INVALID_NOTE") return `Keep your note under ${NOTE_LIMIT_TEXT} characters.`;
  return null;
}
