import type { Metadata } from "next";
import { Suspense } from "react";

import { assertEditorialRoutesEnabled } from "@/lib/editorial/runtime/route-guard";
import { ERROR_SOURCE_LABELS, type ErrorSource } from "@/lib/feedback/contracts";
import { OVERVIEW_DAYS, parseCursor, requireFeedbackSource, type FeedbackSource } from "@/lib/feedback/adminSource";
import type { ErrorRow, FeedbackOverview, FeedbackRow } from "@/lib/feedback/types";
import { Pager } from "./_components/Pager";
import { Notice, Shell, TableRegion, Tile, formatWhen, shortId, td, tdNum, th, type FeedbackTab } from "./_components/Shell";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata(): Promise<Metadata> {
  assertEditorialRoutesEnabled();
  return { title: { absolute: "Feedback — Weekend MVP" } };
}

export default function FeedbackPage({ searchParams }: { searchParams: SearchParams }) {
  assertEditorialRoutesEnabled();
  return (
    <Suspense fallback={<p className="p-6 text-sm">Loading feedback…</p>}>
      <Loaded searchParams={searchParams} />
    </Suspense>
  );
}

async function Loaded({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const tab: FeedbackTab = params.tab === "errors" ? "errors" : "feedback";
  const source = await requireFeedbackSource();
  const cursor = parseCursor(params.cursor);
  const overview = await source.overview();
  return (
    <Shell mode={source.mode} active={tab}>
      {tab === "errors" ? (
        <ErrorsTab source={source} overview={overview} cursor={cursor} />
      ) : (
        <FeedbackNotes source={source} overview={overview} cursor={cursor} />
      )}
    </Shell>
  );
}

function PageTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 max-w-3xl text-sm text-(--ed-text-2)">{description}</p>
    </div>
  );
}

function stars(rating: number | null): string {
  return rating === null ? "No rating" : `${rating} of 5`;
}

async function FeedbackNotes({ source, overview, cursor }: { source: FeedbackSource; overview: FeedbackOverview; cursor: string | null }) {
  const result = await source.feedbackPage(cursor);
  const { feedback } = overview;
  return (
    <>
      <PageTitle
        title="Feedback"
        description="What testers wrote from the Send feedback button, newest first. Each note comes with the page, business, launch step progress and app version. Chat is never attached."
      />
      {feedback.truncated ? <Notice>The counts below cover only the newest {feedback.count.toLocaleString("en-US")} notes of the last {OVERVIEW_DAYS} days.</Notice> : null}
      <dl aria-label={`Feedback in the last ${OVERVIEW_DAYS} days`} className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile label={`Notes, last ${OVERVIEW_DAYS} days`} value={feedback.count.toLocaleString("en-US")} />
        <Tile
          label="Average rating"
          value={feedback.ratingAverage === null ? "None yet" : `${feedback.ratingAverage.toFixed(1)} of 5`}
          detail={`${feedback.unrated.toLocaleString("en-US")} without a rating`}
        />
        <Tile
          label="Ratings, 1 to 5 stars"
          value={<span className="text-base tabular-nums">{feedback.ratingCounts.map((count, index) => `${index + 1}: ${count}`).join("  ")}</span>}
        />
      </dl>

      <h2 id="feedback-list" className="mb-3 text-lg font-semibold">All notes</h2>
      {result.page.length === 0 ? (
        <p className="rounded-lg border border-(--ed-border) bg-(--ed-surface) p-4 text-sm text-(--ed-text-2)">
          No feedback yet. It shows here as soon as a tester sends some.
        </p>
      ) : (
        <TableRegion labelledBy="feedback-list">
          <table className="w-full min-w-[56rem] border-collapse text-sm">
            <caption className="sr-only">Feedback notes, newest first</caption>
            <thead>
              <tr>
                <th scope="col" className={th}>When</th>
                <th scope="col" className={th}>Rating</th>
                <th scope="col" className={th}>Note</th>
                <th scope="col" className={th}>Where</th>
                <th scope="col" className={th}>Launch steps</th>
                <th scope="col" className={th}>Founder and business</th>
                <th scope="col" className={th}>Version</th>
              </tr>
            </thead>
            <tbody>
              {result.page.map((row) => <FeedbackLine key={row.id} row={row} />)}
            </tbody>
          </table>
        </TableRegion>
      )}
      <Pager tab="feedback" shown={result.page.length} nextCursor={result.continueCursor} />
    </>
  );
}

function FeedbackLine({ row }: { row: FeedbackRow }) {
  return (
    <tr>
      <td className={`${td} whitespace-nowrap`}>{formatWhen(row.createdAt)}</td>
      <td className={`${td} whitespace-nowrap`}>{stars(row.rating)}</td>
      <td className={`${td} min-w-72 max-w-xl whitespace-pre-wrap`}>{row.note}</td>
      <td className={td}>
        <span className="font-mono text-xs">{row.route}</span>
        <span className="block text-xs text-(--ed-text-2)">{row.surface === "wizard" ? "Wizard" : "Workspace"}</span>
      </td>
      <td className={td}>
        {row.stepStates.length === 0 ? (
          <span className="text-(--ed-text-2)">None</span>
        ) : (
          <ul className="flex flex-col gap-0.5 text-xs">
            {row.stepStates.map((step) => (
              <li key={`${step.key}:${step.state}`}>
                <span className="font-mono">{step.key}</span>: {step.state}
              </li>
            ))}
          </ul>
        )}
      </td>
      <td className={td}>
        <span className="block font-mono text-xs"><span className="text-(--ed-text-2)">Founder </span>{shortId(row.ownerId)}</span>
        <span className="block font-mono text-xs">
          <span className="text-(--ed-text-2)">Business </span>
          {row.projectId === null ? "none yet" : shortId(row.projectId)}
        </span>
      </td>
      <td className={`${td} whitespace-nowrap font-mono text-xs`}>{row.buildVersion}</td>
    </tr>
  );
}

