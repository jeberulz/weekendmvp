"use client";

import { useMutation, useQuery } from "convex/react";
import { Bookmark } from "lucide-react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { QuietErrorBoundary, WhenConvexReady } from "@/components/platform/client-gates";
import { trackDashboardEvent, type DashboardSource } from "@/lib/track";
import { cn } from "@/lib/utils";

type Variant = "button" | "primary" | "icon";

type SaveIdeaButtonProps = {
  slug: string;
  /** The idea's title. Completes the accessible name, for example "Save AI Code Reviewer". */
  title: string;
  /** Visible label. The accessible name always starts with it. */
  label?: string;
  variant?: Variant;
  source?: DashboardSource;
  className?: string;
  /**
   * The saved state when a list query already knows it. Skips the per-idea
   * subscription. Leave it out on editorial cards, which come from the manifest.
   */
  saved?: boolean;
};

const VARIANT: Record<Variant, { base: string; pressed: string }> = {
  button: {
    base: "h-11 gap-2 rounded-[9px] border border-home-rule bg-home-card px-4 text-sm font-medium text-home-ink hover:border-home-ink-3",
    pressed: "border-home-ink bg-home-sunk",
  },
  primary: {
    base: "h-11 gap-2 rounded-[9px] border border-home-ink bg-home-ink px-4 text-sm font-medium text-home-card hover:bg-home-panel",
    pressed: "",
  },
  icon: {
    base: "size-11 shrink-0 justify-center rounded-lg text-home-ink-2 hover:bg-home-sunk hover:text-home-ink",
    pressed: "text-home-ink",
  },
};

function SaveButtonView({
  pressed,
  disabled,
  onClick,
  label,
  title,
  variant,
  className,
}: {
  pressed: boolean;
  disabled: boolean;
  onClick?: () => void;
  label: string;
  title: string;
  variant: Variant;
  className?: string;
}) {
  const styles = VARIANT[variant];
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink disabled:cursor-default disabled:opacity-60",
        styles.base,
        pressed && styles.pressed,
        className,
      )}
    >
      {/* Filled when saved: the state never relies on colour alone. */}
      <Bookmark
        aria-hidden
        className="size-[17px] shrink-0"
        strokeWidth={1.7}
        fill={pressed ? "currentColor" : "none"}
      />
      <span className={variant === "icon" ? "sr-only" : undefined}>{label}</span>
      {label === "Save" && <span className="sr-only"> {title}</span>}
    </button>
  );
}

function LiveSaveButton({
  slug,
  title,
  label,
  variant,
  source,
  className,
  saved,
}: Required<Omit<SaveIdeaButtonProps, "className" | "saved">> &
  Pick<SaveIdeaButtonProps, "className" | "saved">) {
  const state = useQuery(
    api.platform.dashboard.savedState,
    saved === undefined ? { slug } : "skip",
  );
  const setSaved = useMutation(api.platform.dashboard.setSaved).withOptimisticUpdate(
    (store, args) => {
      const current = store.getQuery(api.platform.dashboard.savedState, { slug: args.slug });
      if (current) {
        store.setQuery(api.platform.dashboard.savedState, { slug: args.slug }, { saved: args.saved });
      }
    },
  );
  // For a known (list) state: shows the click at once. Convex resolves the
  // mutation only after the list query carries it, so this clears cleanly.
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");

  // Published but not seeded into Convex yet: there is nothing to save.
  if (saved === undefined && state === null) return null;
  const known = saved ?? state?.saved;
  const pressed = optimistic ?? known ?? false;

  async function toggle() {
    const next = !pressed;
    setOptimistic(next);
    try {
      await setSaved({ slug, saved: next });
      setMessage(next ? `Saved ${title}.` : `Removed ${title} from Saved.`);
      trackDashboardEvent({
        name: "explore_state_changed",
        props: { flag: "saved", value: next, source },
      });
    } catch (error) {
      console.error("Save toggle failed", error);
      setMessage("Could not update Saved. Try again.");
    } finally {
      setOptimistic(null);
    }
  }

  return (
    <>
      <SaveButtonView
        pressed={pressed}
        disabled={known === undefined}
        onClick={toggle}
        label={label}
        title={title}
        variant={variant}
        className={className}
      />
      <span role="status" className="sr-only">
        {message}
      </span>
    </>
  );
}

/**
 * Save toggle for one idea (PRD 6.10: `aria-pressed` plus a polite
 * announcement). Renders a disabled stand-in on the server so the layout does
 * not move, then the live button once Convex is ready.
 */
export function SaveIdeaButton({
  slug,
  title,
  label = "Save",
  variant = "button",
  source = "home",
  className,
  saved,
}: SaveIdeaButtonProps) {
  const standIn = (
    <SaveButtonView
      pressed={false}
      disabled
      label={label}
      title={title}
      variant={variant}
      className={className}
    />
  );
  return (
    <WhenConvexReady fallback={standIn} unavailable={null}>
      <QuietErrorBoundary fallback={null}>
        <LiveSaveButton
          slug={slug}
          title={title}
          label={label}
          variant={variant}
          source={source}
          className={className}
          saved={saved}
        />
      </QuietErrorBoundary>
    </WhenConvexReady>
  );
}
