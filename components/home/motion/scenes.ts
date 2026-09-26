/**
 * Scroll motion for homepage sections 02–10 (WP43), loaded by HomeMotion.
 * The hero (01) plays on CSS instead; see `.home-intro` in globals.css.
 *
 * Each section root carries `data-scene`; elements inside carry `data-m`
 * roles. A scene is made of beats: a beat hides its elements when it is armed
 * and plays them once when its trigger scrolls into view.
 *
 * - A beat is armed only if its trigger is still below the fold when this
 *   runs. Anything the visitor has already seen stays as rendered.
 * - Only opacity and transforms change (plus clip-path on two decorative
 *   reveals), so nothing reflows. Counters count in an overlay.
 * - Focus moving into a section, or printing, finishes its beats at once, so
 *   nothing is ever left hidden.
 * - Beats are armed one idle slice at a time, so a slow phone never gets one
 *   long task, and each beat checks the fold when it is armed.
 * - Wide screens get the scroll-linked drift. Phones get no drifting images.
 * - GSAP folds Tailwind's `rotate`/`translate` into its own transform, so
 *   moves are relative ("+=22") and the resting tilt of each element holds.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

import { formatCount, parseCount } from "@/lib/home/count";

gsap.registerPlugin(ScrollTrigger, SplitText);

type Timeline = gsap.core.Timeline;
type Kit = {
  desktop: boolean;
  /** `build` adds tweens that hide on creation; they play when `trigger` reaches `start`. */
  beat: (trigger: Element | null, build: (tl: Timeline) => void, start?: string) => void;
  /** A scroll-linked tween across `trigger`'s time on screen. Wide screens only. */
  drift: (target: Element | null, trigger: Element | null, from: gsap.TweenVars, to: gsap.TweenVars) => void;
};

const EASE = "power3.out";

const hasIdle = typeof window !== "undefined" && typeof window.requestIdleCallback === "function";
const later = (fn: () => void) => (hasIdle ? window.requestIdleCallback(fn, { timeout: 500 }) : window.setTimeout(fn, 16));
const cancelLater = (id: number) => (hasIdle ? window.cancelIdleCallback(id) : window.clearTimeout(id));

const all = (root: ParentNode | null, role: string) =>
  root ? Array.from(root.querySelectorAll<HTMLElement>(`[data-m="${role}"]`)) : [];
const one = (root: ParentNode | null, role: string) => root?.querySelector<HTMLElement>(`[data-m="${role}"]`) ?? null;
/** Drops elements that are `display: none` at this breakpoint. */
const shown = (els: HTMLElement[]) => els.filter((el) => el.getClientRects().length > 0);
const kids = (el: Element | null) => (el ? shown(Array.from(el.children) as HTMLElement[]) : []);

/** Fade up from a little below. */
function rise(tl: Timeline, targets: HTMLElement[], at: gsap.Position, vars: gsap.TweenVars = {}) {
  if (targets.length) tl.from(targets, { opacity: 0, y: "+=22", stagger: 0.07, ...vars }, at);
}

/**
 * Lines rise from behind a mask; the heading goes back to plain text once they
 * land. While split, the heading is pinned to its rendered width, rounded up:
 * shrink-to-fit headings are exactly as wide as their longest line, and a flex
 * item would otherwise shrink to its widest line and wrap once more.
 */
function lines(tl: Timeline, el: HTMLElement | null, at: gsap.Position, vars: gsap.TweenVars = {}) {
  if (!el) return;
  const saved = { width: el.style.width, minWidth: el.style.minWidth, maxWidth: el.style.maxWidth };
  const width = `${Math.ceil(el.getBoundingClientRect().width) + 1}px`;
  Object.assign(el.style, { width, minWidth: width, maxWidth: width });
  const split = SplitText.create(el, { type: "lines", mask: "lines", linesClass: "home-line" });
  const done = () => {
    split.revert();
    Object.assign(el.style, saved);
  };
  // 130%: the mask has room for descenders, so tall letters would peek in from below at 110%.
  tl.from(split.lines, { yPercent: 130, duration: 0.9, stagger: 0.09, ...vars, onComplete: done }, at);
}

