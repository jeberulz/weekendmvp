"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { hasSessionHintCookie } from "@/lib/auth-session-cookie";

function subscribeToNothing() {
  return () => {};
}

function readSessionHint() {
  return hasSessionHintCookie(document.cookie);
}

function readServerSessionHint() {
  return false;
}

type Crumb = { label: string; href?: string };

const PUBLIC_CRUMBS: Crumb[] = [
  { label: "Home", href: "/" },
  { label: "Startup Ideas", href: "/startup-ideas" },
];

const MEMBER_CRUMBS: Crumb[] = [
  { label: "Home", href: "/dashboard" },
  { label: "Ideas", href: "/dashboard/explore" },
];

/**
 * Visual breadcrumbs on `/ideas/{slug}`. Signed-in members see workspace
 * crumbs (Home > Ideas > title). Anonymous visitors keep marketing crumbs.
 * JSON-LD breadcrumbs stay on the public path in page.tsx.
 */
export function IdeaBreadcrumbs({ title }: { title: string }) {
  const signedIn = useSyncExternalStore(
    subscribeToNothing,
    readSessionHint,
    readServerSessionHint,
  );

  const crumbs = signedIn ? MEMBER_CRUMBS : PUBLIC_CRUMBS;

  return (
    <nav className="mb-8 text-xs text-neutral-400" aria-label="Breadcrumb">
      {crumbs.map((crumb, index) => (
        <span key={`${crumb.label}-${index}`}>
          {index > 0 ? <span className="mx-2">/</span> : null}
          {crumb.href ? (
            <Link href={crumb.href} className="hover:text-black transition-colors">
              {crumb.label}
            </Link>
          ) : (
            <span>{crumb.label}</span>
          )}
        </span>
      ))}
      <span className="mx-2">/</span>
      <span className="text-neutral-600">{title}</span>
    </nav>
  );
}
