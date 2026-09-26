import { describe, expect, test } from "vitest";

import { FAQS, START_HERE, WHAT_IS } from "../../components/home/content";
import {
  ORG_ID,
  PERSON_ID,
  SITE,
  buildGraph,
  faqPageSchema,
  itemListSchema,
  softwareApplicationSchema,
  webPageSchema,
} from "../../lib/seo";

describe("homepage structured data", () => {
  test("connects the WebPage node to the canonical site entities", () => {
    const page = webPageSchema({
      name: "Weekend MVP",
      description: WHAT_IS,
      url: `${SITE}/`,
      speakableCssSelectors: ["#home-hero-title", "#home-what-is"],
    });

    expect(page).toMatchObject({
      "@type": "WebPage",
      "@id": `${SITE}/`,
      url: `${SITE}/`,
      isPartOf: { "@id": `${SITE}/#website` },
      about: { "@id": ORG_ID },
      author: { "@id": PERSON_ID },
      speakable: {
        "@type": "SpeakableSpecification",
        cssSelector: ["#home-hero-title", "#home-what-is"],
      },
    });
  });

  test("keeps visible FAQ copy and FAQPage answers on one source of truth", () => {
    const schema = faqPageSchema(FAQS, { id: `${SITE}/#faq` });

    expect(schema["@id"]).toBe(`${SITE}/#faq`);
    expect(schema.mainEntity).toHaveLength(FAQS.length);
    expect(schema.mainEntity.map((entry) => entry.name)).toEqual(
      FAQS.map((entry) => entry.question),
    );
    expect(
      schema.mainEntity.map((entry) => entry.acceptedAnswer.text),
    ).toEqual(FAQS.map((entry) => entry.answer));
  });

  test("publishes canonical idea URLs and stable identifiers in the graph", () => {
    const ideas = [
      { slug: "first-idea", title: "First idea" },
      { slug: "second-idea", title: "Second idea" },
    ];
    const list = itemListSchema(ideas, {
      id: `${SITE}/#idea-index`,
      name: "Newest startup ideas on Weekend MVP",
    });
    const app = softwareApplicationSchema({
      id: `${SITE}/#starter-kit`,
      name: "Weekend MVP Starter Kit",
      description: "Build a three-screen MVP in a weekend.",
      applicationCategory: "DeveloperApplication",
      url: `${SITE}/starter-kit`,
      offers: { price: "0", priceCurrency: "USD" },
    });
    const graph = buildGraph(list, app);

    expect(list.itemListElement.map((item) => item.url)).toEqual([
      `${SITE}/ideas/first-idea`,
      `${SITE}/ideas/second-idea`,
    ]);
    expect(graph["@graph"].map((node) => node["@id"])).toEqual([
      `${SITE}/#idea-index`,
      `${SITE}/#starter-kit`,
    ]);
  });

  test("keeps Start here destinations unique and first-party", () => {
    expect(new Set(START_HERE.map((entry) => entry.href)).size).toBe(
      START_HERE.length,
    );
    expect(START_HERE.every((entry) => entry.href.startsWith("/"))).toBe(true);
  });
});
