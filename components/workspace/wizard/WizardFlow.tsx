"use client";

import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type RefObject } from "react";
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
import { stepAnswerOf } from "@/lib/workspace/wizard/defaults";
import { workspacePath } from "@/lib/workspace/routes";
import { cn } from "@/lib/utils";
import { CreateBusiness } from "./CreateBusiness";
import { FounderSignals } from "./FounderSignals";
import { LiveMeetCofounder } from "./MeetCofounder";
import { WizardProgress, progressLabel } from "./WizardProgress";
import { WizardStepPanel } from "./WizardStepPanel";
import { Field, ScreenHead } from "./wizard-ui";

export type WizardFlowProps = {
  /** A library idea from `/start/[ideaSlug]`, or null for `/start/own`. */
  readonly idea: { readonly source: "library"; readonly ideaSlug: string } | null;
  readonly ideaTitle: string | null;
  /** `/start/own?session=…`, so a reload resumes an own-idea session. */
  readonly initialSessionId: string | null;
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

/** A short, human message for a failed wizard call. */
export function wizardErrorMessage(error: unknown): string {
  if (error instanceof ConvexError && typeof error.data === "object" && error.data !== null && "code" in error.data) {
    const data: { code?: unknown; message?: unknown } = error.data;
    if (data.code === "INVALID_ANSWER") {
      return typeof data.message === "string" ? `That answer cannot be saved (${data.message}).` : "That answer cannot be saved.";
    }
    if (data.code === "BUSINESS_LIMIT_REACHED") {
      const limit = "limit" in error.data && typeof error.data.limit === "number" ? error.data.limit : 1;
      return limit === 1
        ? "Your plan includes one business, and you already have it."
        : `Your plan includes ${limit} businesses, and you have used them all.`;
    }
    if (typeof data.code === "string" && ERROR_COPY[data.code]) return ERROR_COPY[data.code];
  }
  return "Something went wrong. Try again.";
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
}: {
  pending: boolean;
  error: string | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onStart: (text: string) => void;
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

  return (
    <form onSubmit={submit} noValidate className="flex w-full max-w-[672px] flex-col gap-6">
      <ScreenHead
        headingId={`${base}-heading`}
        headingRef={headingRef}
        lead="What are we "
        italic="building"
        tail="?"
        sub="One sentence is plenty. I'll suggest everything else."
      />
      <div className="rounded-[10px] border border-home-rule bg-home-card px-[18px] py-4">
        <Field
          id={`${base}-idea`}
          label="Your idea in one sentence"
          hint={`Up to ${WIZARD_LIMITS.ownIdea} characters. Your own idea gets a light blueprint, marked "Not yet validated".`}
          value={text}
          onChange={setText}
          maxLength={WIZARD_LIMITS.ownIdea}
          errorId={errorId}
          invalid={shownError !== null}
          serif
        />
      </div>
      {shownError ? (
        <p id={errorId} role="alert" className="text-sm text-home-clay-ink">
          {shownError}
        </p>
      ) : null}
      <button type="submit" className={`${BTN_PRIMARY} min-h-[52px] w-full text-[15px]`} aria-disabled={pending || undefined}>
        Start building
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
export function WizardFlow({ idea, ideaTitle, initialSessionId }: WizardFlowProps) {
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
      .catch((caught: unknown) => setError(wizardErrorMessage(caught)));
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
      setError(wizardErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  async function startOwn(text: string) {
    await run(async () => {
      const id = await startOrResume({ idea: { source: "own_idea", text } });
      setSessionId(id);
      router.replace(ownIdeaUrl(id), { scroll: false });
    });
  }

  const title = view?.ideaTitle ?? ideaTitle;
  const currentIndex = view === undefined ? 0 : view.completed || view.business !== null ? WIZARD_STEPS.length : view.stepIndex;
  const businessExists = view !== undefined && view.business !== null;
  const ownIdea = view !== undefined ? view.answers.idea?.source === "own_idea" : idea === null;
  const ideaSlug = view?.answers.idea?.source === "library" ? view.answers.idea.ideaSlug : (idea?.ideaSlug ?? null);

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

  const onStep = view !== undefined && !view.completed && view.business === null;
  const showAside = parsed !== null && view !== undefined && view.business === null;
  let body;
  if (sessionId === null && idea === null) {
    body = <OwnIdeaStart pending={pending} error={error} headingRef={headingRef} onStart={(text) => void startOwn(text)} />;
  } else if (view === undefined || parsed === null) {
    body = (
      <>
        <h1 className="sr-only">{title === null ? "Build your idea" : `Build ${title}`}</h1>
        {error ? (
          <p role="alert" className="rounded-lg border border-home-clay-ink/30 bg-home-clay px-4 py-3 text-sm text-home-clay-ink">
            {error}
          </p>
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
        blueprint={view.blueprint}
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
        <div role="img" aria-label="Weekend MVP" className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex size-6 items-center justify-center rounded-[5px] bg-home-ink font-editorial text-[15px] italic text-home-card"
          >
            W
          </span>
          <span aria-hidden="true" className="font-editorial text-lg text-home-ink">
            Weekend <i>MVP</i>
          </span>
        </div>
        {saveExit ? (
          <Link
            href={saveExit.href}
            className={cn("inline-flex min-h-11 items-center text-[13px] text-home-ink-3 underline-offset-2 hover:underline", FOCUS)}
          >
            Save &amp; exit
          </Link>
        ) : null}
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
            <FounderSignals answers={parsed.answers} />
          </div>
        ) : (
          <div className={cn("mt-14", sessionId === null && idea === null ? "flex justify-center" : "")}>{body}</div>
        )}
      </main>
    </>
  );
}
