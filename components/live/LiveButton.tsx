import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "disabled";

const STYLES: Record<Variant, string> = {
  primary:
    "bg-[#A84A00] text-white hover:bg-[#8F3F00] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A84A00]",
  secondary:
    "bg-home-orange-light text-home-ink hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-light",
  ghost:
    "border border-home-rule bg-home-card text-home-ink hover:bg-home-sunk focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-rule",
  disabled: "cursor-not-allowed border border-dashed border-home-rule bg-home-sunk text-[#6B6457]",
};

export function LiveButton({
  href,
  children,
  variant = "primary",
  external,
  className,
  disabled,
  onClick,
  type,
}: {
  href?: string;
  children: React.ReactNode;
  variant?: Variant;
  external?: boolean;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  const base =
    "inline-flex h-[52px] items-center justify-center gap-2.5 rounded-full px-[26px] text-base font-semibold whitespace-nowrap transition-colors sm:w-auto w-full";
  const styles = cn(base, STYLES[disabled ? "disabled" : variant], className);

  if (disabled || variant === "disabled") {
    return (
      <span className={styles} aria-disabled="true">
        {children}
      </span>
    );
  }

  if (onClick || type === "button" || type === "submit") {
    return (
      <button type={type ?? "button"} className={styles} onClick={onClick}>
        {children}
      </button>
    );
  }

  if (!href) {
    return (
      <span className={styles} aria-disabled="true">
        {children}
      </span>
    );
  }

  if (external) {
    return (
      <a
        href={href}
        className={styles}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
        <span aria-hidden="true">↗</span>
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    );
  }

  return (
    <Link href={href} className={styles}>
      {children}
      <span aria-hidden="true">→</span>
    </Link>
  );
}
