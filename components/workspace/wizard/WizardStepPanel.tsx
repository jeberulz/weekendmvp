"use client";

import { ArrowLeft, Check, PencilLine, SkipForward } from "lucide-react";
import { useId, useState, type FormEvent, type ReactNode, type Ref } from "react";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, EYEBROW, FOCUS } from "@/components/workspace/kit/styles";
import {
  GOAL_KINDS,
  COMMERCIAL_MODELS,
  type CommercialModel,
  type GoalKind,
} from "@/lib/workspace/contracts/roster";
import {
  GOAL_TIMEFRAMES,
  PARTNER_NAME_PRESETS,
  PARTNER_PERSONALITIES,
  WIZARD_LIMITS,
  WIZARD_STEPS,
  type GoalTimeframe,
  type PartnerNamePreset,
  type PartnerPersonality,
  type WizardAnswersProgress,
  type WizardStep,
} from "@/lib/workspace/contracts/wizard";
import {
  stepAnswerOf,
  type WizardBlueprintPreview,
  type WizardStepAnswer,
} from "@/lib/workspace/wizard/defaults";
import {
  COMMERCIAL_MODEL_OPTIONS,
  GOAL_KIND_OPTIONS,
  GOAL_TIMEFRAME_OPTIONS,
  PAID_PUSH_DAILY_USD,
  PARTNER_PERSONALITY_OPTIONS,
  PLATFORM_OPTIONS,
  STEP_QUESTIONS,
  STEP_TITLES,
  summarizeStep,
} from "@/lib/workspace/wizard/labels";
import { cn } from "@/lib/utils";

export type WizardStepPanelProps = {
  readonly step: WizardStep;
  readonly ideaTitle: string;
  readonly answers: WizardAnswersProgress;
  readonly defaults: WizardAnswersProgress;
  readonly suggestedNames: readonly string[];
  readonly blueprint: WizardBlueprintPreview;
  /** True while a step mutation is in flight: actions stay focusable but inert. */
  readonly pending: boolean;
  readonly error: string | null;
  readonly headingRef?: Ref<HTMLHeadingElement>;
  /** Use the suggested default. */
  readonly onAccept: () => void;
  /** Pick a different offered choice (or keep a previous answer). */
  readonly onChoose: (answer: WizardStepAnswer) => void;
  /** Answer in the founder's own words. */
  readonly onRewrite: (text: string) => void;
  readonly onSkip: () => void;
  readonly onBack: () => void;
};

const RADIO_ROW =
  "flex cursor-pointer items-start gap-3 rounded-lg border border-home-rule bg-home-card px-3 py-2.5 text-sm has-[:checked]:border-home-ink has-[:checked]:bg-home-sunk";
const RADIO = `mt-0.5 size-4 shrink-0 accent-home-ink ${FOCUS}`;
const INPUT = `w-full rounded-lg border border-home-d3 bg-home-card px-3 py-2 text-sm text-home-ink placeholder:text-home-ink-3 ${FOCUS}`;
const LEGEND = "mb-2 text-sm font-medium text-home-ink";

const ACCEPT_LABELS = {
  idea: "Build this idea",
  blueprint: "Looks good",
  platform: "Use this platform",
  commercial_model: "Use this model",
  goal: "Use this goal",
  name: "Use this name",
  partner_personality: "Use this personality",
  partner_name: "Use this name",
} as const satisfies Record<WizardStep, string>;

const REWRITE_LABELS = {
  idea: "Rewrite the idea",
  blueprint: "Rework it",
  platform: "Rewrite",
  commercial_model: "Rewrite",
  goal: "Rewrite",
  name: "Rewrite",
  partner_personality: "Rewrite",
  partner_name: "Rewrite",
} as const satisfies Record<WizardStep, string>;

function Guarded({
  pending,
  onClick,
  className,
  children,
  ariaExpanded,
  ariaControls,
}: {
  pending: boolean;
  onClick: () => void;
  className: string;
  children: ReactNode;
  ariaExpanded?: boolean;
  ariaControls?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      aria-disabled={pending || undefined}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      onClick={() => {
        if (!pending) onClick();
      }}
    >
      {children}
    </button>
  );
}

