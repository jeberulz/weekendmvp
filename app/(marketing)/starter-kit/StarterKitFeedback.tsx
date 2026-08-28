"use client";

import * as React from "react";
import { CheckCircle2 } from "lucide-react";

const RESPONDENT_KEY = "weekendmvp_starter_kit_feedback_id";
const LAST_RESPONSE_KEY = "weekendmvp_starter_kit_feedback_last";
const LAST_RESPONSE_EVENT = "weekendmvp:starter-kit-feedback-updated";

const PROGRESS_OPTIONS = [
  { value: "not_started", label: "Not started", detail: "I’m still deciding." },
  { value: "planning", label: "Planning", detail: "I picked an idea or wrote a spec." },
  { value: "building", label: "Building", detail: "The MVP is in progress." },
  { value: "shipped", label: "Shipped", detail: "I launched a demo or live link." },
  { value: "paused", label: "Paused", detail: "I stopped or changed direction." },
] as const;

const SECTION_OPTIONS = [
  { value: "", label: "Choose a section (optional)" },
  { value: "rules", label: "The shippable rules" },
  { value: "scorecard", label: "Idea scorecard" },
  { value: "spec", label: "One-page spec" },
  { value: "plan", label: "48-hour plan" },
  { value: "ideas", label: "10 MVP ideas" },
  { value: "prompts", label: "Build prompts" },
  { value: "templates", label: "Templates and scripts" },
] as const;

const BLOCKER_OPTIONS = [
  { value: "", label: "No blocker / choose one (optional)" },
  { value: "time", label: "Finding enough time" },
  { value: "scope", label: "Keeping the idea small" },
  { value: "technical", label: "Technical implementation" },
  { value: "audience", label: "Finding people to test it" },
  { value: "motivation", label: "Staying motivated" },
  { value: "other", label: "Something else" },
] as const;

type FeedbackForm = {
  progress: string;
  helpfulness: number;
  mostUseful: string;
  blocker: string;
  comments: string;
  followUpEmail: string;
  followUpConsent: boolean;
  website: string;
};

type StoredResponse = Pick<
  FeedbackForm,
  "progress" | "helpfulness" | "mostUseful" | "blocker"
> & { savedAt: string };

const INITIAL_FORM: FeedbackForm = {
  progress: "",
  helpfulness: 0,
  mostUseful: "",
  blocker: "",
  comments: "",
  followUpEmail: "",
  followUpConsent: false,
  website: "",
};

function getOrCreateRespondentId(): string {
  try {
    const existing = window.localStorage.getItem(RESPONDENT_KEY);
    if (existing) return existing;
    const created = window.crypto.randomUUID();
    window.localStorage.setItem(RESPONDENT_KEY, created);
    return created;
  } catch {
    return window.crypto.randomUUID();
  }
}

function readStoredResponse(raw: string | null): StoredResponse | null {
  try {
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return null;
    }
    const record = value as Record<string, unknown>;
    if (
      typeof record.progress !== "string" ||
      typeof record.helpfulness !== "number" ||
      typeof record.mostUseful !== "string" ||
      typeof record.blocker !== "string" ||
      typeof record.savedAt !== "string"
    ) {
      return null;
    }
    return record as StoredResponse;
  } catch {
    return null;
  }
}

function subscribeToStoredResponse(onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key === LAST_RESPONSE_KEY) onStoreChange();
  }
  window.addEventListener("storage", handleStorage);
  window.addEventListener(LAST_RESPONSE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(LAST_RESPONSE_EVENT, onStoreChange);
  };
}

function storedResponseSnapshot() {
  return window.localStorage.getItem(LAST_RESPONSE_KEY);
}

function serverStoredResponseSnapshot() {
  return null;
}

