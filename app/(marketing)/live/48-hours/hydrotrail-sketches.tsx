import { cn } from "@/lib/utils";

import type { ScreenKey } from "./free-data";

/**
 * HTML/CSS sketches of the HydroTrail screens built on stream. Not
 * screenshots: numbers are illustrative, and nothing inside is interactive.
 */

function PhoneFrame({
  children,
  label,
  className,
}: {
  children: React.ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        "rounded-[34px] border border-home-panel-rule bg-home-panel p-2 shadow-[0_24px_60px_-28px_rgba(26,24,20,0.55)]",
        className,
      )}
    >
      <div className="overflow-hidden rounded-[27px] bg-home-card">{children}</div>
    </div>
  );
}

/** Hero mock: the live hike screen. */
export function HikeScreenMock({ className }: { className?: string }) {
  return (
    <figure className={cn("mx-auto w-full max-w-[320px]", className)}>
      <PhoneFrame label="Sketch of the HydroTrail live hike screen: a sip target of 650 millilitres per hour, the next sip in 4 minutes 12 seconds, an electrolyte packet prompt with Took it and Snooze, and a large Took a sip button.">
        <div className="flex items-center justify-between px-5 pt-4 font-mono text-[10px] tracking-[0.06em] text-[#6B6457] uppercase">
          <span>HydroTrail</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-home-sage-ink" />
            Live hike · 1:12
          </span>
        </div>

        <div className="px-5 pt-5">
          <div className="font-mono text-[10px] tracking-[0.08em] text-[#6B6457] uppercase">
            Sip target
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-editorial text-[56px] leading-none font-medium tracking-[-0.02em]">
              650
            </span>
            <span className="text-sm font-semibold text-[#4A453C]">ml/h</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-[10px] text-[#4A453C]">
            <span className="rounded-full bg-home-clay px-2 py-0.5 text-home-clay-ink">27°C</span>
            <span className="rounded-full bg-home-sky px-2 py-0.5 text-home-sky-ink">2,640 m</span>
            <span className="rounded-full bg-home-ochre px-2 py-0.5 text-home-ochre-ink">
              9% grade
            </span>
          </div>
        </div>

        <div className="mx-5 mt-5 rounded-2xl border border-home-rule bg-home-paper px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold">Next sip in</span>
            <span className="font-mono text-xl font-semibold tabular-nums">04:12</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-home-sunk">
            <div className="h-full w-[62%] rounded-full bg-home-orange" />
          </div>
        </div>

        <div className="mx-5 mt-3 rounded-2xl bg-home-sage px-4 py-3 text-home-sage-ink">
          <div className="text-xs font-semibold">Electrolyte packet due</div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-semibold">
            <span className="rounded-full bg-home-sage-ink py-1.5 text-center text-white">
              Took it
            </span>
            <span className="rounded-full border border-home-sage-ink/40 py-1.5 text-center">
              Snooze
            </span>
          </div>
        </div>

        <div className="px-5 pt-4 pb-5">
          <div className="flex h-14 items-center justify-center rounded-full bg-home-orange-ink text-base font-semibold text-white">
            Took a sip
          </div>
        </div>
      </PhoneFrame>
      <figcaption className="mt-3 text-center font-mono text-[11px] text-[#6B6457]">
        The live hike screen, sketched. Numbers are illustrative.
      </figcaption>
    </figure>
  );
}

function Line({ w, className }: { w: string; className?: string }) {
  return <div className={cn("h-1.5 rounded-full bg-home-rule", w, className)} />;
}

function Field({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-home-rule bg-home-paper px-2 py-1">
      <span className="truncate text-[9px] text-[#4A453C]">{label}</span>
      <span className="h-1.5 w-6 flex-none rounded-full bg-home-rule" />
    </div>
  );
}

const SKETCH_LABELS: Record<ScreenKey, string> = {
  landing: "Sketch of the landing screen: the HydroTrail name, the hook line and a start button.",
  setup:
    "Sketch of the setup screen: fields for weight, duration, temperature, humidity and packets.",
  hike: "Sketch of the live hike screen: a sip target, a countdown and a Took a sip button.",
  recap:
    "Sketch of the recap screen: planned versus confirmed intake bars, packets taken and a sweat-rate tweak.",
};

/** Small wireframe for the four-screens row. */
export function ScreenSketch({ kind }: { kind: ScreenKey }) {
  return (
    <PhoneFrame label={SKETCH_LABELS[kind]} className="rounded-[22px] p-1.5 shadow-none">
      <div className="flex aspect-[9/14] flex-col gap-2 rounded-[17px] p-3">
        {kind === "landing" ? (
          <>
            <div className="font-mono text-[8px] tracking-[0.08em] text-[#6B6457] uppercase">
              HydroTrail
            </div>
            <div className="font-editorial mt-2 text-[15px] leading-[1.1] font-medium">
              Your bladder is full.
            </div>
            <div className="font-editorial text-[15px] leading-[1.1] text-home-orange-ink italic">
              Your plan is already wrong.
            </div>
            <Line w="w-full" className="mt-2" />
            <Line w="w-4/5" />
            <div className="mt-auto flex h-6 items-center justify-center rounded-full bg-home-orange-ink text-[9px] font-semibold text-white">
              Start a hike
            </div>
          </>
        ) : null}
        {kind === "setup" ? (
          <>
            <div className="text-[11px] font-semibold">Before you go</div>
            <Field label="Weight" />
            <Field label="Duration" />
            <Field label="Temperature" />
            <Field label="Humidity" />
            <Field label="Packets" />
            <div className="mt-auto flex h-6 items-center justify-center rounded-full bg-home-ink text-[9px] font-semibold text-white">
              Start
            </div>
          </>
        ) : null}
        {kind === "hike" ? (
          <>
            <div className="font-mono text-[8px] tracking-[0.08em] text-[#6B6457] uppercase">
              Sip target
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-editorial text-[28px] leading-none font-medium">650</span>
              <span className="text-[9px] font-semibold">ml/h</span>
            </div>
            <div className="rounded-md border border-home-rule bg-home-paper px-2 py-1.5">
              <div className="flex justify-between text-[9px]">
                <span>Next sip</span>
                <span className="font-mono font-semibold">04:12</span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-home-sunk">
                <div className="h-full w-3/5 rounded-full bg-home-orange" />
              </div>
            </div>
            <div className="rounded-md bg-home-sage px-2 py-1.5 text-[9px] font-semibold text-home-sage-ink">
              Packet due · Took it / Snooze
            </div>
            <div className="mt-auto flex h-8 items-center justify-center rounded-full bg-home-orange-ink text-[10px] font-semibold text-white">
              Took a sip
            </div>
          </>
        ) : null}
        {kind === "recap" ? (
          <>
            <div className="text-[11px] font-semibold">Recap</div>
            <div className="space-y-1.5">
              <div className="text-[9px] text-[#4A453C]">Planned</div>
              <div className="h-2 w-full rounded-full bg-home-rule" />
              <div className="text-[9px] text-[#4A453C]">Confirmed</div>
              <div className="h-2 w-3/4 rounded-full bg-home-orange" />
            </div>
            <div className="mt-1 flex justify-between rounded-md border border-home-rule bg-home-paper px-2 py-1 text-[9px]">
              <span>Packets</span>
              <span className="font-mono font-semibold">2 of 3</span>
            </div>
            <div className="rounded-md bg-home-ochre px-2 py-1 text-[9px] text-home-ochre-ink">
              Sweat rate: tweak +10%
            </div>
          </>
        ) : null}
      </div>
    </PhoneFrame>
  );
}
