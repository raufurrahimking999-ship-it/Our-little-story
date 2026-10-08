import React, { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';
import { BackgroundAura } from './components/BackgroundAura';
import { CounterDisplay } from './components/CounterDisplay';
import { MusicPlayerCard } from './components/MusicPlayerCard';
import { SpecialMessageCard } from './components/SpecialMessageCard';
import { InitialOpeningTransition } from './components/InitialOpeningTransition';
import { MemoryVaultGalleryModal } from './components/MemoryVaultGalleryModal';
import { StartupPermissionModal } from './components/StartupPermissionModal';
import { notificationService } from './services/notificationService';
import { localMusicService } from './services/localMusicService';
import { SplashScreen } from '@capacitor/splash-screen';

export default function App() {
  const [isVaultOpen, setIsVaultOpen] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('vault_is_open') === 'true';
    } catch {
      return false;
    }
  });

  const handleOpenVault = () => {
    try {
      sessionStorage.setItem('vault_is_open', 'true');
    } catch {}
    setIsVaultOpen(true);
  };

  const handleCloseVault = () => {
    try {
      sessionStorage.removeItem('vault_is_open');
    } catch {}
    setIsVaultOpen(false);
  };

  useEffect(() => {
    // Initialize native Android daily anniversary notification scheduling
    notificationService.init();
    // Safety check: ensure splash screen is hidden
    try {
      SplashScreen.hide().catch(() => {});
    } catch {}
  }, []);

  const handlePermissionsCompleted = () => {
    localMusicService.requestPermissionAndScan();
    notificationService.init();
  };

  return (
    <div className="relative min-h-[100dvh] w-full flex flex-col items-center justify-between overflow-x-hidden selection:bg-indigo-500/30">
      {/* Startup Native Android Runtime Permission Flow */}
      <StartupPermissionModal onComplete={handlePermissionsCompleted} />

      {/* Premium Initial Opening Experience (Fade-in -> Short Hold -> Seamless Reveal) */}
      <InitialOpeningTransition />

      {/* Background Nocturnal Romantic Atmosphere */}
      <BackgroundAura />

      {/* Main Single-Screen Mobile Content Container (Seamlessly reveals in lockstep with opening dissolve) */}
      <main className="relative z-10 w-full max-w-lg mx-auto flex-1 flex flex-col items-center justify-between px-4 sm:px-6 py-6 sm:py-8 pt-[max(1.75rem,env(safe-area-inset-top))] pb-[max(1.75rem,env(safe-area-inset-bottom))] animate-main-ui-reveal">
        {/* Top Header Anchor Pill */}
        <div className="w-full flex justify-center py-1">
          <div className="w-8 h-1 rounded-full bg-white/[0.08]" aria-hidden="true" />
        </div>

        {/* Centerpiece: Romantic Phrase & Real-Time Relationship Day Counter */}
        <div className="w-full my-auto py-4 sm:py-6 flex flex-col items-center">
          <CounterDisplay />
        </div>

        {/* Bottom Section: Music Player ("our_song.mp3"), Special Message & Subtle Vault Entry */}
        <div className="w-full flex flex-col items-center gap-2 mt-auto">
          <MusicPlayerCard />
          <SpecialMessageCard />
          
          {/* Subtle Vault Entry: Small Lock Icon & Exact Requested Line */}
          <div className="flex flex-col items-center gap-1.5 pt-2 pb-1">
            <button
              onClick={handleOpenVault}
              className="p-1.5 rounded-full text-indigo-300/50 hover:text-rose-300 hover:bg-white/[0.04] transition-all active:scale-95 group"
              aria-label="Open Vault"
            >
              <Lock className="w-3.5 h-3.5 transition-transform group-hover:scale-110 drop-shadow-[0_0_8px_rgba(165,180,252,0.3)]" />
            </button>
            <button
              onClick={handleOpenVault}
              className="text-[11px] sm:text-xs text-indigo-200/60 hover:text-indigo-100 font-romantic tracking-[0.1em] text-center select-none transition-colors"
            >
              A little place for the moments that mean the most.
            </button>
          </div>
        </div>
      </main>

      {/* Full-Screen Private Gallery Experience */}
      <MemoryVaultGalleryModal
        isOpen={isVaultOpen}
        onClose={handleCloseVault}
      />
    </div>
  );
}
