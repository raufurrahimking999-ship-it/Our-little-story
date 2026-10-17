import re

with open('src/components/MusicPlayerCard.tsx', 'r') as f:
    code = f.read()

# 1. Ensure lucide-react imports have all needed icons
old_icons = """import { 
  Play, Pause, SkipBack, SkipForward, Heart, 
  Shuffle, Repeat, Repeat1, Volume2, VolumeX, ListMusic, ArrowLeft, Loader2,
  ChevronDown, ChevronUp, Music, Sparkles
} from 'lucide-react';"""

new_icons = """import { 
  Play, Pause, SkipBack, SkipForward, Heart, 
  Shuffle, Repeat, Repeat1, Volume2, VolumeX, ListMusic, ArrowLeft, Loader2,
  Music, Sparkles
} from 'lucide-react';"""

if old_icons in code:
    code = code.replace(old_icons, new_icons, 1)

# Clean up unused state isListExpanded if present
if "const [isListExpanded, setIsListExpanded] = useState<boolean>(true);" in code:
    code = code.replace("const [isListExpanded, setIsListExpanded] = useState<boolean>(true);\n", "")

# 2. Reconstruct the exact compact Main Card:
# Dimensions: w-full max-w-md px-2 relative
# glass-panel rounded-3xl p-4 sm:p-4.5
# Left: [Music icon immediately left of song name] + songs count / loading
# Right: [Icon-only controls]:
#   - Previous track icon (SkipBack)
#   - Play/Pause icon (Skip/Play/Pause in prominent gradient circle)
#   - Next track icon (SkipForward)
#   - Favourite heart icon (Heart: filled rose when active, outline when inactive)
#   - Song list trigger icon (ListMusic)
# Then:
# Seekbar & Timestamps row (with shuffle, repeat, mute icons)
# Error notification
# NO extra vertical space, NO extra inline list on home screen!

main_card_replacement = """      <div className="glass-panel rounded-3xl p-4 sm:p-4.5 transition-all duration-300 relative overflow-hidden">
        {/* Balanced, uniform ambient glow across the entire card surface */}
        <div
          className={`absolute inset-0 rounded-3xl bg-gradient-to-b from-indigo-500/10 via-indigo-500/5 to-violet-500/10 transition-opacity duration-700 pointer-events-none ${
            isPlaying ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Top Header Row: Song Name with Music Icon & Icon-Only Controls */}
        <div className="flex items-center justify-between gap-2 relative z-10">
          {/* Left: Song meta with music-note icon immediately to the LEFT of the song name */}
          <div className="flex flex-col min-w-0 flex-1 pr-1">
            <div className="flex items-center gap-1.5 min-w-0">
              {/* Music-note icon immediately to the left of the song name */}
              {currentSong?.isBuiltIn ? (
                <Sparkles className="w-3.5 h-3.5 text-rose-300/90 shrink-0 drop-shadow-[0_0_6px_rgba(244,114,182,0.5)]" />
              ) : (
                <Music className="w-3.5 h-3.5 text-indigo-300/80 shrink-0" />
              )}
              <button
                onClick={handleOpenLibrary}
                className="text-xs sm:text-sm font-medium text-slate-100 truncate tracking-wide leading-tight text-left hover:text-indigo-200 transition-colors"
                title="Open Dedicated Song List"
              >
                {songName}
              </button>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-400 pl-5">
              <span className="text-indigo-200/50">{songs.length} songs</span>
              {isLoading && <span className="text-indigo-300 animate-pulse">Loading...</span>}
            </div>
          </div>

          {/* Right Controls Container: Pure Icon-Only Playback Controls */}
          <div className="flex items-center gap-1 shrink-0 select-none">
            {/* Previous Track Icon */}
            <button
              onClick={handlePlayPrevious}
              className="w-7 h-7 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] active:scale-90 transition-all"
              title="Previous Song"
              aria-label="Previous Song"
            >
              <SkipBack className="w-3.5 h-3.5 fill-current" />
            </button>

            {/* Play/Pause Button (Icon only, prominent romantic gradient) */}
            <button
              onClick={togglePlay}
              disabled={isLoading}
              className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/35 via-violet-500/30 to-rose-500/25 hover:from-indigo-500/45 hover:to-rose-500/35 border border-indigo-300/35 flex items-center justify-center text-white shadow-[0_0_12px_rgba(129,140,248,0.30)] active:scale-95 transition-all duration-200"
              aria-label={isPlaying ? 'Pause song' : 'Play song'}
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : isPlaying ? (
                <Pause className="w-3.5 h-3.5 fill-current text-white" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current text-white ml-0.5" />
              )}
            </button>

            {/* Next Track Icon */}
            <button
              onClick={handlePlayNext}
              className="w-7 h-7 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] active:scale-90 transition-all"
              title="Next Song"
              aria-label="Next Song"
            >
              <SkipForward className="w-3.5 h-3.5 fill-current" />
            </button>

            {/* Favourite Heart Icon */}
            <button
              onClick={(e) => {
                if (currentSong) {
                  toggleFavorite(currentSong.id, e);
                }
              }}
              className={`w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition-all ${
                isCurrentFav 
                  ? 'text-rose-400 hover:text-rose-300 drop-shadow-[0_0_8px_rgba(244,63,94,0.55)]' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
              }`}
              title={isCurrentFav ? 'Remove from Favourites' : 'Add to Favourites'}
              aria-label={isCurrentFav ? 'Remove from Favourites' : 'Add to Favourites'}
            >
              <Heart className={`w-3.5 h-3.5 ${isCurrentFav ? 'fill-current scale-110' : ''}`} />
            </button>

            {/* Dedicated Song List Trigger Icon */}
            <button
              onClick={handleOpenLibrary}
              className="w-7 h-7 rounded-full flex items-center justify-center text-indigo-300/80 hover:text-indigo-200 hover:bg-white/[0.06] active:scale-90 transition-all ml-0.5"
              title="Open full-screen Song List"
              aria-label="Open full-screen Song List"
            >
              <ListMusic className="w-3.5 h-3.5" />
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
            {/* Playback Controls Row (Icon only) */}
            <div className="flex items-center gap-2">
              {/* Shuffle button */}
              <button
                onClick={toggleShuffle}
                className={`p-1 rounded transition-colors active:scale-95 ${
                  isShuffle ? 'text-indigo-300 drop-shadow-[0_0_6px_rgba(129,140,248,0.65)]' : 'text-slate-500 hover:text-slate-300'
                }`}
                title={isShuffle ? 'Shuffle: On' : 'Shuffle: Off'}
                aria-label="Toggle Shuffle"
              >
                <Shuffle className="w-3 h-3" />
              </button>

              {/* Repeat Button */}
              <button
                onClick={handleCycleRepeat}
                className={`p-1 rounded transition-colors active:scale-95 ${
                  repeatMode !== 'off' ? 'text-indigo-300 font-bold' : 'text-slate-500 hover:text-slate-300'
                }`}
                title={`Repeat: ${repeatMode}`}
                aria-label="Cycle Repeat mode"
              >
                {repeatMode === 'one' ? <Repeat1 className="w-3 h-3 text-rose-300" /> : <Repeat className="w-3 h-3" />}
              </button>

              {/* Mute button */}
              <button
                onClick={toggleMute}
                className="text-slate-500 hover:text-slate-300 transition-colors p-1 active:scale-95"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-3 h-3 text-rose-400" /> : <Volume2 className="w-3 h-3" />}
              </button>
            </div>
            <span>{formatAudioTime(validDuration)}</span>
          </div>
        </div>

        {/* Error notification */}
        {hasError && (
          <div className="mt-2.5 p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] flex items-center justify-between gap-1.5 relative z-10 animate-fade-in">
            <span>Failed to load track.</span>
            <button
              onClick={() => audioPlayer.resetToDefault()}
              className="text-[10px] text-indigo-300 hover:underline"
            >
              Reset Player
            </button>
          </div>
        )}
      </div>"""

