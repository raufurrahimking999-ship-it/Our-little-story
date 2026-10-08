import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Play, Pause, Volume2, VolumeX, Repeat, Repeat1, Shuffle, 
  Music2, SkipBack, SkipForward, ListMusic, ArrowLeft, Search, AlertCircle, Loader2, Heart, ShieldAlert, Sparkles 
} from 'lucide-react';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { audioPlayer, RepeatMode } from '../services/audioPlayerService';
import { localMusicService, SongItem } from '../services/localMusicService';
import { permissionService } from '../services/permissionService';

function formatAudioTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0 || !Number.isFinite(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export const MusicPlayerCard: React.FC = () => {
  const {
    state,
    togglePlay,
    seek,
    skipNext,
    skipPrevious,
    toggleShuffle,
    toggleMute,
    setSong,
  } = useAudioPlayer();

  const {
    isPlaying,
    duration,
    isLoading,
    hasError,
    isMuted,
    repeatMode,
    isShuffle,
    songName,
    songUrl,
  } = state;

  // Local music library & state
  const [songs, setSongs] = useState<SongItem[]>([]);
  const [isLibraryOpen, setIsLibraryOpen] = useState<boolean>(false); // Full-screen State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hasAudioPermission, setHasPermission] = useState<boolean | null>(null);
  
  // Custom Local Storage Favorites
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('our_story_favorite_songs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sync track callbacks with audioPlayerService for Android locks/next track
  useEffect(() => {
    audioPlayer.setTrackCallbacks({
      onEnded: () => handlePlayNext(),
      onNext: () => handlePlayNext(),
      onPrev: () => handlePlayPrevious(),
    });
  }, [songs, songUrl, isShuffle, repeatMode]);

  // Initial Permission Check and Resume Listeners
  useEffect(() => {
    checkDevicePermission();
    
    const unsubscribe = localMusicService.subscribe((list) => {
      setSongs(list);
    });

    // Auto-refresh when user returns to app (e.g. after changing settings permissions)
    const handleFocusOrResume = () => {
      checkDevicePermission();
    };
    
    window.addEventListener('focus', handleFocusOrResume);
    document.addEventListener('visibilitychange', handleFocusOrResume);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', handleFocusOrResume);
      document.removeEventListener('visibilitychange', handleFocusOrResume);
    };
  }, []);

  const checkDevicePermission = async () => {
    const status = await permissionService.checkPermissions();
    const granted = status.audio === 'granted';
    setHasPermission(granted);
    if (granted) {
      localMusicService.requestPermissionAndScan();
    }
  };

  const handleGrantPermission = async () => {
    const granted = await permissionService.requestAudioPermission();
    setHasPermission(granted);
    if (granted) {
      await localMusicService.requestPermissionAndScan();
    } else {
      const confirmOpen = window.confirm(
        "Storage / Media access is required to play local songs. Would you like to open Settings to enable it?"
      );
      if (confirmOpen) {
        await permissionService.openAppSettings();
      }
    }
  };

  const handleOpenLibrary = async () => {
    setIsLibraryOpen(true);
    const status = await permissionService.checkPermissions();
    if (status.audio === 'granted') {
      setHasPermission(true);
      localMusicService.requestPermissionAndScan();
    } else {
      const granted = await permissionService.requestAudioPermission();
      setHasPermission(granted);
      if (granted) {
        localMusicService.requestPermissionAndScan();
      }
    }
  };

  // Find current song index in playlist
  const currentSongIndex = songs.findIndex((s) => s.url === songUrl || songName.includes(s.title));

  const handlePlayNext = () => {
    skipNext();
  };

  const handlePlayPrevious = () => {
    skipPrevious();
  };

  const handleCycleRepeat = () => {
    audioPlayer.cycleRepeatMode();
  };

  const toggleFavorite = (songId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFavorites((prev) => {
      const updated = prev.includes(songId) 
        ? prev.filter(id => id !== songId) 
        : [...prev, songId];
      try {
        localStorage.setItem('our_story_favorite_songs', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Direct DOM element refs for 60fps smooth progress bar without React re-renders (Main Card)
  const trackContainerRef = useRef<HTMLDivElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const progressKnobRef = useRef<HTMLDivElement>(null);
  const currentTimeSpanRef = useRef<HTMLSpanElement>(null);

  // Direct DOM element refs for Full-Screen Library Bottom Player Deck
  const libTrackContainerRef = useRef<HTMLDivElement>(null);
  const libProgressFillRef = useRef<HTMLDivElement>(null);
  const libProgressKnobRef = useRef<HTMLDivElement>(null);
  const libCurrentTimeSpanRef = useRef<HTMLSpanElement>(null);

  const isDraggingRef = useRef<boolean>(false);
  const dragTimeRef = useRef<number>(0);

  const currentSong = songs.find((s) => s.url === songUrl || (songName && songName.includes(s.title)));
  const songDur = currentSong?.duration && currentSong.duration > 0 ? currentSong.duration : 0;
  const validDuration = Number.isFinite(duration) && duration > 0 ? duration : (songDur > 0 ? songDur : 180.0);

  const updateProgressDOM = (currentSec: number, totalDur: number) => {
    const validDur = totalDur > 0 ? totalDur : 180.0;
    const clampedSec = Math.max(0, Math.min(currentSec, validDur));
    const percent = Math.min(100, Math.max(0, (clampedSec / validDur) * 100));

    // Update Main Card DOM elements if visible
    if (progressFillRef.current) progressFillRef.current.style.width = `${percent}%`;
    if (progressKnobRef.current) progressKnobRef.current.style.left = `${percent}%`;
    if (currentTimeSpanRef.current) currentTimeSpanRef.current.textContent = formatAudioTime(clampedSec);

    // Update Full-Screen Library Deck DOM elements if visible
    if (libProgressFillRef.current) libProgressFillRef.current.style.width = `${percent}%`;
    if (libProgressKnobRef.current) libProgressKnobRef.current.style.left = `${percent}%`;
    if (libCurrentTimeSpanRef.current) libCurrentTimeSpanRef.current.textContent = formatAudioTime(clampedSec);
  };

  // RAF Loop while playing
  useEffect(() => {
    let rafId: number | null = null;

    const tick = () => {
      if (!isDraggingRef.current) {
        const cur = audioPlayer.getCurrentTime();
        updateProgressDOM(cur, validDuration);
      }
      if (isPlaying) {
        rafId = requestAnimationFrame(tick);
      }
    };

    if (isPlaying) {
      rafId = requestAnimationFrame(tick);
    } else {
      const cur = audioPlayer.getCurrentTime();
      updateProgressDOM(cur, validDuration);
    }

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
  }, [isPlaying, validDuration, isLibraryOpen]);

  const computeTargetSecondsFromClientX = (clientX: number, isLibDeck = false): number => {
    const container = isLibDeck ? libTrackContainerRef.current : trackContainerRef.current;
    if (!container) return 0;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * validDuration;
  };

  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>, isLibDeck = false) => {
    e.preventDefault();
    isDraggingRef.current = true;
    try {
      e.pointerId !== undefined && e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    const targetSec = computeTargetSecondsFromClientX(e.clientX, isLibDeck);
    dragTimeRef.current = targetSec;
    updateProgressDOM(targetSec, validDuration);
  };

  const handleTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>, isLibDeck = false) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();

    const targetSec = computeTargetSecondsFromClientX(e.clientX, isLibDeck);
    dragTimeRef.current = targetSec;
    updateProgressDOM(targetSec, validDuration);
  };

  const handleTrackPointerUp = (e: React.PointerEvent<HTMLDivElement>, isLibDeck = false) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    isDraggingRef.current = false;
    try {
      e.pointerId !== undefined && e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const finalTargetSec = computeTargetSecondsFromClientX(e.clientX, isLibDeck);
    dragTimeRef.current = finalTargetSec;
    updateProgressDOM(finalTargetSec, validDuration);
    seek(finalTargetSec);
  };

  const filteredSongs = songs.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full max-w-md px-2 relative">
      {/* 
        =========================================================================
        1. EXISTING MAIN AUDIO PLAYER CARD (Elegant Liquid-Glassmorphism Theme)
        =========================================================================
      */}
      <div className="glass-panel rounded-3xl p-4 sm:p-4.5 transition-all duration-300 relative overflow-hidden">
        {/* Balanced, uniform ambient glow across the entire card surface */}
        <div
          className={`absolute inset-0 rounded-3xl bg-gradient-to-b from-indigo-500/10 via-indigo-500/5 to-violet-500/10 transition-opacity duration-700 pointer-events-none ${
            isPlaying ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Top Header Row: Icon, Title & Controls */}
        <div className="flex items-center justify-between gap-2 relative z-10">
          {/* Left: Disc icon & Song meta */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {/* Compact Spinning Disc Icon with Heart Detail */}
            <div
              className={`relative w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full bg-slate-950/80 border border-white/[0.14] flex items-center justify-center shrink-0 shadow-inner transition-all duration-700 ${
                isPlaying
                  ? 'ring-1.5 ring-indigo-400/70 shadow-[0_0_16px_rgba(165,180,252,0.40)] animate-disc-glow'
                  : 'ring-1 ring-white/[0.08] shadow-none'
              }`}
            >
              <div
                className={`w-full h-full flex items-center justify-center transition-transform duration-700 ${
                  isPlaying ? 'animate-[spin_10s_linear_infinite]' : ''
                }`}
              >
                <Music2 className="w-3.5 h-3.5 text-indigo-200/90" />
              </div>
            </div>

            {/* Song Meta (Title + Playlist Button) */}
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleOpenLibrary}
                  className="text-xs sm:text-sm font-medium text-slate-100 truncate tracking-wide leading-tight text-left hover:text-indigo-200 transition-colors"
                  title="Open Dedicated Song List"
                >
                  {songName}
                </button>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <span className="text-indigo-200/50">{songs.length} songs available</span>
                {isLoading && <Loader2 className="w-2.5 h-2.5 animate-spin text-indigo-300" />}
              </div>
            </div>
          </div>

          {/* Right Controls Container */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Previous Track */}
            <button
              onClick={handlePlayPrevious}
              className="p-1.5 text-slate-300 hover:text-white transition-colors active:scale-95"
              title="Previous Song"
              aria-label="Previous Song"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>

            {/* Luxurious Circular Play/Pause Button */}
            <button
              onClick={togglePlay}
              disabled={isLoading}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-indigo-500/35 via-violet-500/30 to-rose-500/25 hover:from-indigo-500/45 hover:to-rose-500/35 border border-indigo-300/35 flex items-center justify-center text-white shadow-[0_0_16px_rgba(129,140,248,0.30)] active:scale-95 transition-all duration-200"
              aria-label={isPlaying ? 'Pause song' : 'Play song'}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : isPlaying ? (
                <Pause className="w-4 h-4 fill-current text-slate-100" />
              ) : (
                <Play className="w-4 h-4 fill-current text-slate-100 ml-0.5" />
              )}
            </button>

            {/* Next Track */}
            <button
              onClick={handlePlayNext}
              className="p-1.5 text-slate-300 hover:text-white transition-colors active:scale-95"
              title="Next Song"
              aria-label="Next Song"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>

            {/* Dedicated Song List Trigger */}
            <button
              onClick={handleOpenLibrary}
              className="p-1.5 rounded-xl text-indigo-300/80 hover:text-indigo-200 bg-white/[0.04] border border-white/[0.06] transition-colors active:scale-95 ml-0.5"
              title="Open full-screen Song List"
              aria-label="Open full-screen Song List"
            >
              <ListMusic className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Slim, Elegant Progress Bar & Timestamps */}
        <div className="mt-2.5 space-y-1 relative z-10">
          {/* Synchronized Custom Progress Track Container */}
          <div
            ref={trackContainerRef}
            onPointerDown={(e) => handleTrackPointerDown(e, false)}
            onPointerMove={(e) => handleTrackPointerMove(e, false)}
            onPointerUp={(e) => handleTrackPointerUp(e, false)}
            onPointerCancel={(e) => handleTrackPointerUp(e, false)}
            role="slider"
            aria-label="Seek progress"
            aria-valuemin={0}
            aria-valuemax={validDuration}
            tabIndex={0}
            className="relative w-full h-4 sm:h-5 flex items-center select-none cursor-pointer group touch-none"
          >
            {/* Background track line */}
            <div className="w-full h-1 sm:h-1.5 rounded-full bg-white/10 overflow-hidden relative pointer-events-none">
              <div
                ref={progressFillRef}
                className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-indigo-300 to-violet-400 will-change-[width]"
                style={{ width: '0%' }}
              />
            </div>

            {/* Round Progress Indicator Knob */}
            <div
              ref={progressKnobRef}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-slate-100 shadow-[0_0_8px_rgba(167,139,250,0.85)] border border-indigo-200 pointer-events-none transition-transform group-hover:scale-125 group-active:scale-125 will-change-[left]"
              style={{ left: '0%' }}
              aria-hidden="true"
            />
          </div>

          {/* Timestamp Indicators & Controls */}
          <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono tabular-nums px-0.5 pt-0.5 select-none">
            <span ref={currentTimeSpanRef}>00:00</span>

            {/* Playback Controls Row */}
            <div className="flex items-center gap-3">
              {/* Shuffle button */}
              <button
                onClick={toggleShuffle}
                className={`p-1 rounded-full focus:outline-none transition-colors active:scale-95 ${
                  isShuffle ? 'text-indigo-300 drop-shadow-[0_0_6px_rgba(129,140,248,0.65)]' : 'text-slate-500 hover:text-slate-300'
                }`}
                title={isShuffle ? 'Shuffle: On' : 'Shuffle: Off'}
                aria-label="Toggle Shuffle"
              >
                <Shuffle className="w-3.5 h-3.5" />
              </button>

              {/* Repeat Button */}
              <button
                onClick={handleCycleRepeat}
                className={`p-0.5 transition-colors active:scale-95 flex items-center relative ${
                  repeatMode !== 'off' ? 'text-indigo-300' : 'text-slate-500 hover:text-slate-300'
                }`}
                title={`Repeat: ${repeatMode}`}
                aria-label="Cycle Repeat mode"
              >
                {repeatMode === 'one' ? <Repeat1 className="w-3.5 h-3.5 text-rose-300" /> : <Repeat className="w-3.5 h-3.5" />}
              </button>

              {/* Mute button */}
              <button
                onClick={toggleMute}
                className="text-slate-400 hover:text-slate-200 transition-colors p-0.5 active:scale-95"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? (
                  <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-indigo-300/80" />
                )}
              </button>
            </div>

            <span>{formatAudioTime(validDuration)}</span>
          </div>
        </div>

        {/* Error notification */}
        {hasError && (
          <div className="mt-2.5 p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] flex items-center justify-between gap-1.5 relative z-10 animate-fade-in">
            <span className="flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Failed to load track.
            </span>
            <button
              onClick={() => audioPlayer.resetToDefault()}
              className="text-[10px] text-indigo-300 hover:underline"
            >
              Reset Player
            </button>
          </div>
        )}
      </div>

      {/* 
        =========================================================================
        2. PORTALED FULL-SCREEN SONG LIST (PREMIUM ROMANTIC MUSIC LIBRARY)
        - Uses React Portal to guarantee absolutely 100% viewport edge-to-edge layout
        - Harmonized with exact same single-tone nocturnal romantic atmosphere
        - Responds flawlessly to all Android displays & high-density screens
        =========================================================================
      */}
      {isLibraryOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col bg-[#040711] text-slate-100 overflow-hidden select-none animate-digit-fade">
          
          {/* Subtle Romantic Vector Ambient Glow background details */}
          <div className="absolute top-[8%] left-[6%] w-[240px] h-[240px] rounded-full bg-indigo-600/10 blur-[100px] pointer-events-none" />
          <div className="absolute bottom-[20%] right-[4%] w-[260px] h-[260px] rounded-full bg-violet-600/10 blur-[110px] pointer-events-none" />

          {/* Top Header - Harmonized with Romantic Theme */}
          <header className="w-full shrink-0 border-b border-indigo-400/15 bg-[#0a1026]/90 px-4 py-3 sm:px-6 flex items-center justify-between z-30 pt-[calc(10px+env(safe-area-inset-top,0px))]">
            <button
              onClick={() => setIsLibraryOpen(false)}
              className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-white/[0.06] border border-white/10 text-xs font-semibold text-slate-200 hover:text-white transition-all active:scale-95 shrink-0"
              title="Return to Player"
            >
              <ArrowLeft className="w-4 h-4 text-indigo-300" />
              <span>Back</span>
            </button>

            <div className="text-center min-w-0 flex-1 px-2">
              <h1 className="text-sm sm:text-base font-bold tracking-widest text-slate-100 flex items-center justify-center gap-2">
                <span>Song List</span>
                <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400/20" />
              </h1>
              <p className="text-[10px] text-indigo-300/70 font-medium tracking-wider mt-0.5">Romantic Collection</p>
            </div>

            {/* Empty balance item for perfect alignment */}
            <div className="w-[72px] sm:w-[84px] shrink-0" />
          </header>

          {/* Main content - Spans 100% width with no side margins */}
          <div className="flex-1 overflow-y-auto space-y-4 px-4 py-4 sm:px-6 pb-36 z-20">
            {/* Full Width Songs listing */}
            <div className="space-y-4">
              
              {/* Clean Solid Search Input - Premium Minimal Styling */}
              <div className="relative w-full">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <Search className="w-4 h-4 text-indigo-300/70" />
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by track name, artist name, folder..."
                  className="w-full pl-10 pr-4 py-3 text-xs rounded-xl bg-[#0c1228] border border-indigo-400/15 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-400 transition-all shadow-inner"
                />
              </div>

              {/* Permission Banner if Audio Permission Denied */}
              {hasAudioPermission === false && (
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-indigo-950/60 border border-indigo-400/20 text-xs text-indigo-200 gap-2">
                  <div className="flex items-center gap-2 min-w-0 pr-1">
                    <ShieldAlert className="w-4 h-4 text-rose-300 shrink-0" />
                    <span className="truncate text-[11px] sm:text-xs">Storage/Audio permission needed to list songs from your device.</span>
                  </div>
                  <button
                    onClick={() => permissionService.openAppSettings()}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[11px] shrink-0 active:scale-95 transition-all shadow-md"
                  >
                    Open Settings
                  </button>
                </div>
              )}

              {/* Song list layout (Single-tone consistent card) */}
              <div className="w-full bg-[#0a1026]/90 border border-indigo-400/15 rounded-2xl p-1 sm:p-2 shadow-xl space-y-1 divide-y divide-white/[0.04]">
                {filteredSongs.length === 0 ? (
                  <div className="py-20 text-center text-xs text-slate-400 space-y-3">
                    <Music2 className="w-12 h-12 mx-auto text-slate-600" />
                    <p className="text-slate-400 font-medium">No matching songs found in your library.</p>
                  </div>
                ) : (
                  filteredSongs.map((song, idx) => {
                      const isCurrent = song.url === songUrl || songName.includes(song.title);
                      const isFav = favorites.includes(song.id);
                      return (
                        <div
                          key={song.id || idx}
                          onClick={() => {
                            setSong(song.url, `${song.title} — ${song.artist}`, song.artist, song.album, song.duration, idx, songs);
                          }}
                          className={`flex items-center justify-between p-3.5 sm:p-4 rounded-xl cursor-pointer transition-all ${
                            isCurrent
                              ? 'bg-indigo-500/20 border-l-4 border-indigo-400 text-indigo-200 font-semibold shadow-inner'
                              : 'hover:bg-white/[0.04] border-l-4 border-transparent text-slate-200'
                          }`}
                        >
                          {/* Left Details */}
                          <div className="flex items-center gap-3.5 min-w-0 pr-2">
                            {/* CD Artwork icon / Current Playing indicator */}
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isCurrent ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-900 border border-white/5 text-slate-400'
                            }`}>
                              {isCurrent && isPlaying ? (
                                <span className="flex items-end gap-0.5 h-3">
                                  <span className="w-0.5 h-3 bg-white animate-pulse" />
                                  <span className="w-0.5 h-2 bg-white animate-pulse delay-75" />
                                  <span className="w-0.5 h-2.5 bg-white animate-pulse delay-150" />
                                </span>
                              ) : (
                                <Music2 className="w-4 h-4" />
                              )}
                            </div>

                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className={`text-xs sm:text-sm font-semibold truncate tracking-wide leading-tight ${isCurrent ? 'text-indigo-200' : 'text-slate-100'}`}>
                                  {song.title}
                                </span>
                                {song.isBuiltIn && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-rose-500/20 text-rose-300 font-medium border border-rose-400/30 shrink-0">
                                    Our Song
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] sm:text-xs text-slate-400 truncate mt-0.5">
                                {song.artist || 'Local Audio'}
                              </span>
                            </div>
                          </div>

                          {/* Right Controls */}
                          <div className="flex items-center gap-3 shrink-0">
                            {/* Favorite toggle option */}
                            <button
                              onClick={(e) => toggleFavorite(song.id, e)}
                              className={`p-2 rounded-lg transition-colors hover:bg-white/5 ${
                                isFav ? 'text-rose-500' : 'text-slate-500 hover:text-slate-300'
                              }`}
                              title="Like Song"
                            >
                              <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                            </button>

                            <span className="text-[10px] sm:text-xs font-mono text-slate-400 tabular-nums">
                              {song.duration > 0 ? formatAudioTime(song.duration) : '--:--'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Library Footer info */}
                  <div className="flex justify-between items-center text-[10px] sm:text-xs text-slate-400 px-1 pt-1">
                    <span>Device Library Scanned</span>
                    <button
                      onClick={() => localMusicService.requestPermissionAndScan()}
                      className="text-indigo-400 hover:text-indigo-300 font-bold transition-colors"
                    >
                      Rescan Songs
                    </button>
                  </div>
                </div>
              </div>
            </div>

          {/* 
            =========================================================================
            3. PREMIUM SOLID BOTTOM PLAYER CONTROLLER DECK
            - Contains a full-sized seekbar, play/pause, prev/next, shuffle, and repeat
            - Completely unified romantic theme tone
            =========================================================================
          */}
          <div className="fixed bottom-0 left-0 right-0 bg-[#0a1026]/95 border-t border-indigo-400/15 p-4 sm:p-5 flex flex-col gap-3.5 z-30 shadow-2xl pb-[calc(14px+env(safe-area-inset-bottom,0px))]">
            
            {/* Direct timeline slider track */}
            <div className="space-y-1">
              <div
                ref={libTrackContainerRef}
                onPointerDown={(e) => handleTrackPointerDown(e, true)}
                onPointerMove={(e) => handleTrackPointerMove(e, true)}
                onPointerUp={(e) => handleTrackPointerUp(e, true)}
                onPointerCancel={(e) => handleTrackPointerUp(e, true)}
                role="slider"
                aria-label="Seek track"
                aria-valuemin={0}
                aria-valuemax={validDuration}
                tabIndex={0}
                className="relative w-full h-4 flex items-center select-none cursor-pointer group touch-none animate-fade-in"
              >
                {/* Background timeline channel */}
                <div className="w-full h-1 sm:h-1.5 rounded-full bg-white/10 overflow-hidden relative pointer-events-none">
                  <div
                    ref={libProgressFillRef}
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-indigo-400 to-violet-400 will-change-[width]"
                    style={{ width: '0%' }}
                  />
                </div>

                {/* Indicator knob */}
                <div
                  ref={libProgressKnobRef}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-slate-100 shadow-[0_0_8px_rgba(129,140,248,0.8)] border border-indigo-300 pointer-events-none transition-transform group-hover:scale-110 will-change-[left]"
                  style={{ left: '0%' }}
                  aria-hidden="true"
                />
              </div>

              {/* Timestamp display row */}
              <div className="flex justify-between items-center text-[10px] sm:text-xs text-slate-400 font-mono tabular-nums px-0.5">
                <span ref={libCurrentTimeSpanRef}>00:00</span>
                <span>{formatAudioTime(validDuration)}</span>
              </div>
            </div>

            {/* Bottom Controls Row: Song Information & Buttons */}
            <div className="flex items-center justify-between gap-4">
              {/* Left Side: Playing Song Meta */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex flex-col min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-slate-100 truncate tracking-wide">
                    {songName}
                  </span>
                  <p className="text-[10px] text-indigo-300 truncate mt-0.5 flex items-center gap-1 font-semibold tracking-wider">
                    <Sparkles className="w-2.5 h-2.5 text-indigo-300" />
                    <span>Now Playing</span>
                  </p>
                </div>
              </div>

              {/* Right Side: Media Controls Panel */}
              <div className="flex items-center gap-3.5 shrink-0 select-none">
                {/* Shuffle Button */}
                <button
                  onClick={toggleShuffle}
                  className={`p-1.5 rounded-full focus:outline-none transition-colors active:scale-95 ${
                    isShuffle ? 'text-indigo-300 drop-shadow-[0_0_5px_rgba(129,140,248,0.65)]' : 'text-slate-500 hover:text-slate-300'
                  }`}
                  title={isShuffle ? 'Shuffle: On' : 'Shuffle: Off'}
                >
                  <Shuffle className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </button>

                {/* Previous Button */}
                <button
                  onClick={handlePlayPrevious}
                  className="p-1.5 text-slate-300 hover:text-white transition-colors active:scale-95"
                  title="Previous Song"
                >
                  <SkipBack className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </button>

                {/* Main Play/Pause Button */}
                <button
                  onClick={togglePlay}
                  disabled={isLoading}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 hover:from-indigo-400 hover:to-violet-500 flex items-center justify-center text-white shadow-lg active:scale-95 transition-all shrink-0"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : isPlaying ? (
                    <Pause className="w-4 h-4 fill-current text-white" />
                  ) : (
                    <Play className="w-4 h-4 fill-current text-white ml-0.5" />
                  )}
                </button>

                {/* Next Button */}
                <button
                  onClick={handlePlayNext}
                  className="p-1.5 text-slate-300 hover:text-white transition-colors active:scale-95"
                  title="Next Song"
                >
                  <SkipForward className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </button>

                {/* Repeat Button */}
                <button
                  onClick={handleCycleRepeat}
                  className={`p-1.5 transition-colors active:scale-95 ${
                    repeatMode !== 'off' ? 'text-indigo-300' : 'text-slate-500 hover:text-slate-300'
                  }`}
                  title={`Repeat: ${repeatMode}`}
                >
                  {repeatMode === 'one' ? <Repeat1 className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-rose-300" /> : <Repeat className="w-4 h-4 sm:w-4.5 sm:h-4.5" />}
                </button>
              </div>
            </div>

          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
