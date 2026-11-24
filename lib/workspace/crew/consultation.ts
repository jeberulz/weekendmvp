import { WREN_MAX_ATTEMPTS_PER_MESSAGE } from "../wren";

export type ConsultationIntent = {
  recipient: string;
  colleague?: string;
  question: string;
};

const INVITATION = /^(?:(?:can|could|would) you\s+)?(?:please\s+)?/iu;
const MEMBER = String.raw`[\p{L}\p{N}][\p{L}\p{N} '\p{Pd}’]{0,59}?`;
const RELAY = "(?:ask|message|tell|check with|pass (?:this|a) (?:message|question) to)";
// Require a relay verb so ordinary lead chat and free-form data stay on their existing routes.
const CONSULT = new RegExp(
  `^${RELAY} (${MEMBER}) (?:to (?:consult|check|coordinate|compare notes|talk|speak) with|and) (${MEMBER})` +
  String.raw`(?:\s+(?:about|on|whether|to)\s+|(?=\s+(?:what|why|how|which|who|where|when|is|are|does|do|did|can)\b)\s+|[:,]\s*)(.+)$`, "isu",
);
const ASK = new RegExp(
  `^${RELAY} (${MEMBER})` +
  String.raw`(?:\s*[:,]\s*|\s+(?:about|whether|if)\s+|(?=\s+(?:what|why|how|which|who|where|when|is|are|does|do|did|can)\b)\s+|\s+to\s+(?=review\b|explain\b|compare\b|summari[sz]e\b|report\b|describe\b|assess\b|check\b|read\b|suggest\b))(.+)$`, "isu",
);
export function crewConsultationIntent(message: string, focus?: string): ConsultationIntent | null {
  const value = message.trim().replace(INVITATION, "");
  const joint = CONSULT.exec(value);
  if (joint) return { recipient: joint[1], colleague: joint[2], question: joint[3] };
  const addressed = ASK.exec(value);
  if (!addressed) return null;
  const match = addressed[1].trim();
  return { recipient: /^(?:them|this specialist|this agent)$/iu.test(match) ? (focus ?? match) : match, question: addressed[2] };
}

function normalizeRecipient(name: string): string {
  return name.trim().toLowerCase().replace(/^the\s+/u, "")
    .replace(/\s+(?:(?:ai )?(?:agent|specialist|team))$/u, "").replace(/^e-mail$/u, "email");
}

/** Pick only a unique match from the current business's hired roster. */
export function consultationMember<T extends { displayName: string; roleKey: string }>(
  name: string,
  members: readonly T[],
): T | undefined {
  const target = normalizeRecipient(name);
  const matching = members.filter((member) =>
    normalizeRecipient(member.displayName) === target || normalizeRecipient(member.roleKey) === target,
  );
  return matching.length === 1 ? matching[0] : undefined;
}

/** Leave room for the gateway's one schema re-ask per still-unanswered specialist. */
export function consultationAttemptsAvailable(attempt: number, hasUnansweredColleague: boolean): boolean {
  return attempt + (hasUnansweredColleague ? 3 : 1) <= WREN_MAX_ATTEMPTS_PER_MESSAGE;
}
