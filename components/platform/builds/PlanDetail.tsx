"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { ArrowLeft, Check, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Component, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import {
  CORE_FEATURE_MAX,
  STAGES,
  normalizeLiveUrl,
  progress,
  type StageId,
  type StepKey,
} from "@/convex/platform/weekendSteps";
import { WhenConvexReady } from "@/components/platform/client-gates";
import { ModuleError, ModuleSkeleton } from "@/components/platform/home/module-states";
import { categoryName } from "@/components/ideas/idea-meta";
import { stagePrompts } from "@/lib/dashboard/weekend-prompts";
import { trackDashboardEvent } from "@/lib/track";
import { cn } from "@/lib/utils";
import { ExportPromptPack } from "@/components/platform/hub/ExportPromptPack";
import { PromptList } from "./PromptList";
import {
  BUILDS_PATH,
  STAGE_COPY,
  STAGE_STATUS_LABEL,
  completesStage,
  dayName,
  displayUrl,
  progressLine,
  shortDate,
  stageStatus,
} from "./plan-copy";
import { usePlanPrompts, type PromptsState } from "./usePlanPrompts";

type PlanData = FunctionReturnType<typeof api.platform.weekendPlans.get>;
type Plan = PlanData["plan"];

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";
const EYEBROW = "font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3";
const BUTTON = cn("inline-flex h-11 shrink-0 items-center gap-2 rounded-[9px] px-4 text-sm font-medium transition-colors", FOCUS);
const PRIMARY = cn(BUTTON, "bg-home-ink text-home-card hover:bg-home-panel disabled:cursor-wait disabled:opacity-60");
const SECONDARY = cn(
  BUTTON,
  "border border-home-rule bg-home-card text-home-ink hover:border-home-ink-3 disabled:cursor-wait disabled:opacity-60",
);
const QUIET = cn(BUTTON, "px-2.5 text-home-ink-2 hover:text-home-ink disabled:cursor-wait disabled:opacity-60");
const FIELD = cn(
  "h-11 w-full min-w-0 rounded-[9px] border border-home-rule bg-home-card px-3 text-[15px] text-home-ink placeholder:text-home-ink-3 aria-[invalid=true]:border-home-clay-ink",
  FOCUS,
);
const LINK = cn("font-medium text-home-orange-ink underline underline-offset-4 hover:text-home-ink", FOCUS);

function errorCode(error: unknown): string | null {
  if (!(error instanceof ConvexError)) return null;
  const data = error.data as { code?: unknown } | null;
  return typeof data?.code === "string" ? data.code : null;
}

/** The copy for a failed change. A plan closed in another tab says so. */
function failureMessage(error: unknown, fallback: string): string {
  if (errorCode(error) === "PLAN_NOT_ACTIVE") return "This plan is closed, so it can’t change.";
  console.error(fallback, error);
  return fallback;
}

