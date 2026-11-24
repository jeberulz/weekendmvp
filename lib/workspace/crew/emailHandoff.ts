import { type EmailKind, type EmailSequence } from "../contracts/artifacts";

const messageKinds: Record<EmailKind, RegExp> = {
  welcome: /\b(?:welcome|first)\s+(?:waitlist\s+)?(?:e-?mail|message|subject|copy)\b/iu,
  value: /\b(?:value|second)\s+(?:e-?mail|message|subject|copy)\b/iu,
  offer: /\b(?:offer|third)\s+(?:e-?mail|message|subject|copy)\b/iu,
  follow_up: /\b(?:follow[-_ ]?up|fourth|last)\s+(?:e-?mail|message|subject|copy)\b/iu,
};

/** The welcome email is the founder-facing sample when no particular email is named. */
export function handoffEmailKind(note: string): EmailKind | undefined {
  const kinds = (Object.keys(messageKinds) as EmailKind[]).filter((kind) => messageKinds[kind].test(note));
  if (kinds.length === 1) return kinds[0];
  if (kinds.length === 0 && /\b(?:one|a single|(?:a|an|the)\s+(?:revised|updated|rewritten|sample))\s+(?:(?:revised|updated|rewritten|sample|waitlist)\s+)*e-?mail\b(?!\s+(?:sequence|series|campaign|flow|schedule|list)\b)/iu.test(note)) return "welcome";
  return undefined;
}

export function handoffEmailBrief(note: string): string {
  const kind = handoffEmailKind(note);
  const target = kind ? `Rewrite the ${kind.replace("_", "-")} email only. Preserve the other three emails exactly.`
    : "Revise the requested waitlist emails in the existing sequence.";
  return `${target} Use the newly approved brand voice, tagline and positioning in the brand data. Give the reader materially revised copy in the subject, preview or body. Keep the existing factual claims and send timing. Founder’s request: ${note}`;
}

/** Preserve every field outside the one reader-facing message the founder asked to see. */
export function reviseSingleEmail(previous: EmailSequence, candidate: EmailSequence, kind: EmailKind): EmailSequence {
  const { delayHours, goal } = previous.emails[kind];
  const { subject, preview, body, cta } = candidate.emails[kind];
  return {
    ...previous,
    emails: {
      ...previous.emails,
      [kind]: { delayHours, goal, subject, preview, body, ...(cta ? { cta } : {}) },
    },
  };
}

export function emailCopyChanged(previous: EmailSequence, candidate: EmailSequence, kind: EmailKind): boolean {
  const before = previous.emails[kind];
  const after = candidate.emails[kind];
  const words = (text: string) => text.trim().replace(/\s+/gu, " ");
  return words(before.subject) !== words(after.subject) || words(before.preview) !== words(after.preview) || words(before.body) !== words(after.body);
}
