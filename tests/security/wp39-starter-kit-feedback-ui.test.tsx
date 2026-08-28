import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { StarterKitFeedback } from "../../app/(marketing)/starter-kit/StarterKitFeedback";

describe("Starter Kit feedback UI", () => {
  test("renders a semantic, anonymous-by-default feedback form", () => {
    const html = renderToStaticMarkup(<StarterKitFeedback />);
    expect(html).toContain('<section id="feedback"');
    expect(html).toContain("<form");
    expect(html.match(/<fieldset>/g)).toHaveLength(2);
    expect(html).toContain('name="progress"');
    expect(html).toContain('name="helpfulness"');
    expect(html).toContain('type="email"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-atomic="true"');
    expect(html).toContain('id="feedback-comments"');
    expect(html).toContain('maxLength="1000"');
    expect(html).toContain('id="feedback-website"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('class="hidden" aria-hidden="true"');
    expect(html).toContain("Anonymous by default");
  });

  test("does not render an email value, respondent ID, or IP address", () => {
    const html = renderToStaticMarkup(<StarterKitFeedback />);
    expect(html).not.toMatch(/value="[^\"]+@[^\"]+"/);
    expect(html).not.toContain("respondentId");
    expect(html).not.toContain("clientKey");
    expect(html).not.toContain("ip:");
  });
});
