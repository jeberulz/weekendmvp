"use client";

import { useEffect, useState } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { safePlatformReturn } from "@/lib/auth-return";

export default function NewsletterOptInPage() {
  const params = useSearchParams();
  const intent = params.get("intent");
  const destination = safePlatformReturn(params.get("returnTo"));
  const { isAuthenticated } = useConvexAuth();
  const record = useMutation(api.accountBeehiiv.optInAtSignup);
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    let mounted = true;
    async function complete() {
      try {
        // A return URL alone cannot subscribe a visitor. Match the choice in
        // the browser where signup started (email links can open a new tab).
        if (intent && localStorage.getItem("weekend-mvp-newsletter-intent") === intent) {
          await record({});
          if (!mounted) return;
          localStorage.removeItem("weekend-mvp-newsletter-intent");
        }
        if (mounted) router.replace(destination);
      } catch {
        if (mounted) setFailed(true);
      }
    }
    void complete();
    return () => { mounted = false; };
  }, [attempt, destination, intent, isAuthenticated, record, router]);

  if (!failed) return <p role="status">Finishing signup…</p>;
  return <div>
    <p role="alert">Your account is ready. We couldn’t save your newsletter choice.</p>
    <button onClick={() => { setFailed(false); setAttempt(attempt + 1); }}>Retry</button>
    <button onClick={() => router.replace(destination)}>Continue to your account</button>
  </div>;
}
