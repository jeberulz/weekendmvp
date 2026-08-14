"use client";

import { useQuery } from "convex/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SIGNED_IN_HREF } from "@/lib/signed-in-chrome";
import {
  LIBRARY_CATEGORIES,
  isLibraryCategory,
  isLibrarySort,
  type LibrarySort,
} from "@/lib/signed-in-home";
import { isValidPlatformConvexUrl } from "@/lib/platform-convex-url";
import { LibraryCard } from "./LibraryCard";

const emptySubscribe = () => () => undefined;

function titleCase(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function LibraryConfigurationError() {
  return (
    <div role="alert" className="rounded-3xl border border-stone-900/10 p-5">
      <h2 className="text-base font-semibold text-stone-950">
        Library data is unavailable
      </h2>
      <p className="mt-2 text-sm leading-6 text-stone-600">
        The data connection is not configured. No idea state was changed.
      </p>
    </div>
  );
}

function LibraryPickerData() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const q = searchParams.get("q")?.slice(0, 80) ?? "";
  const categoryParam = searchParams.get("category");
  const category = isLibraryCategory(categoryParam) ? categoryParam : undefined;
  const sort: LibrarySort = isLibrarySort(searchParams.get("sort"))
    ? (searchParams.get("sort") as LibrarySort)
    : "score";
  const [searchValue, setSearchValue] = useState(q);

  const requestedProject = searchParams.get("project");
  const projectId =
    requestedProject && /^[a-z0-9]+$/i.test(requestedProject)
      ? (requestedProject as Id<"projects">)
      : undefined;
  const current = useQuery(api.platform.home.current, {
    ...(projectId ? { projectId } : {}),
  });
  const library = useQuery(api.platform.home.library, {
    sort,
    ...(q ? { search: q } : {}),
    ...(category ? { category } : {}),
  });

  function replaceParam(name: string, value: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === null || value === "") next.delete(name);
    else next.set(name, value);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  const currentSlug =
    current && current.kind !== "cold" ? current.sourceSlug : undefined;

  return (
    <div>
      <form
        action={SIGNED_IN_HREF.library}
        method="get"
        className="flex flex-col gap-4 sm:flex-row sm:items-end"
      >
        <div className="min-w-0 flex-1">
          <label htmlFor="library-search" className="mb-2 block text-sm text-stone-700">
            Search the library
          </label>
          <input
            id="library-search"
            name="q"
            type="search"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            maxLength={80}
            placeholder="Title or description"
            className="min-h-11 w-full rounded-2xl border border-stone-900/15 bg-white px-3 text-sm text-stone-950 outline-none focus-visible:ring-2 focus-visible:ring-stone-800"
          />
        </div>
        <input type="hidden" name="sort" value={sort} />
        {category ? <input type="hidden" name="category" value={category} /> : null}
        <button
          type="submit"
          className="min-h-11 rounded-2xl bg-stone-900 px-4 text-sm font-semibold text-[#f3f1eb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800"
        >
          Search
        </button>
      </form>

      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Sort">
        {(["score", "newest"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-current={sort === option ? "true" : undefined}
            onClick={() => replaceParam("sort", option)}
            className="min-h-11 rounded-2xl border border-stone-900/15 px-3 text-sm capitalize text-stone-800 aria-current:bg-stone-900 aria-current:text-[#f3f1eb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800"
          >
            {option === "score" ? "Canonical" : "Newest"}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Category">
        <button
          type="button"
          aria-current={!category ? "true" : undefined}
          onClick={() => replaceParam("category", null)}
          className="min-h-11 rounded-2xl border border-stone-900/15 px-3 text-sm text-stone-800 aria-current:bg-stone-900 aria-current:text-[#f3f1eb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800"
        >
          All
        </button>
        {LIBRARY_CATEGORIES.map((option) => (
          <button
            key={option}
            type="button"
            aria-current={category === option ? "true" : undefined}
            onClick={() => replaceParam("category", option)}
            className="min-h-11 rounded-2xl border border-stone-900/15 px-3 text-sm text-stone-800 aria-current:bg-stone-900 aria-current:text-[#f3f1eb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800"
          >
            {titleCase(option)}
          </button>
        ))}
      </div>

      {library === undefined ? (
        <div
          className="mt-8 h-64 animate-pulse rounded-3xl bg-stone-900/5 motion-reduce:animate-none"
          aria-label="Loading ideas"
        />
      ) : library.cards.length === 0 ? (
        <p className="mt-8 text-sm text-stone-600">Nothing matches. Clear filters.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {library.cards.map((idea) => (
            <li key={idea.ideaId}>
              <LibraryCard idea={idea} currentSlug={currentSlug} />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-8 text-sm text-stone-500">
        I have my own idea instead. That path is not in this version.
      </p>
    </div>
  );
}

export function LibraryPicker() {
  const convexUrlIsValid = useSyncExternalStore(
    emptySubscribe,
    () => isValidPlatformConvexUrl(process.env.NEXT_PUBLIC_CONVEX_URL),
    () => true,
  );
  if (!convexUrlIsValid) return <LibraryConfigurationError />;
  return <LibraryPickerData />;
}
