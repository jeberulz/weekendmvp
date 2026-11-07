import { WIZARD_STEPS, type WizardAnswersProgress } from "@/lib/workspace/contracts/wizard";
import { cn } from "@/lib/utils";

type Signal = { readonly step: string; readonly signal: "kept" | "edited"; readonly note: string };

/** The logged signals in step order. A signal with no note still shows its tag. */
export function loggedSignals(answers: WizardAnswersProgress): Signal[] {
  const out: Signal[] = [];
  for (const step of WIZARD_STEPS) {
    const entry = answers.signals?.[step];
    if (entry === undefined) continue;
    out.push({ step, signal: entry.signal, note: entry.note ?? (entry.signal === "kept" ? "Kept the suggestion." : "Changed the suggestion.") });
  }
  return out;
}

/**
 * The Founder signals aside (System `FounderSignal`): what the founder kept
 * and changed, from `answers.signals`. KEPT is sage, EDIT is ember-soft; the
 * tag is a word, so status is never colour alone.
 */
export function FounderSignals({ answers }: { answers: WizardAnswersProgress }) {
  const signals = loggedSignals(answers);
  return (
    <aside
      aria-labelledby="founder-signals-heading"
      className="max-w-[340px] flex-[1_1_280px] rounded-[10px] border border-home-rule bg-home-card p-[18px]"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="founder-signals-heading" className="font-editorial text-xl font-normal text-home-ink">
          Founder signals
        </h2>
        <span className="font-mono text-xs text-home-ink-3">{signals.length} logged</span>
      </div>
      <p className="mb-3.5 mt-1.5 text-[13px] text-home-ink-3">
        What you kept and changed. Your team reads these when it drafts.
      </p>
      {signals.length === 0 ? (
        <p className="rounded-md border border-dashed border-home-rule p-3 text-sm text-home-ink-3">
          Signals appear as you answer.
        </p>
      ) : (
        <ol className="flex flex-col gap-2.5">
          {signals.map((entry) => (
            <li key={entry.step} className="flex gap-2.5 text-sm text-home-ink">
              <span
                className={cn(
                  "h-fit shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px]",
                  entry.signal === "kept" ? "bg-home-sage text-home-sage-ink" : "bg-home-ember-soft text-home-orange-ink",
                )}
              >
                {entry.signal === "kept" ? "KEPT" : "EDIT"}
              </span>
              <span>{entry.note}</span>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
