import React, { useState, useEffect } from 'react';
import { RELATIONSHIP_CONFIG, calculateElapsed, padZero, TimeElapsed } from '../config';

// Single digit character rendered in a rigid, fixed-width slot with pure opacity transition (zero transform, zero layout shifts)
const DigitChar: React.FC<{ char: string }> = ({ char }) => {
  return (
    <span
      key={char}
      className="w-[0.56em] inline-flex items-center justify-center text-center animate-digit-fade select-none"
      style={{ fontVariantNumeric: 'tabular-nums lining-nums' }}
    >
      {char}
    </span>
  );
};

// Stable, fixed-width time unit container for Days, Hours, Minutes, and Seconds
const TimeUnit: React.FC<{ value: string; widthClass: string; label: string }> = ({ value, widthClass, label }) => {
  const chars = value.split('');
  return (
    <div className="flex flex-col items-center">
      <div
        className={`${widthClass} shrink-0 h-10 sm:h-12 flex items-center justify-center text-2xl sm:text-3xl md:text-4xl font-light text-slate-50 tabular-nums select-none leading-none drop-shadow-[0_2px_12px_rgba(255,255,255,0.18)]`}
        style={{ fontVariantNumeric: 'tabular-nums lining-nums' }}
      >
        {chars.map((c, i) => (
          <DigitChar key={`${i}-${c}`} char={c} />
        ))}
      </div>
      <span className="text-[10px] sm:text-[11px] font-medium tracking-widest uppercase text-indigo-300/60 mt-1 select-none">
        {label}
      </span>
    </div>
  );
};

// Stationary, fixed-width colon separator
const SeparatorColon: React.FC = () => {
  return (
    <div className="w-3 sm:w-4.5 shrink-0 flex items-center justify-center text-base sm:text-xl font-light text-indigo-300/35 select-none pb-4 sm:pb-5">
      :
    </div>
  );
};

