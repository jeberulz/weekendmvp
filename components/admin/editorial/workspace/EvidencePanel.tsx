"use client";

import { ExternalLink } from "lucide-react";
import { useRef } from "react";

import { SOURCE_TYPE_LABELS } from "@/lib/editorial/contracts/evidence";
import type { ClaimView, EvidenceLabel, SourceView } from "@/lib/editorial/contracts/views";
import { truncateText } from "@/lib/editorial/editor/outline";
import { EVIDENCE_LABEL_TEXT, FRESHNESS_LABELS, formatAbsolute, formatDate } from "@/lib/editorial/presentation/format";
import {
  CLAIM_KIND_LABELS,
  CLAIM_TOPIC_LABELS,
  REVIEW_STATUS_LABELS,
  SOURCE_VERIFICATION_LABELS,
} from "@/lib/editorial/presentation/review";
import { cn } from "@/lib/utils";
import { StatusBadge, type Tone } from "../common/primitives";
import { textButtonClass } from "./ui";

const LABEL_TONES: Record<EvidenceLabel, Tone> = {
  machine_verified: "success",
  reviewed_by_you: "success",
  unavailable: "danger",
  changed_since_review: "warning",
  provisional: "warning",
  assumption: "info",
  unverified: "neutral",
};

function EvidenceLabels({ labels }: { labels: EvidenceLabel[] }) {
  if (labels.length === 0) return null;
  return (
    <ul aria-label="Evidence labels" className="flex flex-wrap gap-1">
      {labels.map((label) => (
        <li key={label}>
          <StatusBadge tone={LABEL_TONES[label]}>{EVIDENCE_LABEL_TEXT[label]}</StatusBadge>
        </li>
      ))}
    </ul>
  );
}

/**
 * Claims and their sources. Labels keep machine verification, your own
 * review and provisional search summaries apart; opening a source link is
 * never recorded as review.
 */
