"use client";

import { useMutation } from "convex/react";
import { ArrowRight } from "lucide-react";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import {
  GOAL_LABEL,
  HOURS_LABEL,
  SETUP_GOALS,
  SETUP_HOURS,
  SETUP_TOOLS,
  toolLabel,
  type SetupGoal,
  type SetupHours,
  type SetupTool,
} from "@/convex/platform/setupOptions";
import { trackDashboardEvent } from "@/lib/track";
import { cn } from "@/lib/utils";

export type SetupAnswers = {
  tools: SetupTool[];
  weeklyHours: SetupHours | null;
  goal: SetupGoal | null;
};

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";
// The native control stays visible inside each chip, so the checked state
// never relies on colour alone.
const CHIP = cn(
  "inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-home-rule bg-home-paper px-3.5 text-[13px] text-home-ink-2 transition-colors hover:border-home-ink-3",
  "has-checked:border-home-ink has-checked:bg-home-ink has-checked:text-home-card",
  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-home-orange-ink",
);
const INPUT = "m-0 size-4 accent-home-orange-light focus-visible:outline-none";
const LEGEND = "mb-2.5 p-0 text-sm font-medium text-home-ink";
const TOOL_CHIP_NAME: Partial<Record<SetupTool, string>> = { "no-code": "No-code" };

function Group({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className={LEGEND}>{legend}</legend>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </fieldset>
  );
}

/**
 * The three setup questions (PRD 6.4) as checkbox and radio groups in
 * fieldsets. Every answer is optional. Used on Home and in Settings.
 */
export function SetupForm({
  initial,
  submitLabel,
  onSaved,
  secondary,
}: {
  initial: SetupAnswers;
  submitLabel: string;
  onSaved: (answers: SetupAnswers) => void;
  /** A second action beside submit, for example "Skip for now". */
  secondary?: ReactNode;
}) {
  const id = useId();
  const saveSetup = useMutation(api.platform.preferences.saveSetup);
  const [answers, setAnswers] = useState<SetupAnswers>(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  function toggleTool(tool: SetupTool, checked: boolean) {
    setAnswers((current) => ({
      ...current,
      tools: checked ? [...current.tools, tool] : current.tools.filter((t) => t !== tool),
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await saveSetup({
        tools: answers.tools,
        weeklyHours: answers.weeklyHours ?? undefined,
        goal: answers.goal ?? undefined,
      });
      trackDashboardEvent({
        name: "setup_completed",
        props: {
          tools_count: answers.tools.length,
          hours_bucket: answers.weeklyHours ?? "none",
          goal: answers.goal ?? "none",
        },
      });
      onSaved(answers);
    } catch (cause) {
      console.error("Saving setup answers failed", cause);
      setError("We couldn’t save your answers. Try again in a minute.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Group legend="Which AI tools do you build with?">
        {SETUP_TOOLS.map((tool) => (
          <label key={tool} className={CHIP}>
            <input
              type="checkbox"
              name="tools"
              value={tool}
              checked={answers.tools.includes(tool)}
              onChange={(event) => toggleTool(tool, event.target.checked)}
              className={INPUT}
            />
            {TOOL_CHIP_NAME[tool] ?? toolLabel(tool)}
          </label>
        ))}
      </Group>
      <Group legend="How much time do you have most weekends?">
        {SETUP_HOURS.map((hours) => (
          <label key={hours} className={CHIP}>
            <input
              type="radio"
              name={`${id}-hours`}
              value={hours}
              checked={answers.weeklyHours === hours}
              onChange={() => setAnswers((current) => ({ ...current, weeklyHours: hours }))}
              className={INPUT}
            />
            {HOURS_LABEL[hours]}
          </label>
        ))}
      </Group>
      <Group legend="What do you want from it?">
        {SETUP_GOALS.map((goal) => (
          <label key={goal} className={CHIP}>
            <input
              type="radio"
              name={`${id}-goal`}
              value={goal}
              checked={answers.goal === goal}
              onChange={() => setAnswers((current) => ({ ...current, goal }))}
              className={INPUT}
            />
            {GOAL_LABEL[goal]}
          </label>
        ))}
      </Group>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className={cn(
            "inline-flex h-11 items-center gap-2 rounded-[9px] bg-home-ink px-4 text-sm font-medium text-home-card transition-colors hover:bg-home-panel disabled:cursor-wait disabled:opacity-60",
            FOCUS,
          )}
        >
          {pending ? "Saving…" : submitLabel}
          {!pending && <ArrowRight aria-hidden className="size-4" strokeWidth={1.8} />}
        </button>
        {secondary}
      </div>
      <p role="status" className={cn("text-sm", error ? "text-red-700" : "sr-only")}>
        {error}
      </p>
    </form>
  );
}