export function StarterKitFeedback() {
  const [form, setForm] = React.useState<FeedbackForm>(INITIAL_FORM);
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const storedResponseRaw = React.useSyncExternalStore(
    subscribeToStoredResponse,
    storedResponseSnapshot,
    serverStoredResponseSnapshot,
  );
  const savedAt = React.useMemo(
    () => readStoredResponse(storedResponseRaw)?.savedAt ?? null,
    [storedResponseRaw],
  );

  function update<Key extends keyof FeedbackForm>(
    key: Key,
    value: FeedbackForm[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
    setMessage(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.progress || form.helpfulness === 0) {
      setError("Choose your progress and a usefulness score before sending.");
      return;
    }
    if (
      (form.followUpEmail && !form.followUpConsent) ||
      (!form.followUpEmail && form.followUpConsent)
    ) {
      setError("Add an email and tick the follow-up consent box, or leave both blank.");
      return;
    }

    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/starter-kit-feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          respondentId: getOrCreateRespondentId(),
          progress: form.progress,
          helpfulness: form.helpfulness,
          mostUseful: form.mostUseful || null,
          blocker: form.blocker || null,
          comments: form.comments || null,
          followUpEmail: form.followUpEmail || null,
          followUpConsent: form.followUpConsent,
          website: form.website,
        }),
      });
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; code?: string }
        | null;
      if (!response.ok || !result?.ok) {
        if (result?.code === "RATE_LIMITED") {
          throw new Error("You’ve updated this a few times. Please try again later.");
        }
        if (result?.code === "INVALID_FEEDBACK_REQUEST") {
          throw new Error("Check the form and try again.");
        }
        throw new Error("Feedback is temporarily unavailable. Please try again soon.");
      }

      const nextSavedAt = new Date().toISOString();
      const stored: StoredResponse = {
        progress: form.progress,
        helpfulness: form.helpfulness,
        mostUseful: form.mostUseful,
        blocker: form.blocker,
        savedAt: nextSavedAt,
      };
      try {
        window.localStorage.setItem(LAST_RESPONSE_KEY, JSON.stringify(stored));
        window.dispatchEvent(new Event(LAST_RESPONSE_EVENT));
      } catch {
        // Storage is an update convenience only; the submission already landed.
      }
      setMessage("Thanks — your feedback will shape the next version of the Starter Kit.");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Feedback is temporarily unavailable. Please try again soon.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section id="feedback" className="scroll-mt-40" aria-labelledby="feedback-heading">
      <div className="mb-8">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
          Help improve the kit
        </p>
        <h2 id="feedback-heading" className="text-3xl font-medium tracking-tight">
          Did this move your MVP forward?
        </h2>
        <p className="mt-4 text-neutral-500">
          Two minutes. Anonymous by default. Tell us what helped and where you
          got stuck.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-8 rounded-[2rem] border border-neutral-200 bg-white p-6 md:p-8"
      >
        <fieldset>
          <legend className="text-sm font-semibold">
            Where are you now? <span className="text-red-600">*</span>
          </legend>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {PROGRESS_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer gap-3 rounded-2xl border border-neutral-200 p-4 transition-colors has-[:checked]:border-black has-[:checked]:bg-neutral-50 focus-within:ring-2 focus-within:ring-black/30"
              >
                <input
                  type="radio"
                  name="progress"
                  value={option.value}
                  checked={form.progress === option.value}
                  onChange={() => update("progress", option.value)}
                  required
                  className="mt-1 size-4 accent-black"
                />
                <span>
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-neutral-500">
                    {option.detail}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold">
            How useful has the Starter Kit been? <span className="text-red-600">*</span>
          </legend>
          <div className="mt-4 flex max-w-md items-center gap-2" aria-label="Usefulness score">
            {[1, 2, 3, 4, 5].map((score) => (
              <label key={score} className="flex-1 cursor-pointer text-center">
                <input
                  type="radio"
                  name="helpfulness"
                  value={score}
                  checked={form.helpfulness === score}
                  onChange={() => update("helpfulness", score)}
                  required
                  className="peer sr-only"
                />
                <span className="flex min-h-11 items-center justify-center rounded-xl border border-neutral-200 text-sm font-semibold transition-colors peer-checked:border-black peer-checked:bg-black peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-black/30 peer-focus-visible:ring-offset-2">
                  {score}
                </span>
                <span className="sr-only">{score} out of 5</span>
              </label>
            ))}
          </div>
          <div className="mt-2 flex max-w-md justify-between text-xs text-neutral-400" aria-hidden="true">
            <span>Not useful</span>
            <span>Very useful</span>
          </div>
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="feedback-most-useful" className="text-sm font-medium">
              Most useful part
            </label>
            <select
              id="feedback-most-useful"
              value={form.mostUseful}
              onChange={(event) => update("mostUseful", event.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-black focus:ring-2 focus:ring-black/20"
            >
              {SECTION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="feedback-blocker" className="text-sm font-medium">
              Main blocker
            </label>
            <select
              id="feedback-blocker"
              value={form.blocker}
              onChange={(event) => update("blocker", event.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-black focus:ring-2 focus:ring-black/20"
            >
              {BLOCKER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="feedback-comments" className="text-sm font-medium">
            What changed — or what got in the way?
          </label>
          <textarea
            id="feedback-comments"
            value={form.comments}
            onChange={(event) => update("comments", event.target.value)}
            maxLength={1_000}
            rows={4}
            placeholder="A quick win, a missing step, or the moment you got stuck…"
            className="mt-2 w-full resize-y rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none placeholder:text-neutral-400 focus:border-black focus:ring-2 focus:ring-black/20"
          />
          <p className="mt-1 text-right text-xs text-neutral-400">
            {form.comments.length}/1,000
          </p>
        </div>

        <div className="rounded-2xl bg-neutral-50 p-5">
          <label htmlFor="feedback-email" className="text-sm font-medium">
            Email for a follow-up <span className="font-normal text-neutral-400">(optional)</span>
          </label>
          <input
            id="feedback-email"
            type="email"
            value={form.followUpEmail}
            onChange={(event) => update("followUpEmail", event.target.value)}
            maxLength={320}
            autoComplete="email"
            className="mt-2 min-h-11 w-full rounded-xl border border-neutral-200 bg-white px-4 text-sm outline-none focus:border-black focus:ring-2 focus:ring-black/20"
          />
          <label className="mt-3 flex cursor-pointer items-start gap-3 text-xs leading-relaxed text-neutral-500">
            <input
              type="checkbox"
              checked={form.followUpConsent}
              onChange={(event) => update("followUpConsent", event.target.checked)}
              className="mt-0.5 size-4 accent-black"
            />
            <span>
              I agree that Weekend MVP may email me once about this Starter Kit experience.
            </span>
          </label>
        </div>

        <div className="hidden" aria-hidden="true">
          <label htmlFor="feedback-website">Website</label>
          <input
            id="feedback-website"
            type="text"
            value={form.website}
            onChange={(event) => update("website", event.target.value)}
            autoComplete="off"
            tabIndex={-1}
          />
        </div>

        <div>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-black px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Sending…" : savedAt ? "Update feedback" : "Send feedback"}
          </button>
          {savedAt && !message && (
            <p className="mt-3 text-xs text-neutral-500">
              Feedback already sent. Update it as your build progresses.
            </p>
          )}
          <div aria-live="polite" aria-atomic="true" className="mt-4 min-h-6">
            {message && (
              <p className="flex items-start gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{message}</span>
              </p>
            )}
            {error && <p className="text-sm text-red-700">{error}</p>}
          </div>
        </div>
      </form>
    </section>
  );
}
