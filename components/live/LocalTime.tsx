"use client";

import { useSyncExternalStore } from "react";

function subscribe(): () => void {
  return () => {};
}

function formatLocal(startMs: number, endMs?: number): string {
  const fmt = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  });
  if (endMs !== undefined) {
    const a = fmt.format(new Date(startMs));
    const b = fmt.format(new Date(endMs));
    const zone = a.split(" ").slice(-1)[0];
    const bParts = b.split(" ");
    const bTime = bParts.slice(0, -1).join(" ");
    const bZone = bParts.slice(-1)[0];
    return bZone === zone
      ? `That's ${a.split(" ").slice(0, -1).join(" ")}–${bTime} your time`
      : `That's ${a} – ${b} your time`;
  }
  return `That's ${fmt.format(new Date(startMs))} your time`;
}

/**
 * Visitor-local time under a GMT line. null on the server; formats on the client.
 */
export function LocalTime({
  startMs,
  endMs,
  className,
}: {
  startMs: number;
  endMs?: number;
  className?: string;
}) {
  const label = useSyncExternalStore(
    subscribe,
    () => formatLocal(startMs, endMs),
    () => null,
  );

  if (!label) return null;
  return <p className={className ?? "font-mono text-xs text-[#6B6457]"}>{label}</p>;
}
