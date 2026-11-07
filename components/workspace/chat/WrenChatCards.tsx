"use client";

import Link from "next/link";
import { useMutation } from "convex/react";
import { useEffect, useId, useRef, useState, type FocusEvent } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { WrenCardView } from "@/convex/workspace/wrenCards";
import { ROLE_CATALOGUE } from "@/convex/crew/roles";
import { StatusPill } from "@/components/workspace/kit/StatusPill";
import { CARD_SHELL, DEFAULT_PARTNER_NAME, FromAttribution } from "@/components/workspace/kit/WrenCards";
import { BTN_PRIMARY, BTN_SECONDARY, COMING_SOON_TAG, FOCUS } from "@/components/workspace/kit/styles";
import type { OutputStatus } from "@/components/workspace/kit/types";
import { cn } from "@/lib/utils";
import type { RoleKey } from "@/lib/workspace/contracts/roster";
import { COMING_SOON_LABEL, workspacePath, workspaceRoute, type WorkspaceRouteSlug } from "@/lib/workspace/routes";
import {
  approvalDecisionCopy,
  approvalDecisionErrorCopy,
  errorCode,
  navigateRouteSlug,
  STATUS_LABEL,
  WREN_EXPLAIN_COPY,
  WREN_NAVIGATE_LABELS,
} from "@/lib/workspace/wrenCards";
import {
  WREN_EXPLAIN_TOPICS,
  WREN_NAVIGATE_ROUTES,
  type WrenExplainTopic,
  type WrenNavigateRoute,
} from "@/lib/workspace/contracts/wrenTools";

/**
 * WP77-S4. The cards a Wren reply carries, under the reply text.
 *
 * Every word on a card is chosen by the server or by a server-checked key:
 * the approval card's title and subject line come from the server (the
 * subject line is founder or crew text, rendered as a plain text node), the
 * explanation from `WREN_EXPLAIN_COPY`, the link labels from static maps, and
 * every link is `workspacePath(projectId, route)`, always inside this
 * business. A key the client does not know renders nothing.
 *
 * Approval cards reuse S1's `decideApproval` (approve or "Not now", which
 * cancels). That click never counts against the Wren message cap. Buttons
 * stay focusable while a decision is in flight (`aria-disabled`). When the
 * decision returns, or the card leaves `pending` while focus was on its
 * buttons, focus moves to the card's status line (`tabIndex={-1}`), so it is
 * never dropped on `<body>` when the buttons go away, and the screen reader
 * reads the outcome there. The decision outcome sits in a polite live
 * region that is always mounted (so focus moving to the status line before the
 * text renders still gets the outcome read). The thread's log is
 * `aria-live="off"`; the panel announces Wren's replies in its own region. Ids come from `useId`, so the
 * same approval shown in two replies never duplicates an id.
 */

type ApprovalView = Extract<WrenCardView, { kind: "approval" }>;

function isExplainTopic(topic: string): topic is WrenExplainTopic {
  return Object.prototype.hasOwnProperty.call(WREN_EXPLAIN_TOPICS, topic);
}

function isNavigateRoute(route: string): route is WrenNavigateRoute {
  return Object.prototype.hasOwnProperty.call(WREN_NAVIGATE_ROUTES, route);
}

export function isFocusIn(element: HTMLElement | null): boolean {
  const active = document.activeElement;
  return active !== null && element !== null && element.contains(active);
}

export type FocusFlags = {
  /** Focus is on this card's buttons now (kept by focus / blur on the button group). */
  onButtons: boolean;
  /** Focus was on the buttons when the founder's decision started (kept until that decision settles). */
  decision: boolean;
};

/**
 * Moves focus to the card's status line when focus was on the card's buttons
 * (either flag) and is still there or was dropped on the page body by the
 * buttons going away. Focus the founder moved elsewhere is left alone.
 */
export function returnFocusToStatus(
  flags: { readonly current: FocusFlags },
  buttons: { readonly current: HTMLElement | null },
  status: { readonly current: HTMLElement | null },
) {
  if (!flags.current.onButtons && !flags.current.decision) return;
  flags.current.onButtons = false;
  flags.current.decision = false;
  const active = document.activeElement;
  if (active === null || active === document.body || isFocusIn(buttons.current)) status.current?.focus();
}

