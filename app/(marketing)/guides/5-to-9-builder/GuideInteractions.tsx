"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

import { BeehiivSubscribeForm } from "@/components/forms/BeehiivSubscribeForm";
import { Eyebrow } from "@/components/home/ui";
import { GUIDE_AUTOMATION_ID, subscribeViaApi } from "@/lib/beehiiv-client";
import { trackEvent } from "@/lib/track";

import { GUIDE_TITLE, SECTIONS } from "./guideContent";

const UTM_CAMPAIGN = "5-to-9-builder";
const UNLOCKS = ["The Method", "The 6 Skills", "The Catch", "30-Day Plan", "Idea Bank", "First Sale", "Self-Check", "The prompt"];

export function GuideGate() {
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
        utmCampaign: UTM_CAMPAIGN,
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
          <Eyebrow>Free · Sections 02–11</Eyebrow>
          <span className="font-mono text-[11px] uppercase text-home-ink-3">One email · No download</span>
        </div>
        <div className="guide-faces">
          <div className="guide-locked-face">
            <h2>The rest of the guide is free. One email opens it.</h2>
            <p className="text-home-ink-2">It opens right here, on this page. The same email starts the 5-to-9 Starter: five daily emails, one action a day.</p>
            <ul aria-label="What unlocks" className="guide-chips">
              {UNLOCKS.map((label) => <li key={label}>{label}</li>)}
            </ul>
            <BeehiivSubscribeForm
              automationId={GUIDE_AUTOMATION_ID}
              utmCampaign={UTM_CAMPAIGN}
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
            <div className="guide-placeholder" data-copy-slot="Gate · Fine print">COPY TO WRITE <span>Gate · Fine print</span></div>
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
            <a href="#s02" className="guide-pill guide-pill-outline">Start with 02 · The Method ↓</a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ContentsLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Guide contents">
      <ol className="guide-mini-nav">
        {SECTIONS.map(({ id, title }) => (
          <li key={id}>
            <a href={`#${id}`} onClick={onNavigate}>
              <span className="font-mono text-xs text-home-orange-ink">{id.slice(1)}</span>{title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function GuideNavigation() {
  const progress = useRef<HTMLSpanElement>(null);
  const contents = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const bar = progress.current;
    const guide = bar?.closest<HTMLElement>(".builder-guide");
    if (!bar || !guide) return;
    const end = guide.querySelector("#builder-guide-end");
    const links = [...guide.querySelectorAll<HTMLAnchorElement>(".guide-mini-nav a")];
    const sections = SECTIONS.map(({ id }) => guide.querySelector<HTMLElement>(`#${id}`));
    let frame = 0;
    let activeId = "";
    function update() {
      if (!bar || !end) return;
      const endOffset = end.getBoundingClientRect().top + window.scrollY;
      const read = Math.min(1, window.scrollY / Math.max(1, endOffset - window.innerHeight));
      bar.style.transform = `scaleX(${read})`;

      const active = sections.findLast((section) =>
        section?.getClientRects().length && section.getBoundingClientRect().top <= window.innerHeight * 0.4,
      );
      const nextId = active?.id ?? SECTIONS[0].id;
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
  }, []);

  return (
    <div className="guide-reading-header">
      <div className="guide-measure guide-reading-controls">
        <span className="font-mono text-xs uppercase tracking-wide">{GUIDE_TITLE}</span>
        <a href="#gate" className="guide-when-locked guide-unlock-link">Unlock free ↓</a>
        <details ref={contents} className="guide-unless-locked guide-contents-sheet">
          <summary className="guide-pill guide-pill-outline">Contents</summary>
          <ContentsLinks onNavigate={() => contents.current?.removeAttribute("open")} />
        </details>
      </div>
      <span className="guide-progress" ref={progress} aria-hidden="true" />
    </div>
  );
}

const CHECKLIST_KEY = "5-to-9-builder-checklist";
const CHECKLIST_SIZE = 18;

function readChecklist() {
  try {
    return localStorage.getItem(CHECKLIST_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function subscribeToChecklist(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export function GuideChecklist() {
  const stored = useSyncExternalStore(subscribeToChecklist, readChecklist, () => "[]");
  const [edited, setEdited] = useState<number[] | null>(null);
  let checked = edited ?? [];
  if (edited === null) {
    try {
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        checked = [...new Set(parsed.filter((item): item is number =>
          Number.isInteger(item) && item >= 1 && item <= CHECKLIST_SIZE,
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
      localStorage.setItem(CHECKLIST_KEY, JSON.stringify(next));
    } catch {
      // The checklist still works for this page view.
    }
  }

  return (
    <div className="guide-checklist rounded-[10px] border border-home-rule bg-home-card">
      <div className="flex flex-wrap items-center justify-between gap-2"><strong>You&apos;re ready when…</strong><span className="font-mono text-sm">{checked.length} of {CHECKLIST_SIZE} checked</span></div>
      <progress max={CHECKLIST_SIZE} value={checked.length} aria-label="Self-check progress" />
      <ul>
        {Array.from({ length: CHECKLIST_SIZE }, (_, index) => index + 1).map((item) => (
          <li key={item}>
            <label className="guide-placeholder" data-copy-slot={`Self-Check · Item ${item}`}>
              <input type="checkbox" checked={checked.includes(item)} onChange={() => toggle(item)} />
              <span><span className="sr-only">Item {item}: </span>COPY TO WRITE</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

const PROMPT = "COPY TO WRITE";

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

export function GuidePrompt() {
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
        <span className="font-mono text-sm text-home-d2">validate-my-idea.txt</span>
        <button type="button" onClick={copy} className="guide-pill guide-pill-outline min-w-32">{copied ? "Copied" : "Copy prompt"}</button>
      </div>
      <pre className="guide-placeholder m-3 whitespace-pre-wrap wrap-anywhere" data-copy-slot="The Prompt · Prompt text"><code>{PROMPT}</code></pre>
      <p role="status" className="sr-only">{copied ? "Prompt copied." : ""}</p>
    </div>
  );
}

export function SprintLink({ placement }: { placement: "mid" | "close" }) {
  return (
    <Link className="guide-pill" href="/live/build-along" onClick={() => trackEvent("guide_sprint_click", { placement })}>
      See the Build-Along
    </Link>
  );
}
