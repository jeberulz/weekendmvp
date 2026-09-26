"use client";

import { useMutation } from "convex/react";
import { StickyNote } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import { NOTE_MAX } from "@/convex/platform/hubLimits";
import type { GatedFeature } from "@/convex/platform/plans";
import { IdeaRow, type IdeaCardData } from "@/components/platform/explore/IdeaCard";
import type { DashboardSource } from "@/lib/track";
import { cn } from "@/lib/utils";
import { CollectionMenu } from "./CollectionMenu";
import { isUpgradeRequired } from "./useFeatureGate";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";
const ICON = cn(
  "inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-home-ink-2 transition-colors hover:bg-home-sunk hover:text-home-ink aria-expanded:bg-home-sunk",
  FOCUS,
);
const BUTTON = cn("inline-flex h-10 items-center rounded-[9px] px-3.5 text-sm font-medium transition-colors", FOCUS);

type HubFeature = Exclude<GatedFeature, "weekend_plan">;

function NoteForm({
  slug,
  title,
  initial,
  onDone,
  onUpgrade,
}: {
  slug: string;
  title: string;
  initial: string;
  onDone: (message: string) => void;
  onUpgrade: () => void;
}) {
  const save = useMutation(api.platform.notes.save);
  const [body, setBody] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const id = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  // The member just asked to write, so the field takes focus.
  useEffect(() => field.current?.focus(), []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await save({ slug, body });
      onDone(body.trim() ? "Note saved." : "Note cleared.");
    } catch (caught) {
      setBusy(false);
      if (isUpgradeRequired(caught)) onUpgrade();
      else {
        console.error("Saving the note failed", caught);
        setError("We could not save the note. Try again.");
      }
    }
  }

  return (
    <form onSubmit={submit} className="mt-2 flex flex-col gap-2 rounded-[10px] border border-home-rule bg-home-paper p-3">
      <label htmlFor={`${id}-body`} className="text-sm font-medium text-home-ink">
        Private note for {title}
      </label>
      <textarea
        id={`${id}-body`}
        ref={field}
        rows={3}
        value={body}
        maxLength={NOTE_MAX}
        onChange={(event) => setBody(event.target.value)}
        aria-describedby={`${id}-hint`}
        className={cn(
          "w-full rounded-[9px] border border-home-rule bg-home-card px-3 py-2 text-[15px] text-home-ink",
          FOCUS,
        )}
      />
      <p id={`${id}-hint`} className="text-[12px] text-home-ink-3">
        Only you can see it. Up to {NOTE_MAX.toLocaleString("en-US")} characters. Empty clears it.
      </p>
      {error && (
        <p role="alert" className="text-sm text-home-clay-ink">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className={cn(BUTTON, "bg-home-ink text-home-card hover:bg-home-panel disabled:cursor-wait disabled:opacity-60")}>
          Save note
        </button>
        <button type="button" onClick={() => onDone("")} className={cn(BUTTON, "text-home-ink-2 hover:text-home-ink")}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * A Saved row with the Builder's Hub tools (S11): collections, a private
 * note, and a compare checkbox in compare mode. Shown only to Builder's Hub
 * members; the mutations check the entitlement again.
 */
export function HubRow({
  item,
  source,
  meta,
  compare,
  extraAction,
  onUpgrade,
}: {
  item: { card: IdeaCardData; note: string | null };
  source: DashboardSource;
  meta?: string;
  compare?: { checked: boolean; disabled: boolean; onChange: (checked: boolean) => void };
  extraAction?: ReactNode;
  onUpgrade: (feature: HubFeature) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const noteButton = useRef<HTMLButtonElement>(null);
  const formId = useId();
  const { card, note } = item;

  const actions = (
    <>
      {compare && (
        <label className="mr-1 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-home-ink hover:bg-home-sunk">
          <input
            type="checkbox"
            checked={compare.checked}
            disabled={compare.disabled}
            onChange={(event) => compare.onChange(event.target.checked)}
            className={cn("size-4 accent-home-ink disabled:opacity-50", FOCUS)}
          />
          Compare<span className="sr-only"> {card.title}</span>
        </label>
      )}
      {extraAction}
      <CollectionMenu slug={card.slug} title={card.title} onUpgrade={() => onUpgrade("collections")} />
      <button
        ref={noteButton}
        type="button"
        aria-expanded={editing}
        aria-controls={formId}
        title={note ? "Edit note" : "Add a note"}
        onClick={() => setEditing(!editing)}
        className={ICON}
      >
        <StickyNote aria-hidden className="size-[17px]" strokeWidth={1.7} fill={note ? "currentColor" : "none"} />
        <span className="sr-only">
          {note ? "Edit your note" : "Add a note"} for {card.title}
        </span>
      </button>
    </>
  );

  const below = (
    <>
      {!editing && note && (
        <p className="mt-1.5 whitespace-pre-line rounded-lg bg-home-sunk px-3 py-2 text-[13px] leading-[1.5] text-home-ink-2">
          <span className="sr-only">Your note: </span>
          {note}
        </p>
      )}
      <div id={formId} hidden={!editing}>
        {editing && (
          <NoteForm
            slug={card.slug}
            title={card.title}
            initial={note ?? ""}
            onDone={(done) => {
              setEditing(false);
              setMessage(done);
              noteButton.current?.focus();
            }}
            onUpgrade={() => {
              setEditing(false);
              onUpgrade("collections");
            }}
          />
        )}
      </div>
      <span role="status" className="sr-only">
        {message}
      </span>
    </>
  );

  return <IdeaRow idea={card} source={source} meta={meta} actions={actions} below={below} />;
}
