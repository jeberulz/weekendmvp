"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { QuietErrorBoundary, WhenConvexReady } from "@/components/platform/client-gates";
import { CARD_SHELL, WrenMessage } from "@/components/workspace/kit/WrenCards";
import { UserMessage, WrenComposer, WrenThread } from "@/components/workspace/kit/WrenThread";
import { WrenChatCards } from "@/components/workspace/chat/WrenChatCards";
import { EmptyState, LoadingState } from "@/components/workspace/kit/states";
import { FOCUS } from "@/components/workspace/kit/styles";
import { cn } from "@/lib/utils";
import { resetsInLabel, WREN_STREAM_STALE_MS, WREN_TOMORROW_CARD } from "@/lib/workspace/wren";

/**
 * WP77-S3. The minimal Wren chat: the thread (`listWrenThread`), the composer
 * (`sendWrenMessage`) and Retry on a failed reply (`retryWrenReply`). The
 * reply streams in as the gateway writes it to the row. Full polish is S6.
 * WP77-S4: a finished reply shows its cards (`WrenChatCards`) under the text.
 *
 * Accessibility (S6): the thread is the kit's `role="log"`, but it is switched
 * to `aria-live="off"` here, so streamed drafts are never read out. Wren's
 * replies are announced once, by the single polite status line under the
 * thread: "Wren is writing…" when a reply starts, the finished reply when it
 * is done, and a plain line when it fails or stops. Send outcomes (busy,
 * paused, an error) use the same line and take priority. The message cap
 * shows the break card, outside the log, with the reset time the limiter
 * reported. Focus: sending keeps focus in the composer; "Try again" hands
 * focus to the composer because the button leaves the page.
 */

type Notice =
  | { kind: "none" }
  | { kind: "tomorrow"; resetsIn: string }
  | { kind: "message"; text: string };

const ANNOUNCE_MAX_CHARS = 600;
const UNLOADED = Symbol("unloaded");

function repliedAnnouncement(body: string, cardCount: number): string {
  const text = body.trim();
  const shown = text.length > ANNOUNCE_MAX_CHARS ? `${text.slice(0, ANNOUNCE_MAX_CHARS)}… Read the rest in the thread.` : text;
  const cards = cardCount === 0 ? "" : cardCount === 1 ? " 1 card from Wren is below the reply." : ` ${cardCount} cards from Wren are below the reply.`;
  return `Wren replied: ${shown}${cards}`;
}

const TIME_FORMAT: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };

function TomorrowCard({ resetsIn }: { resetsIn: string }) {
  return (
    <div data-card="wren-tomorrow" className={CARD_SHELL}>
      <p className="text-sm font-medium text-home-ink">{WREN_TOMORROW_CARD.title}</p>
      <p className="text-[13px] text-home-ink-2">{WREN_TOMORROW_CARD.body}</p>
      <p className="text-[13px] text-home-ink-2">You can message Wren again {resetsIn}.</p>
    </div>
  );
}

