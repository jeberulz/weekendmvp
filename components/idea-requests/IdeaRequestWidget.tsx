"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { Lightbulb, X } from "lucide-react";
import { IdeaRequestPanel, type IdeaRequestMoodEvent } from "./IdeaRequestPanel";
import {
  avatarForExpression,
  expressionForEvent,
  eyeFollowOffset,
  scrollDirection,
  tiltForScroll,
  type CharacterExpression,
  type ScrollDirection,
} from "@/lib/idea-requests/character";
import { cn } from "@/lib/utils";

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black";

/**
 * Avatar image slots for the widget character ("Naira Marley", Weekend MVP
 * mascot). Every slot is optional and falls back to the idle image; with no
 * image supplied at all, the button is a plain placeholder circle.
 *
 * The chosen Option 1 image (Pixar-style Naira Marley, teal polo, arms
 * open) is NOT bundled here yet — its file has not been supplied to this
 * build. Pass it as `avatarSrc` (idle) when the file lands, and pass extra
 * expression images as `avatars` when they exist. Do not invent mascot
 * images: a slot with no file simply shows the idle image.
 */
export type WidgetAvatarSlots = {
  idle?: string;
  happy?: string;
  thinking?: string;
  celebrating?: string;
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Idea 4 — floating "Request an idea" widget. Bottom-right on the
 * marketing landing page (anonymous visitors) and inside the signed-in
 * workspace (mounted in `WorkspaceShell`, outside the Wren panel), sharing
 * the same Convex backend as `/ideas/requests`.
 *
 * The button is the character: it leans with scroll direction, perks up
 * on hover (eyes follow the cursor a few px), and squash-and-stretches on
 * click — then opens the panel. All motion is CSS/JS transforms of the
 * image, short and performant, and disabled with
 * `prefers-reduced-motion`. A static image cannot smile on its own: see
 * `avatarForExpression` — expression changes are image swaps, and only
 * work once expression images are supplied.
 *
 * Access: the button carries `aria-expanded`/`aria-controls`; the panel is
 * a `role="dialog"` with a focus trap, Escape closes it and returns focus
 * to the character button. The widget never covers the main CTA: it is a
 * 56px circle in the corner, and on workspace mobile it sits above the
 * bottom tab bar (pass a `className` for that offset).
 */
export function IdeaRequestWidget({
  avatarSrc,
  avatars = {},
  className,
  characterName = "Naira Marley",
}: {
  /** Main character image (idle expression). Swappable; placeholder when omitted. */
  avatarSrc?: string;
  /** Extra expression images; each falls back to `avatarSrc`. */
  avatars?: WidgetAvatarSlots;
  /** Positioning override for the fixed wrapper (default: bottom-right). */
  className?: string;
  characterName?: string;
} = {}) {
  const [open, setOpen] = useState(false);
  const [expression, setExpression] = useState<CharacterExpression>("idle");
  const [scrollDir, setScrollDir] = useState<ScrollDirection>("none");
  const [eye, setEye] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const [squashed, setSquashed] = useState(false);
  const [bob, setBob] = useState(0);
  const [reducedMotion] = useState(() => prefersReducedMotion());

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastScrollY = useRef(0);
  const scrollResetTimer = useRef<number | null>(null);
  const moodTimer = useRef<number | null>(null);

  const slots: WidgetAvatarSlots = { idle: avatarSrc, ...avatars };
  const imageSrc = avatarForExpression(slots, expression);

  const setExpressionTimed = useCallback(
    (next: CharacterExpression, ms = 1200) => {
      setExpression(next);
      if (moodTimer.current !== null) window.clearTimeout(moodTimer.current);
      moodTimer.current = window.setTimeout(() => {
        setExpression(hovered ? "happy" : "idle");
      }, ms);
    },
    [hovered],
  );

  // Scroll direction → lean. Throttled with rAF; resets to upright shortly
  // after scrolling stops. Disabled entirely with reduced motion.
  useEffect(() => {
    if (reducedMotion) return;
    let raf = 0;
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      raf = window.requestAnimationFrame(() => {
        ticking = false;
        const y = window.scrollY;
        const direction = scrollDirection(lastScrollY.current, y);
        lastScrollY.current = y;
        if (direction !== "none") {
          setScrollDir(direction);
          if (scrollResetTimer.current !== null) {
            window.clearTimeout(scrollResetTimer.current);
          }
          scrollResetTimer.current = window.setTimeout(() => setScrollDir("none"), 700);
        }
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.cancelAnimationFrame(raf);
      if (scrollResetTimer.current !== null) window.clearTimeout(scrollResetTimer.current);
    };
  }, [reducedMotion]);

  // Gentle idle bob, ~1.5s cycle. No-op with reduced motion.
  useEffect(() => {
    if (reducedMotion) return;
    const id = window.setInterval(() => {
      setBob((value) => (value === 0 ? -2 : 0));
    }, 1500);
    return () => window.clearInterval(id);
  }, [reducedMotion]);

  useEffect(() => {
    return () => {
      if (moodTimer.current !== null) window.clearTimeout(moodTimer.current);
    };
  }, []);

  // Focus trap + Escape while the panel is open; focus returns to the
  // character button on close.
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open ]);

  function handleHover(event: "hover" | "leave") {
    if (event === "hover") {
      setHovered(true);
      setExpression(expressionForEvent("hover", reducedMotion));
    } else {
      setHovered(false);
      setEye({ x: 0, y: 0 });
      setExpression(expressionForEvent("leave", reducedMotion));
    }
  }

  function handleMouseMove(event: MouseEvent<HTMLButtonElement>) {
    if (reducedMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setEye(eyeFollowOffset(event.clientX, event.clientY, rect, reducedMotion));
  }

  function handleClick() {
    // Playful squash-and-stretch, then open — the click is the open action,
    // never only a joke.
    if (!reducedMotion) {
      setSquashed(true);
      window.setTimeout(() => setSquashed(false), 220);
    }
    setExpressionTimed(expressionForEvent("click", reducedMotion), 900);
    setOpen((value) => !value);
  }

  function handleMood(event: IdeaRequestMoodEvent) {
    setExpressionTimed(expressionForEvent(event, reducedMotion));
  }

  const tilt = tiltForScroll(scrollDir, reducedMotion);
  const transform = [
    `rotate(${tilt}deg)`,
    `translate(${eye.x}px, ${eye.y + bob}px)`,
    hovered && !reducedMotion ? "scale(1.05)" : "scale(1)",
    squashed ? "scale(1.12, 0.86)" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={cn(
        "fixed right-4 bottom-4 z-50 flex flex-col items-end gap-3",
        className,
      )}
    >
      {open && (
        <section
          ref={panelRef}
          id="idea-request-panel"
          role="dialog"
          aria-label={`Request a startup idea — ${characterName}`}
          className="flex max-h-[70vh] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl"
        >
          <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3">
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black text-white"
              >
                {imageSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageSrc} alt="" className="size-full object-cover" />
                ) : (
                  <Lightbulb className="size-5" />
                )}
              </span>
              <div>
                <h2 className="text-base font-medium text-neutral-900">Request an idea</h2>
                <p className="text-sm text-neutral-600">
                  {characterName} is listening — tell us what to research next.
                </p>
              </div>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
              aria-label="Close idea requests"
              className={cn(
                "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 hover:text-black",
                FOCUS,
              )}
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-4 py-4">
            <IdeaRequestPanel limit={5} onMood={handleMood} />
          </div>
        </section>
      )}

      <button
        ref={triggerRef}
        type="button"
        onClick={handleClick}
        onMouseEnter={() => handleHover("hover")}
        onMouseLeave={() => handleHover("leave")}
        onMouseMove={handleMouseMove}
        aria-expanded={open}
        aria-controls="idea-request-panel"
        aria-label={
          open
            ? `Close idea requests — ${characterName}`
            : `Request an idea — ${characterName}`
        }
        title="Request an idea"
        className={cn(
          "relative flex size-14 items-center justify-center overflow-hidden rounded-full bg-black text-white shadow-lg transition-transform duration-200 motion-reduce:transition-none",
          FOCUS,
        )}
      >
        <span
          aria-hidden
          className="flex size-full items-center justify-center transition-transform duration-200 motion-reduce:transition-none"
          style={{ transform }}
        >
          {imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageSrc}
              alt=""
              draggable={false}
              className="size-full rounded-full object-cover"
            />
          ) : (
            <Lightbulb className="size-6" />
          )}
        </span>
        <span className="sr-only">
          {open ? "Close idea requests" : "Request an idea"}
        </span>
      </button>
    </div>
  );
}
