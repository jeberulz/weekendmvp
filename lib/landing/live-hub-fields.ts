import { fields } from "@keystatic/core";

const text = (label: string) => fields.text({ label, validation: { isRequired: true } });
const prose = (label: string) => fields.text({ label, multiline: true, validation: { isRequired: true } });
const title = text("Heading");
const accent = text("Emphasised heading");
const eyebrow = text("Eyebrow");
const body = prose("Description");
const paragraphs = (label: string) => fields.array(prose("Paragraph"), { label, validation: { length: { min: 1 } } });
const group = fields.object({ title, items: paragraphs("Items") });
const replay = fields.object({ label: text("Session label"), title, body });
const question = text("Question");
const answer = prose("Answer");
const faqItem = fields.object({ question, answer });

export const liveHubFields = {
  seoTitle: text("Search and social title"),
  seoDescription: prose("Search and social description"),
  hero: fields.object({ eyebrow, title, accent, intro: body, paragraphs: paragraphs("Introduction paragraphs") }, {
    label: "Opening · fixed position",
  }),
  upcoming: fields.object({ eyebrow }, { label: "Upcoming sessions · fixed position" }),
  sections: fields.blocks({
    howTheyFit: {
      label: "How the sessions fit",
      schema: fields.object({
        eyebrow, title, accent, paragraphs: paragraphs("Explanation"),
        free: body, paid: body, weekend: fields.object({ title, body }),
      }),
    },
    replays: {
      label: "Replays",
      schema: fields.object({ title, free: replay, paid: replay, note: prose("Closing note") }),
    },
    forNotFor: {
      label: "Who it is for", schema: fields.object({ forYou: group, notForYou: group }),
    },
    host: {
      label: "Host", schema: fields.object({ body }),
    },
    pastSessions: {
      label: "Past sessions", schema: fields.object({ eyebrow, emptyMessage: text("Empty message") }),
    },
    freeRightNow: {
      label: "Free right now", schema: fields.object({ eyebrow, title, accent, body }),
    },
    faq: {
      label: "FAQ",
      schema: fields.object({
        title,
        items: fields.blocks({
          answer: { label: "Text answer", schema: faqItem },
          timezones: { label: "Answer with local times", schema: faqItem },
          nextSession: { label: "Answer with next session", schema: faqItem },
        }, {
          label: "Questions",
          description: "Keep one local times answer and one next session answer. Preserve the scheduling tokens in their copy.",
          validation: { length: { min: 2 } },
        }),
      }),
    },
  }, { label: "Editorial sections · reorder", validation: { length: { min: 7, max: 7 } } }),
  finalCta: fields.object({ title, accent }, { label: "Final signup · fixed position" }),
};