/** A header block: children rise in turn, a `lines` heading (at any depth) reveals line by line. */
function intro(tl: Timeline, head: HTMLElement | null, at = 0, linesVars: gsap.TweenVars = {}) {
  kids(head).forEach((child, i) => {
    const pos = at + i * 0.08;
    if (child.dataset.m === "lines") lines(tl, child, pos, linesVars);
    else if (child.querySelector('[data-m="lines"]')) intro(tl, child, pos, linesVars);
    else rise(tl, [child], pos);
  });
}

/**
 * Counts a label's number up from zero. The rendered text stays in place
 * (transparent, still read by assistive tech) and a positioned copy counts on
 * top of it, so nothing around it re-lays out while the digits change.
 */
function count(tl: Timeline, el: HTMLElement | null, at: number, duration = 1.2) {
  const parts = parseCount(el?.textContent ?? "");
  if (!el || !parts || parts.value === 0) return;
  const state = { value: 0 };
  const saved = { position: el.style.position, color: el.style.color };
  let ghost: HTMLSpanElement | null = null;
  tl.from(el, { opacity: 0, duration: 0.4 }, at);
  tl.to(
    state,
    {
      value: parts.value,
      duration,
      ease: "power2.out",
      onStart: () => {
        const cs = getComputedStyle(el);
        ghost = document.createElement("span");
        ghost.setAttribute("aria-hidden", "true");
        Object.assign(ghost.style, { position: "absolute", inset: "0", color: cs.color, whiteSpace: "nowrap", pointerEvents: "none" });
        if (cs.position === "static") el.style.position = "relative";
        el.style.color = "transparent";
        el.append(ghost);
      },
      onUpdate: () => {
        if (ghost) ghost.textContent = formatCount(parts, state.value);
      },
      onComplete: () => {
        ghost?.remove();
        ghost = null;
        Object.assign(el.style, saved);
      },
    },
    at,
  );
}

/**
 * Rows of hour cells fill left to right, one cell per step: a stepped clip
 * over each row, so a row costs one tween however many cells it has.
 * Returns when the last row is full.
 */
function wipe(tl: Timeline, rows: HTMLElement[], at: number, step = 0.04, gap = 0.06) {
  let t = at;
  for (const row of rows) {
    const n = row.children.length;
    if (!n) continue;
    tl.fromTo(
      row,
      { clipPath: "inset(-2px 100% -2px 0%)" },
      { clipPath: "inset(-2px 0% -2px 0%)", duration: n * step, ease: `steps(${n})`, clearProps: "clipPath" },
      t,
    );
    t += n * step + gap;
  }
  return t;
}

