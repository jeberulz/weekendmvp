/// <reference types="vite/client" />

import { describe, expect, test } from "vitest";
import buildPageSource from "../../app/build/[slug]/page.tsx?raw";
import mintSource from "../../components/preview/MintPreviewRedirect.tsx?raw";
import conversionSource from "../../components/preview/PreviewConversion.tsx?raw";
import previewPageSource from "../../app/preview/[token]/page.tsx?raw";

describe("preview mint is not a CMS", () => {
  test("build mints and redirects instead of rendering a form", () => {
    expect(buildPageSource).toContain("MintPreviewRedirect");
    expect(buildPageSource).not.toContain("BuildPreviewForm");
    expect(buildPageSource).not.toContain("Adjust the wording");
    expect(mintSource).toContain('templateId: FALLBACK_TEMPLATE');
    expect(mintSource).toContain('router.replace(`/preview/${body.token}`)');
    expect(mintSource).not.toContain("editorial: \"Editorial\"");
    expect(mintSource).not.toContain("keyBenefits");
  });

  test("the compiled preview keeps Keep this site and no lead form", () => {
    expect(previewPageSource).toContain("PreviewConversion");
    expect(previewPageSource).not.toContain("PreviewClaimBar");
    expect(previewPageSource).not.toContain("BuildPreviewForm");
    expect(conversionSource).toContain("Keep this site");
    expect(conversionSource).toContain("Your shop / brand");
    expect(conversionSource).toContain("claimPreview");
    expect(conversionSource).not.toContain("<form");
    expect(conversionSource).not.toContain("fetch(");
  });
});
