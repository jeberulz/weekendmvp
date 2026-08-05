/**
 * Analytics event helper, ported from the legacy `trackEvent()` in
 * scripts.js (lines 357-404). Sends to Google Analytics (gtag) and mirrors
 * to Meta Pixel, mapping Weekend MVP custom events onto Pixel standard
 * events exactly like the legacy map.
 *
 * Consent gating: `window.gtag` only exists after <AnalyticsScripts /> has
 * mounted, which only happens when consent === true — so the
 * "no-op unless window.gtag exists" guard doubles as the consent check.
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

/** Legacy custom event → Meta Pixel standard event map (scripts.js:369). */
const META_PIXEL_EVENT_MAP: Record<string, string> = {
  signup_form_submitted: "Lead",
  signup_form_success: "CompleteRegistration",
  cta_button_clicked: "ViewContent",
  modal_opened: "ViewContent",
  section_viewed: "ViewContent",
};

export function trackEvent(
  name: string,
  props: Record<string, unknown> = {},
): void {
  // SSR / pre-consent / GA-not-yet-loaded: silently no-op.
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }

  // Google Analytics custom event.
  window.gtag("event", name, props);

  // Meta Pixel mirror.
  if (typeof window.fbq === "function") {
    const metaEventName = META_PIXEL_EVENT_MAP[name];
    if (metaEventName) {
      // ViewContent events carry a content_name; derive it from the CTA
      // button text when the caller didn't pass one explicitly.
      const metaProps =
        metaEventName === "ViewContent" &&
        props.content_name === undefined &&
        typeof props.button_text === "string"
          ? { ...props, content_name: props.button_text }
          : props;
      window.fbq("track", metaEventName, metaProps);
    } else {
      window.fbq("trackCustom", name, props);
    }
  }
}

export type ValidationEventName =
  | "checkout_started"
  | "idea_prompt_copied"
  | "newsletter_subscribed"
  | "purchase_completed"
  | "starter_kit_clicked";

/**
 * Validation-funnel events share a stable page context so the weekly report
 * can group behavior without requiring GA4 custom dimensions.
 */
export function trackValidationEvent(
  name: ValidationEventName,
  props: Record<string, unknown> = {},
): void {
  if (typeof window === "undefined") return;

  const sourcePath = window.location.pathname;
  const segments = sourcePath.split("/").filter(Boolean);
  const inferredContext: Record<string, string> = { source_path: sourcePath };

  if (segments[0] === "ideas" && segments[1]) {
    inferredContext.idea_slug = segments[1];
  } else if (
    segments[1] &&
    ["build-with", "ideas-for", "solve"].includes(segments[0] ?? "")
  ) {
    inferredContext.hub_slug = segments[1];
  }

  trackEvent(name, { ...inferredContext, ...props });
}

/**
 * Convenience helper for section-visibility analytics
 * (legacy `section_viewed` IntersectionObserver events).
 */
export function trackPageSection(section: string): void {
  trackEvent("section_viewed", {
    section_id: section,
    section_name: section,
  });
}
