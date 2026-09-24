/**
 * The homepage icon set: 24px grid, 1.5 stroke, one accent stroke or fill per
 * icon. Decorative by default (aria-hidden); pass `label` when an icon is the
 * only thing that names a control.
 */
import type { ReactNode } from "react";

export type IconName =
  | "arrow"
  | "briefcase"
  | "buyer"
  | "clock"
  | "copy"
  | "check"
  | "flag"
  | "kit"
  | "moon"
  | "plug"
  | "prompt"
  | "screens"
  | "search"
  | "stopwatch"
  | "sun"
  | "target"
  | "wand"
  | "weekend";

const PATHS: Record<IconName, (a: string) => ReactNode> = {
  arrow: () => <path d="M4.75 12h14.5M13.5 6.25L19.25 12l-5.75 5.75" />,
  briefcase: (a) => (
    <>
      <rect x="2.75" y="7" width="18.5" height="12.75" rx="2" />
      <path d="M9 7V5.25c0-.83.67-1.5 1.5-1.5h3c.83 0 1.5.67 1.5 1.5V7M2.75 12.25h18.5" />
      <rect x="10.25" y="10.75" width="3.5" height="3" rx=".75" fill={a} stroke={a} />
    </>
  ),
  buyer: (a) => (
    <>
      <circle cx="7.75" cy="8" r="3" />
      <path d="M2.75 19.25c0-3.1 2.2-5.25 5-5.25s5 2.15 5 5.25" />
      <path stroke={a} d="M15 3.75h5.25V9l-3.75 3.75-5-5z" />
      <circle cx="17.6" cy="6.4" r=".9" fill={a} stroke="none" />
    </>
  ),
  check: (a) => <path stroke={a} d="M5 12.5l4.25 4.25L19 7" />,
  clock: (a) => (
    <>
      <circle cx="12" cy="12" r="8.75" />
      <path stroke={a} d="M12 7.25V12l3.25 2" />
    </>
  ),
  copy: () => (
    <>
      <rect x="8.25" y="8.25" width="12" height="12" rx="2" />
      <path d="M15.75 8.25v-3c0-.83-.67-1.5-1.5-1.5h-9c-.83 0-1.5.67-1.5 1.5v9c0 .83.67 1.5 1.5 1.5h3" />
    </>
  ),
  flag: (a) => (
    <>
      <path d="M5.25 21.25V3.25" />
      <path stroke={a} d="M5.25 4h12.5l-2.5 4.25 2.5 4.25H5.25" />
    </>
  ),
  kit: (a) => (
    <>
      <path d="M2.75 7.25c0-.83.67-1.5 1.5-1.5h4.5l2 2h9c.83 0 1.5.67 1.5 1.5v8.5c0 .83-.67 1.5-1.5 1.5H4.25c-.83 0-1.5-.67-1.5-1.5z" />
      <path stroke={a} d="M9.5 13.5l1.75 1.75 3.5-3.5" />
    </>
  ),
  moon: (a) => (
    <>
      <path d="M19.5 14.25A7.75 7.75 0 1 1 9.75 4.5a7.2 7.2 0 0 0 9.75 9.75z" />
      <path stroke={a} d="M17.25 3.25v3M15.75 4.75h3" />
    </>
  ),
  plug: (a) => (
    <>
      <path d="M9.25 2.75v4M14.75 2.75v4" />
      <path d="M6.75 6.75h10.5v3.5a5.25 5.25 0 0 1-10.5 0z" />
      <path stroke={a} d="M12 15.5v5.75" />
    </>
  ),
  prompt: (a) => (
    <>
      <rect x="2.75" y="4.25" width="18.5" height="15.5" rx="2.5" />
      <path d="M7 10l2.75 2.25L7 14.5M12.25 14.5h4.5" />
      <path stroke={a} d="M17.5 6.75v3M16 8.25h3" />
    </>
  ),
  screens: (a) => (
    <>
      <rect x="2.75" y="5.75" width="5.5" height="12.5" rx="1.25" />
      <rect x="9.25" y="5.75" width="5.5" height="12.5" rx="1.25" stroke={a} />
      <rect x="15.75" y="5.75" width="5.5" height="12.5" rx="1.25" />
      <path d="M4.5 9h2M17.5 9h2" />
    </>
  ),
  search: (a) => (
    <>
      <circle cx="10.5" cy="10.5" r="6.75" />
      <path stroke={a} d="M15.5 15.5l5.25 5.25" />
    </>
  ),
  stopwatch: (a) => (
    <>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M10 2.75h4M12 2.75V6M18.25 6.75l1.25-1.25" />
      <path stroke={a} d="M12 13.5l3.25-3.25" />
      <circle cx="12" cy="13.5" r="1.1" fill={a} stroke="none" />
    </>
  ),
  sun: (a) => (
    <>
      <circle cx="12" cy="12" r="3.75" fill={a} stroke={a} />
      <path d="M12 2.75v2M12 19.25v2M2.75 12h2M19.25 12h2M5.45 5.45l1.4 1.4M17.15 17.15l1.4 1.4M5.45 18.55l1.4-1.4M17.15 6.85l1.4-1.4" />
    </>
  ),
  target: (a) => (
    <>
      <circle cx="12" cy="12" r="8.75" />
      <circle cx="12" cy="12" r="4.75" />
      <circle cx="12" cy="12" r="1.9" fill={a} stroke="none" />
    </>
  ),
  wand: (a) => (
    <>
      <path d="M4 20L15.5 8.5" />
      <path stroke={a} d="M17.5 2.75v3M16 4.25h3M20.25 8v2.5M19 9.25h2.5M12.5 3.25v2M11.5 4.25h2" />
    </>
  ),
  weekend: (a) => (
    <>
      <rect x="3.25" y="4.75" width="17.5" height="15.5" rx="2" />
      <path d="M3.25 9.25h17.5M8 2.75v4M16 2.75v4" />
      <rect x="6.75" y="12.25" width="4.5" height="4.5" rx="1" fill={a} stroke={a} />
      <rect x="12.75" y="12.25" width="4.5" height="4.5" rx="1" fill={a} stroke={a} />
    </>
  ),
};

type IconProps = {
  name: IconName;
  size?: number;
  /** Stroke colour. Defaults to the current text colour. */
  color?: string;
  /** Accent stroke/fill. Defaults to the homepage orange. */
  accent?: string;
  strokeWidth?: number;
  label?: string;
  className?: string;
};

export function Icon({
  name,
  size = 24,
  color = "currentColor",
  accent = "var(--color-home-orange)",
  strokeWidth = 1.5,
  label,
  className,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flexShrink: 0 }}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {PATHS[name](accent)}
    </svg>
  );
}
