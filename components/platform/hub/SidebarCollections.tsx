"use client";

import { useQuery } from "convex/react";
import { Folder } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { QuietErrorBoundary, WhenConvexReady } from "@/components/platform/client-gates";
import { BUILDERS_HUB_UI } from "@/components/platform/plan/flag";
import { cn } from "@/lib/utils";
import { collectionHref } from "./hub-links";

const SHOWN = 8;

function LiveCollections({ pathname }: { pathname: string }) {
  const collections = useQuery(api.platform.collections.list);
  const current = useSearchParams().get("collection");
  if (!collections || collections.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <p className="px-3 pb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3">Collections</p>
      {collections.slice(0, SHOWN).map((collection) => {
        const active = pathname === "/dashboard/saved" && current === collection.collectionId;
        return (
          <Link
            key={collection.collectionId}
            href={collectionHref(collection.collectionId)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink",
              active
                ? "bg-home-card font-medium text-home-ink shadow-[inset_0_0_0_1px_var(--color-home-rule)]"
                : "text-home-ink-2 hover:bg-home-card/70 hover:text-home-ink",
            )}
          >
            <Folder aria-hidden className="size-[18px] shrink-0" />
            <span className="min-w-0 flex-1 truncate">{collection.name}</span>
            <span className="font-mono text-[11px] tabular-nums text-home-ink-3">
              <span className="sr-only">, </span>
              {collection.count}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/** PRD 7.2: the sidebar's Collections group for Builder's Hub. Absent with none, or with the flag off. */
export function SidebarCollections({ collapsed, pathname }: { collapsed: boolean; pathname: string }) {
  if (!BUILDERS_HUB_UI || collapsed) return null;
  return (
    <WhenConvexReady>
      <QuietErrorBoundary>
        <LiveCollections pathname={pathname} />
      </QuietErrorBoundary>
    </WhenConvexReady>
  );
}
