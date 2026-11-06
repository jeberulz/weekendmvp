/**
 * WP76-S1a. The email sequence draft contract WP79 reads
 * (`lib/workspace/growth/emailDraft.ts`), pure.
 */
import { describe, expect, test } from "vitest";

import { EMAIL_KINDS, emailsInOrder } from "../../lib/workspace/contracts/artifacts";
import { hydrotrailEmailSequence } from "../../lib/workspace/contracts/fixtures/hydrotrail";
import { checkEmailSequenceLinks, findLinkLike } from "../../lib/workspace/crew/checks/emailLinks";
import { gateCrewArtifact, issueCodes } from "../../lib/workspace/crew/quality";
import type { EmailSequence } from "../../lib/workspace/contracts/artifacts";
import {
  EMAIL_DRAFT_STEP_COUNT,
  draftStepRows,
  emailStepContent,
  emailStepFromSequence,
  parseEmailSequenceBody,
  stepsRewritable,
  type StoredEmailDocument,
  type StoredSequenceStep,
} from "../../lib/workspace/growth/emailDraft";

const document: StoredEmailDocument = { _id: "doc_1", kind: "email_sequence", body: JSON.stringify(hydrotrailEmailSequence) };

function stepFor(order: number, overrides: Partial<StoredSequenceStep> = {}): StoredSequenceStep {
  const row = draftStepRows(hydrotrailEmailSequence)[order];
  if (row === undefined) throw new Error(`no step ${order}`);
  return { order: BigInt(order), delayHours: row.delayHours, subject: row.subject, documentId: "doc_1", ...overrides };
}

describe("draftStepRows", () => {
  test("four rows, orders 0–3 in EMAIL_KINDS order, delay and subject copied", () => {
    const rows = draftStepRows(hydrotrailEmailSequence);
    expect(rows).toHaveLength(EMAIL_DRAFT_STEP_COUNT);
    expect(rows.map((row) => row.kind)).toEqual([...EMAIL_KINDS]);
    expect(rows.map((row) => row.order)).toEqual([0, 1, 2, 3]);
    expect(rows.map((row) => [row.delayHours, row.subject])).toEqual(
      emailsInOrder(hydrotrailEmailSequence).map(({ email }) => [email.delayHours, email.subject]),
    );
    expect(rows[0]?.delayHours).toBe(0);
  });
});

describe("emailStepContent", () => {
  test("returns each step's full email from the document", () => {
    for (let order = 0; order < EMAIL_DRAFT_STEP_COUNT; order += 1) {
      const kind = EMAIL_KINDS[order];
      if (kind === undefined) throw new Error("no kind");
      expect(emailStepContent(stepFor(order), document)).toEqual({ ok: true, order, kind, email: hydrotrailEmailSequence.emails[kind] });
    }
    // A plain number order reads the same as the stored int64.
    expect(emailStepContent(stepFor(1, { order: 1 }), document).ok).toBe(true);
  });

  test("fails closed on a mismatched subject or delay", () => {
    expect(emailStepContent(stepFor(2, { subject: "Something else" }), document)).toEqual({ ok: false, reason: "subject_mismatch" });
    expect(emailStepContent(stepFor(2, { delayHours: 1 }), document)).toEqual({ ok: false, reason: "delay_mismatch" });
  });

  test("fails closed on another document, an archived or unreadable one, or an order outside 0–3", () => {
    expect(emailStepContent(stepFor(0, { documentId: "doc_2" }), document)).toEqual({ ok: false, reason: "document_mismatch" });
    expect(emailStepContent(stepFor(0), { ...document, kind: "brand_kit" })).toEqual({ ok: false, reason: "document_mismatch" });
    expect(emailStepContent(stepFor(0), { ...document, archivedAt: 5 })).toEqual({ ok: false, reason: "document_archived" });
    expect(emailStepContent(stepFor(0), { ...document, body: "{not json" })).toEqual({ ok: false, reason: "document_unreadable" });
    expect(emailStepContent(stepFor(0), { _id: "doc_1", kind: "email_sequence" })).toEqual({ ok: false, reason: "document_unreadable" });
    expect(emailStepContent(stepFor(0), { ...document, body: JSON.stringify({ ...hydrotrailEmailSequence, trigger: "other" }) }))
      .toEqual({ ok: false, reason: "document_unreadable" });
    for (const order of [4n, -1n, 1.5]) {
      expect(emailStepContent(stepFor(0, { order }), document)).toEqual({ ok: false, reason: "order_out_of_range" });
    }
  });
});

