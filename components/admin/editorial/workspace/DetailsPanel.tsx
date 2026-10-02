"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { editorialMetadataSchema, type EditorialMetadata } from "@/lib/editorial/contracts/metadata";
import {
  AUDIENCE_SLUGS,
  BUILD_TIME_VALUES,
  CATEGORY_SLUGS,
  HIGHLIGHT_LIMITS as H,
  MIN_AUDIENCES,
  MIN_TOOLS,
  REVENUE_GOAL_SLUGS,
  TOOL_SLUGS,
} from "@/lib/editorial/contracts/taxonomy";
import { EDITORIAL_LIMITS as L } from "@/lib/editorial/contracts/limits";
import type { IdeaDetail, RevisionView } from "@/lib/editorial/contracts/views";
import { CANDIDATE_LABELS, REVISION_KIND_LABELS, formatAbsolute, shortHash } from "@/lib/editorial/presentation/format";
import {
  AUDIENCE_LABELS,
  CATEGORY_LABELS,
  ORIGIN_LABELS,
  REVENUE_GOAL_LABELS,
  TOOL_LABELS,
  buildTimeLabel,
} from "@/lib/editorial/presentation/metadata-labels";
import { cn } from "@/lib/utils";
import { fieldClass } from "../common/primitives";
import { smallButtonClass } from "./ui";

type Errors = Map<string, string>;

function validate(draft: EditorialMetadata): Errors {
  const parsed = editorialMetadataSchema.safeParse(draft);
  const errors: Errors = new Map();
  if (parsed.success) return errors;
  for (const issue of parsed.error.issues) {
    const key = issue.path.join(".");
    if (!errors.has(key)) errors.set(key, issue.message);
  }
  return errors;
}

/** Field id for an error path, so the summary can link to the control. */
function fieldId(path: string): string {
  return `meta-${path.replace(/\./g, "-")}`;
}

/**
 * Idea facts plus the metadata/highlights form. Only valid metadata reaches
 * the autosave; while the form has errors the workspace reports it unsaved.
 */
export function DetailsPanel({
  detail,
  view,
  metadata,
  readOnly,
  onMetadata,
  onValidityChange,
}: {
  detail: IdeaDetail;
  view: RevisionView;
  metadata: EditorialMetadata;
  readOnly: boolean;
  onMetadata(metadata: EditorialMetadata): void;
  onValidityChange(invalid: boolean): void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <IdeaFacts detail={detail} view={view} />
      {readOnly ? (
        <MetadataSummary metadata={metadata} />
      ) : (
        <MetadataForm initial={metadata} onMetadata={onMetadata} onValidityChange={onValidityChange} />
      )}
    </div>
  );
}