/**
 * Focus left the button group for somewhere else. A blur with no new target
 * from a button that is still in the page (a click on empty page, the window
 * losing focus) counts too; a blur caused by the button being removed does
 * not, so a status change can still return focus from a removed button.
 */
export function focusLeftGroup(event: FocusEvent<HTMLElement>): boolean {
  const next = event.relatedTarget;
  if (next instanceof Node && event.currentTarget.contains(next)) return false;
  return next !== null || event.target.isConnected;
}

/**
 * Which specialist raised an approval, worked out here from the kind (the
 * server sends only the kind): send is Email, post is Social, publish is the
 * Landing specialist. Wren can raise no other kind in L1.
 */
export function approvalSpecialist(approvalKind: string): RoleKey | null {
  switch (approvalKind) {
    case "send":
      return "email";
    case "post":
      return "social";
    case "publish":
      return "landing";
    default:
      return null;
  }
}

/** The kit status set an approval's status renders in (the visible words come from `STATUS_LABEL`). */
const PILL_STATUS: Readonly<Record<ApprovalView["status"], OutputStatus>> = {
  pending: "ready",
  approved: "approved",
  changes_requested: "changes_requested",
  expired: "draft",
  cancelled: "draft",
};

function ApprovalChatCard({
  projectId,
  card,
  name,
  time,
}: {
  projectId: Id<"projects">;
  card: ApprovalView;
  name: string;
  time: string;
}) {
  const decide = useMutation(api.workspace.approvals.decideApproval);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);
  const buttonsRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  /** Where focus was, so it can be returned to the status line when the buttons go (see `returnFocusToStatus`). */
  const focusFlags = useRef<FocusFlags>({ onButtons: false, decision: false });
  const id = useId();
  const titleId = `${id}-title`;
  const context = card.subject === "" ? card.title : `${card.title}, ${card.subject}`;

  useEffect(() => {
    if (card.status !== "pending") returnFocusToStatus(focusFlags, buttonsRef, statusRef);
  }, [card.status]);

  function choose(decision: "approve" | "cancel") {
    if (inFlight.current) return;
    inFlight.current = true;
    focusFlags.current.decision = isFocusIn(buttonsRef.current);
    setPending(true);
    void decide({ projectId, approvalId: card.approvalId, decision })
      .then((result) =>
        setMessage(approvalDecisionCopy(result.status, { approvalKind: card.approvalKind, partnerName: name })))
      .catch((error: unknown) => setMessage(approvalDecisionErrorCopy(errorCode(error), name)))
      .finally(() => {
        inFlight.current = false;
        setPending(false);
        returnFocusToStatus(focusFlags, buttonsRef, statusRef);
      });
  }

  const specialist = approvalSpecialist(card.approvalKind);
  const reviewHref = workspacePath(projectId, card.reviewRoute);
  const entry = specialist === null ? undefined : ROLE_CATALOGUE.find((role) => role.key === specialist);

  return (
    <li data-card="wren-approval" data-state={card.status} aria-labelledby={titleId} className="flex flex-col gap-2">
      {specialist !== null && entry !== undefined ? (
        <FromAttribution
          from={{ name: entry.employeeName, role: specialist }}
          time={time}
          workstreamHref={reviewHref}
          linkLabel="Review"
          routedBy={name}
        />
      ) : (
        <p>
          <Link
            href={reviewHref}
            className={cn("inline-flex min-h-6 items-center text-[13px] font-medium underline underline-offset-2", FOCUS)}
          >
            Review<span className="sr-only"> · {context}</span>
          </Link>
        </p>
      )}
      <div className={CARD_SHELL}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <p id={titleId} className="text-sm font-medium text-home-ink">{card.title}</p>
            {card.subject === "" ? null : (
              <p data-card-subject className="text-[13px] text-home-ink-3">{card.subject}</p>
            )}
          </div>
          <StatusPill set="output" status={PILL_STATUS[card.status]} label={STATUS_LABEL[card.status]} className="shrink-0" />
        </div>
        {card.status === "pending" ? (
          <div
            ref={buttonsRef}
            className="flex flex-wrap items-center gap-2"
            onFocus={() => {
              focusFlags.current.onButtons = true;
            }}
            onBlur={(event) => {
              if (focusLeftGroup(event)) focusFlags.current.onButtons = false;
            }}
          >
            <button
              type="button"
              aria-disabled={pending || undefined}
              className={BTN_PRIMARY}
              onClick={() => choose("approve")}
            >
              Approve<span className="sr-only"> · {context}</span>
            </button>
            <button
              type="button"
              aria-disabled={pending || undefined}
              className={BTN_SECONDARY}
              onClick={() => choose("cancel")}
            >
              Not now<span className="sr-only"> · {context}</span>
            </button>
          </div>
        ) : null}
        <div
          ref={statusRef}
          tabIndex={-1}
          data-card-status
          className={cn("flex flex-col gap-1 rounded text-[13px] text-home-ink-2", FOCUS)}
        >
          <p role="status" aria-live="polite">{pending ? "Sending your decision…" : message}</p>
        </div>
      </div>
    </li>
  );
}

