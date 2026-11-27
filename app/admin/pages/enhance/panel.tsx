"use client";

import { type FormEvent, useState } from "react";
import type { PanelCatalog } from "@/lib/landing-ai/catalog-server";
import type { Copy, LandingPageId } from "@/lib/landing-ai/blocks";
import type { Usage } from "@/lib/landing-ai/proposal";

type Preview = { before: Copy; after: Copy; costEstimate: Usage };

const actionLabels = [
  ["rewrite", "Rewrite"], ["freshen", "Freshen"], ["shorten", "Shorten"], ["add", "Add a section"],
] as const;

const control = "mt-1 block w-full rounded-lg border border-neutral-300 bg-white p-2.5 font-normal";
const button = "rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50";

function copyText(value: string | string[] | undefined) {
  return Array.isArray(value) ? value.join("\n") : value ?? "—";
}

export function EnhancePanel({ pages, generationAvailable }: {
  pages: PanelCatalog;
  generationAvailable: boolean;
}) {
  const [page, setPage] = useState<LandingPageId>(pages[0].id);
  const [blockId, setBlockId] = useState(pages[0].blocks[0]?.id ?? "");
  const [action, setAction] = useState("rewrite");
  const [instruction, setInstruction] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const blocks = pages.find(({ id }) => id === page)?.blocks ?? [];
  const selected = blocks.find(({ id }) => id === blockId);

  function choosePage(id: LandingPageId) {
    setPage(id);
    setBlockId(pages.find((entry) => entry.id === id)?.blocks[0]?.id ?? "");
    setAction("rewrite");
    setPreview(null);
    setError("");
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!generationAvailable || !selected || busy) return;
    setBusy(true);
    setError("");
    setPreview(null);
    try {
      const response = await fetch("/api/admin/page-ai/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ page, blockId, action, instruction }),
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
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <form onSubmit={generate} className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6">
        <fieldset disabled={busy} className="space-y-4">
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
                setPreview(null);
                setError("");
              }}>
                {blocks.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Action
              <select className={control} value={action} onChange={(event) => { setAction(event.target.value); setPreview(null); }}>
                {actionLabels.filter(([value]) => (value === "add") === (selected?.kind === "add")).map(([value, label]) =>
                  <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          <label className="block text-sm font-semibold">
            Instruction <span className="font-normal text-neutral-600">(optional)</span>
            <textarea className={control} rows={3} value={instruction} maxLength={1500} onChange={(event) => setInstruction(event.target.value)} />
          </label>
          <p id="preview-cost" className="text-sm text-neutral-700">
            {generationAvailable ? "Usage is estimated in tokens. The preview shows reported usage." : "Generation is unavailable until a provider is configured."}
          </p>
          <button className={button} type="submit" disabled={!generationAvailable || !selected} aria-describedby="preview-cost">
            {busy ? "Generating…" : "Generate preview"}
          </button>
        </fieldset>
      </form>
      {error && <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      {preview && (
        <section aria-label="Draft preview" className="mt-6 rounded-xl border border-neutral-200 bg-white p-5 sm:p-6">
          <h2 className="text-xl font-semibold">Review changes</h2>
          <p className="mt-2 text-sm text-neutral-700">
            {preview.costEstimate.estimated ? "Estimated usage" : "Reported usage"} · {preview.costEstimate.inputTokens} input tokens · {preview.costEstimate.outputTokens} output tokens
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
          <button type="button" className="mt-4 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold" onClick={() => setPreview(null)}>Discard</button>
        </section>
      )}
    </div>
  );
}