function ExternalAnchor({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cn("inline-flex items-center gap-1.5", className)}>
      {children}
      <ExternalLink aria-hidden className="size-3.5 shrink-0" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

function CoreFeatureField({
  plan,
  editable,
  onMessage,
  onStepSaved,
}: {
  plan: Plan;
  editable: boolean;
  onMessage: (message: string) => void;
  onStepSaved: (key: StepKey) => void;
}) {
  const setCoreFeature = useMutation(api.platform.weekendPlans.setCoreFeature);
  const [text, setText] = useState(plan.coreFeature ?? "");
  const [saving, setSaving] = useState(false);
  const id = useId();

  if (!editable) {
    return (
      <p className="text-sm text-home-ink-2">
        <span className="font-medium text-home-ink">Core feature: </span>
        {plan.coreFeature ?? "Not written down."}
      </p>
    );
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await setCoreFeature({ planId: plan.planId, text });
      // Saving it checks "Write down the one core feature" on the server.
      if (text.trim()) onStepSaved("fri-scope");
      onMessage(text.trim() ? "Saved your core feature." : "Cleared your core feature.");
    } catch (error) {
      onMessage(failureMessage(error, "We could not save your core feature. Try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2">
      <label htmlFor={`${id}-input`} className="text-sm font-medium text-home-ink">
        Your one core feature
      </label>
      <p id={`${id}-hint`} className="text-[13px] text-home-ink-3">
        One line, up to {CORE_FEATURE_MAX} characters. For example: remind a client when an invoice is 7 days late.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={`${id}-input`}
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={CORE_FEATURE_MAX}
          aria-describedby={`${id}-hint`}
          autoComplete="off"
          className={FIELD}
        />
        <button type="submit" disabled={saving} className={SECONDARY}>
          Save
        </button>
      </div>
    </form>
  );
}

function LiveLinkField({
  plan,
  editable,
  onMessage,
  onStepSaved,
}: {
  plan: Plan;
  editable: boolean;
  onMessage: (message: string) => void;
  onStepSaved: (key: StepKey) => void;
}) {
  const setLiveUrl = useMutation(api.platform.weekendPlans.setLiveUrl);
  // The full link, scheme included, so saving it again never changes it.
  const [value, setValue] = useState(plan.liveUrl ?? "");
  const [invalid, setInvalid] = useState(false);
  const [saving, setSaving] = useState(false);
  const id = useId();

  async function save(event: FormEvent) {
    event.preventDefault();
    if (value.trim() !== "" && normalizeLiveUrl(value) === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setSaving(true);
    try {
      const result = await setLiveUrl({ planId: plan.planId, url: value });
      if (result.liveUrl) {
        setValue(result.liveUrl);
        // Saving it checks "Put it live and save the link" on the server.
        onStepSaved("sun-live");
      }
      onMessage(result.liveUrl ? "Saved your live link." : "Cleared your live link.");
    } catch (error) {
      if (errorCode(error) === "INVALID_LIVE_URL") setInvalid(true);
      else onMessage(failureMessage(error, "We could not save your live link. Try again."));
    } finally {
      setSaving(false);
    }
  }

  const open = plan.liveUrl && (
    <ExternalAnchor href={plan.liveUrl} className={cn("min-h-11 text-sm", LINK)}>
      Open {displayUrl(plan.liveUrl)}
    </ExternalAnchor>
  );

  if (!editable) {
    return open || <p className="text-sm text-home-ink-2">No live link saved.</p>;
  }

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-2">
      <label htmlFor={`${id}-input`} className="text-sm font-medium text-home-ink">
        Your live link
      </label>
      <p id={`${id}-hint`} className="text-[13px] text-home-ink-3">
        Where people can try it, for example myapp.vercel.app. It stays on your Builds page.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={`${id}-input`}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-error ${id}-hint` : `${id}-hint`}
          className={FIELD}
        />
        <button type="submit" disabled={saving} className={SECONDARY}>
          Save link
        </button>
      </div>
      {invalid && (
        <p id={`${id}-error`} className="text-sm text-home-clay-ink">
          Enter a web address, like myapp.vercel.app.
        </p>
      )}
      {open}
    </form>
  );
}

function ConfirmAction({
  trigger,
  question,
  confirm,
  onConfirm,
  triggerClassName,
}: {
  trigger: string;
  question: string;
  confirm: string;
  onConfirm: () => Promise<boolean>;
  triggerClassName: string;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  useEffect(() => {
    if (asking) confirmRef.current?.focus();
    else if (returnFocus.current) {
      returnFocus.current = false;
      triggerRef.current?.focus();
    }
  }, [asking]);

  if (!asking) {
    return (
      <button ref={triggerRef} type="button" onClick={() => setAsking(true)} className={triggerClassName}>
        {trigger}
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-home-rule bg-home-paper p-4">
      <p className="text-sm text-home-ink">{question}</p>
      <div className="flex flex-wrap gap-2">
        <button
          ref={confirmRef}
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const done = await onConfirm();
            if (!done) setBusy(false);
          }}
          className={PRIMARY}
        >
          {confirm}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            returnFocus.current = true;
            setAsking(false);
          }}
          className={QUIET}
        >
          Not yet
        </button>
      </div>
    </div>
  );
}

function StageExtras({
  stage,
  data,
  prompts,
  editable,
  onMessage,
  onStepSaved,
  onFinish,
}: {
  stage: StageId;
  data: PlanData;
  prompts: PromptsState;
  editable: boolean;
  onMessage: (message: string) => void;
  onStepSaved: (key: StepKey) => void;
  onFinish: () => Promise<boolean>;
}) {
  const { plan, idea } = data;
  const promptsHeading = (
    <h3 className={EYEBROW}>{stage === "sat" ? "Build prompts from the research" : "Launch prompts"}</h3>
  );
  switch (stage) {
    case "fri":
      return <CoreFeatureField plan={plan} editable={editable} onMessage={onMessage} onStepSaved={onStepSaved} />;
    case "sat":
      return (
        <div className="flex flex-col gap-2">
          {promptsHeading}
          <PromptList
            state={prompts}
            pick={(all) => stagePrompts(all).sat}
            empty="This idea has no build prompts yet. The research has the build notes."
            ideaSlug={idea.slug}
          />
        </div>
      );
    case "sun":
      return (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            {promptsHeading}
            <PromptList
              state={prompts}
              pick={(all) => stagePrompts(all).sun}
              empty="This idea has no landing page prompt. Ask your AI tool for a one-page site with a headline, three benefits and a waitlist form."
              ideaSlug={idea.slug}
            />
          </div>
          <LiveLinkField plan={plan} editable={editable} onMessage={onMessage} onStepSaved={onStepSaved} />
        </div>
      );
    case "mon":
      if (!editable) return null;
      return (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-home-ink-2">
            Done for this weekend? Finishing moves the plan to Builds with its live link and frees your plan slot.
          </p>
          <div>
            <ConfirmAction
              trigger="Finish this weekend"
              question={`Finish ${idea.title}? The plan can’t change after this.`}
              confirm="Yes, finish"
              onConfirm={onFinish}
              triggerClassName={PRIMARY}
            />
          </div>
        </div>
      );
  }
}

const STATUS_PILL: Record<"done" | "current" | "upcoming", string> = {
  done: "bg-home-sage text-home-sage-ink",
  current: "bg-home-ink text-home-card",
  upcoming: "border border-home-rule text-home-ink-3",
};

function Stages({
  data,
  prompts,
  editable,
  onToggle,
  onMessage,
  onStepSaved,
  onFinish,
}: {
  data: PlanData;
  prompts: PromptsState;
  editable: boolean;
  onToggle: (key: StepKey, done: boolean) => void;
  onMessage: (message: string) => void;
  onStepSaved: (key: StepKey) => void;
  onFinish: () => Promise<boolean>;
}) {
  const done = data.plan.doneKeys;
  return (
    <ol aria-label="Your weekend" className="flex flex-col gap-4">
      {STAGES.map((stage, index) => {
        const status = stageStatus(stage.id, done);
        const copy = STAGE_COPY[stage.id];
        const current = status === "current" && editable;
        return (
          <li key={stage.id}>
            <section
              aria-labelledby={`stage-${stage.id}`}
              className={cn(
                "flex flex-col gap-4 rounded-[14px] border bg-home-card p-5 sm:p-6",
                current ? "border-home-ink" : "border-home-rule",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className={EYEBROW}>
                  <span className="sr-only">Stage {index + 1} of {STAGES.length}: </span>
                  {dayName(stage.id)}
                  {copy.hours > 0 && ` · ${copy.hours} hrs`}
                </p>
                <span
                  className={cn(
                    "inline-flex h-6 items-center gap-1 rounded-full px-2 font-mono text-[10.5px] uppercase tracking-[0.08em]",
                    STATUS_PILL[status],
                  )}
                >
                  {status === "done" && <Check aria-hidden className="size-3" strokeWidth={2.5} />}
                  {STAGE_STATUS_LABEL[status]}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <h2
                  id={`stage-${stage.id}`}
                  className="font-editorial text-[24px] font-normal leading-[1.15] tracking-[-0.015em] text-home-ink"
                >
                  {copy.title}
                </h2>
                <p className="text-[15px] leading-[1.55] text-home-ink-2">{copy.body}</p>
              </div>
              <ul className="flex flex-col border-y border-home-rule">
                {stage.steps.map((step) => {
                  const checked = done.includes(step.key);
                  const label = (
                    <span
                      className={cn(
                        "text-[15px] leading-snug",
                        checked ? "text-home-ink-2 line-through decoration-home-ink-3" : "text-home-ink",
                      )}
                    >
                      {step.label}
                    </span>
                  );
                  return (
                    <li key={step.key} className="border-b border-home-rule last:border-b-0">
                      {editable ? (
                        <label className="flex min-h-12 cursor-pointer items-center gap-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => onToggle(step.key, event.target.checked)}
                            className={cn("size-[18px] shrink-0 accent-home-ink", FOCUS)}
                          />
                          {label}
                        </label>
                      ) : (
                        // A closed plan is a record: a plain mark, not a greyed-out control.
                        <div className="flex min-h-12 items-center gap-3 py-2.5">
                          <span
                            aria-hidden
                            className={cn(
                              "flex size-[18px] shrink-0 items-center justify-center rounded-[4px] border",
                              checked ? "border-home-ink bg-home-ink text-home-card" : "border-home-ink-3",
                            )}
                          >
                            {checked && <Check className="size-3" strokeWidth={3} />}
                          </span>
                          {label}
                          <span className="sr-only">{checked ? ", done" : ", not done"}</span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <StageExtras
                stage={stage.id}
                data={data}
                prompts={prompts}
                editable={editable}
                onMessage={onMessage}
                onStepSaved={onStepSaved}
                onFinish={onFinish}
              />
            </section>
          </li>
        );
      })}
    </ol>
  );
}

function Shipped({ plan, focusOnMount }: { plan: Plan; focusOnMount: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusOnMount) heading.current?.focus();
  }, [focusOnMount]);
  return (
    <section
      aria-labelledby="plan-shipped"
      className="flex flex-col gap-3 rounded-[14px] border border-home-ink bg-home-card p-5 sm:p-6"
    >
      <p className={EYEBROW}>Finished{plan.completedAt ? ` ${shortDate(plan.completedAt)}` : ""}</p>
      <h2
        id="plan-shipped"
        ref={heading}
        tabIndex={-1}
        className="font-editorial text-[28px] font-normal leading-[1.1] text-home-ink outline-none"
      >
        You shipped.
      </h2>
      {plan.liveUrl ? (
        <ExternalAnchor href={plan.liveUrl} className={cn("min-h-11 self-start text-[15px]", LINK)}>
          {displayUrl(plan.liveUrl)}
        </ExternalAnchor>
      ) : (
        <p className="text-sm text-home-ink-2">No live link saved for this one.</p>
      )}
      <div>
        <Link href="/dashboard/saved" className={PRIMARY}>
          Pick the next idea
        </Link>
      </div>
    </section>
  );
}

function LivePlan({ planId }: { planId: string }) {
  const data = useQuery(api.platform.weekendPlans.get, { planId });
  const prompts = usePlanPrompts(data?.idea.slug ?? null);
  const router = useRouter();
  const toggleStep = useMutation(api.platform.weekendPlans.toggleStep).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(api.platform.weekendPlans.get, { planId: args.planId });
    if (!current) return;
    const rest = current.plan.doneKeys.filter((key) => key !== args.key);
    store.setQuery(
      api.platform.weekendPlans.get,
      { planId: args.planId },
      { ...current, plan: { ...current.plan, doneKeys: args.done ? [...rest, args.key] : rest } },
    );
  });
  const finish = useMutation(api.platform.weekendPlans.finish);
  const archive = useMutation(api.platform.weekendPlans.archive);
  const [announcement, setAnnouncement] = useState("");
  const [justFinished, setJustFinished] = useState(false);

  if (data === undefined) return <ModuleSkeleton label="Loading your plan" className="h-[560px]" />;

  const { plan, idea } = data;
  const editable = plan.status === "active";
  const count = progress(plan.doneKeys);

  function stageDone(stage: StageId | null) {
    if (stage) trackDashboardEvent({ name: "weekend_step_completed", props: { step: stage } });
  }

  async function onToggle(key: StepKey, done: boolean) {
    const completes = done ? completesStage(plan.doneKeys, key) : null;
    const next = done ? [...plan.doneKeys, key] : plan.doneKeys.filter((k) => k !== key);
    try {
      await toggleStep({ planId: plan.planId, key, done });
      stageDone(completes);
      setAnnouncement(
        `${progressLine(progress(next))}.${completes ? ` ${dayName(completes)} done.` : ""}`,
      );
    } catch (error) {
      setAnnouncement(failureMessage(error, "We could not save that step. Try again."));
    }
  }

  async function onFinish() {
    try {
      await finish({ planId: plan.planId });
      setJustFinished(true);
      setAnnouncement(`Finished ${idea.title}.`);
      window.scrollTo({ top: 0 });
      return true;
    } catch (error) {
      setAnnouncement(failureMessage(error, "We could not finish the plan. Try again."));
      return false;
    }
  }

  async function onArchive() {
    try {
      await archive({ planId: plan.planId });
      router.push(BUILDS_PATH);
      return true;
    } catch (error) {
      setAnnouncement(failureMessage(error, "We could not archive the plan. Try again."));
      return false;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Link
          href={BUILDS_PATH}
          className={cn("inline-flex min-h-11 items-center gap-1.5 self-start text-sm text-home-ink-2 hover:text-home-ink", FOCUS)}
        >
          <ArrowLeft aria-hidden className="size-4" />
          All builds
        </Link>
        <p className={EYEBROW}>Weekend plan · {categoryName(idea.category)}</p>
        <h1 className="font-editorial text-[34px] font-normal leading-[1.05] tracking-[-0.025em] text-home-ink sm:text-[42px]">
          {idea.title}
        </h1>
        <div className="flex max-w-[520px] items-center gap-3">
          <div aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-home-sunk">
            <div
              className="h-full rounded-full bg-home-orange transition-[width] motion-reduce:transition-none"
              style={{ width: `${(count.done / count.total) * 100}%` }}
            />
          </div>
          <p className="shrink-0 font-mono text-[12px] text-home-ink-2">{progressLine(count)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <Link href={`/ideas/${idea.slug}`} className={cn("inline-flex min-h-11 items-center", LINK)}>
            Read the research
          </Link>
          {plan.status === "archived" && (
            <p className="text-home-ink-2">You archived this plan. It is read only.</p>
          )}
        </div>
        {/* WP44-S11: flag on only. Builder's Hub, with the sheet for Free members. */}
        <ExportPromptPack slug={idea.slug} title={idea.title} />
      </header>

      {plan.status === "done" && <Shipped plan={plan} focusOnMount={justFinished} />}

      <Stages
        data={data}
        prompts={prompts}
        editable={editable}
        onToggle={onToggle}
        onMessage={setAnnouncement}
        onStepSaved={(key) => stageDone(completesStage(plan.doneKeys, key))}
        onFinish={onFinish}
      />

      {editable && (
        <div className="flex flex-col gap-2 border-t border-home-rule pt-5">
          <div>
            <ConfirmAction
              trigger="Archive this plan"
              question={`Archive ${idea.title}? It leaves Builds and frees your plan slot. This can’t be undone.`}
              confirm="Yes, archive"
              onConfirm={onArchive}
              triggerClassName={QUIET}
            />
          </div>
        </div>
      )}

      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

function PlanNotFound() {
  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-home-rule bg-home-card p-5 sm:p-6">
      <h1 className="font-editorial text-[30px] font-normal leading-[1.1] text-home-ink">We can’t find that plan.</h1>
      <p className="text-[15px] text-home-ink-2">It may belong to another account, or the link is wrong.</p>
      <div>
        <Link href={BUILDS_PATH} className={PRIMARY}>
          Go to Builds
        </Link>
      </div>
    </div>
  );
}

/** Not found reads as not found. Anything else is a retryable module error. */
class PlanBoundary extends Component<{ children: ReactNode }, { error: unknown; attempt: number }> {
  state: { error: unknown; attempt: number } = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown) {
    if (errorCode(error) !== "RESOURCE_NOT_FOUND") console.error("Weekend plan failed to load", error);
  }

  render() {
    const { error, attempt } = this.state;
    if (error) {
      if (errorCode(error) === "RESOURCE_NOT_FOUND") return <PlanNotFound />;
      return (
        <ModuleError
          onRetry={() => this.setState((state) => ({ error: null, attempt: state.attempt + 1 }))}
        />
      );
    }
    return (
      <div key={attempt} className="contents">
        {this.props.children}
      </div>
    );
  }
}

/** Plan detail (PRD 6.3, FR-16 to FR-18). */
export function PlanDetail({ planId }: { planId: string }) {
  const skeleton = <ModuleSkeleton label="Loading your plan" className="h-[560px]" />;
  return (
    <WhenConvexReady fallback={skeleton} unavailable={<ModuleError />}>
      <PlanBoundary>
        <LivePlan planId={planId} />
      </PlanBoundary>
    </WhenConvexReady>
  );
}
