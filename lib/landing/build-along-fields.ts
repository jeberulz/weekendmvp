import { fields } from "@keystatic/core";

const text = (label: string) => fields.text({ label, validation: { isRequired: true } });
const prose = (label: string) => fields.text({ label, multiline: true, validation: { isRequired: true } });
const title = text("Heading");
const accent = text("Heading emphasis");
const eyebrow = text("Eyebrow");
const body = prose("Description");
const items = (label: string) => fields.array(prose("Item"), { label, validation: { length: { min: 1 } } });
const card = fields.object({ title, body });
const question = text("Question");
const faqAnswer = fields.object({ question, answer: body });

export const buildAlongFields = {
  hero: fields.object({ eyebrow, title, accent, body }, { label: "Opening" }),
  included: fields.object({ title, accent, items: items("Included items") }, { label: "What's included" }),
  agenda: fields.object({
    eyebrow, title, accent, opening: card, sharpest: card, weekendCut: card, build: card,
    safety: card, firstUsers: card, questions: card, closing: prose("Closing"),
  }, { label: "Agenda · timing and order fixed" }),
  forNotFor: fields.object({
    forYou: fields.object({ title, items: items("Who it is for") }),
    notForYou: fields.object({ title, items: items("Who it is not for") }),
  }, { label: "Audience" }),
  deal: fields.object({
    eyebrow, fallback: prose("Outcome before a successful dry run"),
    dryRun: text("Outcome after a successful dry run"), dryRunAccent: text("Outcome emphasis"),
    requirement: text("Requirement badge"), laptop: card, idea: card,
    tools: fields.object({ title, configured: prose("Tools configured · keep {tools}"), unconfigured: prose("Tools pending") }),
    closing: prose("Closing"),
  }, { label: "The deal" }),
  host: fields.object({ eyebrow, body }, { label: "Host" }),
  proof: fields.object({ title }, { label: "Attendee section · shown only when quotes are configured" }),
  guarantee: fields.object({ eyebrow }, { label: "Refunds · policy and guarantees are code-owned" }),
  personalNote: fields.object({
    standard: prose("Standard postscript · keep {sessionStartWithAt}"),
    earlyBird: text("Early-bird preface · keep {priceLine}"),
  }, { label: "Personal note" }),
  faq: fields.object({
    title,
    items: fields.blocks({
      answer: { label: "Text answer", schema: faqAnswer },
      tools: { label: "Answer with configured tools", schema: faqAnswer },
      refund: { label: "Code-owned refund answer", schema: fields.object({ question }) },
      cancellation: { label: "Code-owned cancellation answer", schema: fields.object({ question }) },
      currency: { label: "Answer with live price", schema: faqAnswer },
    }, { label: "Questions", validation: { length: { min: 4 } } }),
  }, { label: "FAQ" }),
  ticket: fields.object({
    eyebrow, title, accent, earlyBirdNote: prose("Early-bird note · keep {earlyPrice} and {earlyCutoff}"),
  }, { label: "Ticket introduction" }),
  finalCta: fields.object({ title, accent }, { label: "Closing" }),
};
