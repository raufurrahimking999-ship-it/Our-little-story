import React, { useState, useEffect } from 'react';

export const InitialOpeningTransition: React.FC = () => {
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    // Safety timeout to completely unmount the overlay after the sequence completes
    const timer = setTimeout(() => {
      setIsDone(true);
    }, 3500);

    return () => clearTimeout(timer);
  }, []);

  if (isDone) return null;

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none flex flex-col items-center justify-center bg-[#030611] animate-opening-backdrop select-none overflow-hidden"
      aria-hidden="true"
      onAnimationEnd={() => setIsDone(true)}
    >
      {/* Subtle Moving Nocturnal Glow Behind Opening Text */}
      <div 
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.15)_0%,rgba(244,114,182,0.07)_40%,transparent_75%)] animate-title-glow" 
      />

      {/* Floating Minimal Heart Emblem & Centered Romantic Title */}
      <div className="relative px-6 py-4 flex flex-col items-center justify-center gap-3 animate-opening-text">
        {/* Minimal Glowing Heart Icon */}
        <div className="relative w-8 h-8 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-rose-400/20 blur-md animate-heart-pulse" />
          <svg
            viewBox="0 0 24 22"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5 text-rose-300 drop-shadow-[0_0_12px_rgba(244,114,182,0.6)]"
          >
            <path
              d="M12 19.8c-0.3 0-5.8-3.9-8.4-7.5C1.6 9.4 1.7 5.7 4.3 3.6 6.8 1.6 9.8 2.5 12 5.1c2.2-2.6 5.2-3.5 7.7-1.5 2.6 2.1 2.7 5.8 0.7 8.7-2.6 3.6-8.1 7.5-8.4 7.5z"
              fill="rgba(244, 114, 182, 0.25)"
              stroke="rgba(253, 164, 175, 0.95)"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Cinematic Opening Typography */}
        <h1 className="font-romantic text-2xl sm:text-3xl font-light tracking-[0.24em] sm:tracking-[0.28em] text-slate-100 flex items-center gap-2 drop-shadow-[0_2px_24px_rgba(165,180,252,0.45)] text-glow-romantic">
          <span className="italic">Our little story</span>
        </h1>
      </div>
    </div>
  );
};
