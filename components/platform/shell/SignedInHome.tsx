"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { parseSiteRenderSpec } from "@/convex/platform/preview/renderSpec";
import { PreviewTemplateRenderer } from "@/components/preview/templates";
import { PublishPacket } from "@/components/platform/publish/PublishPacket";
import { SIGNED_IN_HREF, objectHomeHref } from "@/lib/signed-in-chrome";
import { isValidPlatformConvexUrl } from "@/lib/platform-convex-url";

const emptySubscribe = () => () => undefined;

function HomeSkeleton() {
  return (
    <div
      aria-label="Loading home"
      className="mx-auto max-w-6xl animate-pulse space-y-6 px-5 py-10 motion-reduce:animate-none sm:px-8"
    >
      <div className="h-8 w-48 rounded-2xl bg-stone-900/10" />
      <div className="h-40 rounded-2xl bg-stone-900/5" />
      <div className="h-40 rounded-2xl bg-stone-900/5" />
    </div>
  );
}

function HomeConfigurationError() {
  return (
    <div role="alert" className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="text-lg font-semibold text-stone-950">
        Home data is unavailable
      </h1>
      <p className="mt-2 text-sm leading-6 text-stone-600">
        The Convex data connection is missing or invalid. Reload after the
        local configuration is fixed. No project was changed.
      </p>
    </div>
  );
}

function asProjectId(value: string | null): Id<"projects"> | undefined {
  if (!value || !/^[a-z0-9]+$/i.test(value) || value.length < 10) {
    return undefined;
  }
  return value as Id<"projects">;
}

function HomeCanvas({
  renderSpec,
  live,
  label,
}: {
  renderSpec: string | null;
  live: boolean;
  label: string;
}) {
  let spec = null;
  try {
    spec = renderSpec ? parseSiteRenderSpec(renderSpec) : null;
  } catch {
    spec = null;
  }

  return (
    <div
      aria-label={label}
      className="relative min-h-112 overflow-hidden rounded-3xl bg-stone-900/5"
    >
      {live ? null : (
        <p className="absolute right-4 top-4 z-10 rounded-2xl border border-dashed border-stone-900/30 bg-[#f3f1eb]/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-700">
          Preview · not live
        </p>
      )}
      {spec ? (
        <div className="origin-top scale-[0.92]">
          <PreviewTemplateRenderer spec={spec} showPreviewChrome={!live} />
        </div>
      ) : (
        <p className="px-6 py-16 text-sm text-stone-600">
          This page is not ready to render yet.
        </p>
      )}
    </div>
  );
}

function ColdHome({
  cards,
}: {
  cards: Array<{
    slug: string;
    title: string;
    description: string;
    category: string;
    buildTime: string;
  }>;
}) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-12">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-500">
        Start here
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-stone-950 sm:text-4xl">
        Pick one idea.
      </h1>
      <p className="mt-3 max-w-[36em] text-sm leading-6 text-stone-600">
        Preview it. That is the whole first session.
      </p>
      <ul className="mt-8 space-y-3">
        {cards.map((card) => (
          <li
            key={card.slug}
            className="rounded-3xl border border-stone-900/10 bg-white p-5"
          >
            <p className="text-xs capitalize text-stone-500">
              {card.category.replaceAll("-", " ")} · {card.buildTime} hours
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-stone-950">
              <Link
                href={`/ideas/${card.slug}`}
                className="rounded-2xl underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800"
              >
                {card.title}
              </Link>
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              {card.description}
            </p>
            <Link
              href={`/build/${card.slug}`}
              className="mt-4 inline-flex min-h-11 items-center rounded-2xl bg-stone-900 px-4 text-sm font-semibold text-[#f3f1eb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800"
            >
              Preview this idea
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-sm text-stone-500">
        I have my own idea instead. That path is not in this version.
      </p>
    </div>
  );
}

function SignedInHomeData() {
  const searchParams = useSearchParams();
  const projectId = asProjectId(searchParams.get("project"));
  const current = useQuery(api.platform.home.current, {
    ...(projectId ? { projectId } : {}),
  });

  if (current === undefined) return <HomeSkeleton />;

  if (current.kind === "cold") {
    return <ColdHome cards={current.cards} />;
  }

  const live = current.kind === "dayn";
  const others = current.others.filter(
    (item) => item.projectId !== current.projectId,
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17.5rem] lg:items-start">
        <HomeCanvas
          renderSpec={current.renderSpec}
          live={live}
          label={
            live
              ? `Live site ${current.kind === "dayn" ? current.hostname : ""}`
              : "Live preview of the unpublished site"
          }
        />
        {live ? (
          <aside className="rounded-3xl border border-stone-900/10 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-500">
              Live
            </p>
            <p className="mt-2 break-all text-sm font-medium text-stone-950">
              {current.hostname}
            </p>
            {current.sourceSlug ? (
              <Link
                href={`/ideas/${current.sourceSlug}`}
                className="mt-4 inline-block text-sm text-stone-600 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800"
              >
                Read the research
              </Link>
            ) : null}
            <Link
              href={SIGNED_IN_HREF.library}
              className="mt-3 block text-sm text-stone-600 underline-offset-4 hover:underline"
            >
              Start another idea
            </Link>
          </aside>
        ) : (
          <PublishPacket
            projectId={current.projectId}
            title={current.title}
            sourceSlug={current.sourceSlug}
            publishable={current.publishable}
            paid={current.paid}
          />
        )}
      </div>
      {live && others.length > 0 ? (
        <ul className="mt-8 border-t border-stone-900/10">
          {others.map((item) => (
            <li
              key={item.projectId}
              className="flex items-center justify-between gap-3 border-b border-stone-900/10 py-3 text-sm"
            >
              <span className="min-w-0 truncate">
                {item.hostname ?? item.title}
              </span>
              <Link
                href={objectHomeHref(item.projectId)}
                className="shrink-0 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800"
              >
                Open
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function SignedInHome() {
  const convexUrlIsValid = useSyncExternalStore(
    emptySubscribe,
    () => isValidPlatformConvexUrl(process.env.NEXT_PUBLIC_CONVEX_URL),
    () => true,
  );
  if (!convexUrlIsValid) return <HomeConfigurationError />;
  return <SignedInHomeData />;
}
