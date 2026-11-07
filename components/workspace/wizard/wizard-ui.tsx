import { Check } from "lucide-react";
import type { ReactNode, Ref } from "react";
import { CHIP_SUGGESTED, FOCUS } from "@/components/workspace/kit/styles";
import { STEP_HEADS } from "@/lib/workspace/wizard/copy";
import type { WizardStep } from "@/lib/workspace/contracts/wizard";
import { cn } from "@/lib/utils";

/** The System "✓ Suggested" chip. The word is text; the tick is decoration. */
export function SuggestedChip({ children = "Suggested" }: { children?: ReactNode }) {
  return (
    <span className={CHIP_SUGGESTED}>
      <Check aria-hidden="true" className="size-3" />
      {children}
    </span>
  );
}

export const STEP_H1 =
  "font-editorial text-[34px] font-normal leading-[1.15] tracking-[-0.01em] text-home-ink focus:outline-none";

/** One step's h1 (the question, italic tail) and its sub line. Focus lands on the h1 when the step changes. */
export function StepHeadView({
  step,
  headingId,
  headingRef,
  children,
}: {
  step: WizardStep;
  headingId: string;
  headingRef?: Ref<HTMLHeadingElement>;
  children?: ReactNode;
}) {
  const head = STEP_HEADS[step];
  return (
    <div>
      <h1 id={headingId} ref={headingRef} tabIndex={-1} className={STEP_H1}>
        {head.before}
        <i>{head.italic}</i>
        {head.after}
      </h1>
      <p className="mt-2 text-base text-home-ink-2">{head.sub}</p>
      {children}
    </div>
  );
}

/** The h1 for the screens after step 8 (Create, Meet): the same style, any words. */
export function ScreenHead({
  headingId,
  headingRef,
  lead,
  italic,
  tail = "",
  sub,
  className,
}: {
  headingId: string;
  headingRef?: Ref<HTMLHeadingElement>;
  lead: string;
  italic: string;
  tail?: string;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <h1 id={headingId} ref={headingRef} tabIndex={-1} className={STEP_H1}>
        {lead}
        <i>{italic}</i>
        {tail}
      </h1>
      {sub ? <p className="mt-2 text-base text-home-ink-2">{sub}</p> : null}
    </div>
  );
}

const CARD_BASE =
  "group flex w-full cursor-pointer items-center gap-3.5 border border-home-rule bg-home-card text-home-ink has-[:checked]:border-home-ink has-[:checked]:bg-home-sunk has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-home-orange-ink";

/**
 * A radio (or checkbox) card. The native input is visually hidden but real,
 * so arrow keys, Space and labels all work; the card shows checked and focus
 * state. The checked state is also a filled dot, never colour alone.
 */
export function OptionCard({
  type = "radio",
  name,
  value,
  checked,
  onChange,
  label,
  hint,
  suggested = false,
  variant = "card",
}: {
  type?: "radio" | "checkbox";
  name?: string;
  value?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
  suggested?: boolean;
  /** `pill` is the compact radio used for the goal's deadline. */
  variant?: "card" | "pill";
}) {
  const indicator =
    type === "radio" ? (
      <span
        aria-hidden="true"
        className="flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-home-ink"
      >
        <span className="size-2.5 rounded-full bg-transparent group-has-[:checked]:bg-home-ink" />
      </span>
    ) : (
      <span
        aria-hidden="true"
        className="flex size-5 shrink-0 items-center justify-center rounded-md border-[1.5px] border-home-ink"
      >
        <Check className="size-3.5 text-transparent group-has-[:checked]:text-home-ink" />
      </span>
    );
  return (
    <label
      className={cn(
        CARD_BASE,
        variant === "pill"
          ? "min-h-11 w-auto rounded-full px-4 text-sm"
          : "min-h-16 rounded-[10px] px-4 py-3.5 text-[15px]",
      )}
    >
      <input
        type={type}
        name={name}
        value={value}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      {variant === "card" ? indicator : null}
      <span className={cn("flex flex-auto", variant === "card" ? "flex-col" : "items-center gap-2")}>
        <span className="font-medium">{label}</span>
        {hint ? <span className="text-sm text-home-ink-2">{hint}</span> : null}
      </span>
      {suggested ? <SuggestedChip /> : null}
    </label>
  );
}

export const TEXT_INPUT = `min-h-12 w-full rounded-lg border border-home-ink-3 bg-home-card px-3.5 text-base text-home-ink placeholder:text-home-ink-3 ${FOCUS}`;

/** A labelled single-line input with an optional hint, linked by id. */
export function Field({
  id,
  label,
  value,
  onChange,
  maxLength,
  placeholder,
  hint,
  errorId,
  invalid = false,
  className,
  serif = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  placeholder?: string;
  hint?: string;
  errorId?: string;
  invalid?: boolean;
  className?: string;
  serif?: boolean;
}) {
  const hintId = `${id}-hint`;
  const describedBy = [hint ? hintId : null, invalid && errorId ? errorId : null].filter(Boolean).join(" ");
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
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
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy || undefined}
        className={cn(TEXT_INPUT, serif && "font-editorial text-xl")}
      />
    </div>
  );
}
