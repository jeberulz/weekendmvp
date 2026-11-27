"use client";

import { useRef, useState } from "react";

import { Container, Em } from "@/components/home/ui";
import { cn } from "@/lib/utils";

import styles from "./proof-of-work.module.css";

/**
 * TODO-HERO-VIDEO: the clip in /hero-video.mp4 is a PLACEHOLDER — a
 * 10-second, 1280x720 muted film made locally with ffmpeg (dark-teal
 * gradient drift + grain), so the hero, overlay and sound toggle are
 * exercised end to end. Swap it for Sir Rulz's real clip of himself working
 * later. The placeholder file lives in the workspace at
 * ~/workspace/work-dashboard-product/hero-video.mp4 (1.0 MB) and must be
 * added to public/hero-video.mp4 via a binary-capable upload — push-files
 * is text-only, so it is NOT part of this PR. Until the file lands, the
 * hero shows the gradient fallback below.
 */
const HERO_VIDEO_SRC = "/hero-video.mp4";

function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" fill="currentColor" stroke="none" />
      {muted ? (
        <>
          <path d="m16 9.5 5 5M21 9.5l-5 5" />
        </>
      ) : (
        <>
          <path d="M15.5 8.75a4.5 4.5 0 0 1 0 6.5" />
          <path d="M18 6.25a8 8 0 0 1 0 11.5" />
        </>
      )}
    </svg>
  );
}

export function ProofHero() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);
  const [failed, setFailed] = useState(false);

  const toggleSound = () => {
    const video = videoRef.current;
    if (!video) return;
    const next = !muted;
    video.muted = next;
    setMuted(next);
    if (!next) {
      void video.play().catch(() => {
        // Autoplay with sound can still be blocked; stay muted instead.
        video.muted = true;
        setMuted(true);
      });
    }
  };

  return (
    <section aria-labelledby="proof-hero-title" className={styles.hero}>
      <div className={styles.heroMedia} aria-hidden="true">
        {!failed && (
          <video
            ref={(el) => {
              videoRef.current = el;
              if (el) el.muted = true;
            }}
            className={styles.heroVideo}
            src={HERO_VIDEO_SRC}
            muted
            loop
            autoPlay
            playsInline
            preload="metadata"
            onError={() => setFailed(true)}
          />
        )}
        <div className={styles.heroOverlay} />
      </div>

      <Container className={cn(styles.heroContent, "relative")}>
        <p className={styles.heroKicker}>Free · No account · Yours to keep</p>
        <h1
          id="proof-hero-title"
          className="max-w-[18ch] text-balance font-editorial text-[clamp(44px,6.4vw,84px)] font-normal leading-[1.02] tracking-[-0.025em]"
        >
          Walk into your review with <Em dark>a year of proof</Em> already
          written.
        </h1>
        <p className="mt-6 max-w-[54ch] text-[clamp(17px,1.6vw,20px)] leading-[1.55] text-[#e8e2d4]">
          You did the work. Then review season came and you couldn&apos;t
          remember half of it. This fixes that. Log a win in 30 seconds while
          it&apos;s fresh. Share it while it matters. When your review comes
          round, the proof is already written.
        </p>
      </Container>

      {!failed && (
        <button
          type="button"
          onClick={toggleSound}
          aria-label={muted ? "Unmute hero video" : "Mute hero video"}
          aria-pressed={!muted}
          className={styles.soundToggle}
        >
          <SoundIcon muted={muted} />
        </button>
      )}
    </section>
  );
}
