import { fields } from "@keystatic/core";

const text = (label: string) => fields.text({ label, validation: { isRequired: true } });
const prose = (label: string) => fields.text({ label, multiline: true, validation: { isRequired: true } });
const eyebrow = text("Eyebrow");
const title = text("Heading");
const accent = text("Heading emphasis");
const body = prose("Description");
const ending = text("Heading ending");
const move = fields.object({ title, accent, body });
const stack = fields.object({
  title, accent: fields.text({ label: "Optional emphasis" }), body, ticketLabel: text("Ticket label"),
});
const example = fields.object({ eyebrow, before: prose("Before"), after: prose("After") });
const leadAndBody = fields.object({ lead: text("Lead"), body });

export const dareFields = {
  seoTitle: text("Search title"),
  seoDescription: prose("Search description"),
  socialTitle: text("Social title"),
  socialDescription: prose("Social description"),
  hero: fields.object({
    eyebrow, tagline: text("Tagline"), intro: prose("Before the emphasis"), accent, ending, note: text("CTA note"),
  }, { label: "Opening · fixed position" }),
  countdownCard: fields.object({
    eyebrow, meta: text("Workshop summary"), footnote: text("Footnote"),
  }, { label: "Schedule · fixed position" }),
  sections: fields.blocks({
    deliverableTeaser: {
      label: "Deliverable", schema: fields.object({ eyebrow, title, body }),
    },
    stats: {
      label: "Statistics", schema: fields.object({
        eyebrow, years: text("Years label"), shipped: text("Products shipped label"),
        ideas: text("Ideas label"), framework: text("Framework label"),
      }),
    },
    problem: {
      label: "Problem", schema: fields.object({
        title, accent, intro: prose("Opening"), setup: text("Before the list"),
        traps: fields.array(leadAndBody, {
          label: "Traps", itemLabel: ({ fields: trap }) => trap.lead.value, validation: { length: { min: 1 } },
        }),
        pitch: prose("Closing emphasis"), ending: text("Closing sentence"),
      }),
    },
    tldr: {
      label: "Summary", schema: fields.object({
        title, accent,
        points: fields.array(leadAndBody, {
          label: "Summary points", itemLabel: ({ fields: point }) => point.lead.value, validation: { length: { min: 1 } },
        }),
      }),
    },
    moves: {
      label: "Three moves", schema: fields.object({ title, accent, discover: move, architect: move, runEarn: move }),
    },
    valueStack: {
      label: "What is included", schema: fields.object({
        eyebrow, title, accent, preamble: prose("Summary before total"),
        workshop: stack, canvas: stack, blueprint: stack, plan: stack, replay: stack, prompts: stack, invite: stack,
      }),
    },
    proof: {
      label: "Worked examples", schema: fields.object({
        title, accent,
        featured: fields.object({
          eyebrow, before: prose("Before"), after: prose("After opening"),
          emphasis: prose("After emphasis"), takeaway: prose("Takeaway"),
        }),
        saas: example, service: example,
      }),
    },
  }, {
    label: "Editorial sections · reorder",
    description: "Keep one of each section. Preserve the draft placeholders and the existing number tokens.",
    validation: { length: { min: 7, max: 7 } },
  }),
  ticket: fields.object({
    eyebrow, title, accent, ending, intro: prose("Ticket introduction"), introAccent: text("Introduction emphasis"),
    dateLabel: text("Date label"), startLabel: text("Start label"), lengthLabel: text("Duration label"),
    formatLabel: text("Format label"), note: prose("Ticket footnote"),
  }, { label: "Ticket · fixed position" }),
  timezones: fields.object({
    title, accent, intro: prose("Before the start time"), remainder: prose("After the start time"),
  }, { label: "Timezones · fixed position" }),
  teacher: fields.object({
    name: text("Display name"), role: text("Role"),
    paragraphs: fields.array(prose("Biography paragraph"), { label: "Biography", validation: { length: { min: 1 } } }),
    yearsChip: text("Experience chip"), shippedChip: text("Products shipped chip"), frameworkChip: text("Framework chip"),
  }, { label: "Teacher · fixed position" }),
  seatSection: fields.object({ eyebrow, title, accent, body }, { label: "Seat waitlist · fixed position" }),
};
