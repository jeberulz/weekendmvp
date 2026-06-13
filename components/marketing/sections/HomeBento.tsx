import {
  CalendarClock,
  CheckCircle2,
  Circle,
  CircleDashed,
  LayoutTemplate,
  Rocket,
  Target,
} from "lucide-react";

/**
 * Homepage-specific bento grid. Highly bespoke layout (timeline / goal /
 * 3-screen flow cards) that doesn't fit the generic BentoGrid section
 * because each card has unique internal visuals (timeline rows, chart,
 * device mockups). Keeping it here as a focused composable so the page
 * file stays primarily composition.
 */

const BENTO_TIMELINE = [
  { letter: "F", label: "Strategy & Scope", icon: CheckCircle2 },
  { letter: "S", label: "Build 3 Screens", icon: CircleDashed },
  { letter: "S", label: "Launch & Waitlist", icon: Circle },
];

export function HomeBento() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 max-w-6xl mx-auto relative z-10">
      {/* Timeline card */}
      <div className="animate-enter delay-300 md:col-span-4 bg-[#0A0A0A] border border-white/5 rounded-[2rem] p-8 relative overflow-hidden group hover:border-white/10 transition-colors">
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none"></div>
        <div className="absolute -top-px left-1/2 -translate-x-1/2 w-20 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
        <div className="relative z-10 flex flex-col h-full justify-between">
          <div>
            <div className="flex items-center gap-2 mb-6 text-neutral-500">
              <CalendarClock size={20} aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-wider">The Timeline</span>
            </div>
            <h3 className="text-2xl text-white font-medium tracking-tight mb-2">48-Hour Plan</h3>
            <p className="text-sm text-neutral-400">Friday to Sunday execution.</p>
          </div>
          <div className="space-y-3 mt-8">
            {BENTO_TIMELINE.map((row, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                <div className="w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-400">{row.letter}</div>
                <span className="text-sm text-neutral-300">{row.label}</span>
                <row.icon className="ml-auto text-neutral-600" size={16} aria-hidden="true" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Goal card */}
      <div className="animate-enter delay-400 md:col-span-4 bg-[#0A0A0A] border border-white/5 rounded-[2rem] p-8 relative overflow-hidden group hover:border-white/10 transition-colors">
        <div className="absolute -top-px left-1/2 -translate-x-1/2 w-20 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
        <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:opacity-30 transition-opacity">
          <Rocket size={120} aria-hidden="true" />
        </div>
        <div className="relative z-10 h-full flex flex-col">
          <div className="flex items-center gap-2 mb-6 text-neutral-500">
            <Target size={20} aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wider">The Goal</span>
          </div>
          <div className="mt-auto">
            <div className="text-6xl font-medium text-white tracking-tighter mb-2">MVP</div>
            <p className="text-neutral-400 text-sm leading-relaxed">Not version one. The smallest version that creates proof.</p>
          </div>
          <div className="mt-8 pt-6 border-t border-white/5">
            <div className="flex justify-between items-end">
              <div>
                <div className="text-3xl font-semibold text-white tracking-tight">128</div>
                <div className="text-[10px] text-neutral-500 uppercase tracking-wide font-semibold mt-1">Emails Collected</div>
              </div>
              <div className="h-8 w-24 flex items-end gap-1">
                <div className="w-full bg-neutral-800 rounded-sm h-[40%]"></div>
                <div className="w-full bg-neutral-800 rounded-sm h-[70%]"></div>
                <div className="w-full bg-white rounded-sm h-[100%] shadow-[0_0_10px_rgba(255,255,255,0.3)]"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Template card */}
      <div className="animate-enter delay-500 md:col-span-4 bg-[#0A0A0A] border border-white/5 rounded-[2rem] p-8 relative overflow-hidden group hover:border-white/10 transition-colors">
        <div className="absolute -top-px left-1/2 -translate-x-1/2 w-20 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
        <div className="flashlight-container absolute inset-0 z-0 rounded-[2rem] pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent opacity-40"></div>
          <div className="absolute inset-0 overflow-hidden rounded-[2rem] opacity-20 mix-blend-screen">
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
              <path d="M0,0 Q50,50 100,100" fill="none" stroke="url(#local-beam-gradient)" strokeWidth="0.5" className="beam-path" style={{ animation: "dash 3s linear infinite", strokeDasharray: "50, 200", strokeDashoffset: 250 }}></path>
              <defs>
                <linearGradient id="local-beam-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="transparent"></stop>
                  <stop offset="50%" stopColor="white"></stop>
                  <stop offset="100%" stopColor="transparent"></stop>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="flashlight-bg absolute inset-0 transition-opacity duration-300"></div>
          <div className="flashlight-border absolute inset-0 rounded-[2rem] p-[1px]"></div>
        </div>
        <div className="flex items-center gap-2 mb-6 text-neutral-500 relative z-10">
          <LayoutTemplate size={20} aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-wider">The Template</span>
        </div>
        <h3 className="text-2xl text-white font-medium tracking-tight mb-8 relative z-10">3-Screen Flow</h3>
        <div className="relative flex items-center justify-center gap-3 perspective-1000">
          <div className="w-20 h-32 bg-neutral-900 border border-white/10 rounded-lg shadow-xl flex flex-col p-2 gap-2 transform -rotate-12 translate-y-2 opacity-60">
            <div className="h-2 w-12 bg-white/20 rounded-full"></div>
            <div className="h-16 w-full bg-white/5 rounded-md"></div>
          </div>
          <div className="w-24 h-40 bg-neutral-800 border border-white/20 rounded-xl shadow-2xl flex flex-col p-3 gap-2 z-10 relative">
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center text-black text-[10px] font-bold shadow-lg">2</div>
            <div className="h-2 w-10 bg-white/40 rounded-full mb-1"></div>
            <div className="h-3 w-16 bg-white/10 rounded-full"></div>
            <div className="mt-auto h-6 w-full bg-white rounded-md"></div>
          </div>
          <div className="w-20 h-32 bg-neutral-900 border border-white/10 rounded-lg shadow-xl flex flex-col p-2 gap-2 transform rotate-12 translate-y-2 opacity-60">
            <div className="h-8 w-8 bg-white/10 rounded-full self-center mt-4"></div>
            <div className="h-2 w-12 bg-white/20 rounded-full self-center"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
