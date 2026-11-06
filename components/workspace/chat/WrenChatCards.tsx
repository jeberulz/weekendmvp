"use client";

import Link from "next/link";
import { useMutation } from "convex/react";
import { useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { WrenCardView } from "@/convex/workspace/wrenCards";
import { CARD_SHELL } from "@/components/workspace/kit/WrenCards";
import { BTN_PRIMARY, BTN_SECONDARY, FOCUS } from "@/components/workspace/kit/styles";
import { cn } from "@/lib/utils";
import { workspacePath } from "@/lib/workspace/routes";
import {
  navigateRouteSlug,
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
 * Every word on a card is static copy chosen by the server-checked key: the
 * approval card's title comes from the server, the explanation from
 * `WREN_EXPLAIN_COPY`, the link label from `WREN_NAVIGATE_LABELS`, and the
 * link itself is `workspacePath(projectId, route)`, always inside this
 * business. A key the client does not know renders nothing.
 *
 * Approval cards reuse S1's `decideApproval` (approve or "Not now", which
 * cancels). That click never counts against the Wren message cap. Buttons
 * stay focusable while a decision is in flight (`aria-disabled`), so focus is
 * not lost; the outcome is read out by the card's polite status line.
 */

const STATUS_LABEL: Record<Extract<WrenCardView, { kind: "approval" }>["status"], string> = {
  pending: "Waiting for you",
  approved: "Approved",
  changes_requested: "Changes requested",
  expired: "Expired",
  cancelled: "Not going ahead",
};

function isExplainTopic(topic: string): topic is WrenExplainTopic {
  return Object.prototype.hasOwnProperty.call(WREN_EXPLAIN_TOPICS, topic);
}

function isNavigateRoute(route: string): route is WrenNavigateRoute {
  return Object.prototype.hasOwnProperty.call(WREN_NAVIGATE_ROUTES, route);
}

function ApprovalChatCard({
  projectId,
  card,
}: {
  projectId: Id<"projects">;
  card: Extract<WrenCardView, { kind: "approval" }>;
}) {
  const decide = useMutation(api.workspace.approvals.decideApproval);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);
  const titleId = `wren-card-${card.approvalId}-title`;

  function choose(decision: "approve" | "cancel") {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    void decide({ projectId, approvalId: card.approvalId, decision })
      .then((result) => {
        setMessage(result.status === "approved" ? "Approved." : result.status === "cancelled" ? "Okay, not now." : "");
      })
      .catch(() => setMessage("That didn't go through. Open the card again in a moment."))
      .finally(() => {
        inFlight.current = false;
        setPending(false);
      });
  }

  return (
    <li data-card="wren-approval" data-state={card.status} aria-labelledby={titleId} className={CARD_SHELL}>
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-home-ink-3">Approval</p>
      <p id={titleId} className="text-sm font-medium text-home-ink">{card.title}</p>
      <p className="text-[13px] text-home-ink-2">Status: {STATUS_LABEL[card.status]}</p>
      {card.status === "pending" ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-disabled={pending || undefined}
            className={BTN_PRIMARY}
            onClick={() => choose("approve")}
          >
            Approve<span className="sr-only"> · {card.title}</span>
          </button>
          <button
            type="button"
            aria-disabled={pending || undefined}
            className={BTN_SECONDARY}
            onClick={() => choose("cancel")}
          >
            Not now<span className="sr-only"> · {card.title}</span>
          </button>
        </div>
      ) : null}
      <p role="status" aria-live="polite" className="min-h-5 text-[13px] text-home-ink-2">
        {pending ? "Sending your decision…" : message}
      </p>
    </li>
  );
}

function ExplainChatCard({ topic }: { topic: WrenExplainTopic }) {
  const copy = WREN_EXPLAIN_COPY[topic];
  const titleId = `wren-explain-${topic}`;
  return (
    <li data-card="wren-explain" aria-labelledby={titleId} className={CARD_SHELL}>
      <p id={titleId} className="text-sm font-medium text-home-ink">{copy.title}</p>
      <p className="text-[13px] text-home-ink-2">{copy.body}</p>
    </li>
  );
}

function NavigateChatCard({ projectId, route }: { projectId: Id<"projects">; route: WrenNavigateRoute }) {
  return (
    <li data-card="wren-navigate" className={CARD_SHELL}>
      <Link
        href={workspacePath(projectId, navigateRouteSlug(route))}
        className={cn("inline-flex min-h-6 items-center text-sm font-medium underline underline-offset-2", FOCUS)}
      >
        {WREN_NAVIGATE_LABELS[route]}
      </Link>
    </li>
  );
}

export function WrenChatCards({ projectId, cards }: { projectId: Id<"projects">; cards: readonly WrenCardView[] }) {
  const shown = cards.filter((card) =>
    card.kind === "approval" ||
    (card.kind === "explain" && isExplainTopic(card.topic)) ||
    (card.kind === "navigate" && isNavigateRoute(card.route)));
  if (shown.length === 0) return null;
  return (
    <ul aria-label="Cards from Wren" className="flex flex-col gap-2">
      {shown.map((card) => {
        switch (card.kind) {
          case "approval":
            return <ApprovalChatCard key={card.approvalId} projectId={projectId} card={card} />;
          case "explain":
            return isExplainTopic(card.topic) ? <ExplainChatCard key={`explain-${card.topic}`} topic={card.topic} /> : null;
          case "navigate":
            return isNavigateRoute(card.route)
              ? <NavigateChatCard key={`navigate-${card.route}`} projectId={projectId} route={card.route} />
              : null;
        }
      })}
    </ul>
  );
}
