"use client";

import {
  Bookmark,
  Compass,
  CreditCard,
  FolderKanban,
  Home,
  Lightbulb,
  Menu,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { Logo } from "@/components/primitives/Logo";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/app/dashboard/SignOutButton";
import {
  isWorkspaceLinkCurrent,
  type WorkspaceCurrentTarget,
} from "./workspace-current";

type WorkspaceLink = WorkspaceCurrentTarget & {
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

const primaryLinks: WorkspaceLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home, match: "exact" },
  {
    href: "/dashboard/explore",
    label: "Explore ideas",
    icon: Compass,
    match: "prefix",
  },
  { href: "/dashboard/new", label: "New idea", icon: Plus, match: "prefix" },
];

const workspaceLinks: WorkspaceLink[] = [
  ...primaryLinks,
  {
    href: "/dashboard/explore?view=saved",
    label: "Saved",
    icon: Bookmark,
    queryView: "saved",
  },
  {
    href: "/dashboard/explore?view=interested",
    label: "Interested",
    icon: Sparkles,
    queryView: "interested",
  },
  {
    href: "/dashboard/billing",
    label: "Billing",
    icon: CreditCard,
    match: "prefix",
  },
];

function RailLink({
  item,
  pathname,
  activeView,
}: {
  item: WorkspaceLink;
  pathname: string;
  activeView: string | null;
}) {
  const Icon = item.icon;
  const current = isWorkspaceLinkCurrent(pathname, activeView, item);

  return (
    <Link
      href={item.href}
      aria-label={item.label}
      aria-current={current ? "page" : undefined}
      title={item.label}
      className={cn(
        "flex size-11 items-center justify-center rounded-lg text-zinc-400 transition-colors duration-200 hover:bg-white/6 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080808]",
        current && "bg-white/8 text-orange-300",
      )}
    >
      <Icon className="size-[18px]" aria-hidden />
    </Link>
  );
}

function ContextLink({
  item,
  pathname,
  activeView,
  compact = false,
  closeOnSelect = false,
}: {
  item: WorkspaceLink;
  pathname: string;
  activeView: string | null;
  compact?: boolean;
  closeOnSelect?: boolean;
}) {
  const Icon = item.icon;
  const current = isWorkspaceLinkCurrent(pathname, activeView, item);

  const link = (
    <Link
      href={item.href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm text-zinc-400 transition-colors duration-200 hover:bg-white/6 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
        current && "bg-white/8 font-medium text-zinc-100",
        compact && "min-h-12 min-w-12 flex-col justify-center gap-1 px-2 text-[11px]",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span>{item.label}</span>
    </Link>
  );

  return closeOnSelect ? <SheetClose asChild>{link}</SheetClose> : link;
}

function MobileMenu({
  pathname,
  activeView,
}: {
  pathname: string;
  activeView: string | null;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex min-h-12 min-w-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] text-zinc-400 hover:bg-white/6 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        >
          <Menu className="size-[18px]" aria-hidden />
          <span>More</span>
        </button>
      </SheetTrigger>
      <SheetContent
        side="left"
        overlayClassName="motion-reduce:animate-none"
        className="w-[min(88vw,22rem)] border-white/10 bg-[#0b0b0b] text-zinc-100 shadow-none motion-reduce:animate-none motion-reduce:transition-none"
      >
        <SheetHeader className="border-b border-white/10 px-5 py-5 text-left">
          <SheetTitle className="text-base text-zinc-100">Workspace</SheetTitle>
          <SheetDescription className="text-zinc-400">
            Move between your ideas, projects, and account.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-1 px-3 py-4">
          {workspaceLinks.map((item) => (
            <ContextLink
              key={item.href}
              item={item}
              pathname={pathname}
              activeView={activeView}
              closeOnSelect
            />
          ))}
          <div className="mt-3 border-t border-white/10 px-3 pt-4">
            <div className="flex items-center gap-2 text-xs leading-5 text-zinc-400">
              <FolderKanban className="size-4" aria-hidden />
              Project cockpit arrives after a project is created.
            </div>
          </div>
          <div className="mt-auto border-t border-white/10 px-3 pt-4">
            <SignOutButton />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const activeView = useSearchParams().get("view");

  return (
    <div className="min-h-dvh bg-[#050505] text-zinc-100">
      <a
        href="#workspace-main"
        className="fixed left-3 top-3 z-50 -translate-y-20 rounded-md bg-orange-800 px-4 py-2 text-sm font-semibold text-white transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-white motion-reduce:transition-none"
      >
        Skip to workspace content
      </a>

      <nav aria-label="Workspace" className="relative z-40">
        <div className="fixed inset-y-0 left-0 hidden md:flex">
          <div className="flex w-[4.5rem] flex-col items-center border-r border-white/10 bg-[#080808] px-3 py-4">
            <Link
              href="/dashboard"
              aria-label="Weekend MVP dashboard"
              className="flex size-11 items-center justify-center rounded-lg text-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            >
              <Logo className="h-6 w-8" aria-label="Weekend MVP" />
            </Link>
            <div className="mt-7 flex flex-col gap-2">
              {primaryLinks.map((item) => (
                <RailLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  activeView={activeView}
                />
              ))}
            </div>
            <div className="mt-auto">
              <RailLink
                item={{
                  href: "/dashboard/billing",
                  label: "Billing",
                  icon: CreditCard,
                  match: "prefix",
                }}
                pathname={pathname}
                activeView={activeView}
              />
            </div>
          </div>

          <aside className="hidden w-60 flex-col border-r border-white/10 bg-[#0b0b0b] px-4 py-5 lg:flex">
            <div className="flex items-center gap-2 px-2">
              <Lightbulb className="size-4 text-orange-300" aria-hidden />
              <span className="text-sm font-semibold text-zinc-100">
                Weekend MVP
              </span>
            </div>
            <p className="mt-1 px-2 text-xs leading-5 text-zinc-400">
              Evidence to shipped outcome
            </p>
            <div className="mt-7 flex flex-col gap-1">
              {workspaceLinks.map((item) => (
                <ContextLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  activeView={activeView}
                />
              ))}
            </div>
            <div className="mt-auto border-t border-white/10 px-2 pt-4">
              <p className="text-xs leading-5 text-zinc-400">
                Project cockpit becomes available after you confirm a brief.
              </p>
            </div>
          </aside>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 flex min-h-[4.5rem] items-center justify-around border-t border-white/10 bg-[#090909] px-2 pb-[env(safe-area-inset-bottom)] md:hidden">
          {primaryLinks.map((item) => (
            <ContextLink
              key={item.href}
              item={item}
              pathname={pathname}
              activeView={activeView}
              compact
            />
          ))}
          <MobileMenu pathname={pathname} activeView={activeView} />
        </div>
      </nav>

      <div className="md:pl-[4.5rem] lg:pl-[19.5rem]">
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-4 border-b border-white/10 bg-[#050505] px-5 sm:px-8">
          <Link
            href="/dashboard/explore"
            className="flex min-h-10 min-w-0 items-center gap-3 rounded-lg border border-white/10 bg-white/[0.025] px-3 text-sm text-zinc-400 hover:border-white/20 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 sm:w-72"
          >
            <Search className="size-4 shrink-0" aria-hidden />
            <span className="truncate">Search the idea library</span>
          </Link>
          <div className="hidden sm:block">
            <SignOutButton />
          </div>
        </header>
        <main id="workspace-main" tabIndex={-1} className="pb-24 outline-none md:pb-0">
          {children}
        </main>
      </div>
    </div>
  );
}
