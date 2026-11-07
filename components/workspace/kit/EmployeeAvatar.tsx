import { cn } from "@/lib/utils";
import type { RoleKey } from "@/lib/workspace/contracts/roster";
import { ROLE_LABELS } from "./types";

const AVATAR_COLOURS: Record<RoleKey, string> = {
  lead: "bg-home-ink",
  brand: "bg-home-orange-ink",
  landing: "bg-home-sky-ink",
  seo: "bg-home-sage-ink",
  marketing: "bg-home-ochre-ink",
  email: "bg-home-clay-ink",
  social: "bg-home-dr",
  engineering: "bg-home-panel",
  ads: "bg-home-ink-2",
  curriculum: "bg-home-ink-3",
  community: "bg-home-ink-3",
  merch: "bg-home-ink-3",
  outbound: "bg-home-ink-3",
};

const SIZES = {
  sm: "size-5 text-[11px]",
  md: "size-7 text-sm",
  md2: "size-8 text-[13px]",
  lg: "size-10 text-lg",
} as const;

export function EmployeeAvatar({
  name,
  role,
  size = "md",
  showAiBadge = false,
  className,
}: {
  name: string;
  role: RoleKey;
  size?: keyof typeof SIZES;
  showAiBadge?: boolean;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={`${name}, ${ROLE_LABELS[role]} (AI employee)`}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-home-card",
        AVATAR_COLOURS[role],
        SIZES[size],
        className,
      )}
    >
      <span aria-hidden="true">{name.charAt(0)}</span>
      {showAiBadge ? (
        <span
          aria-hidden="true"
          className="absolute -bottom-1 -right-1 rounded-sm border border-home-rule bg-home-card px-0.5 font-mono text-[10px] leading-none text-home-ink"
        >
          AI
        </span>
      ) : null}
    </span>
  );
}
