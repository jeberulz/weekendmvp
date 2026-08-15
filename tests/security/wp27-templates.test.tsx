import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { PreviewTemplateRenderer, TEMPLATES } from "../../components/preview/templates";
import {
  SITE_INPUT_CONTRACT_VERSION,
  type SiteInputPayload,
} from "../../convex/platform/engine/contracts";
import {
  PREVIEW_TEMPLATE_VALUES,
  SITE_RENDER_SPEC_CONTRACT_VERSION,
  type PreviewTemplate,
} from "../../convex/platform/preview/renderSpec";

/**
 * WP27-S3 security matrix.
 *
 * Every case below runs **per template**, not once across the set. That is
 * the accepted cost of the owner's three-template ruling (2026-08-06), which
 * was made against a recommendation of one precisely because it triples this
 * surface. Collapsing these into a single shared suite would quietly
 * un-accept that trade-off.
 */

/** Payloads that would execute or escape if any template emitted raw markup. */
const INJECTION_PAYLOADS = [
  '<script>window.__pwned = 1</script>',
  '"><script>alert(1)</script>',
  '<img src=x onerror="alert(1)">',
  'javascript:alert(1)',
  'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
  'vbscript:msgbox(1)',
  "<svg/onload=alert(1)>",
  "<script>alert(1)</script>",
  "</main><script>alert(1)</script><main>",
  "{{constructor.constructor('alert(1)')()}}",
];

function payloadInput(payload: string): SiteInputPayload {
  return {
    contractVersion: SITE_INPUT_CONTRACT_VERSION,
    headline: payload,
    subheadline: payload,
    problemStatement: payload,
    keyBenefits: [payload, payload],
    socialProof: [{ stat: payload, citations: [0] }],
    callToAction: { label: payload },
  };
}

function benignInput(): SiteInputPayload {
  return {
    contractVersion: SITE_INPUT_CONTRACT_VERSION,
    headline: "Ship fewer bugs, write zero tests by hand",
    subheadline: "Turn your product spec into regression tests.",
    problemStatement: "QA engineers spend 40% of their week on repetitive tests.",
    keyBenefits: ["Generates tests from plain-English specs", "Runs in CI"],
    socialProof: [{ stat: "$52B QA automation market by 2028", citations: [0] }],
    callToAction: { label: "Get early access" },
  };
}

function render(templateId: PreviewTemplate, siteInput: SiteInputPayload): string {
  return renderToStaticMarkup(
    <PreviewTemplateRenderer
      spec={{
        contractVersion: SITE_RENDER_SPEC_CONTRACT_VERSION,
        templateId,
        siteInput,
      }}
      showPreviewChrome
    />,
  );
}

test("the matrix below covers every declared template", () => {
  // Guards against a fourth template shipping without security coverage.
  expect(Object.keys(TEMPLATES).sort()).toEqual([...PREVIEW_TEMPLATE_VALUES].sort());
  expect(PREVIEW_TEMPLATE_VALUES).toHaveLength(3);
});

