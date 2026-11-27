import { fields } from "@keystatic/core";

const text = (label: string, multiline = false) => fields.text({ label, multiline, validation: { isRequired: true } });
const list = (label: string, item = "Item") => fields.array(text(item), {
  label,
  itemLabel: ({ value }) => value,
  validation: { length: { min: 1 } },
});
const heading = text("Heading");
const intro = text("Introduction", true);
const navLabel = text("Contents label");
const prompt = text("Prompt body · copied verbatim", true);
const screen = fields.object({
  title: text("Screen name"),
  sub: text("Description"),
});

export const starterKitFields = {
  seoTitle: text("Search title"),
  seoDescription: text("Search description", true),
  socialDescription: text("Social description", true),
  hero: fields.object({
    heading, navLabel,
    intro: text("Before highlighted phrases"), demo: text("First highlight"),
    share: text("Second highlight"), collect: text("Third highlight"),
    outcomeTail: text("After highlights"),
    relatedLead: text("Before Starter link"), starterLabel: text("Starter link label"),
    relatedJoin: text("Between links"), builderLabel: text("Builder link label"),
    checklistHeading: text("Checklist heading"), deliverables: list("Sunday checklist"),
  }, { label: "Opening · fixed position" }),
  rules: fields.object({
    heading, navLabel, includeHeading: text("Must include · heading"), excludeHeading: text("Exclusions heading"),
    include: fields.array(fields.object({ strong: text("Lead in bold"), rest: text("Explanation") }), {
      label: "Must include", itemLabel: ({ fields: item }) => item.strong.value,
      validation: { length: { min: 1 } },
    }),
    exclude: list("Must exclude"),
    screensHeading: text("Three screens · heading"),
    screens: fields.object({ landing: screen, input: screen, output: screen }, { label: "Screens in build order" }),
  }, { label: "Rules · fixed position" }),
  scorecard: fields.object({
    heading, intro, navLabel, questions: list("Scorecard questions", "Question"), note: text("Scorecard note", true),
  }, { label: "Step 1 · Scorecard" }),
  spec: fields.object({
    heading, intro, navLabel,
    nameLabel: text("Name label"), customerLabel: text("Customer label"), promiseLabel: text("Promise label"),
    metricLabel: text("Success metric label"), metrics: list("Example metrics"),
    promptHeading: text("Spec prompt heading"), prompt,
    advancedHeading: text("Advanced prompt heading"), advancedPrompt: prompt,
  }, { label: "Step 2 · Specification" }),
  plan: fields.object({
    heading, navLabel,
    fridayHeading: text("Friday heading"), fridayTasks: list("Friday tasks"),
    saturdayHeading: text("Saturday heading"),
    saturdayTasks: fields.array(fields.object({ label: text("Time block"), body: text("Task", true) }), {
      label: "Saturday tasks", itemLabel: ({ fields: item }) => item.label.value,
      validation: { length: { min: 1 } },
    }),
    sundayHeading: text("Sunday heading"), sundayTasks: list("Sunday tasks"),
  }, { label: "Step 3 · Weekend plan" }),
  resources: fields.blocks({
    ideas: {
      label: "MVP ideas",
      schema: fields.object({
        heading: text("Heading · keep {count}"), navLabel: text("Contents label · keep {count}"),
        ideas: fields.array(fields.object({ title: text("Idea title"), description: text("Description", true) }), {
          label: "MVP ideas", itemLabel: ({ fields: item }) => item.title.value,
          validation: { length: { min: 1 } },
        }),
      }),
    },
    prompts: {
      label: "Build prompts",
      schema: fields.object({
        heading: text("Heading · keep {count}"), navLabel: text("Contents label · keep {count}"), intro,
        prompts: fields.array(fields.object({ title: text("Prompt title"), text: prompt }), {
          label: "Build prompts", itemLabel: ({ fields: item }) => item.title.value,
          validation: { length: { min: 1 } },
        }),
      }),
    },
    templates: {
      label: "Templates and scripts",
      schema: fields.object({
        heading, navLabel, wireframeHeading: text("Wireframe heading"), waitlistLabel: text("Wireframe button label"),
        outreachHeading: text("Outreach heading"), outreachLabel: text("Outreach script label"), outreachScript: text("Outreach script", true),
      }),
    },
  }, {
    label: "Resources · reorder",
    description: "Keep one of each resource. Ideas and prompts are numbered in their displayed order.",
    validation: { length: { min: 3, max: 3 } },
  }),
  finalCta: fields.object({
    heading, body: text("Body", true), bookLabel: text("Booking button"), signupLabel: text("Signup button"),
  }, { label: "Closing actions · fixed position" }),
};