const SCENES: Record<string, (section: HTMLElement, kit: Kit) => void> = {
  /** 02 · The count ticks up, chips fan in, rows land and fill their hours. */
  library(s, { beat, desktop }) {
    beat(
      s,
      (tl) => {
        rise(tl, all(s, "rise"), 0);
        count(tl, one(s, "count"), 0.1, 1.4);
        lines(tl, one(s, "lines"), 0.2);
        rise(tl, shown(all(s, "chip")), 0.45, { y: 0, x: "-=10", duration: 0.5, stagger: desktop ? 0.035 : 0.05 });
      },
      "top 75%",
    );
    const index = one(s, "index");
    beat(
      index,
      (tl) => {
        rise(tl, shown(all(index, "thead")), 0, { y: 0, duration: 0.5 });
        shown(all(index, "row")).forEach((row, i) => {
          rise(tl, [row], 0.05 + i * 0.07, { y: "+=18" });
          wipe(tl, all(row, "cells"), 0.3 + i * 0.07, 0.03, 0.02);
        });
      },
      "top 85%",
    );
  },

  /** 03 · The art settles as it scrolls, the title rises, the numbers tick. */
  spotlight(s, { beat, drift, desktop }) {
    const stage = one(s, "stage");
    const art = one(s, "art");
    drift(art, stage, { yPercent: -3, scale: 1.14 }, { yPercent: 3, scale: 1.07 });
    beat(
      stage,
      (tl) => {
        if (!desktop && art) tl.from(art, { scale: 1.08, duration: 1.6, ease: "power2.out" }, 0);
        rise(tl, all(stage, "rise"), 0.1);
        lines(tl, one(stage, "lines"), 0.25);
      },
      "top 70%",
    );
    const cols = one(s, "cols");
    beat(cols, (tl) => {
      rise(tl, kids(cols), 0, { stagger: 0.12 });
      wipe(tl, all(cols, "cells"), 0.5);
      all(cols, "count").forEach((el, i) => count(tl, el, 0.55 + i * 0.08, 0.9));
    });
  },

  /** 04 · Signature: notes drop onto the wall out of order, pins pop, the stamp presses on. */
  test(s, { beat, desktop }) {
    const head = one(s, "head");
    beat(head, (tl) => intro(tl, head), "top 80%");
    const wall = one(s, "wall");
    beat(wall, (tl) => {
      const notes = all(wall, "note");
      const step = desktop ? 0.14 : 0.1;
      [0, 2, 1, 4, 3, 5].forEach((n, k) => {
        const note = notes[n];
        if (!note) return;
        const at = k * step;
        tl.from(note, { opacity: 0, duration: 0.3, ease: "power1.out" }, at);
        tl.from(note, { y: "-=48", rotation: n % 2 ? "+=7" : "-=7", scale: 1.06, duration: 0.85, ease: "back.out(1.6)" }, at);
        const pin = one(note, "pin");
        if (pin) tl.from(pin, { opacity: 0, scale: 0, duration: 0.35, ease: "back.out(3)" }, at + 0.5);
      });
      const seal = one(wall, "seal");
      const stamp = seal?.querySelector("svg");
      const end = 5 * step + 0.6;
      if (stamp) tl.from(stamp, { opacity: 0, scale: 1.45, rotation: "+=18", duration: 0.6, ease: "back.out(2)" }, end);
      rise(tl, shown(Array.from(seal?.querySelectorAll<HTMLElement>("p") ?? [])), end + 0.15);
    });
  },

  /** 05 · Logos land in grid order; "Paste. Run. Ship." one beat at a time; the prompt cards deal out. */
  ai(s, { beat, desktop }) {
    const head = one(s, "head");
    beat(head, (tl) => intro(tl, head), "top 80%");
    const tiles = one(s, "tiles");
    beat(tiles, (tl) => {
      const step = desktop ? 0.07 : 0.05;
      rise(tl, all(tiles, "tile"), 0, { y: "+=26", stagger: step });
      const logos = shown(all(tiles, "logo"));
      if (logos.length) tl.from(logos, { scale: 0.9, duration: 0.7, stagger: step }, 0.1);
    });
    const panel = one(s, "panel");
    beat(panel, (tl) => {
      // Measure before any tween moves the cards.
      const front = one(panel, "front");
      const deck = all(panel, "deal").reverse();
      const frontTop = front?.getBoundingClientRect().top ?? 0;
      const drops = deck.map((card) => frontTop - card.getBoundingClientRect().top);
      const frontAngle = front ? Number(gsap.getProperty(front, "rotation")) : 0;

      intro(tl, one(panel, "copy"), 0, { stagger: 0.22, duration: 0.8 });
      if (!front) return;
      tl.from(front, { opacity: 0, y: "+=48", duration: 0.9 }, 0.3);
      deck.forEach((card, i) => {
        tl.from(card, { opacity: 0, y: `+=${drops[i]}`, rotation: frontAngle, duration: 0.8 }, 0.75 + i * 0.12);
      });
      const code = shown(all(front, "code"));
      if (code.length) tl.from(code, { opacity: 0, x: "-=6", duration: 0.3, ease: "power1.out", stagger: 0.04 }, 0.95);
    });
  },

  /** 06 · Calm: tiles in reading order, numbers tick. Phones reveal each tile as it arrives. */
  inside(s, { beat, desktop }) {
    const head = one(s, "head");
    beat(head, (tl) => intro(tl, head), "top 80%");
    const reveal = (tl: Timeline, tile: HTMLElement, at: number) => {
      rise(tl, [tile], at, { y: "+=24", duration: 0.75 });
      all(tile, "count").forEach((el, j) => count(tl, el, at + 0.25 + j * 0.1, 1.1));
    };
    const grid = one(s, "grid");
    const tiles = all(grid, "tile");
    if (desktop) beat(grid, (tl) => tiles.forEach((tile, i) => reveal(tl, tile, i * 0.08)), "top 80%");
    else tiles.forEach((tile) => beat(tile, (tl) => reveal(tl, tile, 0), "top 88%"));
  },

  /** 07 · Signature: the photo drifts, 12 hrs counts, the hour bars fill day by day. Monday stays empty. */
  weekend(s, { beat, drift }) {
    drift(one(s, "photo")?.querySelector("img") ?? null, s, { yPercent: -3, scale: 1.08 }, { yPercent: 3, scale: 1.08 });
    const head = one(s, "head");
    beat(
      head,
      (tl) => {
        intro(tl, head);
        count(tl, one(head, "count"), 0.45, 1.2);
      },
      "top 75%",
    );
    const plan = one(s, "plan");
    beat(plan, (tl) => {
      let at = 0;
      shown(all(plan, "day")).forEach((day) => {
        const bar = one(day, "bar");
        const [top, ...rest] = kids(day);
        const text = rest.filter((el) => el !== bar);
        if (top) tl.from(top, { opacity: 0, y: "+=10", duration: 0.45 }, at);
        let end = at + 0.6;
        if (bar && Number(bar.dataset.hours) > 0) end = wipe(tl, [bar], at + 0.12, 0.09);
        else if (bar) tl.from(bar, { opacity: 0, duration: 0.45 }, at + 0.12);
        rise(tl, text, end - 0.1, { y: "+=10", duration: 0.6, stagger: 0.06 });
        at = end - 0.1; // the next day starts as this bar completes
      });
    });
  },

  /** 08 · The ticket slides in and straightens, the stub joins, notches punch, the barcode ripples. */
  kit(s, { beat, desktop }) {
    const head = one(s, "head");
    beat(head, (tl) => intro(tl, head), "top 80%");
    const kit = one(s, "kit");
    beat(
      kit,
      (tl) => {
        const ticket = one(kit, "ticket");
        const stub = one(kit, "stub");
        if (ticket) tl.from(ticket, { opacity: 0, rotation: "-=3", duration: 0.9, ...(desktop ? { x: "-=60" } : { y: "+=30" }) }, 0);
        if (stub) tl.from(stub, { opacity: 0, duration: 0.8, ...(desktop ? { x: "+=48" } : { y: "+=24" }) }, 0.3);
        rise(tl, shown(all(kit, "tear")), 0.3, { y: 0 });
        const notches = shown(all(kit, "notch"));
        if (notches.length) tl.from(notches, { scale: 0, duration: 0.4, ease: "back.out(2.5)", stagger: 0.08 }, 0.75);
        const bars = kids(one(kit, "barcode"));
        if (bars.length) tl.from(bars, { scaleY: 0, transformOrigin: "50% 100%", duration: 0.3, ease: "power2.out", stagger: 0.015 }, 0.95);
      },
      "top 78%",
    );
  },

  /** 09 · The portrait pill widens, the letter settles in, the signature writes itself. */
  founder(s, { beat }) {
    const title = one(s, "title");
    const pill = one(s, "pill");
    beat(title, (tl) => {
      rise(tl, [title as HTMLElement], 0, { y: "+=24", duration: 0.8 });
      if (pill) {
        tl.fromTo(
          pill,
          { clipPath: "inset(0% 32% 0% 32% round 999px)" },
          { clipPath: "inset(0% 0% 0% 0% round 999px)", duration: 1, ease: "power3.inOut", clearProps: "clipPath" },
          0.2,
        );
      }
    });
    const cap = one(s, "cap");
    kids(one(s, "letter")).forEach((p) => {
      beat(
        p,
        (tl) => {
          rise(tl, [p], 0, { y: "+=16", duration: 0.8 });
          if (cap && p.contains(cap)) tl.from(cap, { opacity: 0, scale: 0.6, transformOrigin: "50% 80%", duration: 0.7, ease: "back.out(2)" }, 0.1);
        },
        "top 88%",
      );
    });
    const signoff = one(s, "signoff");
    beat(
      signoff,
      (tl) => {
        const sign = one(signoff, "sign");
        if (sign) {
          tl.fromTo(
            sign,
            { clipPath: "inset(-25% 100% -35% -5%)" },
            { clipPath: "inset(-25% -5% -35% -5%)", duration: 1.3, ease: "power2.inOut", clearProps: "clipPath" },
            0,
          );
        }
        rise(tl, all(signoff, "rise"), 0.5);
      },
      "top 88%",
    );
  },

  /** 10 · The art strip moves with the scroll; the last call rises line by line. */
  final(s, { beat, drift }) {
    const strip = one(s, "strip");
    drift(strip, strip, { x: 90 }, { x: -90 });
    beat(strip, (tl) => rise(tl, kids(strip), 0, { y: "+=34", stagger: 0.06, duration: 0.8 }), "top 88%");
    const title = one(s, "lines");
    beat(
      title,
      (tl) => {
        lines(tl, title, 0, { stagger: 0.14, duration: 1 });
        rise(tl, all(s, "cta"), 0.45);
      },
      "top 82%",
    );
  },
};

