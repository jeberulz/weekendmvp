import { APPROVAL_NOTE_MAX_LENGTH } from "./contracts/approvals";

export const REVISION_TARGETS = {
  brand: { kind: "brand_kit", name: "Iris", artifact: "brand kit" },
  email: { kind: "email_sequence", name: "Elle", artifact: "email sequence" },
  social: { kind: "social_pack", name: "Theo", artifact: "social pack" },
} as const;

type Target = keyof typeof REVISION_TARGETS;
const targets = Object.keys(REVISION_TARGETS) as Target[];
const references: Record<Target, RegExp> = {
  brand: /\b(iris|brand(?:ing)?|palette|logo|colou?rs?|typography|fonts?)\b/iu,
  email: /\b(elle|e-?mails?|subject lines?|waitlist sequence)\b/iu,
  social: /\b(theo|social|posts?|captions?)\b/iu,
};

export function pageFocus(projectId: string, pathname: string): string | undefined {
  const base = `/dashboard/b/${encodeURIComponent(projectId)}/`;
  if (!pathname.startsWith(base)) return undefined;
  const path = pathname.slice(base.length).replace(/\/$/u, "");
  return /^team\/[a-z]+$/u.test(path) ? path.slice(5) : targets.find((target) => target === path);
}

type AssignmentIntent =
  | { type: "revision"; target: Target; note: string; followUpEmail: boolean; emailNote?: string }
  | { type: "clarify"; question: string };

