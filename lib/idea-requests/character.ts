/**
 * Idea 4 widget character ("Naira Marley", Weekend MVP mascot) — pure
 * motion/state helpers. No DOM, no React, so the rules are unit-testable
 * and the component stays a thin view over them.
 *
 * Honest limit, stated in the PR too: the character is a single static
 * image (or one image per expression state). CSS/JS motion can tilt, bob,
 * bounce and squash it, and an image swap can change its expression — but
 * a static image cannot smile, blink or talk on its own. That would need
 * extra expression images, a video loop, or a 3D model (later phase).
 */

export type ScrollDirection = "up" | "down" | "none";
export type CharacterExpression = "idle" | "happy" | "thinking" | "celebrating";

/** Minimum scroll delta (px) that counts as a direction change. */
export const SCROLL_DIRECTION_THRESHOLD_PX = 4;

/** How far the character leans when scrolling (degrees). */
export const SCROLL_TILT_DEGREES = 7;

/** How far the character's image may shift when "eyes follow the cursor". */
export const EYE_FOLLOW_MAX_PX = 5;

export function scrollDirection(prevY: number, nextY: number): ScrollDirection {
  const delta = nextY - prevY;
  if (delta <= -SCROLL_DIRECTION_THRESHOLD_PX) return "up";
  if (delta >= SCROLL_DIRECTION_THRESHOLD_PX) return "down";
  return "none";
}

/**
 * Lean into the scroll: look up (negative tilt) when scrolling up, down
 * when scrolling down, upright when still. `reducedMotion` forces upright.
 */
export function tiltForScroll(direction: ScrollDirection, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  if (direction === "up") return -SCROLL_TILT_DEGREES;
  if (direction === "down") return SCROLL_TILT_DEGREES;
  return 0;
}

/**
 * Subtle "eyes follow the cursor": shift the character image a few px
 * toward the pointer, clamped so it never slides out of its circle.
 * Returns `{ x, y }` in px; `{ 0, 0 }` with reduced motion.
 */
export function eyeFollowOffset(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  reducedMotion: boolean,
): { x: number; y: number } {
  if (reducedMotion || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
  const centreX = rect.left + rect.width / 2;
  const centreY = rect.top + rect.height / 2;
  const clamp = (value: number) => Math.max(-EYE_FOLLOW_MAX_PX, Math.min(EYE_FOLLOW_MAX_PX, value));
  return {
    x: clamp(((clientX - centreX) / (rect.width / 2)) * EYE_FOLLOW_MAX_PX),
    y: clamp(((clientY - centreY) / (rect.height / 2)) * EYE_FOLLOW_MAX_PX),
  };
}

export type CharacterEvent =
  | "hover"
  | "leave"
  | "click"
  | "vote-success"
  | "submit-start"
  | "submit-success"
  | "submit-error";

/**
 * Which expression the character shows after an event. Hover perks it up,
 * a successful vote/submit celebrates, submitting thinks, and leaving
 * returns to idle. Click celebrates — and the component opens the panel
 * on the same click; the expression is never the whole response.
 */
export function expressionForEvent(
  event: CharacterEvent,
  reducedMotion: boolean,
): CharacterExpression {
  if (reducedMotion) return "idle";
  switch (event) {
    case "hover":
      return "happy";
    case "click":
    case "vote-success":
    case "submit-success":
      return "celebrating";
    case "submit-start":
      return "thinking";
    case "leave":
    case "submit-error":
      return "idle";
  }
}

/**
 * Resolve the image for an expression from the widget's avatar slots.
 * Every slot falls back to the idle image, and the idle image falls back
 * to `undefined` (the placeholder circle). Callers never invent an image:
 * a slot with no file supplied simply shows the idle image.
 */
export function avatarForExpression(
  avatars: {
    idle?: string;
    happy?: string;
    thinking?: string;
    celebrating?: string;
  },
  expression: CharacterExpression,
): string | undefined {
  return avatars[expression] ?? avatars.idle;
}