describe.each(PREVIEW_TEMPLATE_VALUES)("template: %s", (templateId) => {
  test("renders its benign content as visible text", () => {
    const html = render(templateId, benignInput());
    expect(html).toContain("Ship fewer bugs");
    expect(html).toContain("Get early access");
  });

  test("renders ink-on-paper rather than zinc-on-black", () => {
    const html = render(templateId, benignInput());
    expect(html).toContain("compiled-landing");
    expect(html).toContain("bg-[#fcfaf7]");
    expect(html).not.toContain("text-zinc-100");
    expect(html).not.toContain("text-zinc-300");
  });

  test.each(INJECTION_PAYLOADS)(
    "escapes injection payload rather than emitting markup: %s",
    (payload) => {
      const html = render(templateId, payloadInput(payload));

      // No executable or markup-bearing element may appear, however the
      // payload was encoded on the way in.
      expect(html).not.toMatch(/<script/i);
      expect(html).not.toMatch(/<img/i);
      expect(html).not.toMatch(/<svg/i);

      // Event handlers must be checked against *real tags only*. Asserting
      // on the raw string is a false positive: an escaped payload legitimately
      // contains the literal text `onerror=&quot;` as inert content, which a
      // naive /\son[a-z]+=/ would flag while the page is perfectly safe.
      const tags = html.match(/<[a-z][^>]*>/gi) ?? [];
      for (const tag of tags) {
        expect(tag).not.toMatch(/\son[a-z]+\s*=/i);
      }

      // The angle brackets that arrived must come back out escaped.
      if (payload.includes("<")) {
        expect(html).toContain("&lt;");
      }
    },
  );

  test("never builds an href or src from spec content", () => {
    // Stronger than allowlisting protocols: SiteInputPayload v1 carries no
    // URL field, so no template should construct a navigable attribute from
    // caller data at all. This asserts that structurally, so a future URL
    // field cannot quietly introduce one without failing here.
    const marker = "MARKER-a1b2c3";
    const html = render(templateId, payloadInput(marker));
    const attributes = html.match(/(?:href|src|action|formaction)\s*=\s*"[^"]*"/gi) ?? [];
    for (const attribute of attributes) {
      expect(attribute).not.toContain(marker);
    }
    // And no dangerous scheme appears anywhere in the output.
    expect(html).not.toMatch(/(?:href|src)\s*=\s*"\s*(?:javascript|data|vbscript):/i);
  });

  test("carries the preview watermark and notice unconditionally", () => {
    // The watermark is part of the template contract, not a caller-supplied
    // overlay, so it must be present with no prop passed to enable it.
    const html = render(templateId, benignInput());
    expect(html).toContain("Preview");
    expect(html).toContain("private preview");
  });

  test("exposes exactly one main landmark and starts at h1", () => {
    const html = render(templateId, benignInput());
    expect(html.match(/<main[\s>]/g) ?? []).toHaveLength(1);
    expect(html.match(/<h1[\s>]/g) ?? []).toHaveLength(1);
    // Heading order: the first heading in document order must be the h1.
    const firstHeading = html.match(/<h([1-6])[\s>]/);
    expect(firstHeading?.[1]).toBe("1");
  });

  test("its call to action is inert, never a link", () => {
    const html = render(templateId, benignInput());
    // A preview must not be able to navigate a visitor anywhere, and S4
    // guarantees no lead endpoint is reachable. An <a> or <form> here would
    // be the seam through which that could regress.
    expect(html).not.toMatch(/<form[\s>]/i);
    expect(html).toMatch(/<button[^>]*type="button"/);
  });
});

describe("template dispatch", () => {
  test("an unknown template id renders nothing rather than guessing", () => {
    const html = renderToStaticMarkup(
      <PreviewTemplateRenderer
        spec={{
          contractVersion: SITE_RENDER_SPEC_CONTRACT_VERSION,
          templateId: "does-not-exist" as PreviewTemplate,
          siteInput: benignInput(),
        }}
        showPreviewChrome
      />,
    );
    expect(html).toBe("");
  });

  test("unknown keys on the spec are ignored, never rendered", () => {
    // WP26-S1's parser returns the parsed object as-is, so unknown keys
    // survive validation. Templates read named fields only, which is what
    // makes that safe — this proves it rather than assuming it.
    const contaminated = {
      ...benignInput(),
      evil: "<script>alert(1)</script>",
      rogue: "SHOULD-NOT-RENDER",
    } as SiteInputPayload;
    for (const templateId of PREVIEW_TEMPLATE_VALUES) {
      const html = render(templateId, contaminated);
      expect(html).not.toContain("SHOULD-NOT-RENDER");
      expect(html).not.toMatch(/<script/i);
    }
  });
});

/**
 * WP27-S6. Pins the properties that make the watermark's contrast failure a
 * WCAG exemption rather than a defect.
 *
 * The live axe pass at the S6 gate reports one WP27-owned violation on every
 * template at every width: the decorative watermark, contrast 1.09. The owner
 * ruled it accepted under WCAG 2.1 SC 1.4.3, which exempts "text ... that is
 * pure decoration" — normatively, content "serving only an aesthetic purpose,
 * providing no information, and having no functionality".
 *
 * That ruling is only sound while all three of those remain true, and none of
 * them is enforced by the ruling itself. These tests are what stop the
 * exemption from silently outliving its own justification: if the watermark
 * ever gains information, focusability, or exposure to assistive technology,
 * it stops being decoration and the accepted contrast failure becomes a real
 * one. Deliberately not a scanner exclusion — the violation still gets
 * reported every run; this only records why it is allowed to stand.
 */
describe.each(PREVIEW_TEMPLATE_VALUES)(
  "%s watermark stays exempt decoration",
  (templateId) => {
    test("the decorative mark is hidden from assistive technology", () => {
      const html = render(templateId, benignInput());
      const watermark = html.match(/<div[^>]*aria-hidden="true"[^>]*>/);
      expect(watermark).not.toBeNull();
      expect(watermark![0]).toContain("pointer-events-none");
    });

    test("it carries no information the readable notice does not", () => {
      const html = render(templateId, benignInput());
      // The accessible announcement is `PreviewNotice`, which passes contrast.
      // If this ever fails, the watermark has become the only source of
      // something a user needs, and the decoration exemption no longer holds.
      expect(html).toContain("This is a private preview");
      expect(html).toContain("expires in 7 days");
    });

    test("it is not focusable and carries no functionality", () => {
      const html = render(templateId, benignInput());
      // Anchored on the watermark's own class, not on the first
      // `aria-hidden` in the document — that one is a decorative bullet
      // `<span>` inside the benefit list, and slicing from it swept in the
      // call-to-action button and failed for the wrong reason.
      const start = html.indexOf("pointer-events-none fixed inset-0");
      expect(start).toBeGreaterThan(-1);
      const mark = html.slice(start);
      for (const functional of ["<a ", "<button", "tabindex", "href=", "onclick"]) {
        expect(mark).not.toContain(functional);
      }
    });
  },
);