function sourceLabel(key: string): string {
  return key in ERROR_SOURCE_LABELS ? ERROR_SOURCE_LABELS[key as ErrorSource] : key;
}

function Breakdown({ id, title, keyHeader, rows, label }: { id: string; title: string; keyHeader: string; rows: readonly { key: string; count: number }[]; label?: (key: string) => string }) {
  return (
    <section aria-labelledby={id} className="min-w-0">
      <h2 id={id} className="mb-2 text-lg font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-(--ed-text-2)">Nothing recorded.</p>
      ) : (
        <TableRegion labelledBy={id}>
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr>
                <th scope="col" className={th}>{keyHeader}</th>
                <th scope="col" className={`${th} text-right`}>Errors</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => (
                <tr key={entry.key}>
                  <td className={`${td} break-all font-mono text-xs`}>{label === undefined ? entry.key : label(entry.key)}</td>
                  <td className={tdNum}>{entry.count.toLocaleString("en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableRegion>
      )}
    </section>
  );
}

async function ErrorsTab({ source, overview, cursor }: { source: FeedbackSource; overview: FeedbackOverview; cursor: string | null }) {
  const result = await source.errorsPage(cursor);
  const { errors } = overview;
  return (
    <>
      <PageTitle
        title="Errors"
        description="Page errors, actions a founder saw fail, and Wren replies that could not finish. Page, business and error class only: no message, stack or text the founder typed."
      />
      {errors.truncated ? <Notice>The counts below cover only the newest {errors.count.toLocaleString("en-US")} errors of the last {OVERVIEW_DAYS} days.</Notice> : null}
      <dl aria-label={`Errors in the last ${OVERVIEW_DAYS} days`} className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile label={`Errors, last ${OVERVIEW_DAYS} days`} value={errors.count.toLocaleString("en-US")} />
        <Tile label="Most common class" value={<span className="break-all text-lg">{errors.byClass[0]?.key ?? "None yet"}</span>} detail={errors.byClass[0] === undefined ? undefined : `${errors.byClass[0].count} times`} />
        <Tile label="Most affected page" value={<span className="break-all font-mono text-sm">{errors.byRoute[0]?.key ?? "None yet"}</span>} detail={errors.byRoute[0] === undefined ? undefined : `${errors.byRoute[0].count} times`} />
      </dl>

      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        <Breakdown id="by-class" title="By error class" keyHeader="Class" rows={errors.byClass} />
        <Breakdown id="by-route" title="By page" keyHeader="Page" rows={errors.byRoute} />
        <Breakdown id="by-source" title="By kind" keyHeader="Kind" rows={errors.bySource} label={sourceLabel} />
      </div>

      <h2 id="error-list" className="mb-3 text-lg font-semibold">All errors</h2>
      {result.page.length === 0 ? (
        <p className="rounded-lg border border-(--ed-border) bg-(--ed-surface) p-4 text-sm text-(--ed-text-2)">No errors recorded yet.</p>
      ) : (
        <TableRegion labelledBy="error-list">
          <table className="w-full min-w-[44rem] border-collapse text-sm">
            <caption className="sr-only">Errors, newest first</caption>
            <thead>
              <tr>
                <th scope="col" className={th}>When</th>
                <th scope="col" className={th}>Kind</th>
                <th scope="col" className={th}>Class</th>
                <th scope="col" className={th}>Page</th>
                <th scope="col" className={th}>Founder and business</th>
                <th scope="col" className={th}>Version</th>
              </tr>
            </thead>
            <tbody>
              {result.page.map((row) => <ErrorLine key={row.id} row={row} />)}
            </tbody>
          </table>
        </TableRegion>
      )}
      <Pager tab="errors" shown={result.page.length} nextCursor={result.continueCursor} />
    </>
  );
}

function ErrorLine({ row }: { row: ErrorRow }) {
  return (
    <tr>
      <td className={`${td} whitespace-nowrap`}>{formatWhen(row.createdAt)}</td>
      <td className={`${td} whitespace-nowrap`}>{ERROR_SOURCE_LABELS[row.source]}</td>
      <td className={`${td} break-all font-mono text-xs`}>{row.errorClass}</td>
      <td className={`${td} font-mono text-xs`}>{row.route}</td>
      <td className={td}>
        <span className="block font-mono text-xs"><span className="text-(--ed-text-2)">Founder </span>{shortId(row.ownerId)}</span>
        <span className="block font-mono text-xs">
          <span className="text-(--ed-text-2)">Business </span>
          {row.projectId === null ? "none" : shortId(row.projectId)}
        </span>
      </td>
      <td className={`${td} whitespace-nowrap font-mono text-xs`}>{row.buildVersion}</td>
    </tr>
  );
}
