"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowBigUp, Lightbulb } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  IDEA_REQUEST_CATEGORIES,
  MAX_REQUEST_PROBLEM_LENGTH,
  MAX_REQUEST_TITLE_LENGTH,
  validateIdeaRequest,
} from "@/lib/idea-requests";
import { CATEGORY_META } from "@/components/ideas/idea-meta";
import { useSessionHint } from "@/lib/use-session-hint";
import { cn } from "@/lib/utils";

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black";

export type IdeaRequestMoodEvent =
  | "vote-success"
  | "submit-start"
  | "submit-success"
  | "submit-error";

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_research: "In research",
  published: "Published",
  declined: "Declined",
};

/**
 * Idea 4 — the shared request list + submit form. Used by the floating
 * widget (`IdeaRequestWidget`) and by the full page (`/ideas/requests`).
 * Server-rendered nothing: the parent gates this behind `WhenConvexReady`
 * so `useQuery` never runs before a Convex client exists.
 *
 * Signed-in only: the full page is gated behind signup in middleware, so
 * anonymous visitors never reach it there — but the floating widget also
 * renders this panel on public pages. For anonymous visitors the panel
 * shows a create-account CTA instead of the form or the list, and the
 * Convex mutations fail closed for anonymous callers as the backstop.
 * `useSessionHint` is a cookie hint, used here for wording/links only —
 * never an access decision (see lib/use-session-hint.ts).
 */