function Suggestion({
  step,
  defaults,
  blueprint,
  ideaTitle,
}: {
  step: WizardStep;
  defaults: WizardAnswersProgress;
  blueprint: WizardBlueprintPreview;
  ideaTitle: string;
}) {
  if (step === "blueprint") {
    return (
      <div className="flex flex-col gap-3">
        {!blueprint.validated ? (
          <p className="inline-flex w-fit items-center rounded-full border border-home-ochre-ink/40 bg-home-ochre px-2.5 py-0.5 text-[12px] font-medium text-home-ochre-ink">
            Not yet validated
          </p>
        ) : null}
        <p className="font-editorial text-[20px] leading-snug text-home-ink">{blueprint.pitch}</p>
        <dl className="grid gap-2 text-sm text-home-ink-2">
          <div>
            <dt className="font-medium text-home-ink">The one user</dt>
            <dd>{blueprint.oneUser}</dd>
          </div>
          <div>
            <dt className="font-medium text-home-ink">The one loop</dt>
            <dd>{blueprint.oneLoop}</dd>
          </div>
        </dl>
        <h4 className="text-sm font-medium text-home-ink">Core features</h4>
        <ul className="list-disc space-y-1 pl-5 text-sm text-home-ink-2">
          {blueprint.features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
        {blueprint.scopeCuts.length > 0 ? (
          <>
            <h4 className="text-sm font-medium text-home-ink">Left out of the weekend</h4>
            <ul className="list-disc space-y-1 pl-5 text-sm text-home-ink-2">
              {blueprint.scopeCuts.map((cut) => (
                <li key={cut}>{cut}</li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    );
  }
  const summary = summarizeStep(step, defaults) ?? "";
  const hint =
    step === "platform" && defaults.platform
      ? PLATFORM_OPTIONS[defaults.platform.kind].hint
      : step === "commercial_model" && defaults.commercialModel
        ? COMMERCIAL_MODEL_OPTIONS[defaults.commercialModel].hint
        : step === "partner_personality" && defaults.partnerPersonality
          ? PARTNER_PERSONALITY_OPTIONS[defaults.partnerPersonality].hint
          : null;
  const shown =
    step === "idea" ? (defaults.idea?.source === "own_idea" ? defaults.idea.text : ideaTitle) : summary;
  return (
    <div className="flex flex-col gap-1">
      <p className="font-editorial text-[22px] leading-snug text-home-ink">{shown}</p>
      {hint ? <p className="text-sm text-home-ink-2">{hint}</p> : null}
      {step === "name" && defaults.name && defaults.name.alternatives.length > 0 ? (
        <p className="text-sm text-home-ink-2">Also suggested: {defaults.name.alternatives.join(", ")}</p>
      ) : null}
    </div>
  );
}

function RadioGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: readonly { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className={LEGEND}>{legend}</legend>
      <div className="grid gap-2">
        {options.map((option) => (
          <label key={option.value} className={RADIO_ROW}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className={RADIO}
            />
            <span className="flex flex-col">
              <span className="font-medium text-home-ink">{option.label}</span>
              {option.hint ? <span className="text-home-ink-2">{option.hint}</span> : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  maxLength,
  errorId,
  invalid,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  errorId: string;
  invalid: boolean;
  hint?: string;
}) {
  const hintId = `${id}-hint`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-home-ink">
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="text-[13px] text-home-ink-2">
          {hint}
        </p>
      ) : null}
      <input
        id={id}
        type="text"
        value={value}
        maxLength={maxLength}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={invalid || undefined}
        aria-describedby={[hint ? hintId : null, invalid ? errorId : null].filter(Boolean).join(" ") || undefined}
        className={INPUT}
      />
    </div>
  );
}

type EditorProps = {
  step: WizardStep;
  answers: WizardAnswersProgress;
  defaults: WizardAnswersProgress;
  suggestedNames: readonly string[];
  pending: boolean;
  onChoose: (answer: WizardStepAnswer) => void;
  onRewrite: (text: string) => void;
};

/** The Rewrite editor: own words where C-WIZARD has a free-text field, otherwise the fixed choices. */
function Editor({ step, answers, defaults, suggestedNames, pending, onChoose, onRewrite }: EditorProps) {
  const base = useId();
  const textId = `${base}-text`;
  const errorId = `${base}-error`;
  const current = { ...defaults, ...answers };
  const [text, setText] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [platformKind, setPlatformKind] = useState<"native" | "web" | "custom">(current.platform?.kind ?? "web");
  const [commercialModel, setCommercialModel] = useState<CommercialModel>(current.commercialModel ?? "free");
  const [goalKind, setGoalKind] = useState<GoalKind>(current.goal?.kind ?? "waitlist");
  const [timeframe, setTimeframe] = useState<GoalTimeframe>(current.goal?.timeframe ?? "weekend");
  const [paidPush, setPaidPush] = useState<boolean>(current.goal?.paidPush !== undefined);
  const [personality, setPersonality] = useState<PartnerPersonality>(current.partnerPersonality ?? "strategist");
  const [chosenName, setChosenName] = useState<string>(current.name?.chosen ?? suggestedNames[0] ?? "");
  const [partnerPreset, setPartnerPreset] = useState<PartnerNamePreset | "custom">(
    current.partnerName?.kind === "preset" ? current.partnerName.name : current.partnerName ? "custom" : "Wren",
  );

  function requireText(): string | null {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      setLocalError("Write something first, or pick one of the choices.");
      return null;
    }
    return trimmed;
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setLocalError(null);
    switch (step) {
      case "idea":
      case "blueprint": {
        const value = requireText();
        if (value !== null) onRewrite(value);
        return;
      }
      case "platform": {
        if (platformKind === "custom") {
          const value = requireText();
          if (value !== null) onRewrite(value);
        } else {
          onChoose({ kind: platformKind });
        }
        return;
      }
      case "commercial_model":
        onChoose(commercialModel);
        return;
      case "goal":
        onChoose({
          kind: goalKind,
          timeframe,
          ...(paidPush ? { paidPush: { dailyBudgetUsd: PAID_PUSH_DAILY_USD } } : {}),
        });
        return;
      case "name": {
        if (text.trim().length > 0) {
          onRewrite(text.trim());
        } else {
          onChoose({ chosen: chosenName, alternatives: suggestedNames.filter((name) => name !== chosenName) });
        }
        return;
      }
      case "partner_personality":
        onChoose(personality);
        return;
      case "partner_name": {
        if (partnerPreset === "custom") {
          const value = requireText();
          if (value !== null) onRewrite(value);
        } else {
          onChoose({ kind: "preset", name: partnerPreset });
        }
        return;
      }
    }
  }

  const invalid = localError !== null;
  let body: ReactNode = null;
  switch (step) {
    case "idea":
      body = (
        <TextField
          id={textId}
          label="Your idea in one sentence"
          value={text}
          onChange={setText}
          maxLength={WIZARD_LIMITS.ownIdea}
          errorId={errorId}
          invalid={invalid}
          hint={`Up to ${WIZARD_LIMITS.ownIdea} characters. It gets a light blueprint, marked "Not yet validated".`}
        />
      );
      break;
    case "blueprint":
      body = (
        <TextField
          id={textId}
          label="What should change?"
          value={text}
          onChange={setText}
          maxLength={WIZARD_LIMITS.reworkNotes}
          errorId={errorId}
          invalid={invalid}
          hint="Your notes go back with the blueprint. You can still choose Looks good afterwards."
        />
      );
      break;
    case "platform":
      body = (
        <>
          <RadioGroup
            legend="Platform"
            name={`${base}-platform`}
            value={platformKind}
            onChange={setPlatformKind}
            options={(["web", "native", "custom"] as const).map((kind) => ({ value: kind, ...PLATFORM_OPTIONS[kind] }))}
          />
          {platformKind === "custom" ? (
            <TextField
              id={textId}
              label="Describe the platform"
              value={text}
              onChange={setText}
              maxLength={WIZARD_LIMITS.customPlatform}
              errorId={errorId}
              invalid={invalid}
            />
          ) : null}
        </>
      );
      break;
    case "commercial_model":
      body = (
        <RadioGroup
          legend="Commercial model"
          name={`${base}-model`}
          value={commercialModel}
          onChange={setCommercialModel}
          options={COMMERCIAL_MODELS.map((model) => ({ value: model, ...COMMERCIAL_MODEL_OPTIONS[model] }))}
        />
      );
      break;
    case "goal":
      body = (
        <>
          <RadioGroup
            legend="Goal"
            name={`${base}-goal`}
            value={goalKind}
            onChange={setGoalKind}
            options={GOAL_KINDS.map((kind) => ({ value: kind, ...GOAL_KIND_OPTIONS[kind] }))}
          />
          <RadioGroup
            legend="By when"
            name={`${base}-timeframe`}
            value={timeframe}
            onChange={setTimeframe}
            options={GOAL_TIMEFRAMES.map((value) => ({ value, ...GOAL_TIMEFRAME_OPTIONS[value] }))}
          />
          <label className="flex items-start gap-3 text-sm text-home-ink">
            <input
              type="checkbox"
              checked={paidPush}
              onChange={(event) => setPaidPush(event.target.checked)}
              className={RADIO}
            />
            <span>
              Add a ${PAID_PUSH_DAILY_USD} a day paid test
              <span className="block text-home-ink-2">Your own ad budget. Nothing runs without your approval.</span>
            </span>
          </label>
        </>
      );
      break;
    case "name":
      body = (
        <>
          {suggestedNames.length > 1 ? (
            <RadioGroup
              legend="Suggested names"
              name={`${base}-name`}
              value={chosenName}
              onChange={setChosenName}
              options={suggestedNames.map((name) => ({ value: name, label: name }))}
            />
          ) : null}
          <TextField
            id={textId}
            label="Or write your own name"
            value={text}
            onChange={setText}
            maxLength={WIZARD_LIMITS.businessName}
            errorId={errorId}
            invalid={invalid}
            hint={`Up to ${WIZARD_LIMITS.businessName} characters. Leave empty to use the choice above.`}
          />
        </>
      );
      break;
    case "partner_personality":
      body = (
        <RadioGroup
          legend="Partner personality"
          name={`${base}-personality`}
          value={personality}
          onChange={setPersonality}
          options={PARTNER_PERSONALITIES.map((value) => ({ value, ...PARTNER_PERSONALITY_OPTIONS[value] }))}
        />
      );
      break;
    case "partner_name":
      body = (
        <>
          <RadioGroup
            legend="Partner name"
            name={`${base}-partner`}
            value={partnerPreset}
            onChange={setPartnerPreset}
            options={[
              ...PARTNER_NAME_PRESETS.map((value) => ({ value, label: value })),
              { value: "custom" as const, label: "Another name" },
            ]}
          />
          {partnerPreset === "custom" ? (
            <TextField
              id={textId}
              label="Your co-founder's name"
              value={text}
              onChange={setText}
              maxLength={WIZARD_LIMITS.partnerName}
              errorId={errorId}
              invalid={invalid}
            />
          ) : null}
        </>
      );
      break;
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {body}
      {localError ? (
        <p id={errorId} role="alert" className="text-sm text-home-clay-ink">
          {localError}
        </p>
      ) : null}
      <div>
        <button type="submit" className={BTN_SECONDARY} aria-disabled={pending || undefined}>
          Save my answer
        </button>
      </div>
    </form>
  );
}

export function WizardStepPanel({
  step,
  ideaTitle,
  answers,
  defaults,
  suggestedNames,
  blueprint,
  pending,
  error,
  headingRef,
  onAccept,
  onChoose,
  onRewrite,
  onSkip,
  onBack,
}: WizardStepPanelProps) {
  const base = useId();
  const headingId = `${base}-heading`;
  const editorId = `${base}-editor`;
  const [editing, setEditing] = useState(false);
  const index = WIZARD_STEPS.indexOf(step);
  const current = stepAnswerOf(step, answers);
  const suggested = stepAnswerOf(step, defaults);
  const differs = current !== undefined && JSON.stringify(current) !== JSON.stringify(suggested);
  const currentSummary = differs ? summarizeStep(step, answers) : undefined;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className={EYEBROW}>{STEP_TITLES[step]}</p>
        <h2
          id={headingId}
          ref={headingRef}
          tabIndex={-1}
          className="font-editorial text-[28px] leading-tight tracking-[-0.015em] text-home-ink focus:outline-none sm:text-[32px]"
        >
          {STEP_QUESTIONS[step]}
        </h2>
      </div>

      <div className={cn(CARD, "flex flex-col gap-4 p-5")}>
        <h3 className={EYEBROW}>Suggested</h3>
        <Suggestion step={step} defaults={defaults} blueprint={blueprint} ideaTitle={ideaTitle} />
        <div className="flex flex-wrap gap-2">
          <Guarded pending={pending} onClick={onAccept} className={BTN_PRIMARY}>
            <Check aria-hidden="true" className="size-4" />
            {ACCEPT_LABELS[step]}
          </Guarded>
        </div>
      </div>

      {currentSummary !== undefined && current !== undefined ? (
        <div className={cn(CARD, "flex flex-col gap-3 p-5")}>
          <h3 className={EYEBROW}>Your answer</h3>
          <p className="text-sm text-home-ink">{currentSummary}</p>
          <div>
            <Guarded pending={pending} onClick={() => onChoose(current)} className={BTN_SECONDARY}>
              Keep my answer
            </Guarded>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        <div>
          <Guarded
            pending={false}
            onClick={() => setEditing((open) => !open)}
            className={BTN_SECONDARY}
            ariaExpanded={editing}
            ariaControls={editorId}
          >
            <PencilLine aria-hidden="true" className="size-4" />
            {REWRITE_LABELS[step]}
          </Guarded>
        </div>
        <div id={editorId} hidden={!editing} className={cn(CARD, "p-5")}>
          {editing ? (
            <Editor
              step={step}
              answers={answers}
              defaults={defaults}
              suggestedNames={suggestedNames}
              pending={pending}
              onChoose={onChoose}
              onRewrite={onRewrite}
            />
          ) : null}
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-home-clay-ink/30 bg-home-clay px-4 py-3 text-sm text-home-clay-ink">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-home-rule pt-4">
        {index > 0 ? (
          <Guarded pending={pending} onClick={onBack} className={BTN_SECONDARY}>
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back
          </Guarded>
        ) : (
          <span />
        )}
        <Guarded pending={pending} onClick={onSkip} className={BTN_SECONDARY}>
          Skip for now
          <SkipForward aria-hidden="true" className="size-4" />
          <span className="sr-only"> (uses the suggestion)</span>
        </Guarded>
      </div>
    </section>
  );
}
