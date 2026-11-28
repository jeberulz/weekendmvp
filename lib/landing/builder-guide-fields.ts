import { fields } from "@keystatic/core";

const title = (label: string) => fields.text({ label, validation: { isRequired: true } });
const prose = (label: string) => fields.text({ label, multiline: true, validation: { isRequired: true } });

function rows<Schema extends Parameters<typeof fields.object>[0]>(
  label: string, schema: Schema, display: (value: { fields: { [Key in keyof Schema]: { value: string } } }) => string,
) {
  return fields.array(fields.object(schema), {
    label,
    validation: { length: { min: 1 } },
    // Each row's first field is a text label.
    itemLabel: (props) => display(props as Parameters<typeof display>[0]),
  });
}

const heading = {
  title: title("Section title"),
  summary: prose("Contents summary"),
};
const lessonFields = { ...heading, lede: prose("Opening paragraph"), honestCatch: prose("The honest catch") };
const stepFields = {
  name: title("Step name"),
  reasoning: prose("Reasoning"),
  mistakes: prose("Common mistakes"),
  example: prose("Worked example"),
};
const steps = {
  find: { label: "Find it", schema: fields.object(stepFields) },
  customer: { label: "Who pays?", schema: fields.object(stepFields) },
  pick: { label: "Pick it", schema: fields.object(stepFields) },
  prove: { label: "Prove it · locked pull quote", schema: fields.object(stepFields) },
  sell: { label: "Sell it", schema: fields.object(stepFields) },
};
export const builderSections = {
  method: { label: "The Method", schema: fields.object({
    ...lessonFields,
    steps: fields.blocks(steps, { label: "Steps", validation: { length: { min: 5, max: 5 } } }),
  }) },
  skills: { label: "The 6 Skills", schema: fields.object({
    ...lessonFields,
    skills: rows("Skills", { name: title("Skill name"), explanation: prose("Explanation"), readiness: prose("Readiness test") }, (x) => x.fields.name.value),
  }) },
  catch: { label: "The Catch", schema: fields.object({
    ...heading, lede: prose("Opening paragraph"),
    topics: rows("Topics", { name: title("Heading"), body: prose("Body") }, (x) => x.fields.name.value),
  }) },
  roles: { label: "Where You're Starting From", schema: fields.object({
    ...lessonFields,
    labels: fields.object({ headStart: title("Head start label"), gap: title("Gap label"), leanOn: title("Lean on label") }),
    roles: rows("Roles", { name: title("Role name"), headStart: prose("Head start"), gap: prose("Gap"), leanOn: prose("Lean on") }, (x) => x.fields.name.value),
  }) },
  plan: { label: "The 30-Day Plan", schema: fields.object({
    ...lessonFields,
    weeks: rows("Weeks", { summary: title("Weekly goal"), proof: prose("Shipped proof") }, (x) => x.fields.summary.value),
  }) },
  ideaBank: { label: "The Idea Bank", schema: fields.object({
    ...heading, introduction: prose("How to use the library · keep {ideaCount}"),
    workedValidation: prose("Worked validation"), honestCatch: prose("The honest catch"),
  }) },
  firstSale: { label: "The First Sale", schema: fields.object({
    ...lessonFields, offer: prose("The offer"), price: prose("The price example"), ask: prose("The ask"),
    scripts: prose("First-sale scripts"), noSaleAdvice: prose("Advice when nobody buys"),
  }) },
  selfCheck: { label: "Self-Check", schema: fields.object({
    ...lessonFields,
    items: fields.object(Object.fromEntries(
      Array.from({ length: 18 }, (_, index) => [`item${index + 1}`, title(`Item ${index + 1}`)]),
    ), { label: "Checklist items" }),
  }) },
  prompt: { label: "The Prompt", schema: fields.object({
    ...lessonFields, prompt: prose("Prompt text"), founderBody: prose("Founder note"),
  }) },
  faq: { label: "FAQ and closing panel", schema: fields.object({
    ...heading,
    questions: rows("Questions", { question: title("Question"), answer: prose("Answer") }, (x) => x.fields.question.value),
    followLabel: title("Follow link label"),
  }) },
};

const offerCopy = fields.object({
  title: title("Card title"),
  eyebrow: title("Card eyebrow"),
  promise: prose("Card copy · keep {price}"),
  linkLabel: title("Button label"),
});
export const builderGuideFields = {
  seoTitle: title("Search title"),
  seoDescription: fields.text({ label: "Search description", multiline: true, validation: { isRequired: true, length: { max: 300 } } }),
  hero: fields.object({
    eyebrow: title("Eyebrow"), lede: prose("Opening paragraph"), ctaLabel: title("Button label"),
    lockedNote: title("Note before subscribing"), subscribedNote: title("Note after subscribing"),
    metaLabel: title("Facts · accessible label"),
    meta: rows("Facts", { value: title("Value"), label: fields.text({ label: "Label" }) }, (x) => x.fields.value.value),
  }),
  contentsHeading: title("Contents heading"),
  opening: fields.object({
    ...heading, lede: prose("Opening paragraph"), validation: prose("Validation paragraph"),
    expertise: prose("Your expertise"), definition: prose("Definition"),
    honestCatch: prose("The honest catch"),
  }, { label: "Opening section · always public" }),
  gate: fields.object({
    heading: title("Heading"), body: prose("Body"), finePrint: prose("Fine print"),
  }),
  sections: fields.blocks(builderSections, {
    label: "After the email gate",
    description: "Reorder the ten sections. Each section must appear once.",
    validation: { length: { min: 10, max: 10 } },
  }),
  cards: fields.object({ mid: offerCopy, close: offerCopy }, { label: "Build-Along cards" }),
};
