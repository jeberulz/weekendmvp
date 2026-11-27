import { fields } from "@keystatic/core";

const text = (label: string) => fields.text({ label, validation: { isRequired: true } });
const prose = (label: string) => fields.text({ label, multiline: true, validation: { isRequired: true } });
const title = text("Heading");
const body = prose("Description");
const paragraphs = (label: string) => fields.array(prose("Paragraph"), { label, validation: { length: { min: 1 } } });
const card = fields.object({ title, body });
const agendaItem = fields.object({ title, body });
const milestone = fields.object({ title, body, mark: text("Badge") });
const question = text("Question");

export const freeWebinarFields = {
  hero: fields.object({
    open: fields.object({
      intro: text("Before the product name"), product: prose("After the product name"), hook: prose("Quotation"),
      body, registrationNote: prose("Registration note"),
    }, { label: "Registration open" }),
    live: fields.object({ title, accent: text("Heading emphasis"), body }, { label: "Live" }),
    replay: fields.object({ title, accent: text("Heading emphasis"), body }, { label: "Registrant replay" }),
    ended: fields.object({
      title, accent: text("Heading emphasis"), replayReady: text("Public replay available"),
      replayPending: text("Public replay pending"), ending: text("Closing line"),
    }, { label: "Ended" }),
  }, { label: "Hero by phase" }),
  whatItDoes: fields.object({
    title, intro: paragraphs("Introduction"), outputs: fields.array(card, {
      label: "Product outputs", itemLabel: ({ fields }) => fields.title.value, validation: { length: { min: 1 } },
    }),
    rulesIntro: prose("Before the thresholds"), rulesEnding: prose("After the thresholds"), ideaLink: text("Idea link label"),
  }, { label: "What HydroTrail does" }),
  screens: fields.object({
    title, intro: prose("Introduction"), closing: prose("Closing"),
    landing: card, setup: card, hike: card, recap: card,
  }, { label: "Screens · sketch and order fixed" }),
  agenda: fields.object({
    title, intro: text("Schedule introduction"),
    idea: agendaItem, test: agendaItem, prompts: agendaItem, firstScreen: milestone, remainingScreens: agendaItem,
    deploy: milestone, questions: agendaItem, close: fields.object({ title }),
  }, { label: "Agenda · times and order fixed" }),
  promise: fields.object({
    title,
    items: fields.array(fields.object({ term: text("Label"), body }), {
      label: "Promises", itemLabel: ({ fields }) => fields.term.value, validation: { length: { min: 1 } },
    }),
    closing: prose("Closing line"),
  }, { label: "What I promise" }),
  weekendTest: fields.object({
    title, intro: prose("Introduction"), checks: fields.array(card, {
      label: "Checks", itemLabel: ({ fields }) => fields.title.value, validation: { length: { min: 1 } },
    }),
  }, { label: "Weekend test" }),
  leaveWith: fields.object({
    title, outcomes: paragraphs("What you leave with"), audienceTitle: text("Audience heading"),
    audience: paragraphs("Who it is for"), notFor: prose("Who it is not for"),
  }, { label: "What you leave with and who it is for" }),
  host: fields.object({ title, intro: prose("Introduction"), body }, { label: "Host" }),
  proofQuotes: fields.object({ title }, { label: "Attendee section · shown only when quotes are configured" }),
  finalCta: fields.object({ title, note: prose("Registration note") }, { label: "Final signup" }),
  faq: fields.object({
    title,
    items: fields.blocks({
      answer: { label: "Text answer", schema: fields.object({ question, answer: body }) },
      tools: { label: "Answer with configured tools", schema: fields.object({ question, answer: body }) },
      support: { label: "Answer with email link", schema: fields.object({ question, answer: body }) },
    }, { label: "Questions", validation: { length: { min: 2 } } }),
  }, { label: "FAQ" }),
};
