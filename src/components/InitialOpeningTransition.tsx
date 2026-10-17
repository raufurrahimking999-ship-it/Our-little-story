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

      {/* Centered Romantic Title */}
      <div className="relative px-6 py-4 flex flex-col items-center justify-center gap-3 animate-opening-text">
        {/* Cinematic Opening Typography */}
        <h1 className="font-romantic text-2xl sm:text-3xl font-light tracking-[0.24em] sm:tracking-[0.28em] text-slate-100 flex items-center justify-center drop-shadow-[0_2px_24px_rgba(165,180,252,0.45)] text-glow-romantic">
          <span className="italic">our little story</span>
        </h1>

        {/* Small, Elegant Romantic Heart with Soft Glow */}
        <div className="flex items-center justify-center pt-0.5">
          <svg
            className="w-4 h-4 text-rose-300/85 filter drop-shadow-[0_0_8px_rgba(244,114,182,0.65)]"
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </div>
      </div>
    </div>
  );
};
