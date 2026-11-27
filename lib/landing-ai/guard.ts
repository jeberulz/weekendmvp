import { beforeCopy, type Block, type Copy, proposalSchema } from "./blocks";
import { lockedLines } from "./voice";

const protectedFacts = [
  /\{\{?[^{}\n]+\}\}?/g,
  /https?:\/\/[^\s<>]+|mailto:[^\s<>]+|(?:^|(?<=\s|\())\/[a-z0-9][\w/?#=&.%+-]*/g,
  /\b[^\s@]+@[a-z\d.-]+\.[a-z]{2,}\b/gi,
  /[$£€]\s*\d+(?:[,.]\d+)*(?:\s*(?:USD|GBP|EUR|\/mo(?:nth)?))?/gi,
  /\b\d+(?:[,.–:\/-]\d+)*(?:\s*(?:hours?|days?|weeks?|months?|years?|seats?|spots?|minutes?|percent|%|USD|GBP|EUR)\b)?/gi,
  /\b(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?|jan(?:uary)?|feb(?:ruary)?|apr(?:il)?|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/gi,
  /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|sixty|hundred|thousand)\s+(?:hours?|days?|weeks?|months?|years?|seats?|spots?|minutes?|people|builders|customers|percent)\b/gi,
  /\b(?:sold out|seats? (?:left|remaining)|spots? (?:left|remaining)|early[- ]bird|tomorrow|yesterday|next week|[a-z0-9]+_[a-z0-9_-]{5,})\b/gi,
];
const unsupportedClaims = /\b(?:most people|most founders|most builders|testimonial|receipt|guarantee|i(?:'ve|’ve| have) watched|i(?:'ve|’ve| have) seen)\b/gi;

function fingerprints(text: string) {
  return protectedFacts.flatMap((pattern) => text.match(pattern) ?? []).sort();
}

function changedFacts(before: string, after: string) {
  return JSON.stringify(fingerprints(before)) !== JSON.stringify(fingerprints(after));
}

function newClaim(before: string, after: string) {
  const claims = new Set((before.match(unsupportedClaims) ?? []).map((value) => value.toLowerCase()));
  return (after.match(unsupportedClaims) ?? []).some((value) => !claims.has(value.toLowerCase()));
}

export function assertEditorialInstruction(instruction?: string) {
  if (instruction && /\b(?:invent|fabricate|make up|fake)\b[^.!?]*\b(?:testimonial|quote|receipt|statistic|fact|result|observation)s?\b/i.test(instruction)) {
    throw new Error("Enhance requires source evidence for claims, testimonials and receipts.");
  }
}

export function validateProposal(block: Block, payload: unknown): Copy {
  const after: Copy = proposalSchema(block).parse(payload);
  const before = beforeCopy(block);
  for (const [key, value] of Object.entries(after)) {
    const original = before[key];
    const source = Array.isArray(original) ? original.join("\n") : original ?? "";
    const proposed = Array.isArray(value) ? value.join("\n") : value;
    if (changedFacts(source, proposed) || newClaim(source, proposed) ||
      lockedLines.some((line) => source.includes(line) !== proposed.includes(line))) {
      throw new Error("The proposal changed protected wording or introduced an unsupported claim.");
    }
  }
  return after;
}
