"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { BTN_PRIMARY, BTN_SECONDARY, EYEBROW, FOCUS } from "@/components/workspace/kit/styles";
import { COMMERCIAL_MODELS, GOAL_KINDS, type CommercialModel, type GoalKind } from "@/lib/workspace/contracts/roster";
import {
  GOAL_TIMEFRAMES,
  PARTNER_NAME_PRESETS,
  PARTNER_PERSONALITIES,
  WIZARD_LIMITS,
  type GoalTimeframe,
  type PartnerNamePreset,
  type PartnerPersonality,
  type WizardAnswersProgress,
  type WizardStep,
} from "@/lib/workspace/contracts/wizard";
import {
  PARTNER_NAME_HINTS,
  PERSONA_SAMPLES,
  RENAME_RISK_BODY,
  RENAME_RISK_HEADLINE,
  WEB_ADDRESS_NOTE,
} from "@/lib/workspace/wizard/copy";
import {
  WIZARD_HINT_STEPS,
  stepAnswerOf,
  type WizardBlueprintPreview,
  type WizardHintStep,
  type WizardStepAnswer,
  type WizardStepHint,
  type WizardStepHints,
} from "@/lib/workspace/wizard/defaults";
import {
  COMMERCIAL_MODEL_OPTIONS,
  GOAL_KIND_OPTIONS,
  GOAL_TIMEFRAME_OPTIONS,
  PAID_PUSH_DAILY_USD,
  PARTNER_PERSONALITY_OPTIONS,
  PLATFORM_OPTIONS,
  STEP_TITLES,
} from "@/lib/workspace/wizard/labels";
import { NOT_VALIDATED_LABEL, NOT_VALIDATED_MEANING } from "@/lib/workspace/wizard/light-blueprint";
import { cn } from "@/lib/utils";
import { Field, OptionCard, StepHeadView, SuggestedChip } from "./wizard-ui";

export type WizardStepPanelProps = {
  readonly step: WizardStep;
  readonly ideaTitle: string;
  /** The library idea's slug, for "Read the research"; null for an own idea. */
  readonly ideaSlug?: string | null;
  readonly answers: WizardAnswersProgress;
  readonly defaults: WizardAnswersProgress;
  readonly suggestedNames: readonly string[];
  readonly blueprint: WizardBlueprintPreview;
  /** WP90-S4: why each suggestion was made; a confident one opens as a quick confirm. */
  readonly hints?: WizardStepHints;
  /** True while a step mutation is in flight: actions stay focusable but inert. */
  readonly pending: boolean;
  readonly error: string | null;
  readonly headingRef?: Ref<HTMLHeadingElement>;
  /** Own idea with a pinned session: tell the founder the answers save as they go. */
  readonly showResumeHint?: boolean;
  /** Use the suggested default. */
  readonly onAccept: () => void;
  /** Pick a different offered choice (or keep a previous answer). */
  readonly onChoose: (answer: WizardStepAnswer) => void;
  /** Answer in the founder's own words. */
  readonly onRewrite: (text: string) => void;
};

/** What the primary button does for the current selection. */
type Decision =
  | { readonly kind: "accept"; readonly label: string }
  | { readonly kind: "choose"; readonly label: string; readonly answer: WizardStepAnswer }
  | { readonly kind: "rewrite"; readonly label: string; readonly text: string }
  | { readonly kind: "missing"; readonly label: string; readonly message: string };

const USE_SUGGESTED = "Use suggested · Continue";
const LOOKS_RIGHT = "Looks right";
const CONTINUE = "Continue";
const PRIMARY = `${BTN_PRIMARY} min-h-[52px] w-full text-[15px]`;
const SECONDARY_WIDE = `${BTN_SECONDARY} min-h-12 w-full text-[15px]`;

