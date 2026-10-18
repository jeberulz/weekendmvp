"use client";

import { useMutation } from "convex/react";
import { useEffect, useRef } from "react";
import { api } from "@/convex/_generated/api";
import { LIVE_BUILDALONG_SIGNUP_SRC } from "@/lib/live/config";

/**
 * One-shot: if the URL carries src=live-buildalong (or any allowlisted src),
 * persist it on the signed-in user once. No auth logic changes.
 */
export function RecordSignupSrc({ src }: { src: string | null }) {
  const record = useMutation(api.live.signupSrc.record);
  const done = useRef(false);

  useEffect(() => {
    if (done.current || !src) return;
    if (src !== LIVE_BUILDALONG_SIGNUP_SRC) return;
    done.current = true;
    void record({ src }).catch(() => {
      done.current = false;
    });
  }, [record, src]);

  return null;
}
