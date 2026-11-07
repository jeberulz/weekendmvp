"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useId, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { QuietErrorBoundary, WhenConvexReady } from "@/components/platform/client-gates";
import { EmptyState, ErrorState, LoadingState } from "@/components/workspace/kit/states";
import { BTN_SECONDARY, CARD, EYEBROW, FOCUS } from "@/components/workspace/kit/styles";
import { type ReviewDecide } from "@/components/workspace/review/ArtifactReviewCard";
import { LiveArtifactReview } from "@/components/workspace/review/LiveArtifactReview";
import { cn } from "@/lib/utils";
import { SOCIAL_PLATFORMS, type SocialPlatform } from "@/lib/workspace/contracts/artifacts";
import {
  captionCount,
  chooseCaption,
  copiedAnnouncement,
  copyTextFor,
  hashtagLine,
  SOCIAL_APPROVED_NOTE,
  SOCIAL_COPY_FAILED,
  SOCIAL_DAY_LABELS,
  SOCIAL_DAY_NAMES,
  SOCIAL_FORMAT_LABELS,
  SOCIAL_KIND_LABELS,
  SOCIAL_NONE_COPY,
  SOCIAL_DAY_SHORT,
  SOCIAL_FORMAT_SHORT,
  SOCIAL_PLATFORM_LABELS,
  SOCIAL_PLATFORM_MARKS,
  SOCIAL_UNAVAILABLE_COPY,
  SOCIAL_WEEK_HEADING,
  SOCIAL_WEEK_NOTE,
  SOCIAL_YOU_POST_COPY,
  SOCIAL_YOU_POST_TITLE,
  platformLimitCopy,
} from "@/lib/workspace/socialPage";

type SocialDraftView = FunctionReturnType<typeof api.growth.drafts.socialPack.socialPackDraft>;
type ReadyView = Extract<SocialDraftView, { state: "ready" }>;
type PostView = ReadyView["posts"][number];

/**
 * WP76-S2b / L1 UI fidelity: the Social page. The founder reads the crew's
 * seven posts as a launch-week calendar (or a list), copies each for the
 * platform they post on, and approves the pack or asks for changes. Nothing
 * here posts or schedules, and the data has no launch date, so days are names
 * only (Friday to Thursday).
 *
 * Accessibility:
 * - the route is the h1; the review card and the week are h2; the selected post (or each list
 *   post) is an h3; the facts of a post are a description list;
 * - everything from the server is a React text node, never HTML;
 * - the platform picker is a native radio group (fieldset + legend) whose
 *   cards show each platform's caption limit;
 * - Calendar/List is a pair of toggle buttons (`aria-pressed`); calendar
 *   tiles are toggle buttons controlling the detail panel; the grid reflows
 *   (no horizontal scroll) and tile art is `aria-hidden` (its text is in the
 *   detail as "Card text");
 * - the character count is words ("212 of 280 characters"), and over the
 *   limit says so in words, never colour alone;
 * - Copy is a text button whose accessible name says which post and platform;
 *   the result is read from one always-mounted polite live region.
 */

export type SocialDecide = ReviewDecide;

const SOCIAL_ARTIFACT = { plural: "posts", approvedNote: SOCIAL_APPROVED_NOTE, approvalKind: "post" } as const;

function CopyButton({
  post,
  platform,
  onResult,
}: {
  post: PostView;
  platform: SocialPlatform;
  onResult: (message: string) => void;
}) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(copyTextFor(post, platform));
    } catch {
      onResult(SOCIAL_COPY_FAILED);
      return;
    }
    onResult(copiedAnnouncement(post.day, platform));
  }

  const dayName = SOCIAL_DAY_NAMES[post.day];
  return (
    <button
      type="button"
      className={BTN_SECONDARY}
      aria-label={`Copy the ${dayName} post for ${SOCIAL_PLATFORM_LABELS[platform]}`}
      onClick={() => void copy()}
    >
      Copy
    </button>
  );
}

type ViewMode = "calendar" | "list";
const VIEW_LABELS: Record<ViewMode, string> = { calendar: "Calendar", list: "List" };

function PostFacts({ post, platform }: { post: PostView; platform: SocialPlatform }) {
  const counts = captionCount(post, platform);
  const row = "grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-3";
  const term = "text-[13px] font-medium text-home-ink-2";
  const label = SOCIAL_PLATFORM_LABELS[platform];
  return (
    <dl className="flex flex-col gap-2 text-sm text-home-ink">
      <div className={row}><dt className={term}>Hook</dt><dd>{post.hook}</dd></div>
      <div className={row}>
        <dt className={term}>Caption for {label}</dt>
        <dd className="whitespace-pre-line">{chooseCaption(post, platform).caption}</dd>
      </div>
      <div className={row}><dt className={term}>Card text</dt><dd>{post.imageText}</dd></div>
      {post.imageAlt === undefined ? null : (
        <div className={row}><dt className={term}>Image description</dt><dd>{post.imageAlt}</dd></div>
      )}
      {post.pollOptions === undefined ? null : (
        <div className={row}>
          <dt className={term}>Poll options</dt>
          <dd>
            <p className="text-[13px] text-home-ink-2">Add these as the poll&apos;s choices on the platform.</p>
            <ol className="list-decimal pl-5">
              {post.pollOptions.map((option, index) => (
                <li key={index}>{option}</li>
              ))}
            </ol>
          </dd>
        </div>
      )}
      {post.hashtags.length === 0 ? null : (
        <div className={row}><dt className={term}>Hashtags</dt><dd>{hashtagLine(post.hashtags)}</dd></div>
      )}
      <div className={row}>
        <dt className={term}>Length for {label}</dt>
        <dd className="flex flex-col gap-0.5">
          <span>{counts.summary}</span>
          {counts.note === null ? null : <span>{counts.note}</span>}
        </dd>
      </div>
    </dl>
  );
}

