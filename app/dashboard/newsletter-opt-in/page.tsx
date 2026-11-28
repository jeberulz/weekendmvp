"use client";

import { useEffect, useState } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { WhenConvexReady } from "@/components/platform/client-gates";
import { api } from "@/convex/_generated/api";
import { safePlatformReturn } from "@/lib/auth-return";

export default function NewsletterOptInPage() {
  return <WhenConvexReady><CompleteOptIn /></WhenConvexReady>;
}

function CompleteOptIn() {
  const params = useSearchParams();
  const intent = params.get("intent");
  const destination = safePlatformReturn(params.get("returnTo"));
  const { isAuthenticated } = useConvexAuth();
  const record = useMutation(api.accountBeehiiv.optInAtSignup);
  const router = useRouter();
  const [needsChoice, setNeedsChoice] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    let mounted = true;
    async function complete() {
      try {
        // A return URL alone cannot subscribe a visitor. Match the choice in
        // the browser where signup started (email links can open a new tab).
        if (!confirmed && (!intent || localStorage.getItem("weekend-mvp-newsletter-intent") !== intent)) {
          setNeedsChoice(true);
          return;
        }
        await record({});
        if (!mounted) return;
        localStorage.removeItem("weekend-mvp-newsletter-intent");
        if (mounted) router.replace(destination);
      } catch {
        if (mounted) setFailed(true);
      }
    }
    void complete();
    return () => { mounted = false; };
  }, [confirmed, attempt, destination, intent, isAuthenticated, record, router]);

  if (needsChoice && !confirmed) return <div>
    <p>Would you like to receive the Weekend MVP newsletter and product updates?</p>
    <button onClick={() => setConfirmed(true)}>Yes, subscribe me</button>
    <button onClick={() => router.replace(destination)}>Skip</button>
  </div>;
  if (!failed) return <p role="status">Finishing signup…</p>;
  return <div>
    <p role="alert">Your account is ready. We couldn’t save your newsletter choice.</p>
    <button onClick={() => { setFailed(false); setAttempt(attempt + 1); }}>Retry</button>
    <button onClick={() => router.replace(destination)}>Continue to your account</button>
  </div>;
}
