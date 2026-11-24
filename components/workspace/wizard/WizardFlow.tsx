"use client";

import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import Link from "next/link";
import { Logo } from "@/components/primitives/Logo";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type RefObject } from "react";
import { ErrorReporterMount } from "@/components/workspace/feedback/ErrorReporterMount";
import { FeedbackControl } from "@/components/workspace/feedback/FeedbackControl";
import { ReportingBoundary } from "@/components/workspace/feedback/ReportingBoundary";
import { reportClientError } from "@/components/workspace/feedback/clientErrors";
import { LoadingState } from "@/components/workspace/kit";
import { BTN_PRIMARY, FOCUS } from "@/components/workspace/kit/styles";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  WIZARD_LIMITS,
  WIZARD_STEPS,
  wizardAnswersProgressSchema,
  type WizardAnswersProgress,
  type WizardStep,
} from "@/lib/workspace/contracts/wizard";
import { trackWorkspaceEvent } from "@/lib/track";
import { stepAnswerOf } from "@/lib/workspace/wizard/defaults";
import { OWN_IDEA_FALLBACK_EXAMPLES, type OwnIdeaExample } from "@/lib/workspace/wizard/own-idea-examples";
import { workspacePath } from "@/lib/workspace/routes";
import { cn } from "@/lib/utils";
import { CreateBusiness } from "./CreateBusiness";
import { CrewPreview } from "./CrewPreview";
import { FounderSignals } from "./FounderSignals";
import { LiveMeetCofounder } from "./MeetCofounder";
import { OwnIdeaExamples } from "./OwnIdeaExamples";
import { WizardProgress, progressLabel } from "./WizardProgress";
import { WizardStepPanel } from "./WizardStepPanel";
import { Field, ScreenHead } from "./wizard-ui";

export type WizardFlowProps = {
  /** A library idea from `/start/[ideaSlug]`, or null for `/start/own`. */
  readonly idea: { readonly source: "library"; readonly ideaSlug: string } | null;
  readonly ideaTitle: string | null;
  /** `/start/own?session=…`, so a reload resumes an own-idea session. */
  readonly initialSessionId: string | null;
  /**
   * WP97: the "Try one of these" chips on `/start/own`, drawn per visit from the live library
   * (`own-idea-examples.server.ts`). Omitted, the static fallback lines show.
   */
  readonly ownIdeaExamples?: readonly OwnIdeaExample[];
};

const ERROR_COPY: Record<string, string> = {
  RATE_LIMITED: "You have started a lot of builds today. Try again tomorrow.",
  SESSION_COMPLETE: "This wizard is already finished.",
  INVALID_STEP: "This step has fixed choices. Pick one of them instead.",
  RESOURCE_NOT_FOUND: "We could not find this build. Start again from the idea page.",
  WORKSPACE_DISABLED: "Building is switched off right now. Try again later.",
  UNAUTHENTICATED: "Your session ended. Sign in again to carry on.",
  // WP74-S4 "Create my business" refusals.
  SESSION_INCOMPLETE: "Finish every step and accept the blueprint before you create your business.",
  EMAIL_NOT_VERIFIED: "Verify your email address first, then create your business.",
  DISPOSABLE_EMAIL:
    "We cannot create a business for a temporary email address. Sign in with an address you keep, then try again.",
  SLUG_UNAVAILABLE: "We could not find a free web address for this name. Choose a different name.",
  EMAIL_INVALID: "We could not read the domain of your email address. Sign in with a standard address, then try again.",
  NAME_RESERVED: "That name is kept for Weekend MVP's own addresses. Choose a different name.",
};

/** What the "Create my business" screen offers after a refusal, beyond the message. */
export type BusinessRefusal = { readonly chooseName: boolean; readonly existingBusinessHref: string | null };

/**
 * The follow-up for a `createBusiness` refusal: reopen the name step for a
 * reserved or unavailable name, or link to the founder's own business (the
 * server only ever sends the caller's own project id).
 */
