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
  screenClassName,
}: {
  children: React.ReactNode;
  label: string;
  className?: string;
  screenClassName?: string;
}) {
  return (
    <div role="img" aria-label={label} className={cn("bg-home-panel p-2", className)}>
      <div className={cn("bg-home-card", screenClassName)}>{children}</div>
    </div>
  );
}

/** Hero mock: the live hike screen. */
export function HikeScreenMock({ className }: { className?: string }) {
  return (
    <figure className={cn("mx-auto w-full max-w-[300px] lg:max-w-[320px]", className)}>
      <PhoneFrame
        label="Sketch of the HydroTrail live hike screen: a sip target of 650 millilitres per hour, the next sip in 4 minutes 12 seconds, an electrolyte packet prompt with Took it and Snooze, and a large Took a sip button."
        className="rounded-[34px] shadow-[0_24px_48px_-30px_rgba(26,24,20,0.6)]"
        screenClassName="grid gap-3.5 rounded-[27px] p-[18px]"
      >
        <div className="flex items-baseline justify-between text-xs text-[#6B6457]">
          <span className="font-editorial text-[17px] font-medium tracking-[-0.01em] text-home-ink">
            HydroTrail
          </span>
          <span>Live hike, 1:12</span>
        </div>

        <div>
          <div className="text-xs text-[#6B6457]">Sip target</div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="font-editorial text-[54px] leading-none tracking-[-0.02em]">650</span>
            <span className="text-sm font-semibold text-[#4A453C]">ml/h</span>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5 font-mono text-xs font-medium">
            <span className="rounded-md bg-home-clay px-2 py-1 text-home-clay-ink">27°C</span>
            <span className="rounded-md bg-home-sky px-2 py-1 text-home-sky-ink">2,640 m</span>
            <span className="rounded-md bg-home-ochre px-2 py-1 text-home-ochre-ink">9% grade</span>
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between border-t border-home-rule pt-3 text-sm font-semibold">
            <span>Next sip in</span>
            <span className="font-mono text-xl font-medium tabular-nums">04:12</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-home-sunk">
            <div className="h-full w-[62%] rounded-full bg-home-orange" />
          </div>
        </div>

        <div className="rounded-[14px] bg-home-sage p-3 text-sm font-semibold text-home-sage-ink">
          Electrolyte packet due
          <div className="mt-2.5 grid grid-cols-2 gap-2 text-[13px]">
            <span className="rounded-full bg-home-sage-ink py-2 text-center text-white">Took it</span>
            <span className="rounded-full py-2 text-center ring-1 ring-home-sage-ink/40 ring-inset">
              Snooze
            </span>
          </div>
        </div>

        <div className="grid h-[54px] place-items-center rounded-full bg-home-orange-ink font-semibold text-white">
          Took a sip
        </div>
      </PhoneFrame>
      <figcaption className="mt-3 text-center text-[13px] text-[#6B6457]">
        A sketch of the live hike screen. The numbers are illustrative.
      </figcaption>
    </figure>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-home-rule pb-1">
      <span>{label}</span>
      <span className="text-home-ink">{value}</span>
    </div>
  );
}

const SKETCH_LABELS: Record<ScreenKey, string> = {
  landing: "Sketch of the landing screen: HydroTrail's opening line and a start button.",
  setup:
    "Sketch of the setup screen: fields for weight, duration, temperature and packets, and a start button.",
  hike: "Sketch of the live hike screen: a sip target, the next-sip countdown, a packet prompt and a Took a sip button.",
  recap:
    "Sketch of the recap screen: planned versus confirmed intake, packets taken and a sweat-rate tweak.",
};

/** Small wireframe for the four-screens row. Text stays at 12px or larger. */
export function ScreenSketch({ kind }: { kind: ScreenKey }) {
  return (
    <PhoneFrame
      label={SKETCH_LABELS[kind]}
      className="rounded-[22px] p-1.5"
      screenClassName="flex aspect-[9/13] flex-col gap-2 rounded-[17px] p-3.5 text-xs text-[#4A453C]"
    >
      {kind === "landing" ? (
        <>
          <div className="font-editorial text-base leading-[1.15] text-home-ink">
            Your bladder is full.{" "}
            <span className="text-home-orange-ink italic">Your plan is already wrong.</span>
          </div>
          <div className="h-1.5 rounded-full bg-home-rule" />
          <div className="h-1.5 w-[70%] rounded-full bg-home-rule" />
          <div className="mt-auto grid h-[30px] place-items-center rounded-full bg-home-orange-ink font-semibold text-white">
            Start a hike
          </div>
        </>
      ) : null}
      {kind === "setup" ? (
        <>
          <div className="font-editorial text-base leading-tight text-home-ink">Before you go</div>
          <Field label="Weight" value="72 kg" />
          <Field label="Duration" value="4 h" />
          <Field label="Heat" value="27°C" />
          <Field label="Packets" value="3" />
          <div className="mt-auto grid h-[30px] place-items-center rounded-full bg-home-ink font-semibold text-white">
            Start
          </div>
        </>
      ) : null}
      {kind === "hike" ? (
        <>
          <div>Sip target</div>
          <div className="font-editorial text-[30px] leading-none text-home-ink">
            650 <span className="font-sans text-xs font-semibold">ml/h</span>
          </div>
          <Field label="Next sip" value="04:12" />
          <div>Packet due</div>
          <div className="mt-auto grid h-[30px] place-items-center rounded-full bg-home-orange-ink font-semibold text-white">
            Took a sip
          </div>
        </>
      ) : null}
      {kind === "recap" ? (
        <>
          <div className="font-editorial text-base leading-tight text-home-ink">Recap</div>
          <div>Planned</div>
          <div className="h-2 rounded-full bg-home-rule" />
          <div>Confirmed</div>
          <div className="h-2 w-[74%] rounded-full bg-home-orange" />
          <Field label="Packets" value="2 of 3" />
          <div>Sweat rate +10%</div>
        </>
      ) : null}
    </PhoneFrame>
  );
}
