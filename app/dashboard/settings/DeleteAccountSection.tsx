"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ModuleSkeleton, PersonalModule } from "@/components/platform/home/module-states";
import { BILLING_NAV } from "@/components/platform/shell/workspace-current";
import { api } from "@/convex/_generated/api";

/** Typed by the member to confirm. Must match `DELETE_CONFIRMATION` in convex/account/deletion.ts. */
const CONFIRM_WORD = "DELETE";

type Blocker = "super_admin" | "platform_owner" | "paid_subscription";

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";

function errorMessage(error: unknown): string {
  if (error instanceof ConvexError) {
    const data: unknown = error.data;
    const code = typeof data === "object" && data !== null && "code" in data ? String(data.code) : "";
    if (code === "CONFIRMATION_MISMATCH") return `Type ${CONFIRM_WORD} in capitals to confirm.`;
    if (code === "DELETION_BLOCKED") return "This account can't be deleted yet. See the note above.";
    if (code === "UNAUTHENTICATED") return "You are signed out. Sign in again, then try once more.";
  }
  return "Something went wrong and nothing was deleted. Try again in a minute.";
}

function BlockerNote({ blockers }: { blockers: Blocker[] }) {
  if (blockers.includes("paid_subscription")) {
    return (
      <p className="text-[15px] text-home-ink">
        Your paid plan still renews. Deleting your account can&apos;t cancel it, so cancel it first.{" "}
        <Link
          href={BILLING_NAV.href}
          className={`font-medium underline underline-offset-2 hover:text-home-orange-ink ${FOCUS_RING}`}
        >
          Go to {BILLING_NAV.label}
        </Link>
      </p>
    );
  }
  return (
    <p className="text-[15px] text-home-ink">
      This account runs the platform, so it can&apos;t be deleted from here. Contact support to change that.
    </p>
  );
}

function DeletionForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const requestDeletion = useMutation(api.account.deletion.requestDeletion);
  const authActions = useAuthActions() as ReturnType<typeof useAuthActions> | undefined;
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmed = value.trim() === CONFIRM_WORD;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed || pending) return;
    setPending(true);
    setError(null);
    try {
      await requestDeletion({ confirmation: value.trim() });
    } catch (caught) {
      setError(errorMessage(caught));
      setPending(false);
      inputRef.current?.focus();
      return;
    }
    // The sign-in records are already gone. Clearing the browser's copy is best effort.
    try {
      await authActions?.signOut();
    } catch {
      /* The session no longer exists on the server, so there is nothing left to end. */
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-[15px] font-medium text-home-ink">
          Type {CONFIRM_WORD} to confirm
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-describedby={hintId}
          aria-invalid={error !== null}
          className={`min-h-11 w-full max-w-xs rounded-[9px] border border-home-ink-3 bg-home-card px-3 text-[15px] text-home-ink ${FOCUS_RING}`}
        />
        <p id={hintId} className="text-sm text-home-ink-3">
          This can&apos;t be undone. The button turns on when the word matches.
        </p>
      </div>
      <p role="status" className={error ? "text-sm font-medium text-home-clay-ink" : "sr-only"}>
        {error ?? ""}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!confirmed || pending}
          className={`inline-flex min-h-11 items-center justify-center rounded-[9px] bg-home-clay-ink px-4 text-sm font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
        >
          {pending ? "Deleting…" : "Delete my account and data"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className={`inline-flex min-h-11 items-center justify-center rounded-[9px] border border-home-ink bg-home-card px-4 text-sm font-medium text-home-ink transition-colors hover:bg-home-sunk disabled:opacity-50 ${FOCUS_RING}`}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function DeletedNotice() {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  return (
    <div className="flex flex-col gap-3" role="status">
      <h3
        ref={headingRef}
        tabIndex={-1}
        className="text-[17px] font-medium text-home-ink outline-none"
      >
        Your account is being deleted
      </h3>
      <p className="text-[15px] text-home-ink-2">
        You are signed out and can&apos;t sign back in to this account. Removing your businesses and notes
        finishes in the background, usually within a minute.
      </p>
      <Link
        href="/"
        className={`inline-flex min-h-11 items-center justify-center self-start rounded-[9px] border border-home-ink bg-home-card px-4 text-sm font-medium text-home-ink transition-colors hover:bg-home-sunk ${FOCUS_RING}`}
      >
        Back to Weekend MVP
      </Link>
    </div>
  );
}

function DeleteAccountBody() {
  const state = useQuery(api.account.deletion.getDeletionState, {});
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const openRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  useEffect(() => {
    if (!open && restoreFocus.current) {
      restoreFocus.current = false;
      openRef.current?.focus();
    }
  }, [open]);

  if (done) return <DeletedNotice />;
  if (state === undefined) {
    return (
      <p role="status" className="text-[15px] text-home-ink-3">
        Loading…
      </p>
    );
  }
  if (state.requested) {
    return (
      <p role="status" className="text-[15px] text-home-ink-2">
        Deletion has started for this account. It finishes in the background.
      </p>
    );
  }
  if (state.blockers.length > 0) return <BlockerNote blockers={state.blockers} />;

  if (!open) {
    return (
      <button
        ref={openRef}
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex min-h-11 items-center justify-center self-start rounded-[9px] border border-home-clay-ink bg-home-card px-4 text-sm font-medium text-home-clay-ink transition-colors hover:bg-home-clay ${FOCUS_RING}`}
      >
        Delete account…
      </button>
    );
  }
  return <DeletionForm
      onDone={() => setDone(true)}
      onCancel={() => {
        restoreFocus.current = true;
        setOpen(false);
      }}
    />;
}

/** Settings: delete the signed-in member's account. The server derives who that is. */
export function DeleteAccountSection() {
  return (
    <PersonalModule skeleton={<ModuleSkeleton label="Loading account deletion" className="h-20" />}>
      <DeleteAccountBody />
    </PersonalModule>
  );
}
