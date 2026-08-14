"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MAX_KEY_BENEFITS,
  type PreviewCustomisation,
} from "@/convex/platform/preview/customisation";
import {
  PREVIEW_TEMPLATE_VALUES,
  type PreviewTemplate,
} from "@/convex/platform/preview/renderSpec";
import { trackEvent } from "@/lib/track";

const TEMPLATE_LABELS: Record<PreviewTemplate, string> = {
  editorial: "Editorial",
  product: "Product",
  minimal: "Minimal",
};

const TEMPLATE_DESCRIPTIONS: Record<PreviewTemplate, string> = {
  editorial: "Long-form and text-led, for an idea that needs explaining.",
  product: "Benefit-led with a prominent call to action.",
  minimal: "One screen, one promise, nothing else.",
};

const FIELD_ERRORS: Record<string, string> = {
  headline: "Give the headline between 8 and 120 characters.",
  subheadline: "Give the subheadline between 8 and 200 characters.",
  problemStatement: "Describe the problem in 20 to 600 characters.",
  keyBenefits: `List between 1 and ${MAX_KEY_BENEFITS} benefits, each 3 to 160 characters.`,
  callToAction: "Give the button 2 to 40 characters.",
};

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string };

export function BuildPreviewForm({
  slug,
  initial,
}: {
  slug: string;
  initial: PreviewCustomisation;
}) {
  const router = useRouter();
  const fieldId = useId();
  const [customisation, setCustomisation] =
    useState<PreviewCustomisation>(initial);
  const [templateId, setTemplateId] = useState<PreviewTemplate>("editorial");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const submitting = status.kind === "submitting";

  function update<K extends keyof PreviewCustomisation>(
    key: K,
    value: PreviewCustomisation[K],
  ) {
    setCustomisation((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setStatus({ kind: "submitting" });
    trackEvent("preview_started", { template: templateId });

    try {
      const response = await fetch("/api/platform/preview/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, templateId, customisation }),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        token?: string;
        code?: string;
      };

      if (!response.ok || !body.ok || typeof body.token !== "string") {
        if (response.status === 429) {
          setStatus({
            kind: "error",
            message:
              "That is a lot of previews in a short time. Wait a moment and try again.",
          });
          return;
        }
        setStatus({
          kind: "error",
          message:
            (body.code && FIELD_ERRORS[body.code]) ??
            "We could not build that preview. Your wording is still here; try again.",
        });
        return;
      }

      // Server-confirmed only: the event fires after a real token exists,
      // never optimistically on submit.
      trackEvent("preview_generated", { template: templateId });
      router.push(`/preview/${body.token}`);
    } catch {
      setStatus({
        kind: "error",
        message:
          "We could not reach the preview service. Your wording is still here; try again.",
      });
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-10 space-y-8">
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-zinc-200">Layout</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {PREVIEW_TEMPLATE_VALUES.map((template) => (
            <label
              key={template}
              className="flex cursor-pointer flex-col gap-1 rounded-lg border border-white/10 p-3 text-sm transition-colors hover:border-white/25 focus-within:ring-2 focus-within:ring-orange-500 has-[:checked]:border-orange-400/60 has-[:checked]:bg-white/5"
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="templateId"
                  value={template}
                  checked={templateId === template}
                  onChange={() => setTemplateId(template)}
                  disabled={submitting}
                  className="size-4 accent-orange-500"
                />
                <span className="font-medium text-zinc-100">
                  {TEMPLATE_LABELS[template]}
                </span>
              </span>
              <span className="text-zinc-400">
                {TEMPLATE_DESCRIPTIONS[template]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        id={`${fieldId}-headline`}
        label="Headline"
        hint="The one promise a visitor should remember."
        value={customisation.headline}
        onChange={(value) => update("headline", value)}
        disabled={submitting}
        maxLength={120}
      />

      <Field
        id={`${fieldId}-subheadline`}
        label="Subheadline"
        hint="One sentence of supporting detail."
        value={customisation.subheadline}
        onChange={(value) => update("subheadline", value)}
        disabled={submitting}
        maxLength={200}
      />

      <Field
        id={`${fieldId}-problem`}
        label="Problem to solve"
        hint="Describe the recurring problem, not the feature."
        value={customisation.problemStatement}
        onChange={(value) => update("problemStatement", value)}
        disabled={submitting}
        maxLength={600}
        multiline
      />

      <div className="space-y-2">
        <span className="block text-sm font-medium text-zinc-200">
          Key benefits
        </span>
        <p className="text-sm text-zinc-400">
          Up to {MAX_KEY_BENEFITS}. Leave a line empty to drop it.
        </p>
        {customisation.keyBenefits.map((benefit, index) => (
          <input
            // Index is a stable identity here: the list is fixed-length for
            // the lifetime of the form and rows are never reordered.
            key={`benefit-${index}`}
            type="text"
            aria-label={`Key benefit ${index + 1}`}
            value={benefit}
            maxLength={160}
            disabled={submitting}
            onChange={(event) => {
              const next = [...customisation.keyBenefits];
              next[index] = event.target.value;
              update("keyBenefits", next);
            }}
            className="min-h-11 w-full rounded-lg border border-white/10 bg-transparent px-3 text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          />
        ))}
        {customisation.keyBenefits.length < MAX_KEY_BENEFITS && (
          <button
            type="button"
            disabled={submitting}
            onClick={() =>
              update("keyBenefits", [...customisation.keyBenefits, ""])
            }
            className="min-h-11 rounded-lg border border-white/15 px-4 text-sm text-zinc-300 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          >
            Add a benefit
          </button>
        )}
      </div>

      <Field
        id={`${fieldId}-cta`}
        label="Button text"
        hint="What the main button should say."
        value={customisation.callToAction}
        onChange={(value) => update("callToAction", value)}
        disabled={submitting}
        maxLength={40}
      />

      <div aria-live="polite" className="min-h-6">
        {status.kind === "error" && (
          <p className="text-sm text-orange-300">{status.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="min-h-12 w-full rounded-lg bg-orange-700 px-5 font-medium text-white transition-colors hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-wait disabled:opacity-70"
      >
        {submitting ? "Building your preview…" : "Build my preview"}
      </button>
      {/* zinc-400, not zinc-500: WP23 raised small-text contrast for exactly
          this reason and axe flags zinc-500 on this background as a serious
          AA contrast failure. */}
      <p className="text-sm text-zinc-400">
        Your preview is private and expires in 7 days. Sign up to keep it.
      </p>
    </form>
  );
}

function Field({
  id,
  label,
  hint,
  value,
  onChange,
  disabled,
  maxLength,
  multiline = false,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  maxLength: number;
  multiline?: boolean;
}) {
  const hintId = `${id}-hint`;
  const shared = {
    id,
    value,
    maxLength,
    disabled,
    "aria-describedby": hintId,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => onChange(event.target.value),
    className:
      "w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
  };

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-zinc-200">
        {label}
      </label>
      <p id={hintId} className="text-sm text-zinc-400">
        {hint}
      </p>
      {multiline ? (
        <textarea {...shared} rows={4} />
      ) : (
        <input {...shared} type="text" className={`${shared.className} min-h-11`} />
      )}
    </div>
  );
}