# Find the section from "<div className=\"glass-panel rounded-3xl" down to the start of "2. PORTALED FULL-SCREEN SONG LIST"
pattern = re.compile(
    r'<div className="glass-panel rounded-3xl[\s\S]*?\{\/\* \s*={10,}\s*2\. PORTALED FULL-SCREEN SONG LIST',
    re.MULTILINE
)

match = pattern.search(code)
if not match:
    print("Could not match pattern for main card!")
    exit(1)

code = pattern.sub(main_card_replacement + "\n\n      {/* \n        =========================================================================\n        2. PORTALED FULL-SCREEN SONG LIST", code, count=1)

# 3. In the Full-Screen Portal Song List:
# Add music icon to the left of each song name!
# Let's inspect where song.title is rendered in the portal:
old_portal_item_title = """                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className={`text-xs sm:text-sm font-semibold truncate tracking-wide leading-tight ${isCurrent ? 'text-indigo-200' : 'text-slate-100'}`}>
                                  {song.title}
                                </span>
                                {song.isBuiltIn && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-rose-500/20 text-rose-300 font-medium border border-rose-400/30 shrink-0">
                                    Special Song
                                  </span>
                                )}
                              </div>"""

new_portal_item_title = """                              <div className="flex items-center gap-1.5 min-w-0">
                                {song.isBuiltIn ? (
                                  <Sparkles className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                                ) : (
                                  <Music className="w-3.5 h-3.5 text-indigo-300/70 shrink-0" />
                                )}
                                <span className={`text-xs sm:text-sm font-semibold truncate tracking-wide leading-tight ${isCurrent ? 'text-indigo-200' : 'text-slate-100'}`}>
                                  {song.title}
                                </span>
                                {song.isBuiltIn && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-rose-500/20 text-rose-300 font-medium border border-rose-400/30 shrink-0">
                                    Default
                                  </span>
                                )}
                              </div>"""

if old_portal_item_title in code:
    code = code.replace(old_portal_item_title, new_portal_item_title, 1)
    print("Updated portal item title with music icon!")
else:
    print("Warning: old_portal_item_title not matched exactly")

with open('src/components/MusicPlayerCard.tsx', 'w') as f:
    f.write(code)

print("Main card restored to original compact dimensions with icon-only controls and music icons beside song titles!")
