"use client";

import { useEffect } from "react";
import { UTM } from "@/lib/live/config";
import { resolveLiveAttrib } from "@/lib/live/attrib";

/** Capture first-touch UTMs from the URL into sessionStorage. */
export function PersistLiveAttrib() {
  useEffect(() => {
    resolveLiveAttrib(window.location.search, UTM.free);
  }, []);
  return null;
}
