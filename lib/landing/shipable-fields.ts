import { fields } from "@keystatic/core";

const text = (label: string, multiline = false) => fields.text({ label, multiline, validation: { isRequired: true } });
const prose = (label: string) => text(label, true);
const title = text("Heading");
const accent = text("Emphasised heading");
const eyebrow = text("Eyebrow");
const tokens = "Use {price}, {stackValue}, {duration}, {builders}, or {ideas} where copy refers to those figures.";
const cta = text("Button label");
const paragraph = prose("Paragraph");
const paragraphs = (label: string) => fields.array(paragraph, { label, validation: { length: { min: 1 } } });

const move = fields.object({ emphasis: text("Emphasis"), ending: text("Heading ending"), body: prose("Description") });
const value = fields.object({
  title: text("Title"),
  emphasis: fields.text({ label: "Optional emphasis" }),
  body: prose("Description"),
  ticketLabel: text("Ticket item label"),
});
const proof = fields.object({
  result: text("Result"), context: prose("Context"), quote: prose("Quotation"), name: text("Attribution"),
});

const sections = {
  deliverableTeaser: {
    label: "Deliverable",
    schema: fields.object({ eyebrow, title, body: prose("Description") }),
  },
  stats: {
    label: "Statistics",
    schema: fields.object({
      eyebrow, shipped: text("MVPs shipped label"), builders: text("Builders label"),
      speed: text("Build time label"), ideas: text("Ideas label"),
    }),
  },
  problem: {
    label: "Problem",
    schema: fields.object({
      title, accent, intro: prose("Opening"), setup: prose("Before the list"),
      examples: fields.array(fields.object({ lead: text("Example heading"), body: prose("Example copy") }), {
        label: "Examples", itemLabel: ({ fields: item }) => item.lead.value, validation: { length: { min: 1 } },
      }),
      conclusion: prose("After the list"), pitchLead: text("Closing lead"), pitchAccent: prose("Closing emphasis"),
      pitchEnd: text("Closing sentence"),
    }),
  },
  tldr: {
    label: "Summary",
    schema: fields.object({
      title, accent,
      points: fields.array(fields.object({ lead: text("Lead"), body: prose("Description") }), {
        label: "Summary points", itemLabel: ({ fields: item }) => item.lead.value, validation: { length: { min: 1 } },
      }),
      bonusLead: text("Bonus lead"), bonusBody: prose("Bonus description before the value"),
    }),
  },
  moves: {
    label: "Three moves",
    schema: fields.object({ title, accent, sharpest: move, weekend: move, live: move }),
  },
  valueStack: {
    label: "What is included",
    schema: fields.object({
      eyebrow, title, accent, cta,
      workshop: value, sheet: value, replay: value, plan: value, builder: value, kit: value,
    }),
  },
  proof: {
    label: "Proof and testimonials",
    schema: fields.object({
      title, accent, ending: text("Heading ending"), featuredLabel: text("Featured result label"),
      featured: proof, second: proof, third: proof,
    }),
  },
};

export const shipableFields = {
  seoTitle: text("Search title"), seoDescription: prose("Search description"), seoKeywords: text("Keywords"),
  socialTitle: text("Social title"), socialDescription: prose("Social description"), twitterDescription: prose("Short social description"),
  hero: fields.object({
    intro: prose("Before the emphasis"), emphasis: text("Emphasis"), ending: text("After the emphasis"), cta,
  }, { label: "Opening · fixed position" }),
  nextDateCard: fields.object({
    eyebrow, intro: text("Workshop summary"), body: prose("Paused seat message"), cta,
  }, { label: "Date announcement · fixed position" }),
  sections: fields.blocks(sections, {
    label: "Editorial sections · reorder",
    description: "Keep one of each section. " + tokens,
    validation: { length: { min: 7, max: 7 } },
  }),
  ticket: fields.object({
    eyebrow, title, accent, ending: text("Heading ending"), intro: prose("Ticket description"),
    introAccent: text("Ticket emphasis"), dateLabel: text("Date label"), startLabel: text("Start label"),
    lengthLabel: text("Duration label"), formatLabel: text("Format label"), cta,
  }, { label: "Ticket · fixed position", description: tokens }),
  timezones: fields.object({ title, accent, intro: prose("Scheduling note") }, { label: "Timezones · fixed position" }),
  teacher: fields.object({
    name: text("Display name"), role: text("Role"), paragraphs: paragraphs("Biography"),
    buildersChip: text("Community chip"), ideasChip: text("Ideas chip"), siteChip: text("Site chip"),
  }, { label: "Teacher · fixed position" }),
  seat: fields.object({
    title, accent, body: prose("Free Starter Kit offer"), cta, finePrint: prose("Fine print"),
  }, { label: "Paused seats · fixed position" }),
  stickyBar: fields.object({ cta }, { label: "Sticky signup button" }),
  faq: fields.array(fields.object({ question: text("Question"), answer: prose("Answer") }), {
    label: "FAQ · structured data",
    itemLabel: ({ fields: entry }) => entry.question.value,
    validation: { length: { min: 1 } },
  }),
};
