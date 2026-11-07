"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useId, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { QuietErrorBoundary, WhenConvexReady } from "@/components/platform/client-gates";
import { EmptyState, ErrorState, LoadingState } from "@/components/workspace/kit/states";
import { BTN_SECONDARY, CARD, EYEBROW, FOCUS } from "@/components/workspace/kit/styles";
import { ArtifactReviewCard, type ReviewDecide } from "@/components/workspace/review/ArtifactReviewCard";
import { cn } from "@/lib/utils";
import { SOCIAL_PLATFORMS, type SocialPlatform } from "@/lib/workspace/contracts/artifacts";
import type { PreviewState } from "@/lib/workspace/emailPage";
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
  SOCIAL_NO_POSTING_COPY,
  SOCIAL_PLATFORM_LABELS,
  SOCIAL_UNAVAILABLE_COPY,
} from "@/lib/workspace/socialPage";

type SocialDraftView = FunctionReturnType<typeof api.growth.drafts.socialPack.socialPackDraft>;
type ReadyView = Extract<SocialDraftView, { state: "ready" }>;
type PostView = ReadyView["posts"][number];

/**
 * WP76-S2b: the Social page. The founder reads the crew's seven posts, copies
 * each for the platform they post on, and approves the pack or asks for
 * changes. Nothing here posts or schedules.
 *
 * Accessibility:
 * - the route is the h1; the pack is the h2; each post is an h3 in an ordered
 *   list; the facts of a post are a description list;
 * - everything from the server is a React text node, never HTML;
 * - the platform picker is a labelled native select;
 * - the character count is words ("212 of 280 characters"), and over the
 *   limit says so in words, never colour alone;
 * - Copy is a text button whose accessible name says which post and platform;
 *   the result is read from one always-mounted polite live region.
 */

export type SocialDecide = ReviewDecide;

const SOCIAL_ARTIFACT = { plural: "posts", approvedNote: SOCIAL_APPROVED_NOTE } as const;

function isPlatform(value: string): value is SocialPlatform {
  return SOCIAL_PLATFORMS.some((platform) => platform === value);
}

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

function PostItem({
  post,
  platform,
  onResult,
}: {
  post: PostView;
  platform: SocialPlatform;
  onResult: (message: string) => void;
}) {
  const counts = captionCount(post, platform);
  const row = "grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-3";
  const term = "text-[13px] font-medium text-home-ink-2";
  const label = SOCIAL_PLATFORM_LABELS[platform];
  return (
    <li className={cn(CARD, "flex flex-col gap-3 p-4")}>
      <div className="flex flex-col gap-0.5">
        <p className={EYEBROW}>
          {SOCIAL_KIND_LABELS[post.kind]} · {SOCIAL_FORMAT_LABELS[post.format]}
        </p>
        <h3 className="text-base font-medium text-home-ink">{SOCIAL_DAY_LABELS[post.day]}</h3>
      </div>
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
      <div>
        <CopyButton post={post} platform={platform} onResult={onResult} />
      </div>
    </li>
  );
}

function SocialReady({
  projectId,
  view,
  decide,
}: {
  projectId: Id<"projects">;
  view: ReadyView;
  decide: SocialDecide;
}) {
  const [platform, setPlatform] = useState<SocialPlatform>("instagram");
  // A counter keys the live text, so the same result twice is a new node and is announced again.
  const [announcement, setAnnouncement] = useState({ text: "", count: 0 });
  const pickerId = useId();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium text-home-ink">Your first week of posts</h2>
        <p className="text-[13px] text-home-ink-2">
          {view.posts.length} posts, Friday to Thursday. {SOCIAL_NO_POSTING_COPY}
        </p>
      </div>
      {view.card === null ? null : (
        <QuietErrorBoundary
          key={view.card.approvalId}
          fallback={<SocialReviewCard card={view.card} decide={decide} preview={{ kind: "failed" }} />}
        >
          <LiveReview projectId={projectId} card={view.card} decide={decide} />
        </QuietErrorBoundary>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={pickerId} className="text-[13px] font-medium text-home-ink">Post on</label>
        <select
          id={pickerId}
          value={platform}
          onChange={(event) => {
            const next = event.target.value;
            if (isPlatform(next)) setPlatform(next);
          }}
          className={cn("min-h-10 w-full max-w-xs rounded-lg border border-home-rule bg-home-card px-2 text-sm text-home-ink", FOCUS)}
        >
          {SOCIAL_PLATFORMS.map((value) => (
            <option key={value} value={value}>{SOCIAL_PLATFORM_LABELS[value]}</option>
          ))}
        </select>
      </div>
      <p role="status" aria-live="polite" data-testid="social-copy-status" className="min-h-5 text-[13px] text-home-ink-2">
        <span key={announcement.count}>{announcement.text}</span>
      </p>
      <ol aria-label="The posts, in order" className="flex flex-col gap-3">
        {view.posts.map((post) => (
          <PostItem key={post.day} post={post} platform={platform} onResult={(text) => setAnnouncement((previous) => ({ text, count: previous.count + 1 }))} />
        ))}
      </ol>
    </div>
  );
}

function SocialReviewCard({
  card,
  decide,
  preview,
}: {
  card: NonNullable<ReadyView["card"]>;
  decide: SocialDecide;
  preview: PreviewState;
}) {
  return <ArtifactReviewCard card={card} decide={decide} preview={preview} artifact={SOCIAL_ARTIFACT} />;
}

function LiveReview({
  projectId,
  card,
  decide,
}: {
  projectId: Id<"projects">;
  card: NonNullable<ReadyView["card"]>;
  decide: SocialDecide;
}) {
  const asks = card.status === "pending" || card.status === "changes_requested";
  const preview = useQuery(
    api.workspace.changeRounds.previewChangeRound,
    asks ? { projectId, approvalId: card.approvalId } : "skip",
  );
  const state: PreviewState = preview === undefined ? { kind: "loading" } : { kind: "ready", preview };
  return <SocialReviewCard card={card} decide={decide} preview={state} />;
}

function SocialPackView({ projectId, view, decide }: { projectId: Id<"projects">; view: SocialDraftView; decide: SocialDecide }) {
  if (view.state === "none") return <EmptyState>{SOCIAL_NONE_COPY}</EmptyState>;
  if (view.state === "unavailable") return <EmptyState>{SOCIAL_UNAVAILABLE_COPY}</EmptyState>;
  return <SocialReady projectId={projectId} view={view} decide={decide} />;
}

function LiveSocial({ projectId }: { projectId: Id<"projects"> }) {
  const view = useQuery(api.growth.drafts.socialPack.socialPackDraft, { projectId });
  const decideApproval = useMutation(api.workspace.approvals.decideApproval);
  if (view === undefined) return <LoadingState label="Loading your posts…" />;
  const approvalId = view.state === "ready" && view.card !== null ? view.card.approvalId : null;
  const decide: SocialDecide = async (decision, note) => {
    if (approvalId === null) throw new Error("no card");
    return await decideApproval({ projectId, approvalId, decision, ...(note === undefined ? {} : { note }) });
  };
  return <SocialPackView projectId={projectId} view={view} decide={decide} />;
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
