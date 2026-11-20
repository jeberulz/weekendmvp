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
export type DashboardFeature = "weekend_plan" | "collections" | "prompt_pack" | "compare" | "live_builds";
export type DashboardSource = "home" | "ideas" | "saved" | "idea_page";
export type OfferKind = "starter_kit" | "promo" | "founding_lifetime";
/** WP64-S6. How the member chose to pay. */
export type MembershipTermProp = "monthly" | "annual" | "lifetime";
export type FoundingTranche = "lifetime_t1" | "lifetime_t2";

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
  | {
      name: "upgrade_clicked";
      /** `term` when the click picked one (WP64-S6). The sidebar link picks none. */
      props: { surface: DashboardSurface; feature: DashboardFeature; term?: MembershipTermProp };
    }
  | { name: "offer_viewed"; props: { offer_id: string; kind: OfferKind } }
  | { name: "offer_clicked"; props: { offer_id: string; kind: OfferKind } }
  | { name: "offer_dismissed"; props: { offer_id: string; kind: OfferKind } }
  // WP64-S6. Started fires from the browser before the redirect to Stripe.
  // Completed and seat taken fire once per checkout, only after
  // `entitlements.mine` confirms. Revenue reporting comes from Stripe, not GA.
  | { name: "checkout_started"; props: { surface: DashboardSurface; term: MembershipTermProp } }
  | { name: "checkout_completed"; props: { term: MembershipTermProp } }
  | { name: "founding_seat_taken"; props: { tranche: FoundingTranche } }
  // WP64-S8. A Builder's Hub member followed a join or replay link. Never the link itself.
  | { name: "live_build_opened"; props: { action: "join" | "replay" } };

export const DASHBOARD_EVENT_PROPS = {
  dashboard_viewed: ["state", "plan"],
  setup_completed: ["tools_count", "hours_bucket", "goal"],
  setup_skipped: [],
  explore_state_changed: ["flag", "value", "source"],
  weekend_plan_started: ["source"],
  weekend_step_completed: ["step"],
  prompt_copied: ["surface"],
  upgrade_prompt_viewed: ["surface", "feature"],
  upgrade_clicked: ["surface", "feature", "term"],
  offer_viewed: ["offer_id", "kind"],
  offer_clicked: ["offer_id", "kind"],
  offer_dismissed: ["offer_id", "kind"],
  checkout_started: ["surface", "term"],
  checkout_completed: ["term"],
  founding_seat_taken: ["tranche"],
  live_build_opened: ["action"],
} as const satisfies { [N in DashboardEvent["name"]]: readonly string[] };

export function trackDashboardEvent(event: DashboardEvent): void {
  const allowed: readonly string[] = DASHBOARD_EVENT_PROPS[event.name];
  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event.props)) {
    if (allowed.includes(key) && value !== undefined) props[key] = value;
  }
  trackEvent(event.name, props);
}

/**
 * WP95 funnel events for the founder journey (wizard, launch, review, chat).
 * Props are plain tokens only: a wizard step name, an artifact kind, a source
 * enum, a day bucket. The allowlist drops any other key, and `isToken` drops
 * any value that is not a short lowercase token, so free text, an email, a
 * business name or idea content cannot be forwarded even by mistake.
 *
 * Consent: with no `window.gtag` nothing is sent, and the once-only helpers
 * then remember nothing, so a visit before consent does not use up the shot.
 */
export type WorkspaceEvent =
  | { name: "wizard_step_finished"; props: { step: string } }
  | { name: "business_created"; props: { source: "library" | "own_idea" } }
  | { name: "launch_piece_waiting"; props: { piece: string } }
  | { name: "review_approved"; props: { piece: string } }
  | { name: "review_changes_asked"; props: { piece: string } }
  | { name: "first_wren_message"; props: Record<string, never> }
  | { name: "workspace_return"; props: { days_away: "1" | "2_6" | "7_plus" } };

export const WORKSPACE_EVENT_PROPS = {
  wizard_step_finished: ["step"],
  business_created: ["source"],
  launch_piece_waiting: ["piece"],
  review_approved: ["piece"],
  review_changes_asked: ["piece"],
  first_wren_message: [],
  workspace_return: ["days_away"],
} as const satisfies { [N in WorkspaceEvent["name"]]: readonly string[] };

const TOKEN = /^[a-z0-9_]{1,32}$/;

function isToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN.test(value);
}

/** True once analytics has loaded, which only happens after consent. */
export function analyticsReady(): boolean {
  return typeof window !== "undefined" && typeof window.gtag === "function";
}

/** Sends one workspace event. Returns whether analytics received it. */
export function trackWorkspaceEvent(event: WorkspaceEvent): boolean {
  if (!analyticsReady()) return false;
  const allowed: readonly string[] = WORKSPACE_EVENT_PROPS[event.name];
  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event.props)) {
    if (allowed.includes(key) && isToken(value)) props[key] = value;
  }
  trackEvent(event.name, props);
  return true;
}

const ONCE_PREFIX = "wmvp:t1:";

function readStore(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStore(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the event may repeat on a later visit, which is harmless.
  }
}

/**
 * Sends `event` once per browser for `scope` (a business id, say). Analytics
 * must have received it before it counts as sent.
 */
export function trackWorkspaceEventOnce(scope: string, event: WorkspaceEvent): boolean {
  if (!analyticsReady()) return false;
  const key = `${ONCE_PREFIX}${event.name}:${event.name === "launch_piece_waiting" ? `${scope}:${String(event.props.piece)}` : scope}`;
  if (readStore(key) !== null) return false;
  if (!trackWorkspaceEvent(event)) return false;
  writeStore(key, "1");
  return true;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The UTC day number of a time, for comparing visit days without time zones. */
function utcDayNumber(ms: number): number {
  return Math.floor(ms / DAY_MS);
}

/** How far back the last visit was, in the buckets the event reports. */
export function daysAwayBucket(days: number): "1" | "2_6" | "7_plus" {
  if (days <= 1) return "1";
  return days <= 6 ? "2_6" : "7_plus";
}

/**
 * "Coming back on a later day": the first workspace open on a UTC day after the
 * last recorded one sends `workspace_return` once. The first ever visit only
 * records the day. Nothing is stored before analytics is ready.
 */
export function trackWorkspaceReturn(nowMs: number = Date.now()): boolean {
  if (!analyticsReady()) return false;
  const key = `${ONCE_PREFIX}last_day`;
  const today = utcDayNumber(nowMs);
  const stored = readStore(key);
  const last = stored === null ? Number.NaN : Number(stored);
  if (!Number.isSafeInteger(last)) {
    writeStore(key, String(today));
    return false;
  }
  if (today <= last) return false;
  const sent = trackWorkspaceEvent({ name: "workspace_return", props: { days_away: daysAwayBucket(today - last) } });
  if (sent) writeStore(key, String(today));
  return sent;
}