/** Only explicit directives in the current founder turn can put work in the queue. */
export function crewAssignmentIntent(body: string, focus?: string): AssignmentIntent | null {
  const current = body.trim();
  const directive = current
    .replace(/^(?:hey[, ]+)?(?:(?:can|could|would) you\s+|(?:i would like|i['’]d like|i want) you to\s+)?(?:please\s+)?/iu, "")
    .replace(/^(?:ask|have|get|tell) (?:iris|elle|theo|the (?:brand|email|social) (?:agent|specialist))\s+(?:to\s+)?/iu, "")
    .replace(/^(?:iris|elle|theo)[,:]\s*/iu, "")
    .replace(/^please\s+/iu, "");
  if (!/^(?:revise|rewrite|redraft|update|change|adjust|replace|set|switch|make|shorten|reword|use|remove|add)\s/iu.test(directive)) return null;
  // Updates *about* work, examples, conditional requests and questions about
  // a change do not authorize it. The original words remain the revision note.
  if (/\b(?:hold off|wait until|not yet|other business|another business|don['’]t (?:start|queue|do|run|update|change|revise)|do not (?:start|queue|do|run|update|change|revise)|account email|billing email|email address|send (?:the|an?|my) email|publish|schedule|post (?:it|them|to))\b/iu.test(directive)) return null;
  if (/^(?:update|make)\s+(?:me|us|sure)\b/iu.test(directive) ||
      /\b(?:status|updates? on|what changed|only if|if possible|for example|hypothetically)\b/iu.test(directive) ||
      (!/^(?:can|could|would) you\b/iu.test(current) && /\?\s*$/u.test(current))) return null;

  const pieces = current.split(/,?\s+(?:and then|then|and(?=\s+(?:have|ask|get|tell|show me|update|revise|rewrite|redraft)\b))\s+/iu);
  const primary = pieces[0];
  const subject = primary.split(/\s+(?:to match|to reflect|to align with|based on|using the approved)\s+/iu)[0];
  const named = targets.filter((target) => references[target].test(subject));
  if (/\b(?:landing page|build pack|ads campaign|stripe|domain name|billing|account settings)\b/iu.test(subject)) return null;
  const focused = targets.find((target) => target === focus);
  const target = named.length === 1 ? named[0] : named.length === 0 ? focused : undefined;
  if (target === undefined) {
    if (named.length === 0 && focus === undefined && !/\b(?:draft|artifact|kit|revise|rewrite)\b/iu.test(directive)) return null;
    return { type: "clarify", question: "Which draft should I revise, and what change would you like? For example, “Revise the brand kit to use a warmer voice.” I can also revise the email sequence or social pack." };
  }
  const followUp = pieces[1];
  const followUpEmail = pieces.length === 2 && target === "brand" && references.email.test(followUp) &&
    (/^(?:(?:have|ask|get|tell) (?:elle|the email (?:agent|specialist)) (?:to )?)?(?:update|revise|rewrite|redraft|align|adapt|match|refresh|adjust)\b/iu.test(followUp) ||
      /^show me (?:an?|one|the) (?:revised|updated|rewritten) (?:waitlist )?email\b/iu.test(followUp));
  if (pieces.length > 1 && !followUpEmail) return { type: "clarify", question: "Which change should I queue first? I can also pass an approved brand revision to Elle for an email update." };
  if (primary.length > APPROVAL_NOTE_MAX_LENGTH || (followUp?.length ?? 0) > APPROVAL_NOTE_MAX_LENGTH) {
    return { type: "clarify", question: `Could you shorten each specialist’s brief to ${APPROVAL_NOTE_MAX_LENGTH} characters so they can receive it in full?` };
  }
  if (/^(?:please )?(?:(?:ask|have|tell) \w+ (?:to )?)?(?:update|change|revise|rewrite|redraft|adjust) (?:my |our |the )?(?:brand(?: kit)?|waitlist emails?|emails?(?: sequence)?|social(?: pack| posts?)?)[.!?]?$/iu.test(primary)) {
    return { type: "clarify", question: `What would you like ${REVISION_TARGETS[target].name} to change in the ${REVISION_TARGETS[target].artifact}?` };
  }
  return { type: "revision", target, note: primary, followUpEmail, ...(followUpEmail ? { emailNote: followUp } : {}) };
}

/** A read request for an existing email, distinct from asking Elle to write one. */
export function emailPreviewRequest(message: string): { revised: boolean } | null {
  if (!/^(?:(?:can|could|would) you |please )*(?:show|share|read|display|open|let me see)\b/iu.test(message.trim()) ||
      !/\b(?:welcome|waitlist|revised|updated|draft|latest|sample|one|the) (?:welcome |waitlist )?email\b/iu.test(message)) return null;
  return { revised: /\b(?:revised|updated|changed|revision)\b/iu.test(message) };
}

/** Answers a specialist status question from the same snapshot used by Team HQ. */
export function specialistStatusAnswer(
  message: string, focus: string | undefined,
  crew: {
    specialists: readonly { name: string; role: string; status: string; detail: string; blocker?: { label: string } }[];
    reviewCount: number;
    spendApprovals?: readonly { title: string; costCredits: number }[];
  },
): string | null {
  if (!/\b(?:working on|status|progress|updates?|finished|done|blocked|waiting|what changed|what happened|who is working|everyone doing|team doing)\b/iu.test(message)) return null;
  const words = new Set(message.toLowerCase().match(/[a-z]+/gu) ?? []);
  const named = crew.specialists.filter((entry) => words.has(entry.name.toLowerCase()) || words.has(entry.role) ||
    (entry.role === "email" && words.has("emails")));
  const teamWide = /\b(?:everyone|everybody|whole team|my team|the team|crew|team status)\b/iu.test(message);
  const members = named.length > 0 ? named : teamWide ? crew.specialists : crew.specialists.filter((entry) => entry.role === focus);
  if (members.length === 0) return null;
  const statuses = members.map((entry) => {
    const blocker = entry.blocker?.label;
    const detail = blocker && !entry.detail.includes(blocker) ? `${entry.detail}. ${blocker}` : entry.detail;
    return `${entry.name} (${entry.role}) — ${entry.status.replaceAll("_", " ")}. ${detail}`;
  });
  const reviews = crew.reviewCount === 0 ? "You have no open draft reviews." : `You have ${crew.reviewCount} open draft review${crew.reviewCount === 1 ? "" : "s"} on Team HQ.`;
  const spend = (crew.spendApprovals ?? []).map((item) => `${item.title} needs your approval for ${item.costCredits} credits.`);
  return [...statuses, reviews, ...spend].join("\n\n");
}

export function declinedRevisionMessage(artifact: string, reason?: string): string {
  switch (reason) {
    case "missing_artifact": return `The team hasn't produced a ${artifact} yet. A revision needs an existing draft.`;
    case "busy": return `A ${artifact} revision is already in progress. Its status is on Team HQ.`;
    case "pending_spend": return `A different paid revision for the ${artifact} is already awaiting a decision. Review its approval card on Team HQ first.`;
    case "plan_gated": return `Your plan does not include another ${artifact} revision. You can still open the current draft.`;
    case "price_not_set": return `The next ${artifact} revision does not have a credit price yet. You can still open the current draft.`;
    case "missing_review":
    case "review_unavailable": return `The ${artifact} has no usable review yet. Open the draft for its latest decision.`;
    default: return `I couldn't queue the ${artifact} revision. You can check the current draft and review below.`;
  }
}