describe("parseEmailSequenceBody and stepsRewritable", () => {
  test("parses only a valid C-ART email sequence", () => {
    expect(parseEmailSequenceBody(JSON.stringify(hydrotrailEmailSequence))).toEqual(hydrotrailEmailSequence);
    expect(parseEmailSequenceBody(undefined)).toBeNull();
    expect(parseEmailSequenceBody("[]")).toBeNull();
  });

  test("a draft's steps are rewritable only as orders 0–3, each at most once", () => {
    expect(stepsRewritable([])).toBe(true);
    expect(stepsRewritable([{ order: 0n }, { order: 3n }])).toBe(true);
    expect(stepsRewritable([{ order: 0n }, { order: 0n }])).toBe(false);
    expect(stepsRewritable([{ order: 4n }])).toBe(false);
  });
});

describe("emailStepFromSequence: one parsed body, many steps", () => {
  test("reads each step's email when order, subject and delay agree", () => {
    for (const [order, { email }] of emailsInOrder(hydrotrailEmailSequence).entries()) {
      const step = { order: BigInt(order), subject: email.subject, delayHours: email.delayHours };
      expect(emailStepFromSequence(step, hydrotrailEmailSequence)).toMatchObject({ ok: true, email: { subject: email.subject } });
    }
  });

  test("refuses an order outside 0-3, a changed subject and a changed delay", () => {
    const [{ email }] = emailsInOrder(hydrotrailEmailSequence);
    const base = { order: 0n, subject: email.subject, delayHours: email.delayHours };
    expect(emailStepFromSequence({ ...base, order: 4n }, hydrotrailEmailSequence)).toEqual({ ok: false, reason: "order_out_of_range" });
    expect(emailStepFromSequence({ ...base, subject: "Other" }, hydrotrailEmailSequence)).toEqual({ ok: false, reason: "subject_mismatch" });
    expect(emailStepFromSequence({ ...base, delayHours: email.delayHours + 1 }, hydrotrailEmailSequence)).toEqual({ ok: false, reason: "delay_mismatch" });
  });
});

describe("findLinkLike: no links in any email field (review M1)", () => {
  test.each([
    "Read more at https://hydrotrail.shop",
    "ftp://files.example",
    "mailto:hello@hydrotrail.shop",
    "Call tel:+15551234",
    "Visit www.hydrotrail",
    "Write to john@hydrotrail.co",
    "Plans at hydrotrail.shop",
    "PLANS AT HYDROTRAIL.SHOP",
    "See maps.hydrotrail.co.uk today",
    "Our page hydrotrail.app.",
  ])("refuses %j", (text) => {
    expect(findLinkLike(text)).not.toBeNull();
  });

  test.each([
    "Pack light, e.g. one bottle.",
    "Refill on the trail, i.e. at a stream.",
    "Carry 2.5 litres on hot days.",
    "Built with Node.js and Next.js.",
    "Stay on the trail.Then turn left.",
    "Meet at 7 a.m. by the gate.",
    "Version v1.2 ships Friday.",
    "Hi {first name}, welcome aboard.",
  ])("allows %j", (text) => {
    expect(findLinkLike(text)).toBeNull();
  });
});

describe("the email sequence quality gate", () => {
  const copy = (): EmailSequence => JSON.parse(JSON.stringify(hydrotrailEmailSequence)) as EmailSequence;

  test("the HydroTrail fixture passes with no hard issue", () => {
    expect(checkEmailSequenceLinks(hydrotrailEmailSequence)).toEqual([]);
    const gated = gateCrewArtifact("email_sequence", hydrotrailEmailSequence, { ownIdea: false, businessName: "HydroTrail" });
    expect(gated.result.hard).toEqual([]);
    expect(gated.artifact).not.toBeNull();
  });

  test.each([
    ["name", (next: EmailSequence): void => void (next.name = "hydrotrail.shop welcome")],
    ["senderName", (next: EmailSequence): void => void (next.senderName = "John at hydrotrail.shop")],
    ["a subject", (next: EmailSequence): void => void (next.emails.value.subject = "Plans at hydrotrail.shop")],
    ["a preview", (next: EmailSequence): void => void (next.emails.welcome.preview = "See www.trail")],
    ["a goal", (next: EmailSequence): void => void (next.emails.follow_up.goal = "Send them to hydrotrail.app")],
    ["a CTA label", (next: EmailSequence): void => void (next.emails.offer.cta = { label: "Open hydrotrail.app", target: "site" })],
  ] as const)("a link in %s is a hard issue and nothing is stored", (_label, edit) => {
    const next = copy();
    edit(next);
    const gated = gateCrewArtifact("email_sequence", next, { ownIdea: false, businessName: "HydroTrail" });
    expect(issueCodes(gated.result.hard)).toContain("email_link_in_text");
    expect(gated.artifact).toBeNull();
  });
});