function DayShort({ day }: { day: PostView["day"] }) {
  return (
    <span className="font-mono text-xs uppercase text-home-ink-3">
      <span aria-hidden="true">{SOCIAL_DAY_SHORT[day]}</span>
      <span className="sr-only">{SOCIAL_DAY_LABELS[day]}</span>
    </span>
  );
}

/** A list row: the board's row header (day, hook, format), then the facts and Copy. */
function PostItem({
  post,
  platform,
  onResult,
}: {
  post: PostView;
  platform: SocialPlatform;
  onResult: (message: string) => void;
}) {
  return (
    <li className={cn(CARD, "flex flex-col gap-3 p-4")}>
      <div className="flex flex-wrap items-center gap-3.5">
        <span className="w-[90px] shrink-0"><DayShort day={post.day} /></span>
        <h3 className="min-w-0 flex-1 text-[15px] font-medium text-home-ink">
          <span className="sr-only">{SOCIAL_DAY_NAMES[post.day]}: </span>
          {post.hook}
        </h3>
        <span className="rounded-full bg-home-sunk px-2 py-px text-xs text-home-ink-2">{SOCIAL_FORMAT_SHORT[post.format]}</span>
      </div>
      <p className={EYEBROW}>{SOCIAL_KIND_LABELS[post.kind]} · {SOCIAL_FORMAT_LABELS[post.format]}</p>
      <PostFacts post={post} platform={platform} />
      <div>
        <CopyButton post={post} platform={platform} onResult={onResult} />
      </div>
    </li>
  );
}

