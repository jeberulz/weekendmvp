/**
 * WP76-S1a review M1: no links anywhere in an email sequence. C-ART refuses a
 * URL only in `body`, with a closed list of top-level domains; the subject is
 * copied into `sequence_steps.subject` and sent by WP79. The platform adds
 * every link, so any link-like text in any field is a HARD issue.
 *
 * The detector (`findLinkLike`) refuses:
 * - a scheme (`https://`, `ftp://`, `mailto:`, `tel:`, `sms:`);
 * - `www.`;
 * - an email address (`name@host.tld`);
 * - a bare domain with any top-level domain: one or more dotted labels, then a
 *   final label of 2–63 letters in one case (`hydrotrail.shop`,
 *   `HYDROTRAIL.SHOP`, `sub.example.co.uk`).
 * It allows, by construction: abbreviations whose parts are single letters
 * ("e.g.", "i.e.", "a.m."), decimals and versions ("2.5", "v1.2"), a sentence
 * run together after a full stop ("trail.Then": a mixed-case last label is
 * not a domain), and JavaScript names ending in `.js` ("Node.js", "Next.js").
 * Known trade-off: a file name ("plan.pdf") reads as a domain and is refused;
 * an email has no reason to name one. Pure, relative imports only.
 */
import type { EmailSequence } from "../../contracts/artifacts";
import { EMAIL_KINDS } from "../../contracts/artifacts";
import { issue, type CheckIssue, type IssuePath } from "./types";

const SCHEME = /\b(?:[a-z][a-z0-9+.-]*:\/\/|mailto:|tel:|sms:)/iu;
const WWW = /\bwww\./iu;
const EMAIL_ADDRESS = /[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,63}\b/iu;
/** Dotted labels, then a final label: captured so its case and value can be judged. */
const DOMAIN = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63})\b/giu;

/** Final labels that are not domains in prose. */
const NOT_A_TLD = new Set(["js"]);

function isDomainLabel(label: string): boolean {
  const oneCase = label === label.toLowerCase() || label === label.toUpperCase();
  return oneCase && !NOT_A_TLD.has(label.toLowerCase());
}

/** The first link-like snippet in `text`, or null. */
export function findLinkLike(text: string): string | null {
  for (const pattern of [SCHEME, WWW, EMAIL_ADDRESS]) {
    const hit = pattern.exec(text);
    if (hit !== null) return hit[0];
  }
  for (const hit of text.matchAll(DOMAIN)) {
    const label = hit[1];
    if (label !== undefined && isDomainLabel(label)) return hit[0];
  }
  return null;
}

/** Every string field of the sequence a reader sees, with its path. */
function emailSequenceTexts(sequence: EmailSequence): { path: IssuePath; text: string }[] {
  const out: { path: IssuePath; text: string }[] = [
    { path: ["name"], text: sequence.name },
    { path: ["senderName"], text: sequence.senderName },
  ];
  for (const kind of EMAIL_KINDS) {
    const email = sequence.emails[kind];
    for (const field of ["subject", "preview", "body", "goal"] as const) {
      out.push({ path: ["emails", kind, field], text: email[field] });
    }
    if (email.cta !== undefined) out.push({ path: ["emails", kind, "cta", "label"], text: email.cta.label });
  }
  return out;
}

/** A hard `email_link_in_text` issue for every field that holds link-like text. */
export function checkEmailSequenceLinks(sequence: EmailSequence): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const { path, text } of emailSequenceTexts(sequence)) {
    const hit = findLinkLike(text);
    if (hit !== null) {
      issues.push(issue("hard", "email_link_in_text", path, `Remove the link "${hit.slice(0, 40)}"; the platform adds every link, so emails name a CTA target instead.`));
    }
  }
  return issues;
}
