import React, { useState } from 'react';
import { RELATIONSHIP_CONFIG } from '../config';
import { ROMANTIC_MESSAGES_POOL } from '../services/notificationService';

export const SpecialMessageCard: React.FC = () => {
  // Combine the special message as the primary note with the romantic messages pool
  const allNotes = [RELATIONSHIP_CONFIG.specialMessage, ...ROMANTIC_MESSAGES_POOL];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);

  const handleNextNote = () => {
    if (isFading) return;
    setIsFading(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % allNotes.length);
      setIsFading(false);
    }, 260);
  };

  const currentMessage = allNotes[currentIndex];

  return (
    <div className="w-full max-w-md px-2 mt-4 sm:mt-5">
      <div 
        onClick={handleNextNote}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleNextNote();
          }
        }}
        title="Tap to reveal another love note"
        aria-label="Romantic note. Tap to reveal another love note."
        className="glass-panel-subtle rounded-2xl py-4 px-6 text-center transition-all duration-300 relative overflow-hidden cursor-pointer group active:scale-[0.99] select-none"
      >
        {/* Very subtle ambient lavender/rose backlight on hover/active */}
        <div className="absolute inset-0 bg-gradient-to-r from-rose-500/5 via-violet-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

        {/* Delicate handwritten love note quote */}
        <div className="relative z-10 flex flex-col items-center">
          <p 
            className={`font-romantic italic text-base sm:text-lg text-slate-100/95 tracking-wide leading-relaxed drop-shadow-[0_2px_16px_rgba(244,114,182,0.22)] transition-all duration-300 ${
              isFading ? 'opacity-0 scale-[0.98] blur-[2px]' : 'opacity-100 scale-100 blur-0'
            }`}
          >
            &ldquo;{currentMessage}&rdquo;
          </p>
        </div>
      </div>
    </div>
  );
};
