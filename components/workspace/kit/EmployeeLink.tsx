import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { RoleKey } from "@/lib/workspace/contracts/roster";
import { DefaultLink } from "./DefaultLink";
import { EmployeeAvatar } from "./EmployeeAvatar";
import { FOCUS } from "./styles";
import type { LinkComponent } from "./types";

/**
 * WP67 employee pages: one person, one link. The avatar and the visible
 * words go inside a single link to the employee's page, and the avatar is
 * decorative there, so the link's accessible name is the words alone (say
 * "Iris, Brand"). With no `href` (the Crew Lead, who has no page) the same
 * avatar and words render unlinked.
 */
export function EmployeeLink({
  href,
  name,
  role,
  size = "sm",
  showAiBadge = false,
  className,
  children,
  linkComponent: Link = DefaultLink,
}: {
  href: string | null;
  name: string;
  role: RoleKey;
  size?: "sm" | "md" | "md2" | "lg" | "xl";
  showAiBadge?: boolean;
  className?: string;
  /** The visible words; they are the link's whole accessible name. */
  children: ReactNode;
  linkComponent?: LinkComponent;
}) {
  const avatar = <EmployeeAvatar name={name} role={role} size={size} showAiBadge={showAiBadge} decorative />;
  if (href === null) {
    return (
      <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
        {avatar}
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 rounded-full underline-offset-2 hover:underline",
        FOCUS,
        className,
      )}
    >
      {avatar}
      {children}
    </Link>
  );
}