export const CounterDisplay: React.FC = () => {
  const [elapsed, setElapsed] = useState<TimeElapsed>(() =>
    calculateElapsed(RELATIONSHIP_CONFIG.startTimestamp)
  );

  useEffect(() => {
    // Initial immediate sync
    setElapsed(calculateElapsed(RELATIONSHIP_CONFIG.startTimestamp));

    // High precision second ticker
    const timer = setInterval(() => {
      setElapsed(calculateElapsed(RELATIONSHIP_CONFIG.startTimestamp));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <section className="w-full flex flex-col items-center text-center">
      {/* Subtle Romantic Pulse Indicator */}
      <div className="flex items-center justify-center gap-2 mb-3 sm:mb-4 px-3 py-1 rounded-full bg-indigo-950/30 border border-indigo-400/10 backdrop-blur-md">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-300" />
        </span>
        <span className="text-[10px] sm:text-[11px] tracking-[0.26em] uppercase text-indigo-200/70 font-medium">
          Always & Forever
        </span>
      </div>

      {/* Main Phrase - Refined Elegant Typography with Ethereal Ambient Glow */}
      <div className="relative py-1 w-full max-w-md mx-auto">
        {/* Soft breathing blue/lavender/rose ambient title aura */}
        <div
          className="absolute -top-4 left-1/2 -translate-x-1/2 w-64 sm:w-80 h-20 bg-gradient-to-r from-blue-500/10 via-violet-400/15 to-rose-400/10 blur-2xl pointer-events-none rounded-full animate-title-glow"
          aria-hidden="true"
        />
        <h1 className="relative font-romantic text-2xl sm:text-3xl md:text-[34px] font-medium tracking-[0.16em] sm:tracking-[0.20em] text-transparent bg-clip-text bg-gradient-to-r from-slate-100 via-indigo-100 to-slate-200 leading-snug px-3 drop-shadow-[0_2px_24px_rgba(165,180,252,0.30)] text-glow-romantic">
          {RELATIONSHIP_CONFIG.mainPhrase}
        </h1>
      </div>

      {/* Unified Together For & Live Counter Glass Card */}
      <div className="w-full max-w-md mt-6 sm:mt-7 px-2">
        <div className="glass-panel rounded-3xl p-5 sm:p-6 transition-all duration-300 relative overflow-hidden">
          {/* Subtle Balanced Glass Surface Highlight */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-white/[0.04] via-transparent to-transparent pointer-events-none" />

          {/* Together For Header & Hero Total Days */}
          <div className="flex flex-col items-center">
            <span className="text-[11px] sm:text-xs tracking-[0.28em] uppercase text-indigo-300/70 font-medium">
              Together for
            </span>

            {/* Strongest Visual Hero: Total Days */}
            <div className="mt-1.5 mb-4 flex items-baseline justify-center gap-2">
              <span className="font-sans-clean text-6xl sm:text-7xl font-extralight tracking-tight text-white tabular-nums drop-shadow-[0_4px_36px_rgba(199,210,254,0.35)] text-glow-lavender">
                {elapsed.totalDays}
              </span>
              <span className="font-romantic italic text-2xl sm:text-3xl text-indigo-200/85 font-normal">
                Days
              </span>
            </div>
          </div>

          {/* Live Breakdown Row: Days · Hours · Minutes · Seconds (Strictly Jitter-Free) */}
          <div className="pt-4 border-t border-white/[0.07] flex items-center justify-center gap-0.5 sm:gap-1.5">
            {/* Days Unit */}
            <TimeUnit
              value={padZero(elapsed.totalDays, 2)}
              widthClass="w-13 sm:w-15"
              label="Days"
            />

            <SeparatorColon />

            {/* Hours Unit */}
            <TimeUnit
              value={padZero(elapsed.hours)}
              widthClass="w-11 sm:w-13"
              label="Hours"
            />

            <SeparatorColon />

            {/* Minutes Unit */}
            <TimeUnit
              value={padZero(elapsed.minutes)}
              widthClass="w-11 sm:w-13"
              label="Mins"
            />

            <SeparatorColon />

            {/* Seconds Unit */}
            <TimeUnit
              value={padZero(elapsed.seconds)}
              widthClass="w-11 sm:w-13"
              label="Secs"
            />
          </div>

          {/* Since Start Date / Time Footer */}
          <div className="mt-4 pt-3.5 border-t border-white/[0.06] flex items-center justify-center">
            <p className="text-xs sm:text-sm text-slate-300/80 tracking-wide font-normal flex items-center gap-1.5 flex-wrap justify-center select-none">
              <span className="text-indigo-300/60 font-light">Since</span>
              <span className="font-medium text-slate-100">
                {RELATIONSHIP_CONFIG.formattedStartDate}, {RELATIONSHIP_CONFIG.formattedStartTime}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Subtle Romantic Relationship Signature: Ripti ♡ Raufur */}
      <div 
        className="mt-3.5 sm:mt-4 flex items-center justify-center select-none" 
        aria-label="Ripti ♡ Raufur"
      >
        <p className="flex items-center gap-2 sm:gap-2.5">
          <span className="font-romantic text-sm sm:text-base font-normal tracking-[0.20em] text-slate-200/90 drop-shadow-[0_1px_8px_rgba(165,180,252,0.15)]">
            Ripti
          </span>

          {/* Refined Glowing Curved Heart with Soft Rose-Lavender Pulse */}
          <span className="inline-flex items-center justify-center" aria-hidden="true">
            <svg
              viewBox="0 0 24 22"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-heart-pulse transition-transform"
            >
              <defs>
                <linearGradient id="signatureHeartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fda4af" stopOpacity="0.95" />
                  <stop offset="50%" stopColor="#d8b4fe" stopOpacity="0.90" />
                  <stop offset="100%" stopColor="#a5b4fc" stopOpacity="0.85" />
                </linearGradient>
                <linearGradient id="signatureHeartFill" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fda4af" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#c084fc" stopOpacity="0.18" />
                </linearGradient>
              </defs>
              <path
                d="M12 19.8c-0.3 0-5.8-3.9-8.4-7.5C1.6 9.4 1.7 5.7 4.3 3.6 6.8 1.6 9.8 2.5 12 5.1c2.2-2.6 5.2-3.5 7.7-1.5 2.6 2.1 2.7 5.8 0.7 8.7-2.6 3.6-8.1 7.5-8.4 7.5z"
                fill="url(#signatureHeartFill)"
                stroke="url(#signatureHeartGrad)"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>

          <span className="font-romantic text-sm sm:text-base font-normal tracking-[0.20em] text-slate-200/90 drop-shadow-[0_1px_8px_rgba(165,180,252,0.15)]">
            Raufur
          </span>
        </p>
      </div>
    </section>
  );
};