/** Key-order independent equality for plain answer objects. */
function sameAnswer(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const left = Object.entries(a).filter(([, value]) => value !== undefined);
  const right = Object.entries(b).filter(([, value]) => value !== undefined);
  if (left.length !== right.length) return false;
  return left.every(([key, value]) => sameAnswer(value, (b as Record<string, unknown>)[key]));
}

/** The steps that may open as a quick confirm (one obvious answer, the full choice one click away). */
const QUICK_STEPS = ["platform", "commercial_model", "goal"] as const satisfies readonly WizardHintStep[];
type QuickStep = (typeof QUICK_STEPS)[number];

function isQuickStep(step: WizardStep): step is QuickStep {
  return (QUICK_STEPS as readonly string[]).includes(step);
}

function isHintStep(step: WizardStep): step is WizardHintStep {
  return (WIZARD_HINT_STEPS as readonly string[]).includes(step);
}

/** WP90-S4: the one-line reason a suggestion was made, from the idea's seed. */
function ReasonLine({ id, reason }: { id: string; reason: string }) {
  return (
    <p id={id} className="text-sm text-home-ink-2">
      <span className="font-medium text-home-ink">Why I suggest it: </span>
      {reason}
    </p>
  );
}

/** The suggested answer of a quick step, in words: a title and an optional detail line. */
function quickSummary(step: QuickStep, defaults: WizardAnswersProgress): { title: string; detail?: string } | null {
  switch (step) {
    case "platform": {
      const kind = defaults.platform?.kind;
      if (kind === undefined || kind === "custom") return null;
      return { title: PLATFORM_OPTIONS[kind].label, detail: PLATFORM_OPTIONS[kind].hint };
    }
    case "commercial_model": {
      const model = defaults.commercialModel;
      if (model === undefined) return null;
      return { title: COMMERCIAL_MODEL_OPTIONS[model].label, detail: COMMERCIAL_MODEL_OPTIONS[model].hint };
    }
    case "goal": {
      const goal = defaults.goal;
      if (goal === undefined || goal.paidPush !== undefined) return null;
      return { title: GOAL_KIND_OPTIONS[goal.kind].label, detail: GOAL_TIMEFRAME_OPTIONS[goal.timeframe].label };
    }
  }
}

/** The quick confirm card: the suggested answer, what it means, and why. */
function QuickConfirm({
  summary,
  reasonId,
  hint,
}: {
  summary: { title: string; detail?: string };
  reasonId: string;
  hint: WizardStepHint;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-home-rule bg-home-card px-[18px] py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={EYEBROW}>My suggestion</h2>
        <SuggestedChip>Suggested · from the idea page</SuggestedChip>
      </div>
      <p className="font-editorial text-xl leading-[1.45] text-home-ink">{summary.title}</p>
      {summary.detail ? <p className="text-sm text-home-ink-2">{summary.detail}</p> : null}
      <ReasonLine id={reasonId} reason={hint.reason} />
    </div>
  );
}

/**
 * The "Not yet validated" label for an own idea's light blueprint (D15), with
 * what it means in words, and an honest note when figures were left out or the
 * outline is the plain fallback. `id` lets the accept button reference it.
 */
function NotValidatedNote({ id, blueprint }: { id: string; blueprint: WizardBlueprintPreview }) {
  const removed = blueprint.removedClaims;
  return (
    <div id={id} className="flex flex-col gap-1.5">
      <p className="inline-flex w-fit items-center rounded-full border border-home-ochre-ink/40 bg-home-ochre px-2.5 py-0.5 text-[12px] font-medium text-home-ochre-ink">
        {NOT_VALIDATED_LABEL}
      </p>
      <p className="text-sm text-home-ink-2">{NOT_VALIDATED_MEANING}</p>
      {blueprint.origin === "own_fallback" ? (
        <p className="text-sm text-home-ink-2">
          We couldn&rsquo;t draft a blueprint from your idea, so this is a plain starting outline. You can still
          continue, or choose &ldquo;I&rsquo;d change some things&rdquo; to add notes.
        </p>
      ) : removed > 0 ? (
        <p className="text-sm text-home-ink-2">
          We left out {removed === 1 ? "one market figure" : `${removed} market figures`}: they would be guesses until
          the idea is researched.
        </p>
      ) : null}
    </div>
  );
}

