"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  hasMeaningfulDraftInput,
  reconcileDraftState,
  reconcileInitialSave,
  serializeDraftInput,
  type DraftInput,
} from "./draftState";
import {
  DraftMessage,
  IntakeProgress,
  ResumeNotice,
  SaveStatus,
} from "./IntakeFeedback";

type BriefInput = DraftInput;

type FieldName = keyof BriefInput;
type FieldErrors = Partial<Record<FieldName, string>>;

const EMPTY_INPUT: BriefInput = {
  title: "",
  problem: "",
  audience: "",
  outcome: "",
  constraints: "",
};

const FIELD_COPY: Array<{
  name: FieldName;
  label: string;
  prompt: string;
  placeholder: string;
  multiline?: boolean;
}> = [
  {
    name: "title",
    label: "Working title",
    prompt: "A short name is enough. You can change it while the brief is a draft.",
    placeholder: "Customer interview planner",
  },
  {
    name: "problem",
    label: "Problem to solve",
    prompt: "Describe the recurring problem, not the feature you already have in mind.",
    placeholder: "Solo founders struggle to run consistent interviews and keep the evidence useful…",
    multiline: true,
  },
  {
    name: "audience",
    label: "Who feels it most?",
    prompt: "Name the narrowest group you can realistically reach first.",
    placeholder: "Indie founders preparing to validate a B2B product",
    multiline: true,
  },
  {
    name: "outcome",
    label: "Useful first outcome",
    prompt: "What should a customer be able to do when the first version works?",
    placeholder: "Run a repeatable interview plan and keep the evidence in one place.",
    multiline: true,
  },
  {
    name: "constraints",
    label: "Constraints or context",
    prompt: "Optional. Include timing, existing tools, or boundaries we should respect.",
    placeholder: "Keep the first version focused on one founder and one active idea.",
    multiline: true,
  },
];

function validate(input: BriefInput): FieldErrors {
  const errors: FieldErrors = {};
  if (input.title.trim().length < 3) errors.title = "Use at least 3 characters.";
  if (input.problem.trim().length < 20)
    errors.problem = "Give us at least 20 characters of problem context.";
  if (input.audience.trim().length < 3)
    errors.audience = "Name the first audience for this idea.";
  if (input.outcome.trim().length < 10)
    errors.outcome = "Describe a concrete outcome in at least 10 characters.";
  if (input.title.trim().length > 120) errors.title = "Keep the title under 120 characters.";
  if (input.problem.trim().length > 2_000) errors.problem = "Keep this under 2,000 characters.";
  if (input.audience.trim().length > 500) errors.audience = "Keep this under 500 characters.";
  if (input.outcome.trim().length > 1_500) errors.outcome = "Keep this under 1,500 characters.";
  if (input.constraints.trim().length > 1_500)
    errors.constraints = "Keep this under 1,500 characters.";
  return errors;
}

function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("INITIAL_DRAFT_CONFLICT"))
    return "This draft was started in another tab. Your text is preserved here; copy it before refreshing.";
  if (message.includes("STALE_BRIEF_WRITE"))
    return "This draft changed in another tab. Refresh before saving again.";
  if (message.includes("RESOURCE_NOT_FOUND"))
    return "This draft is no longer available. Return to projects and choose another.";
  if (message.includes("INVALID_BRIEF_FIELD"))
    return "One or more answers need attention. Your entries are still here.";
  return "We could not save that change. Your entries are still here; try again.";
}

const INTAKE_STORAGE_KEY = "weekendmvp:own-idea-intake";
const INTAKE_KEY_EVENT = "weekendmvp:intake-key-changed";

function subscribeIntakeKey(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(INTAKE_KEY_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(INTAKE_KEY_EVENT, onStoreChange);
  };
}

function readIntakeKey(): string | null {
  return window.localStorage.getItem(INTAKE_STORAGE_KEY);
}

function intakeKey(): string {
  const existing = readIntakeKey();
  if (existing) return existing;
  const next = crypto.randomUUID();
  window.localStorage.setItem(INTAKE_STORAGE_KEY, next);
  window.dispatchEvent(new Event(INTAKE_KEY_EVENT));
  return next;
}