/** Static card copy says "Wren"; the founder's co-founder has the name they chose. */
export function partnerCopy(text: string, name: string): string {
  return name === DEFAULT_PARTNER_NAME ? text : text.replaceAll(DEFAULT_PARTNER_NAME, name);
}

function ExplainChatCard({ topic, name }: { topic: WrenExplainTopic; name: string }) {
  const copy = WREN_EXPLAIN_COPY[topic];
  const titleId = `${useId()}-title`;
  return (
    <li data-card="wren-explain" aria-labelledby={titleId} className={CARD_SHELL}>
      <p id={titleId} className="text-sm font-medium text-home-ink">{partnerCopy(copy.title, name)}</p>
      <p className="text-[13px] text-home-ink-2">{partnerCopy(copy.body, name)}</p>
    </li>
  );
}

function NavigateChatCard({ projectId, route }: { projectId: Id<"projects">; route: WrenNavigateRoute }) {
  const slug = navigateRouteSlug(route);
  // Wren may point at a page that is not built yet (launch plan, build pack, tasks, ads, settings): say so.
  const comingSoon = workspaceRoute(slug as WorkspaceRouteSlug).comingSoon;
  return (
    <li data-card="wren-navigate" className={cn(CARD_SHELL, "flex-row flex-wrap items-center gap-x-3")}>
      <Link
        href={workspacePath(projectId, slug)}
        className={cn("inline-flex min-h-6 items-center text-sm font-medium underline underline-offset-2", FOCUS)}
      >
        {WREN_NAVIGATE_LABELS[route]}
      </Link>
      {comingSoon ? <span className={COMING_SOON_TAG}>{COMING_SOON_LABEL}</span> : null}
    </li>
  );
}

/** The cards that render: approvals, and explain or navigate cards whose key this client knows. */
export function visibleWrenCards(cards: readonly WrenCardView[]): WrenCardView[] {
  return cards.filter((card) =>
    card.kind === "approval" ||
    (card.kind === "explain" && isExplainTopic(card.topic)) ||
    (card.kind === "navigate" && isNavigateRoute(card.route)));
}

export function WrenChatCards({
  projectId,
  cards,
  name = DEFAULT_PARTNER_NAME,
  time = "",
}: {
  projectId: Id<"projects">;
  cards: readonly WrenCardView[];
  /** The co-founder's name. Default "Wren" only when the founder's is missing. */
  name?: string;
  /** The reply's time, shown on each approval's "From" line. */
  time?: string;
}) {
  const shown = visibleWrenCards(cards);
  if (shown.length === 0) return null;
  return (
    <ul aria-label={`Cards from ${name}`} className="flex flex-col gap-2">
      {shown.map((card) => {
        switch (card.kind) {
          case "approval":
            return <ApprovalChatCard key={card.approvalId} projectId={projectId} card={card} name={name} time={time} />;
          case "explain":
            return isExplainTopic(card.topic) ? <ExplainChatCard key={`explain-${card.topic}`} topic={card.topic} name={name} /> : null;
          case "navigate":
            return isNavigateRoute(card.route)
              ? <NavigateChatCard key={`navigate-${card.route}`} projectId={projectId} route={card.route} />
              : null;
        }
      })}
    </ul>
  );
}