/** The blueprint as a dashed card: what I'd build, who it is for, the one loop, what is left out. */
function BlueprintCard({
  blueprint,
  ideaTitle,
  isOwn,
  noteId,
}: {
  blueprint: WizardBlueprintPreview;
  ideaTitle: string;
  isOwn: boolean;
  noteId: string;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-[10px] border border-dashed border-home-d2 bg-home-card px-6 pb-5 pt-6">
      {!blueprint.validated ? <NotValidatedNote id={noteId} blueprint={blueprint} /> : null}
      <div className="flex flex-col gap-2">
        <h2 className="font-editorial text-2xl font-normal leading-tight text-home-ink">
          {isOwn ? "Your idea" : ideaTitle}
        </h2>
        <p className="text-base text-home-ink-2">{blueprint.pitch}</p>
      </div>
      <dl className="grid gap-2 text-sm text-home-ink-2">
        <div>
          <dt className="font-medium text-home-ink">Who it is for</dt>
          <dd>{blueprint.oneUser}</dd>
        </div>
        <div>
          <dt className="font-medium text-home-ink">The one loop</dt>
          <dd>{blueprint.oneLoop}</dd>
        </div>
      </dl>
      <div className="flex flex-col gap-2">
        <h3 className={EYEBROW}>What I&rsquo;d build</h3>
        <ul className="flex flex-col gap-1.5 text-sm text-home-ink">
          {blueprint.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <Plus aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-home-sky-ink" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>
      {blueprint.scopeCuts.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className={EYEBROW}>Left out on purpose</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-home-ink-2">
            {blueprint.scopeCuts.map((cut) => (
              <li key={cut}>{cut}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** The library idea: the picked idea, and where its research lives. */
function LibraryIdea({
  ideaTitle,
  ideaSlug,
  ownOpen,
  onToggleOwn,
  ownButtonRef,
}: {
  ideaTitle: string;
  ideaSlug: string | null;
  ownOpen: boolean;
  onToggleOwn: () => void;
  ownButtonRef: Ref<HTMLButtonElement>;
}) {
  return (
    <>
      <div className="flex flex-col gap-2 rounded-[10px] border border-home-rule bg-home-card px-[18px] py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className={EYEBROW}>Your idea</h2>
          <SuggestedChip>Suggested · from the idea you picked</SuggestedChip>
        </div>
        <p className="font-editorial text-xl leading-[1.45] text-home-ink">{ideaTitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-dashed border-home-orange bg-home-ember-soft px-4 py-3">
        <span className="font-mono text-[11px] font-medium tracking-[0.08em] text-home-orange-ink">FROM THE LIBRARY</span>
        <span className="min-w-60 flex-[1_1_240px] text-sm text-home-ink">
          <b className="font-semibold">{ideaTitle}</b>. Your co-founder starts from its research and its 4 build prompts.
        </span>
        {ideaSlug ? (
          <Link href={`/ideas/${encodeURIComponent(ideaSlug)}`} className={cn("text-sm text-home-orange-ink underline", FOCUS)}>
            Read the research
          </Link>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/ideas" className={cn(BTN_SECONDARY, "min-h-11 text-sm font-normal")}>
          Pick a different idea from the library
        </Link>
        <button
          ref={ownButtonRef}
          type="button"
          className={cn(BTN_SECONDARY, "min-h-11 text-sm font-normal")}
          aria-expanded={ownOpen}
          aria-controls="wizard-own-idea"
          onClick={onToggleOwn}
        >
          Write my own idea instead
        </button>
      </div>
    </>
  );
}

export function WizardStepPanel({
  step,
  ideaTitle,
  ideaSlug = null,
  answers,
  defaults,
  suggestedNames,
  blueprint,
  hints = {},
  pending,
  error,
  headingRef,
  showResumeHint = false,
  onAccept,
  onChoose,
  onRewrite,
}: WizardStepPanelProps) {
  const base = useId();
  const headingId = `${base}-heading`;
  const noteId = `${base}-not-validated`;
  const errorId = `${base}-error`;
  const textId = `${base}-text`;
  const reasonId = `${base}-reason`;
  const choiceId = `${base}-choice`;
  const current = { ...defaults, ...answers };

  // WP90-S4: a confident suggestion the founder has not changed opens as a quick confirm.
  const hint = isHintStep(step) ? hints[step] : undefined;
  const savedAnswer = stepAnswerOf(step, answers);
  const summary = isQuickStep(step) ? quickSummary(step, defaults) : null;
  const quickEligible =
    summary !== null &&
    hint?.confident === true &&
    (savedAnswer === undefined || sameAnswer(savedAnswer, stepAnswerOf(step, defaults)));
  const [choosing, setChoosing] = useState(!quickEligible);
  const quick = quickEligible && !choosing;
  const choiceRef = useRef<HTMLDivElement>(null);
  const focusChoice = useRef(false);
  useEffect(() => {
    if (!choosing || !focusChoice.current) return;
    focusChoice.current = false;
    // "Change" opened the full choice: focus lands on the selected option.
    const target = choiceRef.current?.querySelector<HTMLInputElement>("input:checked") ?? choiceRef.current?.querySelector<HTMLInputElement>("input");
    target?.focus();
  }, [choosing]);

  const ideaAnswer = answers.idea ?? defaults.idea;
  const isOwn = ideaAnswer?.source === "own_idea";

  const [localError, setLocalError] = useState<string | null>(null);
  const [ideaText, setIdeaText] = useState(ideaAnswer?.source === "own_idea" ? ideaAnswer.text : "");
  const [disclosure, setDisclosure] = useState(false);
  const [disclosureText, setDisclosureText] = useState("");
  const [platformKind, setPlatformKind] = useState<"native" | "web" | "custom">(current.platform?.kind ?? "web");
  const [platformText, setPlatformText] = useState(current.platform?.kind === "custom" ? current.platform.description : "");
  const [commercialModel, setCommercialModel] = useState<CommercialModel>(current.commercialModel ?? "free");
  const [goalKind, setGoalKind] = useState<GoalKind>(current.goal?.kind ?? "waitlist");
  const [timeframe, setTimeframe] = useState<GoalTimeframe>(current.goal?.timeframe ?? "weekend");
  const [paidPush, setPaidPush] = useState<boolean>(current.goal?.paidPush !== undefined);
  const savedName = answers.name?.chosen ?? defaults.name?.chosen ?? suggestedNames[0] ?? "";
  const savedNameIsListed = suggestedNames.includes(savedName);
  const [chosenName, setChosenName] = useState<string>(savedNameIsListed ? savedName : "");
  const [nameText, setNameText] = useState<string>(savedNameIsListed ? "" : savedName);
  const [personality, setPersonality] = useState<PartnerPersonality>(current.partnerPersonality ?? "strategist");
  const savedPartner = current.partnerName;
  const [partnerPreset, setPartnerPreset] = useState<PartnerNamePreset | "">(
    savedPartner === undefined ? "Wren" : savedPartner.kind === "preset" ? savedPartner.name : "",
  );
  const [partnerText, setPartnerText] = useState<string>(savedPartner?.kind === "custom" ? savedPartner.name : "");
  const toggleRef = useRef<HTMLButtonElement>(null);

  const defaultName = defaults.name?.chosen;
  const customName = nameText.trim();
  const customPartner = partnerText.trim();

  function decide(): Decision {
    if (quick) return { kind: "accept", label: LOOKS_RIGHT };
    switch (step) {
      case "idea": {
        if (isOwn) {
          const text = ideaText.trim();
          if (text.length === 0) return { kind: "missing", label: CONTINUE, message: "Write your idea in one sentence first." };
          const unchanged = defaults.idea?.source === "own_idea" && defaults.idea.text === text;
          return unchanged ? { kind: "accept", label: CONTINUE } : { kind: "rewrite", label: CONTINUE, text };
        }
        if (disclosure) {
          const text = disclosureText.trim();
          if (text.length === 0) return { kind: "missing", label: "Use my idea", message: "Write your idea in one sentence first." };
          return { kind: "rewrite", label: "Use my idea", text };
        }
        return { kind: "accept", label: "Use this idea · Continue" };
      }
      case "blueprint": {
        if (!disclosure) return { kind: "accept", label: "Looks good" };
        const text = disclosureText.trim();
        if (text.length === 0) return { kind: "missing", label: "Rework it", message: "Say what should change first." };
        return { kind: "rewrite", label: "Rework it", text };
      }
      case "platform": {
        if (platformKind === "custom") {
          const text = platformText.trim();
          if (text.length === 0) return { kind: "missing", label: CONTINUE, message: "Describe the platform first, or pick one of the choices." };
          return { kind: "rewrite", label: CONTINUE, text };
        }
        return defaults.platform?.kind === platformKind
          ? { kind: "accept", label: USE_SUGGESTED }
          : { kind: "choose", label: CONTINUE, answer: { kind: platformKind } };
      }
      case "commercial_model":
        return defaults.commercialModel === commercialModel
          ? { kind: "accept", label: USE_SUGGESTED }
          : { kind: "choose", label: CONTINUE, answer: commercialModel };
      case "goal": {
        const answer = {
          kind: goalKind,
          timeframe,
          ...(paidPush ? { paidPush: { dailyBudgetUsd: PAID_PUSH_DAILY_USD } } : {}),
        };
        return sameAnswer(answer, defaults.goal)
          ? { kind: "accept", label: USE_SUGGESTED }
          : { kind: "choose", label: CONTINUE, answer };
      }
      case "name": {
        if (customName.length > 0) return { kind: "rewrite", label: CONTINUE, text: customName };
        if (chosenName === "") return { kind: "missing", label: CONTINUE, message: "Pick a name or type your own." };
        return chosenName === defaultName
          ? { kind: "accept", label: USE_SUGGESTED }
          : {
              kind: "choose",
              label: CONTINUE,
              answer: { chosen: chosenName, alternatives: suggestedNames.filter((name) => name !== chosenName) },
            };
      }
      case "partner_personality":
        return defaults.partnerPersonality === personality
          ? { kind: "accept", label: USE_SUGGESTED }
          : { kind: "choose", label: CONTINUE, answer: personality };
      case "partner_name": {
        if (customPartner.length > 0) return { kind: "rewrite", label: CONTINUE, text: customPartner };
        if (partnerPreset === "") return { kind: "missing", label: CONTINUE, message: "Pick a name or type your own." };
        return defaults.partnerName?.kind === "preset" && defaults.partnerName.name === partnerPreset
          ? { kind: "accept", label: USE_SUGGESTED }
          : { kind: "choose", label: CONTINUE, answer: { kind: "preset", name: partnerPreset } };
      }
    }
  }

  const decision = decide();
  const invalid = localError !== null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (decision.kind === "missing") {
      setLocalError(decision.message);
      return;
    }
    setLocalError(null);
    if (decision.kind === "accept") onAccept();
    else if (decision.kind === "choose") onChoose(decision.answer);
    else onRewrite(decision.text);
  }

  /** Escape closes an open disclosure and hands focus back to the button that opened it. */
  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Escape" || !disclosure) return;
    event.stopPropagation();
    setDisclosure(false);
    setLocalError(null);
    toggleRef.current?.focus();
  }

  const group = `${base}-group`;
  const describeAccept =
    step === "blueprint" && !blueprint.validated ? noteId : hint !== undefined && step !== "blueprint" ? reasonId : undefined;
  const nameDiffers = customName.length > 0 || (defaultName !== undefined && chosenName !== defaultName);

  let body: ReactNode;
  switch (step) {
    case "idea":
      body = isOwn ? (
        <div className="flex flex-col gap-2 rounded-[10px] border border-home-rule bg-home-card px-[18px] py-4">
          <Field
            id={textId}
            label="Your idea in one sentence"
            hint={`Up to ${WIZARD_LIMITS.ownIdea} characters. Your own idea gets a light blueprint, marked "Not yet validated".`}
            value={ideaText}
            onChange={setIdeaText}
            maxLength={WIZARD_LIMITS.ownIdea}
            errorId={errorId}
            invalid={invalid}
            serif
          />
        </div>
      ) : (
        <>
          <LibraryIdea
            ideaTitle={ideaTitle}
            ideaSlug={ideaSlug}
            ownOpen={disclosure}
            onToggleOwn={() => {
              setDisclosure((open) => !open);
              setLocalError(null);
            }}
            ownButtonRef={toggleRef}
          />
          <div id="wizard-own-idea" hidden={!disclosure}>
            {disclosure ? (
              <Field
                id={textId}
                label="Your idea in one sentence"
                hint={`Up to ${WIZARD_LIMITS.ownIdea} characters. It gets a light blueprint, marked "Not yet validated".`}
                value={disclosureText}
                onChange={setDisclosureText}
                maxLength={WIZARD_LIMITS.ownIdea}
                errorId={errorId}
                invalid={invalid}
                serif
              />
            ) : null}
          </div>
        </>
      );
      break;
    case "blueprint":
      body = (
        <>
          <BlueprintCard blueprint={blueprint} ideaTitle={ideaTitle} isOwn={isOwn} noteId={noteId} />
          <div id={`${base}-rework`} hidden={!disclosure}>
            {disclosure ? (
              <div className="flex flex-col gap-1.5">
                <label htmlFor={textId} className="text-sm font-medium text-home-ink">
                  What should change?
                </label>
                <p id={`${textId}-hint`} className="text-[13px] text-home-ink-2">
                  Your notes go back with the blueprint. You can still choose &ldquo;Looks good&rdquo; afterwards.
                </p>
                <textarea
                  id={textId}
                  rows={3}
                  value={disclosureText}
                  maxLength={WIZARD_LIMITS.reworkNotes}
                  placeholder="e.g. Drop one feature, add another"
                  onChange={(event) => setDisclosureText(event.target.value.replace(/[\r\n]+/g, " "))}
                  onKeyDown={(event) => {
                    // Enter sends the notes (the notes are one line); Shift+Enter is ignored, not a line break.
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    if (!event.shiftKey) event.currentTarget.form?.requestSubmit();
                  }}
                  aria-invalid={invalid || undefined}
                  aria-describedby={`${textId}-hint${invalid ? ` ${errorId}` : ""}`}
                  className={`w-full rounded-lg border border-home-ink-3 bg-home-card px-3.5 py-3 text-base text-home-ink placeholder:text-home-ink-3 ${FOCUS}`}
                />
              </div>
            ) : null}
          </div>
        </>
      );
      break;
    case "platform":
      body = (
        <>
          <fieldset className="flex flex-col gap-2.5">
            <legend className="sr-only">{STEP_TITLES.platform}</legend>
            {(["web", "native", "custom"] as const).map((kind) => (
              <OptionCard
                key={kind}
                name={group}
                value={kind}
                checked={platformKind === kind}
                onChange={() => setPlatformKind(kind)}
                label={PLATFORM_OPTIONS[kind].label}
                hint={PLATFORM_OPTIONS[kind].hint}
                suggested={defaults.platform?.kind === kind}
              />
            ))}
          </fieldset>
          {platformKind === "custom" ? (
            <Field
              id={textId}
              label="Describe the platform"
              value={platformText}
              onChange={setPlatformText}
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
        <fieldset className="flex flex-col gap-2.5">
          <legend className="sr-only">{STEP_TITLES.commercial_model}</legend>
          {COMMERCIAL_MODELS.map((model) => (
            <OptionCard
              key={model}
              name={group}
              value={model}
              checked={commercialModel === model}
              onChange={() => setCommercialModel(model)}
              label={COMMERCIAL_MODEL_OPTIONS[model].label}
              hint={COMMERCIAL_MODEL_OPTIONS[model].hint}
              suggested={defaults.commercialModel === model}
            />
          ))}
        </fieldset>
      );
      break;
    case "goal":
      body = (
        <>
          <fieldset className="flex flex-col gap-2.5">
            <legend className="sr-only">{STEP_TITLES.goal}</legend>
            {GOAL_KINDS.map((kind) => (
              <OptionCard
                key={kind}
                name={`${group}-goal`}
                value={kind}
                checked={goalKind === kind}
                onChange={() => setGoalKind(kind)}
                label={GOAL_KIND_OPTIONS[kind].label}
                hint={GOAL_KIND_OPTIONS[kind].hint}
                suggested={defaults.goal?.kind === kind}
              />
            ))}
          </fieldset>
          <fieldset className="flex flex-col gap-2.5">
            <legend className="text-sm font-medium text-home-ink">
              By when? <span className="font-normal text-home-ink-2">(optional)</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {GOAL_TIMEFRAMES.map((value) => (
                <OptionCard
                  key={value}
                  variant="pill"
                  name={`${group}-when`}
                  value={value}
                  checked={timeframe === value}
                  onChange={() => setTimeframe(value)}
                  label={GOAL_TIMEFRAME_OPTIONS[value].label}
                  suggested={defaults.goal?.timeframe === value}
                />
              ))}
            </div>
          </fieldset>
          <OptionCard
            type="checkbox"
            checked={paidPush}
            onChange={setPaidPush}
            label={`Add a $${PAID_PUSH_DAILY_USD} a day paid test`}
            hint="Your own ad budget. Nothing runs without your approval."
          />
        </>
      );
      break;
    case "name":
      body = (
        <>
          <fieldset className="flex flex-col gap-2.5">
            <legend className="sr-only">{STEP_TITLES.name}</legend>
            {suggestedNames.map((name) => (
              <OptionCard
                key={name}
                name={group}
                value={name}
                checked={customName.length === 0 && chosenName === name}
                onChange={() => {
                  setChosenName(name);
                  setNameText("");
                }}
                label={name}
                hint={name === defaultName ? undefined : "Also suggested"}
                suggested={name === defaultName}
              />
            ))}
          </fieldset>
          <Field
            id={textId}
            label="Or type your own"
            value={nameText}
            onChange={setNameText}
            maxLength={WIZARD_LIMITS.businessName}
            placeholder="Name your business"
            errorId={errorId}
            invalid={invalid}
          />
          {nameDiffers ? (
            <div
              role="note"
              className="rounded-lg border border-home-orange-ink/30 bg-home-ember-soft px-4 py-3.5 text-[13px] text-home-ink-2"
            >
              <b className="font-semibold text-home-ink">{RENAME_RISK_HEADLINE}</b> {RENAME_RISK_BODY}
            </div>
          ) : (
            <p className="text-sm text-home-sage-ink">{WEB_ADDRESS_NOTE}</p>
          )}
        </>
      );
      break;
    case "partner_personality":
      body = (
        <>
          <fieldset className="flex flex-col gap-2.5">
            <legend className="sr-only">{STEP_TITLES.partner_personality}</legend>
            {PARTNER_PERSONALITIES.map((value) => (
              <OptionCard
                key={value}
                name={group}
                value={value}
                checked={personality === value}
                onChange={() => setPersonality(value)}
                label={PARTNER_PERSONALITY_OPTIONS[value].label}
                hint={PARTNER_PERSONALITY_OPTIONS[value].hint}
                suggested={defaults.partnerPersonality === value}
              />
            ))}
          </fieldset>
          <div className="flex flex-col gap-2 rounded-[10px] border border-home-rule bg-home-card px-[18px] py-4">
            <p className={EYEBROW}>How I&rsquo;ll sound · example</p>
            <p className="font-editorial text-[19px] italic leading-snug text-home-ink">{PERSONA_SAMPLES[personality]}</p>
          </div>
        </>
      );
      break;
    case "partner_name":
      body = (
        <>
          <fieldset className="flex flex-col gap-2.5">
            <legend className="sr-only">{STEP_TITLES.partner_name}</legend>
            {PARTNER_NAME_PRESETS.map((preset) => (
              <OptionCard
                key={preset}
                name={group}
                value={preset}
                checked={customPartner.length === 0 && partnerPreset === preset}
                onChange={() => {
                  setPartnerPreset(preset);
                  setPartnerText("");
                }}
                label={preset}
                hint={PARTNER_NAME_HINTS[preset]}
                suggested={defaults.partnerName?.kind === "preset" && defaults.partnerName.name === preset}
              />
            ))}
          </fieldset>
          <Field
            id={textId}
            label="Or type your own"
            value={partnerText}
            onChange={setPartnerText}
            maxLength={WIZARD_LIMITS.partnerName}
            placeholder="Your co-founder's name"
            errorId={errorId}
            invalid={invalid}
          />
        </>
      );
      break;
  }

  if (isHintStep(step) && hint !== undefined) {
    if (quick && summary !== null) {
      body = <QuickConfirm summary={summary} reasonId={reasonId} hint={hint} />;
    } else {
      body = (
        <div id={choiceId} ref={choiceRef} className="flex flex-col gap-6">
          <ReasonLine id={reasonId} reason={hint.reason} />
          {body}
        </div>
      );
    }
  }

  const primary = (
    <button
      type="submit"
      className={step === "blueprint" ? `${BTN_PRIMARY} min-h-12 w-full text-[15px]` : PRIMARY}
      aria-disabled={pending || undefined}
      aria-describedby={describeAccept}
    >
      {decision.label}
    </button>
  );

  return (
    <form
      onSubmit={submit}
      onKeyDown={onKeyDown}
      noValidate
      className="flex w-full max-w-[672px] flex-col gap-6"
    >
      <StepHeadView step={step} headingId={headingId} headingRef={headingRef}>
        {showResumeHint && step === "idea" ? (
          <p className="mt-2 text-[13px] text-home-ink-3">Your answers save as you go. Bookmark this page to come back.</p>
        ) : null}
      </StepHeadView>

      {body}

      <p role="status" aria-live="polite" className="sr-only">
        {pending ? "Saving…" : ""}
      </p>

      {localError ? (
        <p id={errorId} role="alert" className="text-sm text-home-clay-ink">
          {localError}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-lg border border-home-clay-ink/30 bg-home-clay px-4 py-3 text-sm text-home-clay-ink">
          {error}
        </p>
      ) : null}

      {step === "blueprint" ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {primary}
          <button
            ref={toggleRef}
            type="button"
            className={SECONDARY_WIDE}
            aria-expanded={disclosure}
            aria-controls={`${base}-rework`}
            onClick={() => {
              setDisclosure((open) => !open);
              setLocalError(null);
            }}
          >
            I&rsquo;d change some things
          </button>
        </div>
      ) : quick ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {primary}
          <button
            ref={toggleRef}
            type="button"
            className={SECONDARY_WIDE}
            onClick={() => {
              focusChoice.current = true;
              setChoosing(true);
            }}
          >
            Change
          </button>
        </div>
      ) : (
        primary
      )}
    </form>
  );
}
