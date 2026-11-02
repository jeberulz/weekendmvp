"use client";

import { useMutation } from "convex/react";
import { useEffect, useRef } from "react";
import { api } from "@/convex/_generated/api";
import {
  LIVE_BUILDALONG_SIGNUP_SRC,
  LIVE_REPLAY_SIGNUP_SRC,
} from "@/lib/live/config";

const ALLOWED_SIGNUP_SRC: ReadonlySet<string> = new Set([
  LIVE_BUILDALONG_SIGNUP_SRC,
  LIVE_REPLAY_SIGNUP_SRC,
]);

/**
 * One-shot: if the URL carries an allowlisted src (live-buildalong /
 * live-replay), persist it on the signed-in user once. No auth logic changes.
 */
export function RecordSignupSrc({ src }: { src: string | null }) {
  const record = useMutation(api.live.signupSrc.record);
  const done = useRef(false);

  useEffect(() => {
    if (done.current || !src) return;
    if (!ALLOWED_SIGNUP_SRC.has(src)) return;
    done.current = true;
    void record({ src }).catch(() => {
      done.current = false;
    });
  }, [record, src]);

  return null;
}
