"use client";

import { Menu } from "lucide-react";
import { useRef, useState } from "react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import styles from "../editorial.module.css";
import { NavList } from "./NavList";
import type { NavCounts } from "./nav-items";

/** Below 1280px the sidebar collapses into this sheet. Focus returns to the trigger. */
export function MobileNav({
  counts,
  accountLabel,
  connection,
}: {
  counts: NavCounts;
  accountLabel: string;
  connection: string;
}) {
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-(--ed-input) bg-(--ed-surface) px-3 text-sm font-medium outline-hidden hover:bg-(--ed-sunk) focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--ed-focus) xl:hidden"
        >
          <Menu aria-hidden="true" className="size-4" />
          Menu
        </button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className={`${styles.theme} w-[17rem] max-w-[85vw] bg-(--ed-canvas) p-0`}
        onOpenAutoFocus={(event) => {
          // Open on the current page's link (or the first), not the close button.
          event.preventDefault();
          const nav = navRef.current;
          const target = nav?.querySelector<HTMLAnchorElement>('a[aria-current="page"]') ?? nav?.querySelector<HTMLAnchorElement>("a");
          target?.focus();
        }}
      >
        <SheetHeader className="border-b border-(--ed-border) px-4 py-4">
          <SheetTitle className="text-base">Editorial</SheetTitle>
          <SheetDescription className="text-(--ed-text-2)">
            Signed in as {accountLabel}. Data: {connection}.
          </SheetDescription>
        </SheetHeader>
        <nav ref={navRef} aria-label="Editorial" className="px-2 py-3">
          <NavList counts={counts} onNavigate={() => setOpen(false)} />
        </nav>
      </SheetContent>
    </Sheet>
  );
}