function PlatformPicker({ platform, onChange }: { platform: SocialPlatform; onChange: (next: SocialPlatform) => void }) {
  return (
    <fieldset role="radiogroup" className="flex min-w-0 flex-col">
      <legend className="mb-3 text-[17px] font-semibold text-home-ink">
        Where will you post? <span className="font-normal text-home-ink-3">· captions are fitted to the platform</span>
      </legend>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2.5">
        {SOCIAL_PLATFORMS.map((value) => {
          const checked = value === platform;
          return (
            <label
              key={value}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[10px] border bg-home-card p-3.5",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-home-orange-ink",
                checked ? "border-home-ink ring-1 ring-home-ink" : "border-home-rule hover:bg-home-paper",
              )}
            >
              <input
                type="radio"
                name="social-platform"
                value={value}
                checked={checked}
                onChange={() => onChange(value)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-home-sunk font-mono text-[13px] font-medium text-home-ink"
              >
                {SOCIAL_PLATFORM_MARKS[value]}
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="font-semibold text-home-ink">{SOCIAL_PLATFORM_LABELS[value]}</span>
                <span className="text-xs text-home-ink-3">{platformLimitCopy(value)}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function CalendarView({
  posts,
  platform,
  selected,
  onSelect,
  onResult,
  detailId,
}: {
  posts: readonly PostView[];
  platform: SocialPlatform;
  selected: number;
  onSelect: (index: number) => void;
  onResult: (message: string) => void;
  detailId: string;
}) {
  const post = posts[selected];
  return (
    <div className="flex flex-col gap-3">
      {/* One week, one row (Social board): the strip scrolls sideways when the column is narrow. Every day is a
          button, so keyboard focus scrolls it into view. */}
      <ol
        aria-label="Launch week calendar"
        className="grid auto-cols-[minmax(7.5rem,1fr)] grid-flow-col gap-2.5 overflow-x-auto pb-1"
      >
        {posts.map((item, i) => (
          <li key={item.day} className="min-w-0">
            <button
              type="button"
              aria-pressed={i === selected}
              aria-controls={detailId}
              onClick={() => onSelect(i)}
              className={cn(
                "flex h-full min-h-[200px] w-full flex-col gap-2 rounded-[10px] border bg-home-card p-3 text-left hover:bg-home-paper",
                FOCUS,
                i === selected ? "border-home-ink ring-1 ring-home-ink" : "border-home-rule",
              )}
            >
              <DayShort day={item.day} />
              <span
                aria-hidden="true"
                className={cn(
                  "flex aspect-square w-full items-end overflow-hidden rounded-md p-2 text-xs font-bold leading-[1.15] [overflow-wrap:anywhere]",
                  i % 2 === 0 ? "bg-home-panel text-home-card" : "bg-home-sunk text-home-ink",
                )}
              >
                {item.imageText}
              </span>
              <span className="text-[13px] leading-[1.35] text-home-ink">{item.hook}</span>
              <span className="mt-auto self-start rounded-full bg-home-sunk px-2 py-px text-[11px] text-home-ink-2">
                {SOCIAL_FORMAT_SHORT[item.format]}
              </span>
            </button>
          </li>
        ))}
      </ol>
      {post === undefined ? null : (
        <div
          id={detailId}
          role="region"
          aria-labelledby={`${detailId}-h`}
          className={cn(CARD, "flex flex-col gap-3 p-5")}
        >
          <p className={EYEBROW}>{SOCIAL_KIND_LABELS[post.kind]} · {SOCIAL_FORMAT_SHORT[post.format]}</p>
          <h3 id={`${detailId}-h`} className="text-base font-medium text-home-ink">{SOCIAL_DAY_LABELS[post.day]}</h3>
          <PostFacts post={post} platform={platform} />
          <div>
            <CopyButton post={post} platform={platform} onResult={onResult} />
          </div>
        </div>
      )}
    </div>
  );
}

function SocialReady({
  projectId,
  view,
}: {
  projectId: Id<"projects">;
  view: ReadyView;
}) {
  const [platform, setPlatform] = useState<SocialPlatform>("instagram");
  const [mode, setMode] = useState<ViewMode>("calendar");
  const [selected, setSelected] = useState(0);
  // A counter keys the live text, so the same result twice is a new node and is announced again.
  const [announcement, setAnnouncement] = useState({ text: "", count: 0 });
  const baseId = useId();
  const weekId = `${baseId}-week`;
  const onResult = (text: string) => setAnnouncement((previous) => ({ text, count: previous.count + 1 }));
  return (
    <div className="flex flex-col gap-5">
      <PlatformPicker platform={platform} onChange={setPlatform} />
      <div className="rounded-[10px] border border-dashed border-home-d2 bg-home-card p-4 text-[15px] text-home-ink">
        <span className="font-semibold">{SOCIAL_YOU_POST_TITLE}</span> {SOCIAL_YOU_POST_COPY}
      </div>
      {view.card === null ? null : (
        <LiveArtifactReview
          projectId={projectId}
          card={view.card}
          artifact={SOCIAL_ARTIFACT}
          headingLevel={2}
          approveLabel="Approve all 7"
        />
      )}
      <section aria-labelledby={weekId} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <h2 id={weekId} className="font-editorial text-[28px] font-normal leading-tight text-home-ink">
            {SOCIAL_WEEK_HEADING}
          </h2>
          <div role="group" aria-label="View" className="inline-flex rounded-full border border-home-rule bg-home-card p-1">
            {(Object.keys(VIEW_LABELS) as ViewMode[]).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
                className={cn(
                  "min-h-9 rounded-full px-3.5 text-[13px] font-medium",
                  FOCUS,
                  mode === value ? "bg-home-ink text-home-card" : "text-home-ink hover:bg-home-sunk",
                )}
              >
                {VIEW_LABELS[value]}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-home-ink-2">{SOCIAL_WEEK_NOTE}</p>
        <p role="status" aria-live="polite" data-testid="social-copy-status" className="min-h-5 text-[13px] text-home-ink-2">
          <span key={announcement.count}>{announcement.text}</span>
        </p>
        {mode === "calendar" ? (
          <CalendarView
            posts={view.posts}
            platform={platform}
            selected={Math.min(selected, view.posts.length - 1)}
            onSelect={setSelected}
            onResult={onResult}
            detailId={`${baseId}-detail`}
          />
        ) : (
          <ol aria-label="The posts, in order" className="flex flex-col gap-3">
            {view.posts.map((post) => (
              <PostItem key={post.day} post={post} platform={platform} onResult={onResult} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function SocialPackView({ projectId, view }: { projectId: Id<"projects">; view: SocialDraftView }) {
  if (view.state === "none") return <EmptyState>{SOCIAL_NONE_COPY}</EmptyState>;
  if (view.state === "unavailable") return <EmptyState>{SOCIAL_UNAVAILABLE_COPY}</EmptyState>;
  return <SocialReady projectId={projectId} view={view} />;
}

function LiveSocial({ projectId }: { projectId: Id<"projects"> }) {
  const view = useQuery(api.growth.drafts.socialPack.socialPackDraft, { projectId });
  if (view === undefined) return <LoadingState label="Loading your posts…" />;
  return <SocialPackView projectId={projectId} view={view} />;
}

export function SocialPackPanel({ projectId }: { projectId: Id<"projects"> }) {
  const failed = <ErrorState message="Your posts couldn't load right now. Reload the page to try again." />;
  return (
    <WhenConvexReady fallback={<LoadingState label="Loading your posts…" />} unavailable={failed}>
      <QuietErrorBoundary fallback={failed}>
        <LiveSocial projectId={projectId} />
      </QuietErrorBoundary>
    </WhenConvexReady>
  );
}