function LiveWrenChat({ projectId }: { projectId: Id<"projects"> }) {
  const messages = useQuery(api.workspace.chat.listWrenThread, { projectId });
  const sendMessage = useMutation(api.workspace.chat.sendWrenMessage);
  const retryReply = useMutation(api.workspace.chat.retryWrenReply);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<Notice>({ kind: "none" });
  const inFlight = useRef(false);
  // The `updatedAt` of the streaming reply the timer has marked stopped.
  const [stoppedAt, setStoppedAt] = useState<number | undefined>(undefined);
  // What the status line says about Wren's reply, set once per change of its state.
  const [announcement, setAnnouncement] = useState("");
  const [announcedKey, setAnnouncedKey] = useState<string | null | typeof UNLOADED>(UNLOADED);
  const composerRef = useRef<HTMLDivElement>(null);

  const last = messages?.at(-1);
  const lastStreamingUpdatedAt =
    last?.author === "wren" && last.status === "streaming" ? last.updatedAt : undefined;

  // A reply still `streaming` after the stale window has stopped (the action died).
  // Queries can't expire it, so flip at the threshold with one timer, no polling.
  useEffect(() => {
    if (lastStreamingUpdatedAt === undefined) return;
    const remaining = Math.max(0, lastStreamingUpdatedAt + WREN_STREAM_STALE_MS - Date.now());
    const timer = setTimeout(() => setStoppedAt(lastStreamingUpdatedAt), remaining + 1);
    return () => clearTimeout(timer);
  }, [lastStreamingUpdatedAt]);

  const lastStale = lastStreamingUpdatedAt !== undefined && stoppedAt === lastStreamingUpdatedAt;
  const lastState = last?.author === "wren" ? (lastStale ? "stopped" : last.status) : null;
  const lastKey = last === undefined || lastState === null ? null : `${last._id}:${lastState}`;
  const lastBody = last?.body ?? "";
  const lastCardCount = last?.cards.length ?? 0;

  // Announce Wren's reply once per state change (adjusted during render, not in
  // an effect). What was already on the page when the thread first loaded is
  // never announced.
  if (messages !== undefined && announcedKey !== lastKey) {
    setAnnouncedKey(lastKey);
    if (announcedKey !== UNLOADED && lastKey !== null) {
      if (lastState === "streaming") setAnnouncement("Wren is writing…");
      else if (lastState === "done") setAnnouncement(repliedAnnouncement(lastBody, lastCardCount));
      else if (lastState === "failed") setAnnouncement("Wren couldn't finish this reply. You can try again.");
      else if (lastState === "stopped") setAnnouncement("Wren stopped partway through. You can try again.");
    }
  }

  if (messages === undefined) return <WrenThread status="loading" />;

  const replying = lastStreamingUpdatedAt !== undefined && !lastStale;

  async function run(action: () => Promise<Notice>): Promise<boolean> {
    if (inFlight.current) return false;
    inFlight.current = true;
    setSending(true);
    try {
      const notice = await action();
      setNotice(notice);
      return notice.kind === "none";
    } catch {
      setNotice({ kind: "message", text: "That didn't go through. Try again in a moment." });
      return false;
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  function send(text: string): Promise<boolean> {
    return run(async () => {
      const result = await sendMessage({ projectId, body: text });
      switch (result.kind) {
        case "sent":
        case "duplicate":
          return { kind: "none" };
        case "busy":
          return { kind: "message", text: "Wren is still answering. Send your message once the reply is done." };
        case "paused":
          return { kind: "message", text: "Wren is paused right now. Your message wasn't sent." };
        case "capped":
          return { kind: "tomorrow", resetsIn: resetsInLabel(Date.now(), result.resetsAt) };
      }
    });
  }

  function retry(wrenMessageId: Id<"chat_messages">) {
    // The button goes away once Wren starts again: keep focus on the page.
    composerRef.current?.querySelector("textarea")?.focus();
    void run(async () => {
      const result = await retryReply({ projectId, wrenMessageId });
      if (result.kind === "exhausted") {
        return { kind: "message", text: "Wren has tried this message several times. Try asking another way." };
      }
      if (result.kind === "busy") return { kind: "message", text: "Wren is still answering another message." };
      return { kind: "none" };
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {messages.length === 0 ? (
        <EmptyState title="Ask Wren anything about your launch">
          Wren answers here and can put cards in front of you. Nothing is sent, posted or spent unless you approve a card.
        </EmptyState>
      ) : (
        <WrenThread liveUpdates={false}>
          {messages.map((message) => {
            if (message.author === "founder") {
              return <UserMessage key={message._id}>{message.body}</UserMessage>;
            }
            const isLast = message._id === last?._id;
            const stopped = message.status === "streaming" && isLast && lastStale;
            const writing = message.status === "streaming" && !stopped;
            return (
              <div key={message._id} aria-busy={writing || undefined}>
                <WrenMessage time={new Date(message.createdAt).toLocaleTimeString(undefined, TIME_FORMAT)}>
                  {stopped && message.body.length === 0 ? (
                    <p className="text-home-ink-2">Wren stopped partway through.</p>
                  ) : writing && message.body.length === 0 ? (
                    <p className="text-home-ink-2">Wren is writing…</p>
                  ) : (
                    <p className="whitespace-pre-wrap">{message.body}</p>
                  )}
                  {message.status === "done" ? <WrenChatCards projectId={projectId} cards={message.cards} /> : null}
                  {stopped && message.body.length > 0 ? <p className="text-[13px] text-home-ink-2">Wren stopped partway through.</p> : null}
                  {(message.status === "failed" || stopped) && isLast ? (
                    <p>
                      <button
                        type="button"
                        onClick={() => retry(message._id)}
                        aria-disabled={sending || undefined}
                        className={cn("min-h-6 rounded px-1 text-[13px] font-medium underline", FOCUS)}
                      >
                        Try again<span className="sr-only"> · ask Wren to answer this message again</span>
                      </button>
                    </p>
                  ) : null}
                </WrenMessage>
              </div>
            );
          })}
        </WrenThread>
      )}
      {notice.kind === "tomorrow" ? <TomorrowCard resetsIn={notice.resetsIn} /> : null}
      <p role="status" aria-live="polite" className="min-h-5 text-[13px] text-home-ink-2">
        {notice.kind === "message" ? notice.text : notice.kind === "tomorrow" ? WREN_TOMORROW_CARD.title : announcement}
      </p>
      <div ref={composerRef} className="rounded-xl border border-home-rule bg-home-card">
        <WrenComposer onSend={send} sending={sending || replying} />
      </div>
    </div>
  );
}

export function WrenChatPanel({ projectId }: { projectId: Id<"projects"> }) {
  const unavailable = <p className="text-sm text-home-ink-2">Chat with Wren isn&apos;t available right now.</p>;
  return (
    <section aria-labelledby="wren-chat-heading" className="flex flex-col gap-3">
      <h2 id="wren-chat-heading" className="text-lg font-medium text-home-ink">
        Chat with Wren
      </h2>
      <WhenConvexReady fallback={<LoadingState label="Loading messages…" />} unavailable={unavailable}>
        <QuietErrorBoundary fallback={unavailable}>
          <LiveWrenChat projectId={projectId} />
        </QuietErrorBoundary>
      </WhenConvexReady>
    </section>
  );
}
