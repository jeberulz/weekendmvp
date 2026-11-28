"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { hasSessionHintCookie } from "@/lib/auth-session-cookie";
import { memberPage } from "@/lib/member-pages";
import { isTenantHost } from "@/lib/tenant-host";
import { useConsent } from "./ConsentProvider";

export function MemberActivity() {
  const pathname = usePathname();
  const { consent } = useConsent();
  useEffect(() => {
    const page = memberPage(pathname);
    if (!page || consent !== true || !hasSessionHintCookie(document.cookie) || isTenantHost(location.host)) return;
    if (!document.cookie.split(";").some(part => part.trim() === "member_activity_consent=true")) return;
    const key = crypto.randomUUID();
    let started: number | null = null;
    let focusedMs = 0;
    let opened = false;
    let lastSent = -1;

    function report() {
      if (started !== null) {
        const now = performance.now();
        // A sleeping laptop or suspended browser can miss several heartbeats.
        focusedMs += Math.min(now - started, 35_000);
        started = now;
      }
      const duration = Math.floor(focusedMs);
      if (!opened || duration === lastSent || !hasSessionHintCookie(document.cookie)) return;
      lastSent = duration;
      void fetch("/api/platform/member-activity", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, key, focusedMs: duration }),
        keepalive: true, referrerPolicy: "no-referrer",
      }).catch(() => {});
    }
    function pause() {
      report();
      started = null;
    }
    function update() {
      if (document.visibilityState === "visible" && document.hasFocus()) {
        if (!opened) { opened = true; report(); }
        started ??= performance.now();
      } else pause();
    }
    // Deferring the first report also avoids counting React's development effect probe.
    const initial = window.setTimeout(update, 0);
    const timer = window.setInterval(report, 30_000);
    window.addEventListener("focus", update);
    window.addEventListener("blur", pause);
    window.addEventListener("pagehide", pause);
    window.addEventListener("pageshow", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
      pause();
      window.removeEventListener("focus", update);
      window.removeEventListener("blur", pause);
      window.removeEventListener("pagehide", pause);
      window.removeEventListener("pageshow", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [consent, pathname]);
  return null;
}
