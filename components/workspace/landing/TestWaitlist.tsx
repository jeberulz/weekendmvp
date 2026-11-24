"use client";

import { useMutation } from "convex/react";
import { useId, useRef, useState, type FormEvent } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import styles from "@/components/tenant-site/tenant-site.module.css";
import { isPrivateTestAddress } from "@/lib/workspace/privateLanding";

type TestWaitlistProps = {
  projectId: Id<"projects">;
  versionId: Id<"site_versions">;
  initialCount: number;
};

/** The private preview uses the site's real form layout with an owner-only test mutation. */
export function TestWaitlist({ projectId, versionId, initialCount }: TestWaitlistProps) {
  const record = useMutation(api.growth.drafts.landing.recordTestLead);
  const field = useId();
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const active = useRef(false);
  const attempt = useRef<{ email: string; requestId: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (active.current) return;
    const rawEmail = new FormData(event.currentTarget).get("email");
    const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
    if (!isPrivateTestAddress(email)) {
      setError(true);
      setMessage("Use a test address such as grower@example.test.");
      return;
    }
    if (attempt.current?.email !== email) attempt.current = { email, requestId: crypto.randomUUID() };

    active.current = true;
    setPending(true);
    setError(false);
    setMessage("");
    try {
      const receipt = await record({ projectId, versionId, email, requestId: attempt.current.requestId });
      setCount(receipt.testLeadCount);
      setMessage("Test signup recorded.");
      attempt.current = null;
    } catch {
      setError(true);
      setMessage("The test signup could not be recorded. If a new draft is ready, reload the preview and try again.");
    } finally {
      active.current = false;
      setPending(false);
    }
  }

  return (
    <form className={styles.slot} onSubmit={submit} aria-label="Test waitlist">
      <label className={styles.label} htmlFor={field}>Test email</label>
      <input
        id={field}
        name="email"
        type="email"
        required
        maxLength={120}
        autoComplete="off"
        placeholder="grower@example.test"
        aria-describedby={`${field}-details`}
        className={styles.field}
      />
      <button type="submit" className={styles.btn} aria-disabled={pending}>
        {pending ? "Recording…" : "Test signup"}
      </button>
      <p id={`${field}-details`} className={styles.status}>Use an example.test address. This form records a test entry only.</p>
      <p className={styles.status} role={error ? "alert" : "status"}>
        {message ? `${message} ` : ""}{count} test {count === 1 ? "entry" : "entries"} for this draft.
      </p>
    </form>
  );
}
