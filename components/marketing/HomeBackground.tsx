/**
 * Homepage background decoration: grid lines, top glow halo, three SVG
 * beams (md+), and mobile vertical beam. Stays a server component (no
 * client hooks); the beams animate via the existing global CSS animations.
 */
export function HomeBackground() {
  return (
    <>
      <div className="fixed inset-0 pointer-events-none z-0 grid-lines"></div>
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-96 bg-white/5 blur-[120px] rounded-full pointer-events-none -z-10 mix-blend-screen"></div>
      <div className="absolute top-[380px] left-0 w-full h-[800px] pointer-events-none z-0 overflow-visible hidden md:block">
        <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1440 800">
          <defs>
            <linearGradient id="beam-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="transparent"></stop>
              <stop offset="50%" stopColor="white"></stop>
              <stop offset="100%" stopColor="transparent"></stop>
            </linearGradient>
          </defs>
          {[
            "M 720 0 C 720 200, 320 200, 320 600",
            "M 720 0 V 600",
            "M 720 0 C 720 200, 1120 200, 1120 600",
          ].map((d, i) => (
            <g key={d}>
              <path d={d} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1"></path>
              <path d={d} fill="none" stroke="url(#beam-gradient)" strokeWidth="1.5" className={`beam-path beam-${i + 1} glow-filter`}></path>
            </g>
          ))}
        </svg>
      </div>
      <div className="md:hidden absolute top-[400px] left-1/2 -translate-x-1/2 w-px h-[600px] bg-white/5 z-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-transparent via-white/50 to-transparent animate-[fadeUp_3s_infinite]"></div>
      </div>
    </>
  );
}
