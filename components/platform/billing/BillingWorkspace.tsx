"use client";

import { useQuery } from "convex/react";
import { ArrowUpRight, CircleAlert, Coins, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";

type Pack = {
  id: string;
  name: string;
  amountMinor: number;
  credits: number;
};

type CheckoutState =
  | { kind: "idle" }
  | { kind: "pending"; packId: string }
  | { kind: "error"; message: string };

function formatUsd(amountMinor: bigint | number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(amountMinor) / 100);
}

function statusTone(status: string) {
  if (status === "paid") return "border-emerald-400/25 text-emerald-300";
  if (status === "refunded" || status === "failed") {
    return "border-zinc-700 text-zinc-400";
  }
  if (status === "disputed") return "border-red-400/25 text-red-300";
  return "border-amber-400/25 text-amber-300";
}

export function BillingWorkspace({ packs }: { packs: Pack[] }) {
  const summary = useQuery(api.platform.billing.queries.summary, {
    historyLimit: 20,
  });
  const searchParams = useSearchParams();
  const [projectId, setProjectId] = useState("");
  const [checkout, setCheckout] = useState<CheckoutState>({ kind: "idle" });
  const idempotencyKeys = useRef(new Map<string, string>());
  const selectedProjectId = projectId || summary?.projects[0]?.id || "";
  const returnState = searchParams.get("checkout");
  const waitingForConfirmation = returnState === "return";

  const ledgerRows = useMemo(() => summary?.ledger ?? [], [summary?.ledger]);

  async function startCheckout(packId: string) {
    if (!selectedProjectId) return;
    setCheckout({ kind: "pending", packId });
    const checkoutKey = `${selectedProjectId}:${packId}`;
    let idempotencyKey = idempotencyKeys.current.get(checkoutKey);
    if (!idempotencyKey) {
      idempotencyKey = `checkout:${crypto.randomUUID()}`;
      idempotencyKeys.current.set(checkoutKey, idempotencyKey);
    }

    try {
      const response = await fetch("/api/platform/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          packId,
          projectId: selectedProjectId,
          idempotencyKey,
        }),
      });
      const result = (await response.json()) as { ok?: boolean; url?: string };
      if (!response.ok || !result.ok || !result.url) {
        throw new Error("Checkout could not be started.");
      }
      const url = new URL(result.url);
      if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com") {
        throw new Error("Checkout returned an unexpected destination.");
      }
      window.location.assign(url.href);
    } catch {
      setCheckout({
        kind: "error",
        message: "Checkout is temporarily unavailable. Your card has not been charged.",
      });
    }
  }

  if (summary === undefined) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-zinc-400" role="status">
        <LoaderCircle className="mr-3 size-4 animate-spin" aria-hidden="true" />
        Loading billing history…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
      <header className="flex flex-col gap-6 border-b border-white/10 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-amber-300">
            Account credits
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-zinc-50 sm:text-4xl">
            Billing
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            Credits fund explicit project tasks. Purchases appear here only after Stripe confirms them.
          </p>
        </div>
        <div className="min-w-48 border-l border-white/10 pl-5">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Available</p>
          <p className="mt-2 flex items-center gap-2 text-3xl font-semibold tabular-nums text-zinc-50">
            <Coins className="size-5 text-amber-300" aria-hidden="true" />
            {summary.balance.toString()}
          </p>
        </div>
      </header>

      {summary.paidActionsSuspended && (
        <div className="mt-6 flex gap-3 border border-red-400/20 bg-red-400/[0.06] p-4 text-sm text-red-200" role="alert">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>Your balance is negative after a refund or dispute. Add credits before starting another paid task.</p>
        </div>
      )}

      {waitingForConfirmation && (
        <div className="mt-6 border border-amber-400/20 bg-amber-400/[0.05] p-4 text-sm text-amber-100" role="status">
          Checkout return received. Credit confirmation can take a moment; this page updates from the verified webhook, not the redirect.
        </div>
      )}
      {returnState === "cancelled" && (
        <div className="mt-6 border border-white/10 p-4 text-sm text-zinc-300" role="status">
          Checkout was cancelled. No credits were added and no completion is claimed.
        </div>
      )}

      <section className="mt-10" aria-labelledby="credit-packs-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="credit-packs-heading" className="text-xl font-semibold text-zinc-100">
              Add credits
            </h2>
            <p className="mt-2 text-sm text-zinc-500">One-time packs. No subscription.</p>
          </div>
          {summary.projects.length > 0 && (
            <label className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
              Purchase for project
              <select
                value={selectedProjectId}
                onChange={(event) => setProjectId(event.target.value)}
                className="mt-2 block min-h-11 min-w-64 border border-white/15 bg-zinc-950 px-3 text-sm normal-case tracking-normal text-zinc-200 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-300/30"
              >
                {summary.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {summary.projects.length === 0 ? (
          <div className="mt-5 border border-dashed border-white/15 p-6">
            <p className="text-sm text-zinc-300">A verified active project is required before Checkout.</p>
            <Link href="/dashboard/new" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-amber-300 hover:text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-300/40">
              Create a project <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className="mt-5 grid gap-px border border-white/10 bg-white/10 md:grid-cols-3">
            {packs.map((pack) => {
              const pending = checkout.kind === "pending" && checkout.packId === pack.id;
              return (
                <article key={pack.id} className="flex min-h-60 flex-col bg-[#080808] p-6">
                  <p className="text-sm font-medium text-zinc-400">{pack.name}</p>
                  <p className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-zinc-50">
                    {pack.credits} <span className="text-base font-normal text-zinc-500">credits</span>
                  </p>
                  <p className="mt-2 text-sm text-zinc-500">{formatUsd(pack.amountMinor)} one time</p>
                  <button
                    type="button"
                    disabled={checkout.kind === "pending"}
                    onClick={() => void startCheckout(pack.id)}
                    className="mt-auto inline-flex min-h-11 items-center justify-center border border-amber-300/35 bg-amber-300 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:ring-offset-2 focus:ring-offset-black disabled:cursor-wait disabled:opacity-50"
                  >
                    {pending ? <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" /> : null}
                    {pending ? "Opening Stripe…" : "Choose pack"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
        {checkout.kind === "error" && (
          <p className="mt-4 text-sm text-red-300" role="alert">{checkout.message}</p>
        )}
      </section>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_1.2fr]">
        <section aria-labelledby="purchase-history-heading">
          <h2 id="purchase-history-heading" className="text-lg font-semibold text-zinc-100">Purchases</h2>
          <div className="mt-4 border-t border-white/10">
            {summary.purchases.length === 0 ? (
              <p className="py-6 text-sm text-zinc-500">No purchases yet.</p>
            ) : summary.purchases.map((purchase) => (
              <div key={purchase.id} className="flex items-center justify-between gap-4 border-b border-white/10 py-4 text-sm">
                <div>
                  <p className="font-medium text-zinc-200">{purchase.credits.toString()} credits</p>
                  <p className="mt-1 text-xs text-zinc-600">{new Date(purchase.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-zinc-300">{formatUsd(purchase.amountMinor)}</p>
                  <span className={`mt-1 inline-flex border px-2 py-0.5 text-[11px] uppercase tracking-[0.14em] ${statusTone(purchase.status)}`}>
                    {purchase.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="ledger-heading">
          <h2 id="ledger-heading" className="text-lg font-semibold text-zinc-100">Credit ledger</h2>
          <div className="mt-4 overflow-x-auto border-t border-white/10">
            {ledgerRows.length === 0 ? (
              <p className="py-6 text-sm text-zinc-500">Ledger entries will appear after a verified credit change.</p>
            ) : (
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.14em] text-zinc-600">
                  <tr><th className="py-3 pr-4 font-medium">Reason</th><th className="py-3 pr-4 font-medium">Date</th><th className="py-3 pr-4 text-right font-medium">Change</th><th className="py-3 text-right font-medium">Balance</th></tr>
                </thead>
                <tbody>
                  {ledgerRows.map((row) => (
                    <tr key={row.id} className="border-t border-white/10 text-zinc-300">
                      <td className="py-3 pr-4 capitalize">{row.reason.replaceAll("_", " ")}</td>
                      <td className="py-3 pr-4 text-zinc-500">{new Date(row.createdAt).toLocaleDateString()}</td>
                      <td className={`py-3 pr-4 text-right tabular-nums ${row.delta > 0n ? "text-emerald-300" : "text-zinc-300"}`}>{row.delta > 0n ? "+" : ""}{row.delta.toString()}</td>
                      <td className="py-3 text-right tabular-nums">{row.balanceAfter.toString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
