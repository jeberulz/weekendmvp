"use client";

import { useMutation, useQuery } from "convex/react";
import { Columns3, FolderPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { api } from "@/convex/_generated/api";
import { COLLECTION_NAME_MAX } from "@/convex/platform/hubLimits";
import { SAVED_PATH } from "@/components/platform/explore/library-params";
import { BuildersHubTag } from "@/components/platform/plan/BuildersHubTag";
import { useUpsell } from "@/components/platform/plan/useUpsell";
import { cn } from "@/lib/utils";
import { collectionHref } from "./hub-links";
import { isUpgradeRequired, useFeatureGate } from "./useFeatureGate";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";
const BUTTON = cn(
  "inline-flex h-10 items-center gap-2 rounded-[9px] border border-home-rule bg-home-card px-3.5 text-sm font-medium text-home-ink transition-colors hover:border-home-ink-3 aria-pressed:border-home-ink aria-pressed:bg-home-sunk",
  FOCUS,
);
const PILL = cn(
  "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors",
  FOCUS,
);

function NewCollectionForm({ onCancel, onUpgrade }: { onCancel: () => void; onUpgrade: () => void }) {
  const create = useMutation(api.platform.collections.create);
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const field = useRef<HTMLInputElement>(null);
  const id = useId();
  useEffect(() => field.current?.focus(), []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Give the collection a name.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { collectionId } = await create({ name });
      router.push(collectionHref(collectionId));
    } catch (caught) {
      setBusy(false);
      const code = (caught as { data?: { code?: string } }).data?.code;
      if (isUpgradeRequired(caught)) onUpgrade();
      else if (code === "COLLECTION_LIMIT") setError("You have the most collections allowed. Delete one first.");
      else {
        console.error("Creating the collection failed", caught);
        setError("We could not create the collection. Try again.");
      }
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex w-full flex-col gap-2 rounded-[12px] border border-home-rule bg-home-card p-4 sm:flex-row sm:items-end"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <label htmlFor={`${id}-name`} className="text-sm font-medium text-home-ink">
          Collection name
        </label>
        <input
          ref={field}
          id={`${id}-name`}
          value={name}
          maxLength={COLLECTION_NAME_MAX}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={error !== ""}
          aria-describedby={error ? `${id}-error` : undefined}
          placeholder="Weekend in October"
          className={cn(
            "h-11 w-full rounded-[9px] border border-home-rule bg-home-card px-3 text-[15px] text-home-ink placeholder:text-home-ink-3 aria-[invalid=true]:border-home-clay-ink",
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
        <button
          type="submit"
          disabled={busy}
          className={cn(BUTTON, "h-11 border-home-ink bg-home-ink text-home-card hover:bg-home-panel disabled:cursor-wait disabled:opacity-60")}
        >
          Create
        </button>
        <button type="button" onClick={onCancel} className={cn(BUTTON, "h-11 border-transparent bg-transparent text-home-ink-2")}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * Saved's Builder's Hub toolbar (PRD 7.2, flag on): the collections list,
 * "New collection" and "Compare". A Free member sees the tag on each and gets
 * the sheet at the click, from the server's answer.
 */
export function SavedToolbar({
  currentCollection,
  compare,
}: {
  currentCollection: string | null;
  compare?: { active: boolean; onChange: (active: boolean) => void };
}) {
  const { showUpsell } = useUpsell();
  const collections = useQuery(api.platform.collections.list);
  const gate = useFeatureGate();
  const [creating, setCreating] = useState(false);
  const newButton = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {collections && collections.length > 0 ? (
          <nav aria-label="Collections">
            <ul className="flex flex-wrap gap-2">
              <li>
                <Link
                  href={SAVED_PATH}
                  aria-current={currentCollection === null ? "page" : undefined}
                  className={cn(
                    PILL,
                    currentCollection === null
                      ? "border-home-ink bg-home-ink text-home-card"
                      : "border-home-rule bg-home-card text-home-ink hover:border-home-ink-3",
                  )}
                >
                  All saved
                </Link>
              </li>
              {collections.map((collection) => {
                const current = collection.collectionId === currentCollection;
                return (
                  <li key={collection.collectionId}>
                    <Link
                      href={collectionHref(collection.collectionId)}
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        PILL,
                        current
                          ? "border-home-ink bg-home-ink text-home-card"
                          : "border-home-rule bg-home-card text-home-ink hover:border-home-ink-3",
                      )}
                    >
                      {collection.name}
                      <span className={cn("font-mono text-[11px]", current ? "text-home-d2" : "text-home-ink-3")}>
                        <span className="sr-only">, </span>
                        {collection.count}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap gap-2">
          <button
            ref={newButton}
            type="button"
            aria-expanded={creating}
            onClick={(event) => {
              if (creating) setCreating(false);
              else void gate.run("collections", () => setCreating(true), event.currentTarget);
            }}
            className={BUTTON}
          >
            <FolderPlus aria-hidden className="size-4 shrink-0" strokeWidth={1.8} />
            New collection
            {showUpsell && <BuildersHubTag className="text-home-ink-3" />}
          </button>
          {compare && (
            <button
              type="button"
              aria-pressed={compare.active}
              onClick={(event) => {
                if (compare.active) compare.onChange(false);
                else void gate.run("compare", () => compare.onChange(true), event.currentTarget);
              }}
              className={BUTTON}
            >
              <Columns3 aria-hidden className="size-4 shrink-0" strokeWidth={1.8} />
              Compare
              {showUpsell && <BuildersHubTag className="text-home-ink-3" />}
            </button>
          )}
        </div>
      </div>
      {creating && (
        <NewCollectionForm
          onCancel={() => {
            setCreating(false);
            newButton.current?.focus();
          }}
          onUpgrade={() => {
            setCreating(false);
            gate.openSheet("collections", newButton.current);
          }}
        />
      )}
      {gate.sheet}
    </div>
  );
}