export function startHomeMotion(): () => void {
  /** Armed beats that have not played yet, with the section each belongs to. */
  const waiting = new Map<Timeline, Element>();
  const finish = (inside?: Node) => {
    waiting.forEach((section, tl) => {
      if (inside && !section.contains(inside)) return;
      waiting.delete(tl);
      tl.progress(1);
    });
  };
  const onFocus = (e: FocusEvent) => {
    if (e.target instanceof Node) finish(e.target);
  };
  const onPrint = () => finish();
  document.addEventListener("focusin", onFocus);
  window.addEventListener("beforeprint", onPrint);

  const mm = gsap.matchMedia();
  mm.add({ desktop: "(min-width: 1024px)", motion: "(prefers-reduced-motion: no-preference)" }, (context) => {
    const { desktop, motion } = context.conditions as { desktop: boolean; motion: boolean };
    if (!motion) return;
    const unseen = (el: Element) => el.getBoundingClientRect().top >= window.innerHeight;

    // Scenes only queue their beats; the queue is armed in idle slices of about 10ms.
    const jobs: (() => void)[] = [];
    const queue = (job: () => void) => jobs.push(() => context.add(job));
    let handle = 0;
    const pump = () => {
      const until = performance.now() + 10;
      do jobs.shift()?.();
      while (jobs.length && performance.now() < until);
      if (jobs.length) handle = later(pump);
      else ScrollTrigger.refresh();
    };

    document.querySelectorAll<HTMLElement>("[data-scene]").forEach((section) => {
      const kit: Kit = {
        desktop,
        beat(trigger, build, start = "top 80%") {
          queue(() => {
            if (!trigger || !unseen(trigger)) return;
            const tl = gsap.timeline({ paused: true, defaults: { ease: EASE, duration: 0.7 } });
            build(tl);
            waiting.set(tl, section);
            ScrollTrigger.create({
              trigger,
              start,
              once: true,
              onEnter: () => {
                waiting.delete(tl);
                tl.play();
              },
            });
          });
        },
        drift(target, trigger, from, to) {
          if (!desktop) return;
          queue(() => {
            if (!target || !trigger || !unseen(trigger)) return;
            gsap.fromTo(target, from, { ...to, ease: "none", scrollTrigger: { trigger, start: "top bottom", end: "bottom top", scrub: 0.6 } });
          });
        },
      };
      SCENES[section.dataset.scene ?? ""]?.(section, kit);
      section.querySelectorAll<HTMLElement>('[data-m="up"]').forEach((el) => kit.beat(el, (tl) => rise(tl, [el], 0), "top 90%"));
      section
        .querySelectorAll<HTMLElement>('[data-m="up-list"]')
        .forEach((el) => kit.beat(el, (tl) => rise(tl, kids(el), 0, { stagger: 0.06 }), "top 90%"));
    });
    handle = later(pump);
    return () => {
      jobs.length = 0;
      cancelLater(handle);
      waiting.clear();
    };
  });

  return () => {
    document.removeEventListener("focusin", onFocus);
    window.removeEventListener("beforeprint", onPrint);
    mm.revert();
  };
}