export function IdeaRequestPanel({
  limit = 5,
  onMood,
}: {
  limit?: number;
  /** Lets the widget character react (celebrate a vote, think while submitting). */
  onMood?: (event: IdeaRequestMoodEvent) => void;
}) {
  const [title, setTitle] = useState("");
  const [problem, setProblem] = useState("");
  const [category, setCategory] = useState("");
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [votingId, setVotingId] = useState<Id<"idea_requests"> | null>(null);

  const signedIn = useSessionHint();
  const requests = useQuery(
    api.ideaRequests.listTop,
    signedIn ? { limit } : "skip",
  );
  const myRequests = useQuery(api.ideaRequests.mine, signedIn ? {} : "skip");
  const submitRequest = useMutation(api.ideaRequests.submit);
  const toggleVote = useMutation(api.ideaRequests.toggleVote);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormErrors([]);
    setStatus("");
    const validated = validateIdeaRequest({ title, problem, category });
    if (!validated.ok) {
      setFormErrors(validated.errors);
      return;
    }
    setSubmitting(true);
    onMood?.("submit-start");
    try {
      const result = await submitRequest({
        title: validated.title,
        problem: validated.problem,
        ...(validated.category ? { category: validated.category } : {}),
      });
      setTitle("");
      setProblem("");
      setCategory("");
      onMood?.("submit-success");
      setStatus(
        result.deduped
          ? "That idea is already on the list — vote for it below instead."
          : "Thanks — your idea request is on the list.",
      );
    } catch (error) {
      onMood?.("submit-error");
      setFormErrors([
        error instanceof Error
          ? error.message.replace(/^(VALIDATION|RATE_LIMITED|UNAUTHENTICATED):\s*/, "")
          : "Could not submit your request. Please try again.",
      ]);
    } finally {
      setSubmitting(false);
    }
  }

  async function onVote(requestId: Id<"idea_requests">) {
    setVotingId(requestId);
    setStatus("");
    try {
      const result = await toggleVote({ requestId });
      if (result.voted) onMood?.("vote-success");
    } catch {
      setStatus("Could not record your vote. Please try again.");
    } finally {
      setVotingId(null);
    }
  }

  // Signed-in only (see the header comment): anonymous visitors get the
  // create-account CTA instead of the form, the list, or any vote button.
  // The full page is also gated behind signup in middleware, so this is
  // the widget's public-page behaviour, not the page's only defence.
  if (!signedIn) {
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-base font-medium text-neutral-900">
          Request an idea — for members
        </h3>
        <p className="text-sm leading-relaxed text-neutral-600">
          Idea requests and voting are only for users who have created an
          account. Create a free account and tell us what to research next —
          the most-voted requests feed the research queue.
        </p>
        <Link
          href="/signup?returnTo=%2Fideas%2Frequests"
          className={cn(
            "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-black px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-800",
            FOCUS,
          )}
        >
          <Lightbulb aria-hidden className="size-4" />
          Create a free account
        </Link>
        <p className="text-sm text-neutral-600">
          Already have one?{" "}
          <Link
            href="/login?returnTo=%2Fideas%2Frequests"
            className={cn("font-medium underline underline-offset-4 hover:text-black", FOCUS)}
          >
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={onSubmit} className="flex flex-col gap-3" aria-label="Request a startup idea">
        <div className="flex flex-col gap-1">
          <label htmlFor="idea-request-title" className="text-sm font-medium text-neutral-800">
            What should we research next?
          </label>
          <input
            id="idea-request-title"
            name="title"
            type="text"
            value={title}
            maxLength={MAX_REQUEST_TITLE_LENGTH}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. A CRM for freelance photographers"
            className={cn(
              "min-h-11 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400",
              FOCUS,
            )}
          />
          <p className="text-xs text-neutral-500">
            {title.length}/{MAX_REQUEST_TITLE_LENGTH} characters
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="idea-request-problem" className="text-sm font-medium text-neutral-800">
            Who is it for, and what problem does it solve?
          </label>
          <textarea
            id="idea-request-problem"
            name="problem"
            value={problem}
            maxLength={MAX_REQUEST_PROBLEM_LENGTH}
            rows={2}
            onChange={(event) => setProblem(event.target.value)}
            placeholder="e.g. Freelance photographers lose track of client follow-ups"
            className={cn(
              "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400",
              FOCUS,
            )}
          />
          <p className="text-xs text-neutral-500">
            {problem.length}/{MAX_REQUEST_PROBLEM_LENGTH} characters
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="idea-request-category" className="text-sm font-medium text-neutral-800">
            Category <span className="font-normal text-neutral-500">(optional)</span>
          </label>
          <select
            id="idea-request-category"
            name="category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className={cn(
              "min-h-11 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900",
              FOCUS,
            )}
          >
            <option value="">No category</option>
            {IDEA_REQUEST_CATEGORIES.map((slug) => (
              <option key={slug} value={slug}>
                {CATEGORY_META[slug]?.name ?? slug}
              </option>
            ))}
          </select>
        </div>
        {formErrors.length > 0 && (
          <ul role="alert" className="flex flex-col gap-1 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {formErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}
        <button
          type="submit"
          disabled={submitting}
          className={cn(
            "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-black px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-60",
            FOCUS,
          )}
        >
          <Lightbulb aria-hidden className="size-4" />
          {submitting ? "Submitting…" : "Request this idea"}
        </button>
        {status && (
          <p role="status" className="text-sm text-neutral-600">
            {status}
          </p>
        )}
      </form>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-neutral-800">Most requested</h3>
        {requests === undefined && (
          <p className="text-sm text-neutral-500">Loading requests…</p>
        )}
        {requests !== undefined && requests.length === 0 && (
          <p className="text-sm text-neutral-500">
            No requests yet — yours could be the first.
          </p>
        )}
        {requests !== undefined && requests.length > 0 && (
          <ul className="flex flex-col gap-2">
            {requests.map((request) => (
              <li
                key={request.id}
                className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2.5"
              >
                <button
                  type="button"
                  aria-pressed={request.hasVoted}
                  aria-label={`Vote for ${request.title}`}
                  disabled={votingId === request.id}
                  onClick={() => void onVote(request.id)}
                  className={cn(
                    "flex min-h-11 min-w-11 shrink-0 flex-col items-center justify-center rounded-lg border px-2 py-1 text-xs font-medium transition-colors disabled:opacity-60",
                    FOCUS,
                    request.hasVoted
                      ? "border-black bg-black text-white"
                      : "border-neutral-300 bg-white text-neutral-800 hover:border-neutral-500",
                  )}
                >
                  <ArrowBigUp aria-hidden className="size-4" />
                  {request.voteCount}
                  <span className="sr-only">votes</span>
                </button>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-900">{request.title}</p>
                  <p className="text-sm text-neutral-600">{request.problem}</p>
                  {request.category && (
                    <p className="text-xs text-neutral-500">
                      {CATEGORY_META[request.category]?.name ?? request.category}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-neutral-500">
          One vote per person per request.{" "}
          <Link href="/ideas/requests" className={cn("font-medium underline underline-offset-4 hover:text-black", FOCUS)}>
            See all requests
          </Link>
        </p>
      </div>

      {signedIn && (
        <div className="flex flex-col gap-2 border-t border-neutral-100 pt-4">
          <h3 className="text-sm font-medium text-neutral-800">My requests</h3>
          {myRequests === undefined && (
            <p className="text-sm text-neutral-500">Loading your requests…</p>
          )}
          {myRequests !== undefined && myRequests.length === 0 && (
            <p className="text-sm text-neutral-500">
              You haven&apos;t requested anything yet — your requests will show up here, on any device.
            </p>
          )}
          {myRequests !== undefined && myRequests.length > 0 && (
            <ul className="flex flex-col gap-2">
              {myRequests.map((request) => (
                <li
                  key={request.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-900">{request.title}</p>
                    <p className="text-xs text-neutral-500">
                      {STATUS_LABELS[request.status] ?? request.status} · {request.voteCount}{" "}
                      {request.voteCount === 1 ? "vote" : "votes"}
                    </p>
                  </div>
                  {request.hasVoted && (
                    <span className="shrink-0 rounded-full bg-black px-2 py-0.5 text-xs font-medium text-white">
                      Voted
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