export function EvidencePanel({
  claims,
  sources,
  selectedClaimId,
  onSelectClaim,
  onShowInArticle,
}: {
  claims: ClaimView[];
  sources: SourceView[];
  selectedClaimId: string | null;
  onSelectClaim(claimId: string): void;
  onShowInArticle(claimId: string): void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const focusSource = (sourceId: string) => {
    const card = containerRef.current?.querySelector<HTMLElement>(`[data-source-card="${CSS.escape(sourceId)}"]`);
    card?.scrollIntoView({ block: "nearest" });
    card?.focus({ preventScroll: true });
  };
  const ordered = [...claims].sort((a, b) => Number(b.material) - Number(a.material));

  return (
    <div ref={containerRef} className="flex flex-col gap-6">
      <section aria-labelledby="claims-heading" className="flex flex-col gap-2">
        <h2 id="claims-heading" className="text-sm font-semibold">
          Claims <span className="font-mono font-normal text-(--ed-text-2)">({claims.length})</span>
        </h2>
        {claims.length === 0 ? (
          <p className="text-sm text-(--ed-text-2)">This revision has no recorded claims.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {ordered.map((claim) => (
              <li key={claim.id}>
                <article
                  data-claim-card={claim.id}
                  tabIndex={-1}
                  aria-labelledby={`claim-${claim.id}`}
                  className={cn(
                    "flex flex-col gap-2 rounded-lg border bg-(--ed-surface) px-3 py-3 outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--ed-focus)",
                    claim.id === selectedClaimId ? "border-(--ed-text) ring-1 ring-(--ed-text)" : "border-(--ed-border)",
                  )}
                >
                  <h3 id={`claim-${claim.id}`} className="text-sm font-medium leading-snug">
                    {claim.text}
                  </h3>
                  <p className="text-xs text-(--ed-text-2)">
                    {CLAIM_KIND_LABELS[claim.kind]} · {CLAIM_TOPIC_LABELS[claim.topic]}
                    {claim.material ? " · Material" : ""} · Your review: {REVIEW_STATUS_LABELS[claim.review.status]}
                  </p>
                  <EvidenceLabels labels={claim.labels} />
                  {!claim.anchorPresent ? (
                    <p className="text-xs text-(--ed-warning)">The verified wording no longer appears in its section.</p>
                  ) : null}
                  {claim.verification.reason ? <p className="text-xs">Verification note: {claim.verification.reason}</p> : null}
                  <SourceRefs label="Supported by" ids={claim.sourceIds} sourceById={sourceById} onFocusSource={focusSource} />
                  <SourceRefs label="Contradicted by" ids={claim.contradictingSourceIds} sourceById={sourceById} onFocusSource={focusSource} />
                  <div className="flex flex-wrap gap-3">
                    {claim.anchorPresent ? (
                      <button type="button" className={textButtonClass} onClick={() => onShowInArticle(claim.id)}>
                        Show in article
                      </button>
                    ) : null}
                    {claim.id !== selectedClaimId ? (
                      <button type="button" className={textButtonClass} onClick={() => onSelectClaim(claim.id)}>
                        Select<span className="sr-only"> claim: {truncateText(claim.text, 60)}</span>
                      </button>
                    ) : null}
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="sources-heading" className="flex flex-col gap-2">
        <h2 id="sources-heading" className="text-sm font-semibold">
          Sources <span className="font-mono font-normal text-(--ed-text-2)">({sources.length})</span>
        </h2>
        {sources.length === 0 ? (
          <p className="text-sm text-(--ed-text-2)">This revision cites no sources.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sources.map((source) => (
              <li key={source.id}>
                <SourceCard source={source} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SourceRefs({
  label,
  ids,
  sourceById,
  onFocusSource,
}: {
  label: string;
  ids: string[];
  sourceById: Map<string, SourceView>;
  onFocusSource(sourceId: string): void;
}) {
  if (ids.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span className="text-(--ed-text-2)">{label}:</span>
      {ids.map((id) => {
        const source = sourceById.get(id);
        return source ? (
          <button key={id} type="button" className={`${textButtonClass} text-xs`} onClick={() => onFocusSource(id)}>
            {source.publisher ?? source.domain}
            <span className="sr-only"> (go to source)</span>
          </button>
        ) : (
          <span key={id} className="text-(--ed-danger)">
            Missing source {id}
          </span>
        );
      })}
    </div>
  );
}

function SourceCard({ source }: { source: SourceView }) {
  const excerpt = source.excerpt ? truncateText(source.excerpt, 180) : null;
  return (
    <article
      data-source-card={source.id}
      tabIndex={-1}
      aria-labelledby={`source-${source.id}`}
      className="flex flex-col gap-2 rounded-lg border border-(--ed-border) bg-(--ed-surface) px-3 py-3 outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--ed-focus)"
    >
      <h3 id={`source-${source.id}`} className="text-sm font-medium leading-snug">
        {source.publisher ?? source.domain}
        {source.title ? <span className="block font-normal text-(--ed-text-2)">{source.title}</span> : null}
      </h3>
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="inline-flex max-w-full items-center gap-1 break-all text-xs underline underline-offset-2 outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--ed-focus)"
      >
        <ExternalLink aria-hidden="true" className="size-3.5 shrink-0" />
        {source.url}
        <span className="sr-only"> (opens the original in a new tab)</span>
      </a>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        <dt className="text-(--ed-text-2)">Type</dt>
        <dd>{SOURCE_TYPE_LABELS[source.sourceType]}</dd>
        <dt className="text-(--ed-text-2)">Published</dt>
        <dd>{source.publishedAt ? formatDate(source.publishedAt) : "Unknown"}</dd>
        <dt className="text-(--ed-text-2)">Retrieved</dt>
        <dd>{source.retrievedAt ? formatAbsolute(source.retrievedAt) : "Unknown"}</dd>
        <dt className="text-(--ed-text-2)">Freshness</dt>
        <dd>
          {FRESHNESS_LABELS[source.freshness]}
          {source.freshnessWindowDays ? ` (window ${source.freshnessWindowDays} days)` : ""}
        </dd>
        <dt className="text-(--ed-text-2)">Machine check</dt>
        <dd>
          {SOURCE_VERIFICATION_LABELS[source.verification.status]}
          {source.verificationAuthority === "fixture_simulated" ? " (simulated in the local demo)" : ""}
          {source.verification.reason ? ` — ${source.verification.reason}` : ""}
        </dd>
        <dt className="text-(--ed-text-2)">Your review</dt>
        <dd>{REVIEW_STATUS_LABELS[source.review.status]}</dd>
        <dt className="text-(--ed-text-2)">Claims</dt>
        <dd>{source.claimIds.length}</dd>
      </dl>
      <EvidenceLabels labels={source.labels} />
      {excerpt ? <p className="border-l-2 border-(--ed-border-strong) pl-2 text-sm">“{excerpt}”</p> : null}
      {source.excerpt || source.context ? (
        <details className="text-sm">
          <summary className="min-h-8 cursor-pointer rounded text-sm font-medium outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--ed-focus)">
            Quote and context
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            {source.excerpt ? (
              <blockquote className="border-l-2 border-(--ed-text) pl-2 whitespace-pre-wrap">{source.excerpt}</blockquote>
            ) : null}
            {source.context ? <p className="whitespace-pre-wrap text-(--ed-text-2)">{source.context}</p> : null}
          </div>
        </details>
      ) : null}
    </article>
  );
}
