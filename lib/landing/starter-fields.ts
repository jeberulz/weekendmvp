import { fields } from "@keystatic/core";

const text = (label: string, multiline = false) => fields.text({ label, multiline, validation: { isRequired: true } });
const section = { eyebrow: text("Eyebrow"), title: text("Heading"), emphasis: text("Heading emphasis") };
const form = fields.object({
  submitLabel: text("Subscribe button"),
  finePrint: text("Fine print"),
}, { label: "Subscription form" });
const day = (number: number) => fields.object({
  title: text("Title"),
  text: text("Description", true),
}, { label: `Day ${number}` });

const question = text("Question");
const starterBlocks = {
  fiveDays: {
    label: "Five days",
    schema: fields.object({
      ...section, intro: text("Introduction", true),
      days: fields.object({
        one: day(1), two: day(2), three: day(3), four: day(4), five: day(5),
      }, { label: "Email sequence" }),
      followUp: text("After the emails", true),
      buildAlongLabel: text("Build-Along link label · keep {buildAlongPrice}"),
    }),
  },
  founderNote: {
    label: "Founder note",
    schema: fields.object({
      eyebrow: text("Eyebrow"), title: text("Heading"),
      paragraphs: fields.array(text("Paragraph", true), { label: "Paragraphs", validation: { length: { min: 1 } } }),
      signatureRole: text("Signature role"), aboutLabel: text("About link label"),
    }),
  },
  whoItIsFor: {
    label: "Who it is for",
    schema: fields.object({
      ...section,
      forTitle: text("Who it is for · heading"),
      forItems: fields.array(text("Item"), { label: "Who it is for · list", validation: { length: { min: 1 } } }),
      againstTitle: text("Who it is not for · heading"),
      againstItems: fields.array(text("Item"), { label: "Who it is not for · list", validation: { length: { min: 1 } } }),
    }),
  },
  faq: {
    label: "FAQ",
    schema: fields.object({
      ...section,
      questions: fields.blocks({
        plain: { label: "Question and answer", schema: fields.object({ question, answer: text("Answer", true) }) },
        nextSteps: {
          label: "Question with Build-Along and guide links",
          schema: fields.object({
            question,
            intro: text("Before the Build-Along link", true),
            buildAlongLabel: text("Build-Along link label · keep {buildAlongPrice}"),
            continuation: text("Before the Builder guide link", true),
            guideLabel: text("Builder guide link label"),
          }),
        },
      }, { label: "Questions", validation: { length: { min: 1 } } }),
    }),
  },
};

export const starterFields = {
  seoTitle: fields.text({ label: "Search title", validation: { isRequired: true, length: { max: 60 } } }),
  seoDescription: fields.text({ label: "Search description", multiline: true, validation: { isRequired: true, length: { max: 155 } } }),
  hero: fields.object({
    ...section, body: text("Introduction", true),
    bylineStart: text("Byline · before the live idea count"), bylineEnd: text("Byline · after the live idea count"),
    illustrationAlt: text("Illustration description"), captionLabel: text("Illustration label"), caption: text("Illustration caption"),
    form,
  }, { label: "Opening · fixed position" }),
  sections: fields.blocks(starterBlocks, {
    label: "Page sections",
    description: "Reorder the four sections. Keep exactly one of each.",
    validation: { length: { min: 4, max: 4 } },
  }),
  finalCapture: fields.object({
    title: text("Heading"), emphasis: text("Heading emphasis"), eyebrow: text("Eyebrow"),
    body: text("Closing paragraph", true), form,
  }, { label: "Final signup · fixed position" }),
};
