import { fields } from "@keystatic/core";

const text = (label: string) => fields.text({ label, validation: { isRequired: true } });
const prose = (label: string) => fields.text({ label, multiline: true, validation: { isRequired: true } });
const title = text("Heading");
const accent = text("Heading emphasis");
const eyebrow = text("Eyebrow");
const intro = prose("Introduction");
const card = fields.object({ title, body: prose("Description") });
const planDay = fields.object({ day: text("Day label"), title, body: prose("Description") });
const linkLabel = text("Link label");
const signUp = text("Signup label");

export const homeFields = {
  seoTitle: text("Search title · keep {ideaCount}"),
  seoDescription: prose("Search description · keep {ideaCount}"),
  hero: fields.object({
    title, accent, intro, countLabel: text("After the idea count"),
    signUp, ownIdea: text("Own-idea prompt"), stamp: text("Stamp"),
  }, { label: "Opening" }),
  whatIs: fields.object({
    title, intro, navigation: text("Links heading"),
    startHere: fields.object({
      browse: text("Idea library"), dmarc: text("DMARC monitor"), prompts: text("Prompt regression"),
      kit: text("Starter Kit"), starter: text("5-to-9 Starter"), builder: text("5-to-9 Builder"),
      audience: text("Non-technical founders"),
    }, { label: "Start here · link destinations fixed" }),
  }, { label: "What is Weekend MVP?" }),
  ideaLibrary: fields.object({ eyebrow, title, accent }, { label: "Idea library" }),
  ideaOfTheWeek: fields.object({
    eyebrow, research: linkLabel, process: text("Process label"), figures: text("Figures label"),
    sources: text("After the source count"),
  }, { label: "Idea of the week" }),
  weekendTest: fields.object({
    eyebrow, title, accent,
    notes: fields.object({
      feature: card, screens: card, tools: card, buyer: card, prompts: card, estimate: card,
    }, { label: "Sticky notes · keep {hours} in the estimate" }),
    stamp: text("Stamp"), closing: prose("Closing · keep {hours}"),
  }, { label: "Weekend test" }),
  buildWithAi: fields.object({
    eyebrow, title, accent, intro,
    prompts: fields.object({
      eyebrow, first: text("Heading first line"), second: text("Heading second line"), accent,
      intro: prose("Before the idea name"), ending: text("After the idea name"), link: linkLabel,
    }),
  }, { label: "Build with AI" }),
  insideEveryIdea: fields.object({
    eyebrow, title, accent, intro,
    problem: text("Problem tile"), solution: text("Solution tile"), market: text("Market tile"),
    competition: text("Competition tile"), business: text("Business tile"), stack: text("Stack tile"),
    prompts: text("Prompts tile"), sources: text("Sources tile"), sourcesNote: text("Sources note"),
    linkEyebrow: text("Link eyebrow"), link: linkLabel,
  }, { label: "Inside every idea" }),
  yourWeekend: fields.object({
    eyebrow, title, accent, intro, timeframe: text("Timeframe"), signUp,
    plan: fields.object({ friday: planDay, saturday: planDay, sunday: planDay, monday: planDay }, { label: "Plan · hours fixed" }),
    closing: prose("Strip message"), closingCta: text("Strip signup label"),
  }, { label: "Your weekend" }),
  starterKit: fields.object({
    eyebrow, title, accent, ticketLine: text("Ticket title first line"), ticketAccent: text("Ticket title emphasis"),
    ticketMeta: fields.array(fields.object({ label: text("Label"), value: text("Value") }), {
      label: "Ticket details", itemLabel: ({ fields }) => fields.label.value, validation: { length: { min: 1, max: 5 } },
    }),
    stub: text("Stub label"), signUp, finePrint: text("Fine print"),
    contents: fields.object({
      demo: text("Demo test"), template: text("Template"), scorecard: text("Scorecard"),
      plan: text("Weekend plan"), checklist: text("Checklist"), prompts: text("Prompts"),
    }),
  }, { label: "Starter Kit" }),
  founderNote: fields.object({
    title, letter: fields.array(prose("Paragraph"), { label: "Letter", validation: { length: { min: 1 } } }),
    biography: text("Author line"), link: linkLabel,
  }, { label: "Founder note" }),
  finalCall: fields.object({
    title, accent, signUp, ownIdea: text("Own-idea prompt"),
    faqs: fields.array(fields.object({ question: text("Question"), answer: prose("Answer") }), {
      label: "Questions and answers", itemLabel: ({ fields }) => fields.question.value, validation: { length: { min: 1 } },
    }),
  }, { label: "Closing and FAQs" }),
};
