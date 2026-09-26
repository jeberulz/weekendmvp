"use client";

import { Download, PackageOpen } from "lucide-react";
import { useId, useState } from "react";
import { PACK_FORMATS, type PackFormat } from "@/lib/prompt-pack/formats";
import { BuildersHubTag } from "@/components/platform/plan/BuildersHubTag";
import { BUILDERS_HUB_UI } from "@/components/platform/plan/flag";
import { useUpsell } from "@/components/platform/plan/useUpsell";
import { cn } from "@/lib/utils";
import { useFeatureGate } from "./useFeatureGate";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";
const BUTTON = cn("inline-flex h-11 items-center gap-2 rounded-[9px] px-4 text-sm font-medium transition-colors", FOCUS);

function filenameOf(response: Response, fallback: string) {
  const match = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "");
  return match?.[1] ?? fallback;
}

function LiveExport({ slug, title }: { slug: string; title: string }) {
  const { showUpsell } = useUpsell();
  const gate = useFeatureGate();
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<PackFormat>("all");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const panelId = useId();

  async function download() {
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch(`/api/ideas/prompt-pack?slug=${encodeURIComponent(slug)}&format=${format}`);
      if (response.status === 403) {
        // The server has the last word, even after the gate said yes.
        gate.openSheet("prompt_pack");
        return;
      }
      if (!response.ok) throw new Error(String(response.status));
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameOf(response, `${slug}-prompt-pack`);
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStatus("Prompt pack downloaded.");
    } catch (error) {
      console.error("Prompt pack download failed", error);
      setStatus("We could not build the prompt pack. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={(event) => {
            if (open) setOpen(false);
            else void gate.run("prompt_pack", () => setOpen(true), event.currentTarget);
          }}
          className={cn(BUTTON, "border border-home-rule bg-home-card text-home-ink hover:border-home-ink-3")}
        >
          <PackageOpen aria-hidden className="size-4 shrink-0" strokeWidth={1.8} />
          Export prompt pack
          {showUpsell && <BuildersHubTag className="text-home-ink-3" />}
        </button>
      </div>
      <div id={panelId} hidden={!open} className="rounded-[10px] border border-home-rule bg-home-paper p-4">
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-sm font-medium text-home-ink">Pick a format for {title}</legend>
          <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {PACK_FORMATS.map((option) => (
              <label key={option.id} className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-home-ink">
                <input
                  type="radio"
                  name={`${panelId}-format`}
                  value={option.id}
                  checked={format === option.id}
                  onChange={() => setFormat(option.id)}
                  className={cn("size-4 accent-home-ink", FOCUS)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
        <button
          type="button"
          onClick={download}
          disabled={busy}
          className={cn(BUTTON, "mt-3 bg-home-ink text-home-card hover:bg-home-panel disabled:cursor-wait disabled:opacity-60")}
        >
          <Download aria-hidden className="size-4 shrink-0" strokeWidth={1.8} />
          {busy ? "Building…" : "Download"}
        </button>
      </div>
      <p role="status" className="sr-only">
        {status}
      </p>
      {gate.sheet}
    </div>
  );
}

/**
 * PRD 7.2: "Export prompt pack" beside the prompts. Flag on only. A Free
 * member sees the Builder's Hub tag and gets the sheet at the click.
 */
export function ExportPromptPack({ slug, title }: { slug: string; title: string }) {
  if (!BUILDERS_HUB_UI) return null;
  return <LiveExport slug={slug} title={title} />;
}
