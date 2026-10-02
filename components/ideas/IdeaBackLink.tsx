"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useSyncExternalStore } from "react";
import { hasSessionHintCookie } from "@/lib/auth-session-cookie";
import {
  resolveIdeaMemberReturn,
  sameOriginReferrerPath,
  type IdeaMemberReturn,
} from "@/lib/idea-member-return";

function subscribeToNothing() {
  return () => {};
}

function readSessionHint() {
  return hasSessionHintCookie(document.cookie);
}

function readServerSessionHint() {
  return false;
}

const PUBLIC_RETURN = {
  href: "/startup-ideas",
  label: "All Ideas",
} as const;

function readMemberReturn(from: string | null): IdeaMemberReturn {
  const referrerPath =
    typeof window === "undefined"
      ? null
      : sameOriginReferrerPath(document.referrer, window.location.origin);
  return resolveIdeaMemberReturn({ from, referrerPath });
}

function IdeaBackLinkInner({
  className,
  anonymousLabel,
}: {
  className?: string;
  anonymousLabel: string;
}) {
  const signedIn = useSyncExternalStore(
    subscribeToNothing,
    readSessionHint,
    readServerSessionHint,
  );
  const searchParams = useSearchParams();
  const from = searchParams.get("from");

  // Referrer is only available after mount; keep Home as the signed-in default
  // on the server/first paint so hydration stays deterministic when `from` is
  // absent. Explicit `?from=` is available from searchParams immediately.
  const target = signedIn
    ? typeof window === "undefined"
      ? resolveIdeaMemberReturn({ from, referrerPath: null })
      : readMemberReturn(from)
    : { href: PUBLIC_RETURN.href, label: anonymousLabel };

  return (
    <Link
      href={target.href}
      className={
        className ??
        "inline-flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-black"
      }
    >
      <ArrowLeft size={16} aria-hidden="true" />
      {target.label}
    </Link>
  );
}

/**
 * Sidebar (and optional footer) return control. Anonymous: All Ideas →
 * /startup-ideas (or a custom label). Signed-in: Back to Home / Explore /
 * Builds from `?from=` or a safe dashboard referrer.
 */
export function IdeaBackLink({
  className,
  anonymousLabel = PUBLIC_RETURN.label,
}: {
  className?: string;
  /** Footer copy historically said "See all startup ideas". */
  anonymousLabel?: string;
}) {
  return (
    <Suspense
      fallback={
        <Link
          href={PUBLIC_RETURN.href}
          className={
            className ??
            "inline-flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-black"
          }
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {anonymousLabel}
        </Link>
      }
    >
      <IdeaBackLinkInner className={className} anonymousLabel={anonymousLabel} />
    </Suspense>
  );
}