export function businessRefusal(error: unknown): BusinessRefusal {
  const none: BusinessRefusal = { chooseName: false, existingBusinessHref: null };
  if (!(error instanceof ConvexError) || typeof error.data !== "object" || error.data === null || !("code" in error.data)) {
    return none;
  }
  const data: { code?: unknown; projectId?: unknown } = error.data;
  if (data.code === "NAME_RESERVED" || data.code === "SLUG_UNAVAILABLE") return { ...none, chooseName: true };
  if (data.code === "BUSINESS_LIMIT_REACHED" && typeof data.projectId === "string" && /^[a-z0-9]{1,64}$/.test(data.projectId)) {
    return { ...none, existingBusinessHref: workspacePath(data.projectId) };
  }
  return none;
}

/**
 * The `@convex-dev/rate-limiter` refusal (`{ kind: "RateLimited", retryAfter }`),
 * which `startOrResume` throws once the daily `wizardStart` allowance is used.
 * It carries no `code`, so it needs its own branch.
 */
function rateLimitedMessage(data: { kind?: unknown; retryAfter?: unknown }): string | null {
  if (data.kind !== "RateLimited") return null;
  const lead = "You have started a lot of builds today.";
  if (typeof data.retryAfter !== "number" || !Number.isFinite(data.retryAfter) || data.retryAfter <= 0) {
    return `${lead} Try again later.`;
  }
  const hours = Math.ceil(data.retryAfter / 3_600_000);
  if (hours <= 1) return `${lead} Try again in about an hour.`;
  return `${lead} Try again in about ${hours} hours.`;
}

/** A short, human message for a failed wizard call. */
export function wizardErrorMessage(error: unknown): string {
  if (error instanceof ConvexError && typeof error.data === "object" && error.data !== null) {
    const limited = rateLimitedMessage(error.data);
    if (limited !== null) return limited;
  }
  if (error instanceof ConvexError && typeof error.data === "object" && error.data !== null && "code" in error.data) {
    const data: { code?: unknown; message?: unknown } = error.data;
    if (data.code === "INVALID_ANSWER") {
      return typeof data.message === "string" ? `That answer cannot be saved (${data.message}).` : "That answer cannot be saved.";
    }
    if (data.code === "BUSINESS_LIMIT_REACHED") {
      const limit = "limit" in error.data && typeof error.data.limit === "number" ? error.data.limit : 1;
      return businessLimitCopy(limit);
    }
    if (typeof data.code === "string" && ERROR_COPY[data.code]) return ERROR_COPY[data.code];
  }
  return "Something went wrong. Try again.";
}

/** The line for a founder at the business allowance (same words as the "Create my business" refusal). */
export function businessLimitCopy(limit: number): string {
  return limit === 1
    ? "Your plan includes one business, and you already have it."
    : `Your plan includes ${limit} businesses, and you have used them all.`;
}

/**
 * L1 F6: a resumed session whose owner is already at the business allowance
 * says so as soon as it opens, instead of after all eight steps.
 */
