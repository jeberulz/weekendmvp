"use client";

import { type FormEvent, useState } from "react";
import type { PanelCatalog } from "@/lib/landing-ai/catalog-server";
import type { Copy, LandingPageId } from "@/lib/landing-ai/blocks";
import type { Usage } from "@/lib/landing-ai/proposal";
import { estimatedUsd, estimateInputTokens, MAX_OUTPUT_TOKENS } from "@/lib/landing-ai/cost";

type Preview = { before: Copy; after: Copy; costEstimate: Usage; approval?: string };

const actionLabels = [
  ["rewrite", "Rewrite"], ["freshen", "Freshen"], ["shorten", "Shorten"], ["add", "Add a section"],
] as const;

const control = "mt-1 block w-full rounded-lg border border-neutral-300 bg-white p-2.5 font-normal";
const button = "rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50";

const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 6 });

function copyText(value: string | string[] | undefined) {
  return Array.isArray(value) ? value.join("\n") : value ?? "—";
}

export function EnhancePanel({ pages, generationAvailable, github = false }: {
  pages: PanelCatalog;
  generationAvailable: boolean;
  github?: boolean;
}) {
  const [page, setPage] = useState<LandingPageId>(pages[0].id);
  const [blockId, setBlockId] = useState(pages[0].blocks[0]?.id ?? "");
  const [action, setAction] = useState("rewrite");
  const [instruction, setInstruction] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [branch, setBranch] = useState("");
  const [saved, setSaved] = useState<{ href: string; branch: string | null } | null>(null);
  const [busy, setBusy] = useState<"generate" | "approve" | null>(null);

  const blocks = pages.find(({ id }) => id === page)?.blocks ?? [];
  const selected = blocks.find(({ id }) => id === blockId);
  const inputEstimate = estimateInputTokens(selected?.characters ?? 0, selected?.fieldCount ?? 0, instruction.length);
  const maximumEstimate = estimatedUsd(inputEstimate, MAX_OUTPUT_TOKENS);

  const selection = { page, blockId, action, ...(github ? { branch: branch.trim() } : {}) };

  function clearReview() {
    setPreview(null);
    setError("");
    setSaved(null);
  }

  function choosePage(id: LandingPageId) {
    setPage(id);
    setBlockId(pages.find((entry) => entry.id === id)?.blocks[0]?.id ?? "");
    setAction("rewrite");
    clearReview();
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!generationAvailable || !selected || busy) return;
    setBusy("generate");
    clearReview();
    try {
      const response = await fetch("/api/admin/page-ai/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...selection, instruction }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "The preview could not be generated.");
        return;
      }
      setPreview(data);
    } catch {
      setError("The preview could not be generated. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function approve() {
    if (!preview?.approval || busy) return;
    setBusy("approve");
    setError("");
    try {
      const response = await fetch("/api/admin/page-ai/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...selection, after: preview.after, approval: preview.approval }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "The preview could not be saved.");
        return;
      }
      setSaved({ href: data.href, branch: data.branch });
      setPreview(null);
    } catch {
      setError("The save could not be confirmed. Check the draft in the editor before trying again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-6">
      <form onSubmit={generate} className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6">
        <fieldset disabled={busy !== null} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm font-semibold">
              Page
              <select className={control} value={page} onChange={(event) => choosePage(event.target.value as LandingPageId)}>
                {pages.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Section
              <select className={control} value={blockId} onChange={(event) => {
                const id = event.target.value;
                setBlockId(id);
                setAction(blocks.find((block) => block.id === id)?.kind === "add" ? "add" : "rewrite");
                clearReview();
              }}>
                {blocks.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Action
              <select className={control} value={action} onChange={(event) => { setAction(event.target.value); clearReview(); }}>
                {actionLabels.filter(([value]) => (value === "add") === (selected?.kind === "add")).map(([value, label]) =>
                  <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          {github && (
            <div className="text-sm">
              <label htmlFor="draft-branch" className="font-semibold">Draft branch</label>
              <input id="draft-branch" className={control} value={branch} placeholder="content/home-refresh" required maxLength={120}
                onChange={(event) => { setBranch(event.target.value); clearReview(); }} aria-describedby="draft-branch-help" />
              <p id="draft-branch-help" className="mt-1 text-neutral-600">Use a content/ branch. Approval can create it if it does not exist.</p>
            </div>
          )}
          <label className="block text-sm font-semibold">
            Instruction <span className="font-normal text-neutral-600">(optional)</span>
            <textarea className={control} rows={3} value={instruction} maxLength={1500} onChange={(event) => setInstruction(event.target.value)} />
          </label>
          <p id="preview-cost" className="text-sm text-neutral-700">
            {generationAvailable
              ? `Estimated usage: about ${inputEstimate} input tokens and up to ${MAX_OUTPUT_TOKENS} output tokens (about ${dollars.format(maximumEstimate)} at that cap).`
              : "Generation is unavailable until a provider is configured."}
          </p>
          <button className={button} type="submit" disabled={!generationAvailable || !selected || (github && !branch.trim())} aria-describedby="preview-cost">
            {busy === "generate" ? "Generating…" : "Generate preview"}
          </button>
        </fieldset>
      </form>
      {error && <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      {saved && (
        <p role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
          {saved.branch ? <>Saved to <strong>{saved.branch}</strong>. Review the branch and open a pull request when ready.</> : "Saved to the local draft."}{" "}
          <a href={saved.href} className="font-semibold underline">Open in the page editor</a>
        </p>
      )}
      {preview && (
        <section aria-label="Draft preview" className="mt-6 rounded-xl border border-neutral-200 bg-white p-5 sm:p-6">
          <h2 className="text-xl font-semibold">Review changes</h2>
          <p className="mt-2 text-sm text-neutral-700">
            {preview.costEstimate.estimated ? "Estimated usage" : "Reported usage"} · {preview.costEstimate.inputTokens} input tokens · {preview.costEstimate.outputTokens} output tokens · about {dollars.format(estimatedUsd(preview.costEstimate.inputTokens, preview.costEstimate.outputTokens))}
          </p>
          <dl className="mt-4 divide-y divide-neutral-200">
            {Object.keys(preview.after).map((key) => (
              <div className="grid gap-3 py-4 sm:grid-cols-2" key={key}>
                <dt className="col-span-full text-sm font-medium">{key}</dt>
                <dd className="whitespace-pre-wrap rounded-lg bg-neutral-100 p-3 text-sm"><strong className="block">Before</strong>{copyText(preview.before[key])}</dd>
                <dd className="whitespace-pre-wrap rounded-lg bg-emerald-50 p-3 text-sm"><strong className="block">After</strong>{copyText(preview.after[key])}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex flex-wrap gap-3">
            {preview.approval && (
              <button type="button" className={button} disabled={busy !== null} onClick={approve}>
                {busy === "approve" ? "Saving…" : "Approve and save draft"}
              </button>
            )}
            <button type="button" className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold disabled:opacity-50"
              disabled={busy !== null} onClick={clearReview}>Discard</button>
          </div>
        </section>
      )}
    </div>
  );
}