export function OwnIdeaIntake({ projectId }: { projectId?: string }) {
  const router = useRouter();
  const storedIntakeKey = useSyncExternalStore(
    subscribeIntakeKey,
    readIntakeKey,
    () => null,
  );
  const directProject = useQuery(
    api.platform.projects.getOwned,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip",
  );
  const resumable = useQuery(
    api.platform.intake.getOwnIdeaDraftByKey,
    !projectId && storedIntakeKey
      ? { idempotencyKey: storedIntakeKey }
      : "skip",
  );
  const startOwnIdea = useMutation(api.platform.intake.startOwnIdea);
  const saveDraft = useMutation(api.platform.intake.saveDraft);
  const confirmBrief = useMutation(api.platform.intake.confirmBrief);

  const sourceDraft = useMemo(
    () =>
      projectId
        ? directProject?.project.source === "own_idea"
          ? directProject.currentDraft
            ? {
                projectId: directProject.project.projectId,
                revision: directProject.currentDraft.revision,
                updatedAt: directProject.currentDraft.updatedAt,
                input: directProject.currentDraft.input,
              }
            : null
          : null
        : resumable,
    [directProject, projectId, resumable],
  );
  const loading = projectId
    ? directProject === undefined
    : storedIntakeKey !== null && resumable === undefined;

  const [input, setInput] = useState<BriefInput>(EMPTY_INPUT);
  const inputRef = useRef<BriefInput>(EMPTY_INPUT);
  const activeProjectIdRef = useRef<Id<"projects"> | null>(null);
  const revisionRef = useRef<bigint | null>(null);
  const updatedAtRef = useRef<number | null>(null);
  const hydratedRef = useRef<string | null>(null);
  const initialSavePendingRef = useRef(false);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const lastSavedRef = useRef("");
  const conflictRef = useRef(false);
  const [step, setStep] = useState<"shape" | "review">("shape");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!sourceDraft) return;
    // The mutation response carries the authoritative winner payload. Let it
    // reconcile first so a reactive exact-key query cannot replace local text
    // while the initial create/retry is in flight.
    if (initialSavePendingRef.current) return;
    const identity = `${sourceDraft.projectId}:${sourceDraft.revision}`;
    if (
      hydratedRef.current === null &&
      activeProjectIdRef.current === sourceDraft.projectId &&
      revisionRef.current === sourceDraft.revision &&
      updatedAtRef.current !== null
    ) {
      // The exact-key query may arrive after the first autosave mutation. Do
      // not replace newer keystrokes captured while that mutation was pending.
      hydratedRef.current = identity;
      return;
    }
    if (hydratedRef.current === identity) {
      if (updatedAtRef.current === null) return;
      const reconciliation = reconcileDraftState({
        localInput: inputRef.current,
        lastSavedSerialized: lastSavedRef.current,
        localUpdatedAt: updatedAtRef.current,
        serverInput: sourceDraft.input,
        serverUpdatedAt: sourceDraft.updatedAt,
      });
      if (reconciliation.kind === "hydrate") {
        inputRef.current = reconciliation.input;
        setInput(reconciliation.input);
        updatedAtRef.current = reconciliation.updatedAt;
        lastSavedRef.current = reconciliation.serialized;
        conflictRef.current = false;
        setStatus("saved");
        setMessage("");
      } else if (reconciliation.kind === "conflict") {
        conflictRef.current = true;
        setStatus("error");
        setMessage(
          "This draft changed in another tab. Your text is preserved here; copy it before refreshing.",
        );
      }
      return;
    }
    hydratedRef.current = identity;
    activeProjectIdRef.current = sourceDraft.projectId;
    revisionRef.current = sourceDraft.revision;
    updatedAtRef.current = sourceDraft.updatedAt;
    const serverSerialized = serializeDraftInput(sourceDraft.input);
    if (
      lastSavedRef.current === "" &&
      hasMeaningfulDraftInput(inputRef.current)
    ) {
      // A shared key may become resumable after this tab has already started
      // typing. Preserve that local text and require an explicit refresh
      // rather than silently adopting or overwriting the other tab's draft.
      lastSavedRef.current = serverSerialized;
      conflictRef.current = true;
      setStatus("error");
      setMessage(
        "This draft was started in another tab. Your text is preserved here; copy it before refreshing.",
      );
      return;
    }
    inputRef.current = sourceDraft.input;
    setInput(sourceDraft.input);
    lastSavedRef.current = serverSerialized;
    conflictRef.current = false;
    setStatus("saved");
    setMessage("");
  }, [sourceDraft]);

  const serialized = useMemo(() => serializeDraftInput(input), [input]);

  function enqueueSave(nextInput: BriefInput): Promise<void> {
    if (!hasMeaningfulDraftInput(nextInput)) return Promise.resolve();
    const nextSerialized = serializeDraftInput(nextInput);
    if (nextSerialized === lastSavedRef.current) return saveChainRef.current;
    const performSave = async () => {
      if (nextSerialized === lastSavedRef.current) return;
      if (conflictRef.current) {
        throw new Error("STALE_BRIEF_WRITE");
      }
      setStatus("saving");
      setMessage("");
      try {
        if (
          !activeProjectIdRef.current ||
          revisionRef.current === null ||
          updatedAtRef.current === null
        ) {
          initialSavePendingRef.current = true;
          let created;
          try {
            created = await startOwnIdea({
              idempotencyKey: intakeKey(),
              input: nextInput,
            });
          } finally {
            initialSavePendingRef.current = false;
          }
          activeProjectIdRef.current = created.projectId;
          revisionRef.current = created.revision;
          updatedAtRef.current = created.updatedAt;
          hydratedRef.current = `${created.projectId}:${created.revision}`;
          const reconciliation = reconcileInitialSave({
            attemptedInput: nextInput,
            currentInput: inputRef.current,
            serverInput: created.input,
            acceptedInput: created.acceptedInput,
          });
          lastSavedRef.current = reconciliation.serialized;
          if (reconciliation.kind === "saved") {
            inputRef.current = reconciliation.input;
            setInput(reconciliation.input);
            conflictRef.current = false;
            setStatus("saved");
          } else if (reconciliation.kind === "dirty") {
            conflictRef.current = false;
            setStatus("idle");
          } else {
            conflictRef.current = true;
            throw new Error("INITIAL_DRAFT_CONFLICT");
          }
          return;
        }
        const result = await saveDraft({
          projectId: activeProjectIdRef.current,
          revision: revisionRef.current,
          expectedUpdatedAt: updatedAtRef.current!,
          input: nextInput,
        });
        updatedAtRef.current = result.updatedAt;
        lastSavedRef.current = nextSerialized;
        conflictRef.current = false;
        setStatus("saved");
      } catch (error) {
        setStatus("error");
        setMessage(friendlyError(error));
        throw error;
      }
    };
    saveChainRef.current = saveChainRef.current.then(performSave, performSave);
    return saveChainRef.current;
  }

  useEffect(() => {
    if (
      !hasMeaningfulDraftInput(input) ||
      serialized === lastSavedRef.current
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      void enqueueSave(input).catch(() => undefined);
    }, 800);
    return () => window.clearTimeout(timer);
    // `enqueueSave` intentionally reads the current server timestamp from a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, serialized]);

  useEffect(() => {
    if (step === "review") headingRef.current?.focus();
  }, [step]);

  function updateField(name: FieldName, value: string) {
    setInput((current) => {
      const next = { ...current, [name]: value };
      inputRef.current = next;
      return next;
    });
    setErrors((current) => ({ ...current, [name]: undefined }));
  }

  async function continueToReview() {
    const nextErrors = validate(input);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      const first = FIELD_COPY.find(({ name }) => nextErrors[name]);
      document.getElementById(first?.name ?? "title")?.focus();
      return;
    }
    setMessage("");
    try {
      await enqueueSave(input);
    } catch (error) {
      setStatus("error");
      setMessage(friendlyError(error));
      return;
    }
    setStep("review");
  }

  async function confirm() {
    setConfirming(true);
    setMessage("");
    try {
      await enqueueSave(input);
      if (!activeProjectIdRef.current || revisionRef.current === null) {
        throw new Error("RESOURCE_NOT_FOUND");
      }
      await confirmBrief({
        projectId: activeProjectIdRef.current,
        revision: revisionRef.current,
      });
      window.localStorage.removeItem(INTAKE_STORAGE_KEY);
      window.dispatchEvent(new Event(INTAKE_KEY_EVENT));
      router.push(`/dashboard/projects/${activeProjectIdRef.current}`);
    } catch (error) {
      setMessage(friendlyError(error));
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <div aria-label="Loading your draft" className="space-y-5 animate-pulse">
        <div className="h-8 w-56 rounded-md bg-white/10" />
        <div className="h-24 rounded-xl bg-white/5" />
        <div className="h-24 rounded-xl bg-white/5" />
      </div>
    );
  }

  if (
    projectId &&
    (!directProject ||
      directProject.project.source !== "own_idea" ||
      !directProject.currentDraft)
  ) {
    return (
      <DraftUnavailable
        onBack={() => router.push("/dashboard/projects")}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <IntakeProgress step={step} />

      {step === "shape" ? (
        <>
          <div className="border-b border-white/10 pb-7">
            <h1 className="text-3xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-4xl">
              Bring your own idea
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-400">
              Give us the problem, audience, and useful first outcome. We will keep this as a private draft until you review and confirm it.
            </p>
            {sourceDraft ? (
              <ResumeNotice />
            ) : null}
          </div>

          <form
            className="mt-8 space-y-8"
            onSubmit={(event) => {
              event.preventDefault();
              void continueToReview();
            }}
            noValidate
          >
            {FIELD_COPY.map(({ name, label, prompt, placeholder, multiline }) => {
              const error = errors[name];
              const describedBy = `${name}-hint${error ? ` ${name}-error` : ""}`;
              return (
                <div key={name} className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-8">
                  <div>
                    <Label htmlFor={name} className="text-sm font-medium text-zinc-100">
                      {label}
                    </Label>
                    <p id={`${name}-hint`} className="mt-1.5 text-sm leading-5 text-zinc-400">
                      {prompt}
                    </p>
                  </div>
                  <div>
                    {multiline ? (
                      <textarea
                        id={name}
                        value={input[name]}
                        onChange={(event) => updateField(name, event.target.value)}
                        placeholder={placeholder}
                        rows={name === "problem" ? 5 : 3}
                        aria-describedby={describedBy}
                        aria-invalid={Boolean(error)}
                        className="min-h-24 w-full resize-y rounded-lg border border-input bg-white/[0.035] px-3 py-2.5 text-sm leading-6 text-zinc-100 outline-none transition-colors placeholder:text-zinc-400 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 aria-invalid:border-red-500"
                      />
                    ) : (
                      <Input
                        id={name}
                        value={input[name]}
                        onChange={(event) => updateField(name, event.target.value)}
                        placeholder={placeholder}
                        aria-describedby={describedBy}
                        aria-invalid={Boolean(error)}
                        className="h-11 bg-white/[0.035] placeholder:text-zinc-400"
                      />
                    )}
                    {error ? (
                      <p id={`${name}-error`} className="mt-2 text-sm text-red-300">
                        {error}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}

            <div className="flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <SaveStatus status={status} />
              <Button type="submit" size="lg" disabled={status === "saving"}>
                Review brief
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </form>
        </>
      ) : (
        <section aria-labelledby="brief-review-heading">
          <div className="border-b border-white/10 pb-7">
            <h1
              id="brief-review-heading"
              ref={headingRef}
              tabIndex={-1}
              className="text-3xl font-semibold tracking-[-0.03em] text-zinc-50 outline-none sm:text-4xl"
            >
              Confirm the brief
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-400">
              Check the evidence we should work from. Confirmation freezes this revision; future edits create a new one.
            </p>
          </div>
          <dl className="divide-y divide-white/10">
            {FIELD_COPY.map(({ name, label }) => (
              <div key={name} className="grid gap-2 py-5 sm:grid-cols-[minmax(0,12rem)_1fr] sm:gap-8">
                <dt className="text-sm text-zinc-400">{label}</dt>
                <dd className="whitespace-pre-wrap text-sm leading-6 text-zinc-200">
                  {input[name] || "Not provided"}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" onClick={() => setStep("shape")} disabled={confirming}>
              <ArrowLeft aria-hidden="true" />
              Edit answers
            </Button>
            <Button size="lg" onClick={() => void confirm()} disabled={confirming}>
              {confirming ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Check aria-hidden="true" />}
              {confirming ? "Confirming…" : "Confirm this revision"}
            </Button>
          </div>
        </section>
      )}

      <DraftMessage message={message} />
    </div>
  );
}

export function DraftUnavailable({ onBack }: { onBack: () => void }) {
  return (
    <div className="max-w-xl rounded-xl border border-white/10 bg-white/[0.025] p-6">
      <h1 className="text-xl font-semibold text-zinc-100">Draft unavailable</h1>
      <p className="mt-2 max-w-[65ch] text-sm leading-6 text-zinc-400">
        This own-idea draft could not be opened. It may already be confirmed or unavailable to this account.
      </p>
      <Button className="mt-5" onClick={onBack}>
        Back to projects
      </Button>
    </div>
  );
}
