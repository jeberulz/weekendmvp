"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SignOutButton } from "@/app/dashboard/SignOutButton";
import { objectHomeHref } from "@/lib/signed-in-chrome";
import { dollarsFromMinor } from "@/lib/signed-in-home";

function asProjectId(value: string | null): Id<"projects"> | undefined {
  if (!value || !/^[a-z0-9]+$/i.test(value) || value.length < 10) {
    return undefined;
  }
  return value as Id<"projects">;
}

function AccountBody({ onPicked }: { onPicked?: () => void }) {
  const searchParams = useSearchParams();
  const projectId = asProjectId(searchParams.get("project"));
  const user = useQuery(api.currentUser.requireCurrent);
  const current = useQuery(api.platform.home.current, {
    ...(projectId ? { projectId } : {}),
  });
  const billing = useQuery(api.platform.billing.queries.summary, {
    historyLimit: 5,
  });
  const [portalError, setPortalError] = useState("");
  const [portalBusy, setPortalBusy] = useState(false);

  const email = user?.email ?? "Signed in";
  const others = current?.others ?? [];
  const currentId = current && current.kind !== "cold" ? current.projectId : undefined;
  const paid = billing?.purchases.find((purchase) => purchase.status === "paid");

  async function openPortal() {
    setPortalBusy(true);
    setPortalError("");
    try {
      const response = await fetch("/api/platform/billing/portal", {
        method: "POST",
      });
      const result = (await response.json()) as { ok?: boolean; url?: string };
      if (!response.ok || !result.ok || !result.url) {
        throw new Error("unavailable");
      }
      const url = new URL(result.url);
      if (url.protocol !== "https:" || !url.hostname.endsWith("stripe.com")) {
        throw new Error("unavailable");
      }
      window.location.assign(url.href);
    } catch {
      setPortalError("Card updates are unavailable right now.");
      setPortalBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="truncate text-sm text-stone-700">{email}</p>
      {others.length >= 2 ? (
        <ul className="space-y-1">
          {others.map((item) => {
            const here = item.projectId === currentId;
            const label = item.hostname ?? item.title;
            return (
              <li key={item.projectId}>
                {here ? (
                  <p className="rounded-2xl bg-stone-900/5 px-3 py-2 text-sm text-stone-500">
                    {label}
                  </p>
                ) : (
                  <Link
                    href={objectHomeHref(item.projectId)}
                    onClick={onPicked}
                    className="block rounded-2xl px-3 py-2 text-sm text-stone-800 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800"
                  >
                    {label}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
      {paid ? (
        <div className="space-y-2">
          <p className="text-sm text-stone-700">
            Last charge {dollarsFromMinor(paid.amountMinor)}
          </p>
          <button
            type="button"
            disabled={portalBusy}
            onClick={() => void openPortal()}
            className="min-h-11 w-full rounded-2xl border border-stone-900/15 px-4 text-left text-sm text-stone-800 hover:bg-white disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800"
          >
            {portalBusy ? "Opening…" : "Update card"}
          </button>
          {portalError ? (
            <p className="text-sm text-stone-600" role="alert">
              {portalError}
            </p>
          ) : null}
        </div>
      ) : null}
      <SignOutButton />
    </div>
  );
}

export function AccountMenu({
  variant,
}: {
  variant: "desktop" | "tab";
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || variant !== "desktop") return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, variant]);

  if (variant === "tab") {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <button
            type="button"
            className="flex min-h-12 min-w-12 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] text-stone-600 hover:bg-white/70 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800"
          >
            Account
          </button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          overlayClassName="motion-reduce:animate-none"
          className="rounded-t-3xl border-stone-900/10 bg-[#f3f1eb] text-stone-900 shadow-none motion-reduce:animate-none motion-reduce:transition-none"
        >
          <SheetHeader className="text-left">
            <SheetTitle>Account</SheetTitle>
            <SheetDescription>Email, sites, and sign out.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <AccountBody />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "rounded-2xl px-3 py-2 text-sm font-medium text-stone-700 underline-offset-4 hover:text-stone-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800",
          open && "text-stone-950",
        )}
      >
        Account
      </button>
      {open ? (
        <div
          id={panelId}
          role="menu"
          className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-stone-900/10 bg-white p-4 shadow-sm"
        >
          <AccountBody onPicked={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}