function IdeaFacts({ detail, view }: { detail: IdeaDetail; view: RevisionView }) {
  const idea = detail.idea;
  const rows: Array<[string, ReactNode]> = [
    ["Slug", <span key="slug" className="font-mono break-all">{idea.slug}{idea.slugConflict ? " (conflicts with another idea)" : ""}</span>],
    ["Origin", ORIGIN_LABELS[idea.origin]],
    ["Engine run", idea.engineRunId ? <span key="run" className="font-mono">{idea.engineRunId}</span> : "None"],
    ["Your decision", idea.candidate.state === "legacy" ? "Legacy (live before this workspace)" : CANDIDATE_LABELS[idea.candidate.state]],
    [
      "Engine recommendation",
      idea.engineRecommendation ? `${idea.engineRecommendation.value.replace("_", " ")} — kept separate from your decision` : "None",
    ],
    ["Labels", idea.labels.length > 0 ? idea.labels.join(", ") : "None"],
    ["Duplicate of", idea.duplicateOf ? idea.duplicateOf.title : "Not a known duplicate"],
    ["Revision", `v${view.number} · ${REVISION_KIND_LABELS[view.kind]}`],
    ["Created", `${formatAbsolute(view.createdAt)} by ${view.createdBy.label}`],
    ["Artifact hash", <span key="hash" className="font-mono">{shortHash(view.hashes.artifact)}</span>],
    [
      "Approval",
      view.approval
        ? `${view.approval.status === "active" ? "Active" : view.approval.status === "revoked" ? "Revoked" : "Superseded"} · ${formatAbsolute(view.approval.approvedAt)} by ${view.approval.approvedBy.label}`
        : "Not approved",
    ],
  ];
  return (
    <section aria-labelledby="facts-heading" className="flex flex-col gap-2">
      <h2 id="facts-heading" className="text-sm font-semibold">
        Idea and revision
      </h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg border border-(--ed-border) bg-(--ed-surface) px-3 py-3 text-xs">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-(--ed-text-2)">{label}</dt>
            <dd className="min-w-0">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function MetadataSummary({ metadata }: { metadata: EditorialMetadata }) {
  return (
    <section aria-labelledby="metadata-heading" className="flex flex-col gap-2">
      <h2 id="metadata-heading" className="text-sm font-semibold">
        Metadata and highlights
      </h2>
      <p className="text-xs text-(--ed-text-2)">Read-only for this revision.</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg border border-(--ed-border) bg-(--ed-surface) px-3 py-3 text-xs">
        <dt className="text-(--ed-text-2)">Description</dt>
        <dd>{metadata.description}</dd>
        <dt className="text-(--ed-text-2)">Category</dt>
        <dd>{CATEGORY_LABELS[metadata.category]}</dd>
        <dt className="text-(--ed-text-2)">Build time</dt>
        <dd>{buildTimeLabel(metadata.buildTime)}</dd>
        <dt className="text-(--ed-text-2)">Revenue goal</dt>
        <dd>{REVENUE_GOAL_LABELS[metadata.revenueGoal]}</dd>
        <dt className="text-(--ed-text-2)">Tools</dt>
        <dd>{metadata.tools.map((tool) => TOOL_LABELS[tool]).join(", ")}</dd>
        <dt className="text-(--ed-text-2)">Audiences</dt>
        <dd>{metadata.audiences.map((audience) => AUDIENCE_LABELS[audience]).join(", ")}</dd>
        <dt className="text-(--ed-text-2)">Highlights</dt>
        <dd>{metadata.highlights ? `“${metadata.highlights.problemQuote}” · ${metadata.highlights.stats.length} stats` : "None"}</dd>
        <dt className="text-(--ed-text-2)">Social card</dt>
        <dd>{metadata.og ? metadata.og.subject : "None"}</dd>
      </dl>
    </section>
  );
}

function MetadataForm({
  initial,
  onMetadata,
  onValidityChange,
}: {
  initial: EditorialMetadata;
  onMetadata(metadata: EditorialMetadata): void;
  onValidityChange(invalid: boolean): void;
}) {
  const [draft, setDraft] = useState(initial);
  const errors = useMemo(() => validate(draft), [draft]);

  const update = (next: EditorialMetadata) => {
    setDraft(next);
    const nextErrors = validate(next);
    onValidityChange(nextErrors.size > 0);
    if (nextErrors.size === 0) onMetadata(next);
  };

  const highlights = draft.highlights;
  const error = (path: string) => errors.get(path) ?? null;

  return (
    <form aria-labelledby="metadata-heading" noValidate onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-4">
      <div>
        <h2 id="metadata-heading" className="text-sm font-semibold">
          Metadata and highlights
        </h2>
        <p className="text-xs text-(--ed-text-2)">Changes save with the draft once every field is valid.</p>
      </div>

      {errors.size > 0 ? (
        <div role="alert" className="rounded-md border border-(--ed-danger) bg-(--ed-danger-bg) px-3 py-2 text-sm text-(--ed-danger)">
          <p className="font-medium">
            Fix {errors.size} problem{errors.size === 1 ? "" : "s"}. Metadata changes are not saved until then.
          </p>
          <ul className="mt-1 list-disc pl-5">
            {[...errors.entries()].map(([path, message]) => (
              <li key={path}>
                <a href={`#${fieldId(path)}`} className="underline underline-offset-2">
                  {message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <TextField
        id={fieldId("description")}
        label="Description"
        hint={`One sentence for cards and search results, up to ${L.descriptionChars} characters.`}
        value={draft.description}
        maxLength={L.descriptionChars}
        multiline
        error={error("description")}
        onChange={(description) => update({ ...draft, description })}
      />

      <div className="grid gap-3">
        <SelectField
          id={fieldId("category")}
          label="Category"
          value={draft.category}
          options={CATEGORY_SLUGS.map((slug) => [slug, CATEGORY_LABELS[slug]])}
          onChange={(category) => update({ ...draft, category: category as EditorialMetadata["category"] })}
        />
        <SelectField
          id={fieldId("buildTime")}
          label="Build time"
          value={draft.buildTime}
          options={BUILD_TIME_VALUES.map((value) => [value, buildTimeLabel(value)])}
          onChange={(buildTime) => update({ ...draft, buildTime: buildTime as EditorialMetadata["buildTime"] })}
        />
        <SelectField
          id={fieldId("revenueGoal")}
          label="Revenue goal"
          value={draft.revenueGoal}
          options={REVENUE_GOAL_SLUGS.map((slug) => [slug, REVENUE_GOAL_LABELS[slug]])}
          onChange={(revenueGoal) => update({ ...draft, revenueGoal: revenueGoal as EditorialMetadata["revenueGoal"] })}
        />
      </div>

      <CheckboxGroup
        id={fieldId("tools")}
        legend={`Tools (at least ${MIN_TOOLS})`}
        options={TOOL_SLUGS.map((slug) => [slug, TOOL_LABELS[slug]])}
        values={draft.tools}
        error={error("tools")}
        onChange={(tools) => update({ ...draft, tools: tools as EditorialMetadata["tools"] })}
      />
      <CheckboxGroup
        id={fieldId("audiences")}
        legend={`Audiences (at least ${MIN_AUDIENCES})`}
        options={AUDIENCE_SLUGS.map((slug) => [slug, AUDIENCE_LABELS[slug]])}
        values={draft.audiences}
        error={error("audiences")}
        onChange={(audiences) => update({ ...draft, audiences: audiences as EditorialMetadata["audiences"] })}
      />

      <fieldset className="flex flex-col gap-3 rounded-lg border border-(--ed-border) px-3 pb-3 pt-1">
        <legend className="px-1 text-sm font-semibold">Homepage highlights</legend>
        <label className="flex min-h-9 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-(--ed-text)"
            checked={highlights !== null}
            onChange={(event) =>
              update({
                ...draft,
                highlights: event.target.checked ? { problemQuote: "", stats: [{ value: "", label: "", source: null }], competitors: null } : null,
              })
            }
          />
          Show highlights on the homepage card
        </label>
        {highlights ? (
          <>
            <TextField
              id={fieldId("highlights.problemQuote")}
              label="Problem quote"
              value={highlights.problemQuote}
              maxLength={H.problemQuote}
              error={error("highlights.problemQuote")}
              onChange={(problemQuote) => update({ ...draft, highlights: { ...highlights, problemQuote } })}
            />
            <div id={fieldId("highlights.stats")} className="flex flex-col gap-2">
              <p className="text-sm font-medium">Stats (1–{H.maxStats})</p>
              {error("highlights.stats") ? <p className="text-xs text-(--ed-danger)">{error("highlights.stats")}</p> : null}
              {highlights.stats.map((stat, index) => (
                <div key={index} className="grid gap-2 rounded-md border border-(--ed-border) p-2">
                  <TextField
                    id={fieldId(`highlights.stats.${index}.value`)}
                    label={`Stat ${index + 1} value`}
                    value={stat.value}
                    maxLength={H.statValue}
                    error={error(`highlights.stats.${index}.value`)}
                    onChange={(value) =>
                      update({ ...draft, highlights: { ...highlights, stats: highlights.stats.map((item, i) => (i === index ? { ...item, value } : item)) } })
                    }
                  />
                  <TextField
                    id={fieldId(`highlights.stats.${index}.label`)}
                    label={`Stat ${index + 1} label`}
                    value={stat.label}
                    maxLength={H.statLabel}
                    error={error(`highlights.stats.${index}.label`)}
                    onChange={(label) =>
                      update({ ...draft, highlights: { ...highlights, stats: highlights.stats.map((item, i) => (i === index ? { ...item, label } : item)) } })
                    }
                  />
                  <TextField
                    id={fieldId(`highlights.stats.${index}.source`)}
                    label={`Stat ${index + 1} source (optional)`}
                    value={stat.source ?? ""}
                    maxLength={H.statSource}
                    error={error(`highlights.stats.${index}.source`)}
                    onChange={(source) =>
                      update({
                        ...draft,
                        highlights: {
                          ...highlights,
                          stats: highlights.stats.map((item, i) => (i === index ? { ...item, source: source.trim() ? source : null } : item)),
                        },
                      })
                    }
                  />
                  {highlights.stats.length > 1 ? (
                    <button
                      type="button"
                      className={cn(smallButtonClass, "self-end")}
                      onClick={() => update({ ...draft, highlights: { ...highlights, stats: highlights.stats.filter((_, i) => i !== index) } })}
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                      Remove stat {index + 1}
                    </button>
                  ) : null}
                </div>
              ))}
              {highlights.stats.length < H.maxStats ? (
                <button
                  type="button"
                  className={cn(smallButtonClass, "self-start")}
                  onClick={() => update({ ...draft, highlights: { ...highlights, stats: [...highlights.stats, { value: "", label: "", source: null }] } })}
                >
                  <Plus aria-hidden="true" className="size-4" />
                  Add stat
                </button>
              ) : null}
            </div>
            <label className="flex min-h-9 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-(--ed-text)"
                checked={highlights.competitors !== null}
                onChange={(event) =>
                  update({
                    ...draft,
                    highlights: {
                      ...highlights,
                      competitors: event.target.checked
                        ? Array.from({ length: H.minCompetitors }, () => ({ name: "", price: "" }))
                        : null,
                    },
                  })
                }
              />
              Include competitor prices ({H.minCompetitors}–{H.maxCompetitors})
            </label>
            {highlights.competitors ? (
              <div id={fieldId("highlights.competitors")} className="flex flex-col gap-2">
                {error("highlights.competitors") ? <p className="text-xs text-(--ed-danger)">{error("highlights.competitors")}</p> : null}
                {highlights.competitors.map((competitor, index) => {
                  const competitors = highlights.competitors ?? [];
                  return (
                    <div key={index} className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2 rounded-md border border-(--ed-border) p-2">
                      <TextField
                        id={fieldId(`highlights.competitors.${index}.name`)}
                        label={`Competitor ${index + 1}`}
                        value={competitor.name}
                        maxLength={H.competitorName}
                        error={error(`highlights.competitors.${index}.name`)}
                        onChange={(name) =>
                          update({ ...draft, highlights: { ...highlights, competitors: competitors.map((item, i) => (i === index ? { ...item, name } : item)) } })
                        }
                      />
                      <TextField
                        id={fieldId(`highlights.competitors.${index}.price`)}
                        label="Price"
                        value={competitor.price}
                        maxLength={H.competitorPrice}
                        error={error(`highlights.competitors.${index}.price`)}
                        onChange={(price) =>
                          update({ ...draft, highlights: { ...highlights, competitors: competitors.map((item, i) => (i === index ? { ...item, price } : item)) } })
                        }
                      />
                      {competitors.length > H.minCompetitors ? (
                        <button
                          type="button"
                          className={cn(smallButtonClass, "self-start")}
                          onClick={() => update({ ...draft, highlights: { ...highlights, competitors: competitors.filter((_, i) => i !== index) } })}
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                          Remove competitor {index + 1}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
                {highlights.competitors.length < H.maxCompetitors ? (
                  <button
                    type="button"
                    className={cn(smallButtonClass, "self-start")}
                    onClick={() =>
                      update({ ...draft, highlights: { ...highlights, competitors: [...(highlights.competitors ?? []), { name: "", price: "" }] } })
                    }
                  >
                    <Plus aria-hidden="true" className="size-4" />
                    Add competitor
                  </button>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-(--ed-border) px-3 pb-3 pt-1">
        <legend className="px-1 text-sm font-semibold">Social card inputs</legend>
        <label className="flex min-h-9 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-(--ed-text)"
            checked={draft.og !== null}
            onChange={(event) => update({ ...draft, og: event.target.checked ? { subject: "", accent: "amber" } : null })}
          />
          Provide social card inputs
        </label>
        {draft.og ? (
          <div className="grid gap-2">
            <TextField
              id={fieldId("og.subject")}
              label="Card subject"
              value={draft.og.subject}
              maxLength={L.ogSubjectChars}
              error={error("og.subject")}
              onChange={(subject) => draft.og && update({ ...draft, og: { ...draft.og, subject } })}
            />
            <TextField
              id={fieldId("og.accent")}
              label="Accent name"
              hint="Lowercase, e.g. amber"
              value={draft.og.accent}
              maxLength={24}
              error={error("og.accent")}
              onChange={(accent) => draft.og && update({ ...draft, og: { ...draft.og, accent } })}
            />
          </div>
        ) : null}
      </fieldset>
    </form>
  );
}

function TextField({
  id,
  label,
  hint,
  value,
  maxLength,
  error,
  multiline = false,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  maxLength: number;
  error?: string | null;
  multiline?: boolean;
  onChange(value: string): void;
}) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  const shared = {
    id,
    value,
    maxLength,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
  } as const;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-(--ed-text-2)">
          {hint}
        </p>
      ) : null}
      {multiline ? (
        <textarea
          {...shared}
          rows={3}
          className={cn(fieldClass, "py-2 aria-invalid:border-(--ed-danger)")}
          onChange={(event) => onChange(event.target.value.replace(/[\r\n]+/g, " "))}
        />
      ) : (
        <input {...shared} className={cn(fieldClass, "aria-invalid:border-(--ed-danger)")} onChange={(event) => onChange(event.target.value)} />
      )}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-(--ed-danger)">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange(value: string): void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select id={id} value={value} className={fieldClass} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

function CheckboxGroup({
  id,
  legend,
  options,
  values,
  error,
  onChange,
}: {
  id: string;
  legend: string;
  options: Array<[string, string]>;
  values: readonly string[];
  error?: string | null;
  onChange(values: string[]): void;
}) {
  return (
    <fieldset id={id} aria-describedby={error ? `${id}-error` : undefined} className="flex flex-col gap-1.5">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {options.map(([optionValue, optionLabel]) => (
          <label key={optionValue} className="flex min-h-9 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-(--ed-text)"
              checked={values.includes(optionValue)}
              onChange={(event) => {
                // Canonical (option) order, so toggling a tag off and on again is not a change.
                const next = new Set(values);
                if (event.target.checked) next.add(optionValue);
                else next.delete(optionValue);
                onChange(options.map(([value]) => value).filter((value) => next.has(value)));
              }}
            />
            {optionLabel}
          </label>
        ))}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-xs text-(--ed-danger)">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
