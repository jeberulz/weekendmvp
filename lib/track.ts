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

/**
 * WP44 dashboard events (PRD section 10). Props are enums, counts and config
 * ids only: never an email, a name, a note or any other free text. Each event
 * forwards only its allowlisted keys, so a stray field cannot leak.
 */
export type DashboardState = "new" | "set_up" | "choosing" | "building" | "finished";
export type DashboardPlan = "free" | "builders_hub";
export type DashboardSurface = "sidebar" | "sheet" | "tag" | "billing";
export type DashboardFeature = "weekend_plan" | "collections" | "prompt_pack" | "compare";
export type DashboardSource = "home" | "ideas" | "saved" | "idea_page";
export type OfferKind = "starter_kit" | "promo";

export type DashboardEvent =
  | { name: "dashboard_viewed"; props: { state: DashboardState; plan: DashboardPlan } }
  | {
      name: "setup_completed";
      /** "none" when the member left that question unanswered. */
      props: { tools_count: number; hours_bucket: "8" | "12" | "20" | "more" | "none"; goal: string };
    }
  | { name: "setup_skipped"; props: Record<string, never> }
  | {
      name: "explore_state_changed";
      props: { flag: "saved"; value: boolean; source: DashboardSource };
    }
  | { name: "weekend_plan_started"; props: { source: DashboardSource } }
  | { name: "weekend_step_completed"; props: { step: "fri" | "sat" | "sun" | "mon" } }
  | { name: "prompt_copied"; props: { surface: "plan" | "home" | "idea_page" } }
  | { name: "upgrade_prompt_viewed"; props: { surface: DashboardSurface; feature: DashboardFeature } }
  | { name: "upgrade_clicked"; props: { surface: DashboardSurface; feature: DashboardFeature } }
  | { name: "offer_viewed"; props: { offer_id: string; kind: OfferKind } }
  | { name: "offer_clicked"; props: { offer_id: string; kind: OfferKind } }
  | { name: "offer_dismissed"; props: { offer_id: string; kind: OfferKind } };

export const DASHBOARD_EVENT_PROPS = {
  dashboard_viewed: ["state", "plan"],
  setup_completed: ["tools_count", "hours_bucket", "goal"],
  setup_skipped: [],
  explore_state_changed: ["flag", "value", "source"],
  weekend_plan_started: ["source"],
  weekend_step_completed: ["step"],
  prompt_copied: ["surface"],
  upgrade_prompt_viewed: ["surface", "feature"],
  upgrade_clicked: ["surface", "feature"],
  offer_viewed: ["offer_id", "kind"],
  offer_clicked: ["offer_id", "kind"],
  offer_dismissed: ["offer_id", "kind"],
} as const satisfies { [N in DashboardEvent["name"]]: readonly string[] };

export function trackDashboardEvent(event: DashboardEvent): void {
  const allowed: readonly string[] = DASHBOARD_EVENT_PROPS[event.name];
  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event.props)) {
    if (allowed.includes(key)) props[key] = value;
  }
  trackEvent(event.name, props);
}