function BusinessLimitNotice({
  limit,
  existingBusinessHref,
  headingRef,
}: {
  limit: number;
  existingBusinessHref: string | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const base = useId();
  return (
    <section aria-labelledby={`${base}-heading`} className="flex w-full max-w-[672px] flex-col gap-6">
      <ScreenHead
        headingId={`${base}-heading`}
        headingRef={headingRef}
        lead="Your plan is "
        italic="full"
        tail="."
        sub="Your answers here are saved, but this build can't become a new business on your plan."
      />
      <p role="status" className="rounded-lg border border-home-clay-ink/30 bg-home-clay px-4 py-3 text-sm text-home-clay-ink">
        {businessLimitCopy(limit)}
      </p>
      {existingBusinessHref ? (
        <p className="text-sm">
          <Link href={existingBusinessHref} className={cn("font-medium text-home-ink underline underline-offset-2", FOCUS)}>
            Open your business
          </Link>
        </p>
      ) : null}
    </section>
  );
}

/**
 * WP95-S4. A move forward is a finished step (never Back): `wizard_step_finished` with the step
 * left behind. Moving from "done" to the business is `business_created`. Enums only.
 */
function trackWizardMove(from: string, to: string, source: "library" | "own_idea" | undefined): void {
  const order = (position: string) =>
    position === "business" ? WIZARD_STEPS.length + 1 : position === "done" ? WIZARD_STEPS.length : WIZARD_STEPS.indexOf(position as WizardStep);
  if (order(to) <= order(from)) return;
  if (to === "business") {
    trackWorkspaceEvent({ name: "business_created", props: { source: source === "own_idea" ? "own_idea" : "library" } });
    return;
  }
  if (from !== "done") trackWorkspaceEvent({ name: "wizard_step_finished", props: { step: from } });
}

/** The own-idea route for a session; `?session=` makes a reload resume it. */
export function ownIdeaUrl(sessionId: string): string {
  return `/start/own?session=${encodeURIComponent(sessionId)}`;
}

/** The library route pinned to a session, so a reload after "Create my business" shows that business. */
export function libraryIdeaUrl(ideaSlug: string, sessionId: string): string {
  return `/start/${encodeURIComponent(ideaSlug)}?session=${encodeURIComponent(sessionId)}`;
}

function OwnIdeaStart({
  pending,
  error,
  headingRef,
  onStart,
  examples,
}: {
  pending: boolean;
  error: string | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onStart: (text: string) => void;
  /** Concrete example ideas, to lower the blank-page cost on the own path (WP97). */
  examples: readonly OwnIdeaExample[];
}) {
  const base = useId();
  const [text, setText] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const errorId = `${base}-error`;
  const shownError = localError ?? error;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      setLocalError("Write your idea in one sentence first.");
      return;
    }
    setLocalError(null);
    onStart(trimmed);
  }

  const fieldId = `${base}-idea`;
  // A tapped example fills the field and hands focus back to it, ready to edit.
  function applyExample(example: string) {
    setText(example);
    setLocalError(null);
    document.getElementById(fieldId)?.focus();
  }

  return (
    <form onSubmit={submit} noValidate className="flex w-full max-w-[600px] flex-col gap-6">
      <ScreenHead
        headingId={`${base}-heading`}
        headingRef={headingRef}
        lead="What are we "
        italic="building"
        tail="?"
        sub="One sentence is plenty. I'll suggest everything else."
      />
      <Field
        id={fieldId}
        label="Your idea in one sentence"
        hint={`Up to ${WIZARD_LIMITS.ownIdea} characters. Your own idea gets a light blueprint, marked "Not yet validated".`}
        value={text}
        onChange={setText}
        maxLength={WIZARD_LIMITS.ownIdea}
        errorId={errorId}
        invalid={shownError !== null}
        serif
      />
      <OwnIdeaExamples examples={examples} value={text} onApply={applyExample} />
      {shownError ? (
        <p id={errorId} role="alert" className="text-sm text-home-clay-ink">
          {shownError}
        </p>
      ) : null}
      <button type="submit" className={`${BTN_PRIMARY} min-h-[52px] w-full text-[15px]`} aria-disabled={pending || undefined}>
        Continue
      </button>
    </form>
  );
}

/**
 * The eight-step wizard as one client flow. Progress lives on the server
 * (`wizard_sessions`): every decision is a mutation and the view is a live
 * query, so a reload resumes where the founder left off.
 *
 * It renders the whole frame: the top bar (logo, "Save & exit" only when the
 * session can be resumed), the step bar, the step, and the Founder signals
 * aside. Each screen owns the page's single h1, and focus moves to it when the
 * step changes.
 */
