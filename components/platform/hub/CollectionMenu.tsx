"use client";

import { useMutation, useQuery } from "convex/react";
import { Check, FolderPlus } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { isUpgradeRequired } from "./useFeatureGate";

const ICON =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-home-ink-2 transition-colors hover:bg-home-sunk hover:text-home-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink data-[state=open]:bg-home-sunk";
const ITEM =
  "flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm text-home-ink outline-none data-[disabled]:cursor-default data-[disabled]:text-home-ink-2 data-[highlighted]:bg-home-sunk data-[highlighted]:shadow-[inset_0_0_0_2px_var(--color-home-orange-ink)]";

function MenuItems({
  slug,
  onMessage,
  onUpgrade,
}: {
  slug: string;
  onMessage: (message: string) => void;
  onUpgrade: () => void;
}) {
  const collections = useQuery(api.platform.collections.list);
  const holding = useQuery(api.platform.collections.forIdea, { slug });
  const add = useMutation(api.platform.collections.addIdea);
  const remove = useMutation(api.platform.collections.removeIdea);

  if (collections === undefined || holding === undefined) {
    return (
      <DropdownMenu.Item disabled className={ITEM}>
        Loading collections
      </DropdownMenu.Item>
    );
  }
  if (collections.length === 0) {
    return (
      <DropdownMenu.Item disabled className={ITEM}>
        No collections yet. Use New collection above.
      </DropdownMenu.Item>
    );
  }

  async function toggle(collectionId: Id<"collections">, name: string, next: boolean) {
    try {
      if (next) await add({ collectionId, slug });
      else await remove({ collectionId, slug });
      onMessage(next ? `Added to ${name}.` : `Removed from ${name}.`);
    } catch (error) {
      if (isUpgradeRequired(error)) onUpgrade();
      else {
        console.error("Changing the collection failed", error);
        onMessage("We could not change the collection. Try again.");
      }
    }
  }

  return collections.map((collection) => {
    const checked = holding.includes(collection.collectionId);
    return (
      <DropdownMenu.CheckboxItem
        key={collection.collectionId}
        checked={checked}
        // Stay open, so several collections can be changed in a row.
        onSelect={(event) => event.preventDefault()}
        onCheckedChange={(next) => void toggle(collection.collectionId, collection.name, next)}
        className={ITEM}
      >
        <span
          aria-hidden
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded border",
            checked ? "border-home-ink bg-home-ink text-home-card" : "border-home-ink-3",
          )}
        >
          {checked && <Check className="size-3" strokeWidth={2.5} />}
        </span>
        <span className="min-w-0 flex-1 truncate">{collection.name}</span>
        <span className="pl-3 font-mono text-xs text-home-ink-3">{collection.count}</span>
      </DropdownMenu.CheckboxItem>
    );
  });
}

/** Per-idea collections menu on Saved rows (Builder's Hub, PRD 7.2). */
export function CollectionMenu({ slug, title, onUpgrade }: { slug: string; title: string; onUpgrade: () => void }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <>
      <DropdownMenu.Root modal={false} open={open} onOpenChange={setOpen}>
        <DropdownMenu.Trigger asChild>
          <button type="button" title="Collections" className={ICON}>
            <FolderPlus aria-hidden className="size-[17px]" strokeWidth={1.7} />
            <span className="sr-only">Collections for {title}</span>
          </button>
        </DropdownMenu.Trigger>
        {/* No portal: the menu stays inside `main`, so its content sits in a landmark. */}
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 max-h-[min(360px,var(--radix-dropdown-menu-content-available-height))] min-w-60 max-w-[min(320px,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-home-rule bg-home-card p-1.5 font-sans text-home-ink shadow-[0_16px_40px_-16px_rgba(26,24,20,0.35)]"
        >
          <DropdownMenu.Label className="px-3 pb-1 pt-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3">
            Add to a collection
          </DropdownMenu.Label>
          {open && (
            <MenuItems
              slug={slug}
              onMessage={setMessage}
              onUpgrade={() => {
                setOpen(false);
                onUpgrade();
              }}
            />
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      <span role="status" className="sr-only">
        {message}
      </span>
    </>
  );
}
