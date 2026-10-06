import { describe, expect, test } from "vitest";

import { SITE, PERSON_ID, PERSON_PATH, breadcrumbSchema } from "../../lib/seo";

describe("breadcrumbSchema", () => {
  test("puts a name on every ListItem and nested item", () => {
    const schema = breadcrumbSchema([
      { label: "Home", href: "/" },
      { label: "Build With", href: "/build-with/" },
      { label: "Claude", href: "/build-with/claude" },
    ]);

    expect(schema["@type"]).toBe("BreadcrumbList");
    for (const entry of schema.itemListElement) {
      expect(entry.name).toEqual(expect.any(String));
      expect((entry.name as string).length).toBeGreaterThan(0);
      expect(entry.item).toMatchObject({
        name: entry.name,
        "@id": expect.stringMatching(/^https?:\/\//),
      });
    }
  });

  test("keeps name when the trailing crumb has no href", () => {
    const schema = breadcrumbSchema([
      { label: "Home", href: "/" },
      { label: "John Iseghohi" },
    ]);
    const last = schema.itemListElement[1];
    expect(last).toMatchObject({
      "@type": "ListItem",
      position: 2,
      name: "John Iseghohi",
    });
    expect(last).not.toHaveProperty("item");
  });
});

describe("ProfilePage / Person @id separation", () => {
  test("ProfilePage @id must not equal PERSON_ID", () => {
    // Mirrors app/(marketing)/john-iseghohi/page.tsx — Google rich-result
    // FAIL: "Dependent entity in mainEntity cannot reuse ID of main entity".
    const profilePageId = `${SITE}${PERSON_PATH}#profilepage`;
    expect(PERSON_ID).toBe(`${SITE}${PERSON_PATH}`);
    expect(profilePageId).not.toBe(PERSON_ID);
  });
});