function WizardFlowInner({ idea, ideaTitle, initialSessionId, ownIdeaExamples = OWN_IDEA_FALLBACK_EXAMPLES }: WizardFlowProps) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<Id<"wizard_sessions"> | null>(
    initialSessionId === null ? null : (initialSessionId as Id<"wizard_sessions">),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<BusinessRefusal | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const started = useRef(false);
  const movedToOwnUrl = useRef(false);
  const lastPosition = useRef<string | null>(null);

  const startOrResume = useMutation(api.workspace.wizard.startOrResume);
  const saveStep = useMutation(api.workspace.wizard.saveStep);
  const rewriteStep = useMutation(api.workspace.wizard.rewriteStep);
  const goBack = useMutation(api.workspace.wizard.goBack);
  const createBusiness = useMutation(api.workspace.business.createBusiness);
  const view = useQuery(api.workspace.wizard.getSession, sessionId === null ? "skip" : { sessionId });
  // The server stores only C-WIZARD-parsed answers; parsing again narrows the
  // storage type (which allows a null paid push) to the contract type.
  const parsed = useMemo<{ answers: WizardAnswersProgress; defaults: WizardAnswersProgress } | null>(
    () =>
      view === undefined
        ? null
        : {
            answers: wizardAnswersProgressSchema.parse(view.answers),
            defaults: wizardAnswersProgressSchema.parse(view.defaults),
          },
    [view],
  );

  // A library idea starts (or resumes) its session as soon as the page opens.
  useEffect(() => {
    if (idea === null || sessionId !== null || started.current) return;
    started.current = true;
    startOrResume({ idea })
      .then((id) => setSessionId(id))
      .catch((caught: unknown) => {
        reportClientError({ source: "action", error: caught });
        setRefusal(businessRefusal(caught));
        setError(wizardErrorMessage(caught));
      });
  }, [idea, sessionId, startOrResume]);

  // A library session rewritten as an own idea now belongs to `/start/own`:
  // move the URL there, carrying the session, so a reload resumes it instead
  // of starting a fresh library session for the old slug.
  const viewSource = view?.answers.idea?.source;
  const viewSessionId = view?.sessionId;
  useEffect(() => {
    if (idea === null || viewSource !== "own_idea" || viewSessionId === undefined || movedToOwnUrl.current) return;
    movedToOwnUrl.current = true;
    router.replace(ownIdeaUrl(viewSessionId), { scroll: false });
  }, [idea, viewSource, viewSessionId, router]);

  // Announce each step change and move focus to its h1.
  const position = view === undefined ? null : view.business !== null ? "business" : view.completed ? "done" : view.step;
  useEffect(() => {
    if (view === undefined || position === null) return;
    const label = view.business !== null
      ? "Business created. Meet your co-founder."
      : view.completed
        ? "All steps done. Create your business."
        : progressLabel(view.stepIndex);
    if (lastPosition.current !== null && lastPosition.current !== position) {
      setAnnouncement(label);
      headingRef.current?.focus();
      trackWizardMove(lastPosition.current, position, view.answers.idea?.source);
    }
    lastPosition.current = position;
  }, [position, view]);

  async function run(action: () => Promise<unknown>) {
    if (pending) return;
    setPending(true);
    setError(null);
    setRefusal(null);
    try {
      await action();
    } catch (caught) {
      reportClientError({ source: "action", error: caught });
      setError(wizardErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  async function startOwn(text: string) {
    await run(async () => {
      const id = await startOrResume({ idea: { source: "own_idea", text } });
      // The own-idea sentence is step 1; the session (and so the position tracking) starts after it.
      trackWorkspaceEvent({ name: "wizard_step_finished", props: { step: "idea" } });
      setSessionId(id);
      router.replace(ownIdeaUrl(id), { scroll: false });
    });
  }

  const title = view?.ideaTitle ?? ideaTitle;
  const currentIndex = view === undefined ? 0 : view.completed || view.business !== null ? WIZARD_STEPS.length : view.stepIndex;
  const businessExists = view !== undefined && view.business !== null;
  const ownIdea = view !== undefined ? view.answers.idea?.source === "own_idea" : idea === null;
  const ideaSlug = view?.answers.idea?.source === "library" ? view.answers.idea.ideaSlug : (idea?.ideaSlug ?? null);

  // Where the founder is, for feedback: the step name, or "done" before the business exists. A plain token.
  const wizardStepStates =
    view === undefined || view.business !== null ? [] : [{ key: "wizard_step", state: view.completed ? "done" : view.step }];

  // "Save & exit" only where the session can be resumed: a library idea resumes by its slug; an own idea
  // resumes by the `?session=` the URL carries once the first sentence started it.
  const saveExit =
    businessExists
      ? null
      : ownIdea
        ? sessionId !== null
          ? { href: "/ideas" }
          : null
        : ideaSlug !== null
          ? { href: `/ideas/${encodeURIComponent(ideaSlug)}` }
          : null;

  // `?? null`: a backend from before L1 F6 sends no field, which must read as no limit.
  const limitNotice = view === undefined || view.business !== null ? null : (view.businessLimit ?? null);
  const blocked = limitNotice !== null;
  const onStep = view !== undefined && !view.completed && view.business === null && !blocked;
  // The Founder-signals rail appears from step 2 — step 1 (idea) has nothing to show yet.
  const showAside =
    parsed !== null &&
    view !== undefined &&
    view.business === null &&
    !blocked &&
    (view.completed || view.stepIndex > 0);
  // WP90-S4: the crew preview shows once the blueprint is reviewed, while the founder answers the rest.
  const crewVisible = view !== undefined && (view.completed || view.stepIndex > WIZARD_STEPS.indexOf("blueprint"));
  let body;
  if (sessionId === null && idea === null) {
    body = (
      <OwnIdeaStart
        pending={pending}
        error={error}
        headingRef={headingRef}
        onStart={(text) => void startOwn(text)}
        examples={ownIdeaExamples}
      />
    );
  } else if (view === undefined || parsed === null) {
    body = (
      <>
        <h1 className="sr-only">{title === null ? "Build your idea" : `Build ${title}`}</h1>
        {error ? (
          <div className="flex flex-col gap-3">
            <p role="alert" className="rounded-lg border border-home-clay-ink/30 bg-home-clay px-4 py-3 text-sm text-home-clay-ink">
              {error}
            </p>
            {refusal?.existingBusinessHref ? (
              <p className="text-sm">
                <Link href={refusal.existingBusinessHref} className={cn("font-medium text-home-ink underline underline-offset-2", FOCUS)}>
                  Open your business
                </Link>
              </p>
            ) : null}
          </div>
        ) : (
          <LoadingState label="Opening your build…" />
        )}
      </>
    );
  } else if (view.business !== null) {
    body = (
      <LiveMeetCofounder
        answers={parsed.answers}
        business={view.business}
        ideaTitle={view.ideaTitle}
        headingRef={headingRef}
      />
    );
  } else if (limitNotice !== null) {
    body = (
      <BusinessLimitNotice
        limit={limitNotice.limit}
        existingBusinessHref={limitNotice.projectId === null ? null : workspacePath(limitNotice.projectId)}
        headingRef={headingRef}
      />
    );
  } else if (view.completed) {
    body = (
      <CreateBusiness
        answers={parsed.answers}
        pending={pending}
        error={error}
        headingRef={headingRef}
        existingBusinessHref={refusal?.existingBusinessHref ?? null}
        onChooseName={
          refusal?.chooseName
            ? () => void run(() => goBack({ sessionId: view.sessionId, step: view.step, to: "name" }))
            : null
        }
        onCreate={() =>
          void run(async () => {
            try {
              await createBusiness({ sessionId: view.sessionId });
            } catch (caught) {
              setRefusal(businessRefusal(caught));
              throw caught;
            }
            // Pin the URL to this session so a reload shows the business
            // instead of starting a new session for the idea.
            const pinned = idea === null || view.answers.idea?.source !== "library"
              ? ownIdeaUrl(view.sessionId)
              : libraryIdeaUrl(idea.ideaSlug, view.sessionId);
            router.replace(pinned, { scroll: false });
          })
        }
        onBack={() => void run(() => goBack({ sessionId: view.sessionId, step: view.step }))}
      />
    );
  } else {
    const step: WizardStep = view.step;
    const ids = { sessionId: view.sessionId, step };
    body = (
      <WizardStepPanel
        key={step}
        step={step}
        ideaTitle={view.ideaTitle}
        ideaSlug={ideaSlug}
        answers={parsed.answers}
        defaults={parsed.defaults}
        suggestedNames={view.suggestedNames}
        suggestedPartnerNames={view.suggestedPartnerNames}
        blueprint={view.blueprint}
        hints={view.hints}
        pending={pending}
        error={error}
        headingRef={headingRef}
        showResumeHint={ownIdea && sessionId !== null}
        onAccept={() => {
          const answer = stepAnswerOf(step, parsed.defaults);
          if (answer !== undefined) void run(() => saveStep({ ...ids, answer }));
        }}
        onChoose={(answer) => void run(() => saveStep({ ...ids, answer }))}
        onRewrite={(text) => void run(() => rewriteStep({ ...ids, text }))}
      />
    );
  }

  return (
    <>
      <header className="flex items-center justify-between gap-4 px-6 py-3">
        {/* The one brand wordmark (WP67-S6), not linked: leaving mid-wizard goes through "Save & exit". */}
        <Logo className="h-4 w-32 text-home-ink" />
        <div className="flex items-center gap-3">
          <FeedbackControl
            surface="wizard"
            variant="header"
            projectId={view?.business?.projectId}
            extraStates={wizardStepStates}
          />
          {saveExit ? (
            <Link
              href={saveExit.href}
              className={cn("inline-flex min-h-11 items-center text-[13px] text-home-ink-3 underline-offset-2 hover:underline", FOCUS)}
            >
              Save &amp; exit
            </Link>
          ) : null}
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className={cn(
          "mx-auto w-full px-6 pb-16 pt-2 focus:outline-none",
          businessExists ? "max-w-[1180px]" : "max-w-[1120px]",
        )}
      >
        <WizardProgress
          currentIndex={currentIndex}
          pending={pending}
          onBack={
            onStep && view.stepIndex > 0 ? () => void run(() => goBack({ sessionId: view.sessionId, step: view.step })) : null
          }
          finishedCaption={businessExists ? "Meet your co-founder" : undefined}
        />
        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>
        {showAside ? (
          <div className="mt-14 flex flex-wrap items-start gap-12">
            <div className="flex min-w-0 flex-[999_1_560px] justify-center">{body}</div>
            {crewVisible && view.crew !== null ? (
              <div className="flex max-w-[340px] flex-[1_1_280px] flex-col gap-6">
                <FounderSignals answers={parsed.answers} className="w-full" />
                <CrewPreview crew={view.crew} />
              </div>
            ) : (
              <FounderSignals answers={parsed.answers} />
            )}
          </div>
        ) : (
          <div className="mt-14 flex justify-center">{body}</div>
        )}
      </main>
    </>
  );
}

/**
 * The wizard, with the private error log wired in (WP95-S3): a render error is reported (class and
 * route only) and handed up, so `app/start/error.tsx` still shows its message.
 */
export function WizardFlow(props: WizardFlowProps) {
  return (
    <ReportingBoundary>
      <ErrorReporterMount />
      <WizardFlowInner {...props} />
    </ReportingBoundary>
  );
}
