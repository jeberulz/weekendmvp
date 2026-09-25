"use client";

import {
  BookOpen,
  Bookmark,
  Compass,
  CreditCard,
  House,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
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
import { AccountMenu } from "./AccountMenu";
import { LegacyDarkSurface } from "./LegacyDarkSurface";
import { useSidebarCollapsed } from "./sidebar-state";
import {
  BILLING_NAV,
  PRIMARY_NAV,
  STARTER_KIT_HREF,
  isWorkspaceNavCurrent,
  type WorkspaceNavId,
} from "./workspace-current";
import { WorkspaceSearch } from "./WorkspaceSearch";

const NAV_ICONS: Record<WorkspaceNavId, LucideIcon> = {
  home: House,
  ideas: Compass,
  saved: Bookmark,
  billing: CreditCard,
};

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";

/** Compact brand mark for the collapsed rail and the phone header. */
function BrandMark() {
  return (
    <span
      aria-hidden
      className="flex size-8 items-center justify-center rounded-lg bg-home-ink font-editorial text-lg italic leading-none text-home-card"
    >
      W
    </span>
  );
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  current,
  collapsed,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  current: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        "flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-150",
        focusRing,
        current
          ? "bg-home-card font-medium text-home-ink shadow-[inset_0_0_0_1px_var(--color-home-rule)]"
          : "text-home-ink-2 hover:bg-home-card/70 hover:text-home-ink",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className="size-[18px] shrink-0" aria-hidden />
      <span className={cn(collapsed && "sr-only")}>{label}</span>
    </Link>
  );
}

function MobileTab({
  href,
  label,
  icon: Icon,
  current,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  current: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-[11px]",
        focusRing,
        current ? "font-semibold text-home-ink" : "text-home-ink-3",
      )}
    >
      <Icon className="size-5" aria-hidden />
      <span>{label}</span>
    </Link>
  );
}

function AccountSheet() {
  const sheetLink =
    "flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm text-home-ink hover:bg-home-sunk";

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-[11px] text-home-ink-3",
            focusRing,
          )}
        >
          <UserRound className="size-5" aria-hidden />
          <span>Account</span>
        </button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        overlayClassName="motion-reduce:animate-none"
        className="rounded-t-2xl border-home-rule bg-home-card pb-[max(1rem,env(safe-area-inset-bottom))] text-home-ink shadow-none motion-reduce:animate-none motion-reduce:transition-none"
      >
        <SheetHeader className="border-b border-home-rule px-5 pb-4 pt-5 text-left">
          <SheetTitle className="text-base text-home-ink">Account</SheetTitle>
          <SheetDescription className="text-home-ink-2">
            Your plan, resources and sign out.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-1 px-3">
          <SheetClose asChild>
            <Link href={BILLING_NAV.href} className={cn(sheetLink, focusRing)}>
              <CreditCard className="size-[18px] text-home-ink-2" aria-hidden />
              {BILLING_NAV.label}
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link href={STARTER_KIT_HREF} className={cn(sheetLink, focusRing)}>
              <BookOpen className="size-[18px] text-home-ink-2" aria-hidden />
              Starter Kit
            </Link>
          </SheetClose>
        </div>
        <div className="border-t border-home-rule px-5 pt-4">
          <SignOutButton className="w-full" />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const view = useSearchParams().get("view");
  const [collapsed, setCollapsed] = useSidebarCollapsed();

  return (
    <div className="min-h-dvh bg-home-paper font-sans text-home-ink">
      <a
        href="#workspace-main"
        className="fixed left-3 top-3 z-50 -translate-y-20 rounded-md bg-home-ink px-4 py-2 text-sm font-semibold text-home-card transition-transform focus:translate-y-0 focus:outline-2 focus:outline-offset-2 focus:outline-home-orange-ink motion-reduce:transition-none"
      >
        Skip to workspace content
      </a>

      <nav aria-label="Workspace" className="relative z-40">
        <div
          id="workspace-sidebar"
          className={cn(
            "fixed inset-y-0 left-0 hidden flex-col gap-6 border-r border-home-rule bg-home-sunk px-3 py-4 lg:flex",
            collapsed ? "w-[72px]" : "w-[248px]",
          )}
        >
          <div
            className={cn(
              "flex items-center",
              collapsed ? "flex-col gap-2" : "justify-between gap-2",
            )}
          >
            <Link
              href="/dashboard"
              aria-label="Weekend MVP home"
              className={cn(
                "flex min-h-10 items-center gap-2.5 rounded-lg px-2 text-home-ink",
                focusRing,
              )}
            >
              {collapsed ? <BrandMark /> : <Logo className="h-4 w-32" />}
            </Link>
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              aria-expanded={!collapsed}
              aria-controls="workspace-sidebar"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(
                "flex size-10 items-center justify-center rounded-lg text-home-ink-2 transition-colors hover:bg-home-card/70 hover:text-home-ink",
                focusRing,
              )}
            >
              {collapsed ? (
                <PanelLeftOpen className="size-[18px]" aria-hidden />
              ) : (
                <PanelLeftClose className="size-[18px]" aria-hidden />
              )}
            </button>
          </div>

          <div className="flex flex-col gap-1">
            {PRIMARY_NAV.map((item) => (
              <SidebarLink
                key={item.id}
                href={item.href}
                label={item.label}
                icon={NAV_ICONS[item.id]}
                current={isWorkspaceNavCurrent(item.id, pathname, view)}
                collapsed={collapsed}
              />
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <p
              className={cn(
                "px-3 pb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3",
                collapsed && "sr-only",
              )}
            >
              Resources
            </p>
            <SidebarLink
              href={STARTER_KIT_HREF}
              label="Starter Kit"
              icon={BookOpen}
              current={false}
              collapsed={collapsed}
            />
          </div>

          <div className="mt-auto">
            <AccountMenu collapsed={collapsed} />
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 grid grid-cols-4 border-t border-home-rule bg-home-card px-2 pb-[env(safe-area-inset-bottom)] lg:hidden">
          {PRIMARY_NAV.map((item) => (
            <MobileTab
              key={item.id}
              href={item.href}
              label={item.label}
              icon={NAV_ICONS[item.id]}
              current={isWorkspaceNavCurrent(item.id, pathname, view)}
            />
          ))}
          <AccountSheet />
        </div>
      </nav>

      <div className={collapsed ? "lg:pl-[72px]" : "lg:pl-[248px]"}>
        <header className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-home-rule bg-home-paper px-4 sm:px-8">
          <Link
            href="/dashboard"
            aria-label="Weekend MVP home"
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg text-home-ink lg:hidden",
              focusRing,
            )}
          >
            <BrandMark />
          </Link>
          <WorkspaceSearch />
        </header>
        <main id="workspace-main" tabIndex={-1} className="outline-none">
          <LegacyDarkSurface>{children}</LegacyDarkSurface>
        </main>
      </div>
    </div>
  );
}
