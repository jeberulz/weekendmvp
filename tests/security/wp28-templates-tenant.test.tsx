import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { PreviewTemplateRenderer } from "../../components/preview/templates";
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
 * WP28-S3. The WP27 matrix re-run in the configuration WP28 introduces:
 * `showPreviewChrome={false}`, which is what a *public* audience sees.
 *
 * This is not duplication for its own sake. WP27's suite only ever rendered
 * the preview configuration, so nothing proved that removing the notice and
 * watermark leaves the escaping intact — and this is the first time template
 * output is served to strangers rather than to one capability holder.
 * Per template, as the owner's three-template ruling requires.
 */

const INJECTION_PAYLOADS = [
  "<script>window.__pwned = 1</script>",
  '"><script>alert(1)</script>',
  '<img src=x onerror="alert(1)">',
  "javascript:alert(1)",
  "<svg/onload=alert(1)>",
  "</main><script>alert(1)</script><main>",
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

function renderPublished(
  templateId: PreviewTemplate,
  siteInput: SiteInputPayload,
): string {
  return renderToStaticMarkup(
    <PreviewTemplateRenderer
      spec={{
        contractVersion: SITE_RENDER_SPEC_CONTRACT_VERSION,
        templateId,
        siteInput,
      }}
      showPreviewChrome={false}
    />,
  );
}

describe.each(PREVIEW_TEMPLATE_VALUES)("%s published", (templateId) => {
  test.each(INJECTION_PAYLOADS)("escapes %s", (payload) => {
    const html = renderPublished(templateId, payloadInput(payload));
    // Assert on raw markup only. A bare `not.toContain(" onerror=")` looks
    // stronger but is the known false-positive family WP27 recorded: the
    // escaped payload renders `&lt;img src=x onerror=&quot;…`, so the literal
    // text ` onerror=` is present and completely inert. What actually matters
    // is that no `<` from caller content ever opens a tag.
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<svg/onload");
    expect(html).not.toMatch(/<[a-z]+[^>]*\son(error|load|click)=/i);

    // The payload must survive as visible text — silently dropping it would
    // look identical to a test that never rendered it at all.
    if (payload.includes("<")) {
      expect(html).toContain("&lt;");
    } else {
      expect(html).toContain(payload);
    }
  });

  test("carries no preview chrome", () => {
    const html = renderPublished(templateId, payloadInput("benign"));
    // A customer's live page must not be stamped as a preview, and must not
    // claim it expires.
    expect(html).not.toContain("private preview");
    expect(html).not.toContain("pointer-events-none fixed inset-0");
    expect(html).not.toContain("PREVIEW");
  });

  test("still renders the site content without chrome", () => {
    const html = renderPublished(templateId, {
      ...payloadInput("x"),
      headline: "Verify any collectible",
    });
    expect(html).toContain("Verify any collectible");
  });

  test("builds no URL from caller-supplied content", () => {
    const html = renderPublished(templateId, payloadInput("javascript:alert(1)"));
    // WP27's rule holds on the public surface too: no href or src is ever
    // constructed from spec content.
    expect(html).not.toMatch(/href="javascript:/);
    expect(html).not.toMatch(/src="javascript:/);
    expect(html).not.toMatch(/href="data:/);
  });
});
