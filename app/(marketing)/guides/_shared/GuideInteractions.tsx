"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

import { BeehiivSubscribeForm } from "@/components/forms/BeehiivSubscribeForm";
import { Eyebrow } from "@/components/home/ui";
import { GUIDE_AUTOMATION_ID, subscribeViaApi } from "@/lib/beehiiv-client";
import { trackEvent } from "@/lib/track";

import { renderInlineCopy } from "./copy";
import type { GuideGateConfig, GuideNavSection } from "./types";

export function GuideGate({ config, utmCampaign, finePrint }: { config: GuideGateConfig; utmCampaign: string; finePrint: string }) {
  const gate = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const email = useRef<string | null>(null);
  const resendUsed = useRef(false);
  const focusAfterUnlock = useRef(false);
  const [unlocked, setUnlocked] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "requested">("idle");

  function setMode(mode: "pending" | "confirmed") {
    const guide = gate.current?.closest<HTMLElement>(".builder-guide");
    if (guide) guide.dataset.guide = mode;
  }

  useLayoutEffect(() => {
    const guide = gate.current?.closest<HTMLElement>(".builder-guide");
    // The parser runs the bootstrap on a direct load. A client navigation
    // creates the wrapper without executing its inline script.
    if (!guide || guide.dataset.guide) return;
    let mode = "locked";
    try {
      if (localStorage.getItem("weekendmvp_subscribed") === "true") mode = "returning";
    } catch {
      // Storage is optional in embedded browsers.
    }
    guide.dataset.guide = mode;
  }, []);

  useLayoutEffect(() => {
    if (!unlocked || focusAfterUnlock.current) return;
    focusAfterUnlock.current = true;
    heading.current?.focus({ preventScroll: true });
  }, [unlocked]);

  async function resend() {
    if (!email.current || resendUsed.current) return;
    resendUsed.current = true;
    setResendState("sending");
    try {
      const result = await subscribeViaApi({
        email: email.current,
        automationIds: [GUIDE_AUTOMATION_ID],
        utmCampaign,
      });
      if (result.ok) setMode("confirmed");
    } catch {
      // This request can be retried on a new page view.
    } finally {
      setResendState("requested");
    }
  }

  return (
    <section id="gate" ref={gate} aria-label="Unlock the guide" className="guide-gate bg-home-sunk">
      <div className="guide-ticket bg-home-card">
        <div className="guide-stub">
          <Eyebrow>{config.stubEyebrow}</Eyebrow>
          <span className="font-mono text-[11px] uppercase text-home-ink-3">{config.stubNote}</span>
        </div>
        <div className="guide-faces">
          <div className="guide-locked-face">
            <h2>{config.heading}</h2>
            <p className="text-home-ink-2 [&_a]:underline [&_a]:underline-offset-4">{renderInlineCopy(config.body)}</p>
            <ul aria-label="What unlocks" className="guide-chips">
              {config.unlocks.map((label) => <li key={label}>{label}</li>)}
            </ul>
            <BeehiivSubscribeForm
              automationId={GUIDE_AUTOMATION_ID}
              utmCampaign={utmCampaign}
              successHref={null}
              onSuccess={(details) => {
                if (!details) return;
                email.current = details.email;
                setMode(details.via === "api" ? "confirmed" : "pending");
                setUnlocked(true);
                trackEvent("guide_unlocked", { via: details.via });
              }}
              onConfirmed={() => setMode("confirmed")}
              optimisticSuccessMs={8000}
              showFirstName={false}
              submitLabel="Unlock the guide"
              emailPlaceholder="you@work.com"
              emailLabel="Email"
              className="guide-form"
              emailLabelClassName="mb-2 block text-sm font-medium text-home-ink"
              inputClassName="h-[52px] rounded-full border-home-ink-3 bg-home-card px-4 text-[17px] text-home-ink placeholder:text-home-ink-3 focus:ring-home-orange-ink"
              buttonClassName="h-[52px] rounded-full bg-home-ink px-5 text-base text-home-paper hover:bg-home-ink-2 focus:ring-home-orange-ink"
            />
            <p data-copy-slot="Gate · Fine print" className="[&_a]:underline [&_a]:underline-offset-4">{renderInlineCopy(finePrint)}</p>
          </div>
          <div className="guide-open-face">
            <Eyebrow>Unlocked</Eyebrow>
            <h2 tabIndex={-1} ref={heading}>The guide&apos;s open below.</h2>
            <div className="guide-swap text-home-ink-2">
              <p className="guide-pending">
                Day 1 should be in your inbox in a few minutes. Not there?{" "}
                <span className="guide-resend" data-resend={resendState}>
                  <button type="button" onClick={resend}>Resend</button>
                  <span className="guide-resend-sending">Sending…</span>
                  <span className="guide-resend-requested">Resend requested.</span>
                </span>
              </p>
              <p className="guide-confirmed">Day 1 is on its way.</p>
              <p className="guide-returning">You unlocked it on this device.</p>
            </div>
            <a href={config.nextHref} className="guide-pill guide-pill-outline">{config.nextLabel}</a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ContentsLinks({ sections, onNavigate }: { sections: readonly GuideNavSection[]; onNavigate?: () => void }) {
  return (
    <nav aria-label="Guide contents">
      <ol className="guide-mini-nav">
        {sections.map(({ id, title }, index) => (
          <li key={id}>
            <a href={`#${id}`} onClick={onNavigate}>
              <span className="font-mono text-xs text-home-orange-ink">{String(index + 1).padStart(2, "0")}</span>{title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function GuideNavigation({ title, sections }: { title: string; sections: readonly GuideNavSection[] }) {
  const progress = useRef<HTMLSpanElement>(null);
  const contents = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const bar = progress.current;
    const guide = bar?.closest<HTMLElement>(".builder-guide");
    if (!bar || !guide) return;
    const end = guide.querySelector("#builder-guide-end");
    const links = [...guide.querySelectorAll<HTMLAnchorElement>(".guide-mini-nav a")];
    const sectionNodes = sections.map(({ id }) => guide.querySelector<HTMLElement>(`#${id}`));
    let frame = 0;
    let activeId = "";
    function update() {
      if (!bar || !end) return;
      const endOffset = end.getBoundingClientRect().top + window.scrollY;
      const read = Math.min(1, window.scrollY / Math.max(1, endOffset - window.innerHeight));
      bar.style.transform = `scaleX(${read})`;

      const active = sectionNodes.findLast((section) =>
        section?.getClientRects().length && section.getBoundingClientRect().top <= window.innerHeight * 0.4,
      );
      const nextId = active?.id ?? sections[0].id;
      if (nextId === activeId) return;
      activeId = nextId;
      for (const link of links) {
        if (link.hash === `#${activeId}`) link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
      }
    }
    function scheduleUpdate() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    }
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleUpdate);
    observer?.observe(guide);
    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [sections]);

  return (
    <div className="guide-reading-header">
      <div className="guide-measure guide-reading-controls">
        <span className="font-mono text-xs uppercase tracking-wide">{title}</span>
        <a href="#gate" className="guide-when-locked guide-unlock-link">Unlock free ↓</a>
        <details ref={contents} className="guide-unless-locked guide-contents-sheet">
          <summary className="guide-pill guide-pill-outline">Contents</summary>
          <ContentsLinks sections={sections} onNavigate={() => contents.current?.removeAttribute("open")} />
        </details>
      </div>
      <span className="guide-progress" ref={progress} aria-hidden="true" />
    </div>
  );
}

function readChecklist(storageKey: string) {
  try {
    return localStorage.getItem(storageKey) ?? "[]";
  } catch {
    return "[]";
  }
}

function subscribeToChecklist(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export function GuideChecklist({ items, storageKey }: { items: readonly string[]; storageKey: string }) {
  const stored = useSyncExternalStore(subscribeToChecklist, () => readChecklist(storageKey), () => "[]");
  const [edited, setEdited] = useState<number[] | null>(null);
  let checked = edited ?? [];
  if (edited === null) {
    try {
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        checked = [...new Set(parsed.filter((item): item is number =>
          Number.isInteger(item) && item >= 1 && item <= items.length,
        ))];
      }
    } catch {
      // Ignore malformed local data.
    }
  }

  function toggle(item: number) {
    const next = checked.includes(item) ? checked.filter((value) => value !== item) : [...checked, item];
    setEdited(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // The checklist still works for this page view.
    }
  }

  return (
    <div className="guide-checklist rounded-[10px] border border-home-rule bg-home-card">
      <div className="flex flex-wrap items-center justify-between gap-2"><strong>You&apos;re ready when…</strong><span className="font-mono text-sm">{checked.length} of {items.length} checked</span></div>
      <progress max={items.length} value={checked.length} aria-label="Self-check progress" />
      <ul>
        {items.map((text, index) => {
          const item = index + 1;
          return (
            <li key={item}>
              <label data-copy-slot={`Self-Check · Item ${item}`}>
                <input type="checkbox" checked={checked.includes(item)} onChange={() => toggle(item)} />
                <span>{text}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const input = document.createElement("textarea");
    const focused = document.activeElement;
    input.value = text;
    input.className = "sr-only";
    input.readOnly = true;
    document.body.appendChild(input);
    input.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      input.remove();
      if (focused instanceof HTMLElement) focused.focus({ preventScroll: true });
    }
  }
}

export function GuidePrompt({ prompt: PROMPT, fileName }: { prompt: string; fileName: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    if (!await copyText(PROMPT)) return;
    setCopied(true);
    trackEvent("guide_prompt_copied");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="guide-prompt guide-dark">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-home-panel-rule p-3">
        <span className="font-mono text-sm text-home-d2">{fileName}</span>
        <button type="button" onClick={copy} className="guide-pill guide-pill-outline min-w-32">{copied ? "Copied" : "Copy prompt"}</button>
      </div>
      <pre className="m-3 whitespace-pre-wrap wrap-anywhere px-3 py-2 text-sm text-home-d2" data-copy-slot="The Prompt · Prompt text"><code>{PROMPT}</code></pre>
      <p role="status" className="sr-only">{copied ? "Prompt copied." : ""}</p>
    </div>
  );
}

/**
 * Offer link with click tracking. The event keeps its original name, `guide_sprint_click`, so existing
 * reports keep working. It now also carries `guide` and `offerId`. Rename it when a second offer exists.
 */
export function OfferLink({
  placement,
  href,
  label,
  guide,
  offerId,
}: {
  placement: "mid" | "close";
  href: string;
  label: string;
  guide: string;
  offerId: string;
}) {
  return (
    <Link className="guide-pill" href={href} onClick={() => trackEvent("guide_sprint_click", { placement, guide, offerId })}>
      {label}
    </Link>
  );
}
