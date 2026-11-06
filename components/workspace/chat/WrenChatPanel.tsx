"use client";

import { useMutation, useQuery } from "convex/react";
import { useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { QuietErrorBoundary, WhenConvexReady } from "@/components/platform/client-gates";
import { CARD_SHELL, WrenMessage } from "@/components/workspace/kit/WrenCards";
import { UserMessage, WrenComposer, WrenThread } from "@/components/workspace/kit/WrenThread";
import { EmptyState, LoadingState } from "@/components/workspace/kit/states";
import { FOCUS } from "@/components/workspace/kit/styles";
import { cn } from "@/lib/utils";
import { resetsInLabel, WREN_TOMORROW_CARD } from "@/lib/workspace/wren";

/**
 * WP77-S3. The minimal Wren chat: the thread (`listWrenThread`), the composer
 * (`sendWrenMessage`) and Retry on a failed reply (`retryWrenReply`). The
 * reply streams in as the gateway writes it to the row. Full polish is S6.
 *
 * Accessibility: the thread is the kit's `role="log"`. A reply still being
 * written is `aria-busy`, so screen readers announce it once it is complete,
 * not on every draft write. Send outcomes (busy, paused, an error) go to one
 * polite status line; the message cap shows the break card, outside the log,
 * with the reset time the limiter reported.
 *
 * S6 note: `aria-busy` on a child of `role="log"` is how the stream stays
 * quiet; support varies (NVDA and JAWS honour it, VoiceOver may still read
 * draft text). S6 should test with real screen readers and, if needed, hide
 * the draft from the log and announce the finished reply once.
 */

type Notice =
  | { kind: "none" }
  | { kind: "tomorrow"; resetsIn: string }
  | { kind: "message"; text: string };

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

  if (messages === undefined) return <WrenThread status="loading" />;

  const last = messages.at(-1);
  const replying = last?.author === "wren" && last.status === "streaming";

  async function run(action: () => Promise<Notice>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    try {
      setNotice(await action());
    } catch {
      setNotice({ kind: "message", text: "That didn't go through. Try again in a moment." });
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  function send(text: string) {
    void run(async () => {
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
          Wren answers here. Nothing is sent, posted or spent from this chat.
        </EmptyState>
      ) : (
        <WrenThread>
          {messages.map((message) => {
            if (message.author === "founder") {
              return <UserMessage key={message._id}>{message.body}</UserMessage>;
            }
            const writing = message.status === "streaming";
            return (
              <div key={message._id} aria-busy={writing || undefined}>
                <WrenMessage time={new Date(message.createdAt).toLocaleTimeString(undefined, TIME_FORMAT)}>
                  {writing && message.body.length === 0 ? (
                    <p className="text-home-ink-2">Wren is writing…</p>
                  ) : (
                    <p className="whitespace-pre-wrap">{message.body}</p>
                  )}
                  {message.status === "failed" && message._id === last?._id ? (
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
        {notice.kind === "message" ? notice.text : notice.kind === "tomorrow" ? WREN_TOMORROW_CARD.title : ""}
      </p>
      <div className="rounded-xl border border-home-rule bg-home-card">
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
