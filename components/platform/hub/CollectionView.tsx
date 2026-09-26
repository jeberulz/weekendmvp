"use client";

import { useMutation, useQuery } from "convex/react";
import { FolderMinus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Component, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import { COLLECTION_NAME_MAX } from "@/convex/platform/hubLimits";
import { WhenConvexReady } from "@/components/platform/client-gates";
import { SAVED_PATH } from "@/components/platform/explore/library-params";
import { ModuleError, ModuleSkeleton } from "@/components/platform/home/module-states";
import { cn } from "@/lib/utils";
import { HubRow } from "./HubRow";
import { SavedToolbar } from "./SavedToolbar";
import { isUpgradeRequired, useFeatureGate } from "./useFeatureGate";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";
const BUTTON = cn("inline-flex h-10 items-center rounded-[9px] px-3.5 text-sm font-medium transition-colors", FOCUS);
const QUIET = cn(BUTTON, "text-home-ink-2 hover:text-home-ink");
const ICON = cn(
  "inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-home-ink-2 transition-colors hover:bg-home-sunk hover:text-home-ink",
  FOCUS,
);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function addedOn(ms: number) {
  const date = new Date(ms);
  return `Added ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

function RenameForm({
  collectionId,
  name,
  onDone,
  onUpgrade,
}: {
  collectionId: string;
  name: string;
  onDone: (message: string) => void;
  onUpgrade: () => void;
}) {
  const rename = useMutation(api.platform.collections.rename);
  const [value, setValue] = useState(name);
  const [error, setError] = useState("");
  const field = useRef<HTMLInputElement>(null);
  const id = useId();
  useEffect(() => field.current?.select(), []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!value.trim()) {
      setError("Give the collection a name.");
      return;
    }
    try {
      await rename({ collectionId, name: value });
      onDone(`Renamed to ${value.trim()}.`);
    } catch (caught) {
      if (isUpgradeRequired(caught)) onUpgrade();
      else {
        console.error("Renaming failed", caught);
        setError("We could not rename it. Try again.");
      }
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <label htmlFor={`${id}-name`} className="text-sm font-medium text-home-ink">
          New name
        </label>
        <input
          ref={field}
          id={`${id}-name`}
          value={value}
          maxLength={COLLECTION_NAME_MAX}
          onChange={(event) => setValue(event.target.value)}
          aria-invalid={error !== ""}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            "h-11 w-full rounded-[9px] border border-home-rule bg-home-card px-3 text-[15px] text-home-ink aria-[invalid=true]:border-home-clay-ink",
            FOCUS,
          )}
        />
        {error && (
          <p id={`${id}-error`} className="text-sm text-home-clay-ink">
            {error}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <button type="submit" className={cn(BUTTON, "h-11 bg-home-ink text-home-card hover:bg-home-panel")}>
          Save name
        </button>
        <button type="button" onClick={() => onDone("")} className={cn(QUIET, "h-11")}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function LiveCollection({ collectionId }: { collectionId: string }) {
  const data = useQuery(api.platform.collections.items, { collectionId });
  const removeIdea = useMutation(api.platform.collections.removeIdea);
  const deleteCollection = useMutation(api.platform.collections.remove);
  const gate = useFeatureGate();
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) confirmButton.current?.focus();
  }, [confirming]);

  if (data === undefined) return <ModuleSkeleton label="Loading the collection" className="h-[320px]" />;
  const { collection, items } = data;

  async function takeOut(slug: string, title: string) {
    try {
      await removeIdea({ collectionId, slug });
      setMessage(`Removed ${title} from ${collection.name}.`);
    } catch (error) {
      console.error("Removing from the collection failed", error);
      setMessage("We could not remove it. Try again.");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <SavedToolbar currentCollection={collectionId} />
      <div className="flex flex-col gap-3 border-b border-home-ink pb-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2
            ref={heading}
            tabIndex={-1}
            className="font-editorial text-[28px] font-normal leading-[1.1] tracking-[-0.015em] text-home-ink outline-none"
          >
            {collection.name}
          </h2>
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3">
            {collection.count} {collection.count === 1 ? "idea" : "ideas"}
          </p>
        </div>
        {renaming ? (
          <RenameForm
            collectionId={collectionId}
            name={collection.name}
            onDone={(done) => {
              setRenaming(false);
              setMessage(done);
              heading.current?.focus();
            }}
            onUpgrade={() => {
              setRenaming(false);
              gate.openSheet("collections");
            }}
          />
        ) : confirming ? (
          <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-home-rule bg-home-paper p-3">
            <p className="text-sm text-home-ink">
              Delete {collection.name}? The ideas stay in Saved. This can’t be undone.
            </p>
            <button
              ref={confirmButton}
              type="button"
              onClick={async () => {
                await deleteCollection({ collectionId });
                router.push(SAVED_PATH);
              }}
              className={cn(BUTTON, "bg-home-ink text-home-card hover:bg-home-panel")}
            >
              Yes, delete
            </button>
            <button type="button" onClick={() => setConfirming(false)} className={QUIET}>
              Not now
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={(event) => void gate.run("collections", () => setRenaming(true), event.currentTarget)}
              className={cn(BUTTON, "border border-home-rule bg-home-card text-home-ink hover:border-home-ink-3")}
            >
              Rename
            </button>
            <button type="button" onClick={() => setConfirming(true)} className={QUIET}>
              Delete collection
            </button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-[15px] text-home-ink-2">
          Nothing here yet. Use the folder button on any idea in{" "}
          <Link href={SAVED_PATH} className={cn("font-medium text-home-orange-ink underline underline-offset-4", FOCUS)}>
            Saved
          </Link>{" "}
          to add it.
        </p>
      ) : (
        <ul className="divide-y divide-home-rule border-y border-home-ink">
          {items.map((item) => (
            <li key={item.card.ideaId}>
              <HubRow
                item={item}
                source="saved"
                meta={addedOn(item.addedAt)}
                onUpgrade={(feature) => gate.openSheet(feature)}
                extraAction={
                  <button
                    type="button"
                    title={`Remove from ${collection.name}`}
                    onClick={() => void takeOut(item.card.slug, item.card.title)}
                    className={ICON}
                  >
                    <FolderMinus aria-hidden className="size-[17px]" strokeWidth={1.7} />
                    <span className="sr-only">
                      Remove {item.card.title} from {collection.name}
                    </span>
                  </button>
                }
              />
            </li>
          ))}
        </ul>
      )}
      <p role="status" className="sr-only">
        {message}
      </p>
      {gate.sheet}
    </div>
  );
}

function CollectionMissing() {
  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-home-rule bg-home-card p-5">
      <h2 className="font-editorial text-[26px] font-normal text-home-ink">We can’t find that collection.</h2>
      <p className="text-[15px] text-home-ink-2">It may have been deleted, or the link is wrong.</p>
      <div>
        <Link href={SAVED_PATH} className={cn(BUTTON, "bg-home-ink text-home-card hover:bg-home-panel")}>
          Back to Saved
        </Link>
      </div>
    </div>
  );
}

class CollectionBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state: { error: unknown } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const code = (error as { data?: { code?: string } }).data?.code;
    if (code === "RESOURCE_NOT_FOUND") return <CollectionMissing />;
    return <ModuleError onRetry={() => this.setState({ error: null })} />;
  }
}

/** One collection on the Saved page (`/dashboard/saved?collection=…`). */
export function CollectionView({ collectionId }: { collectionId: string }) {
  const skeleton = <ModuleSkeleton label="Loading the collection" className="h-[320px]" />;
  return (
    <WhenConvexReady fallback={skeleton} unavailable={<ModuleError />}>
      <CollectionBoundary>
        <LiveCollection collectionId={collectionId} />
      </CollectionBoundary>
    </WhenConvexReady>
  );
}
