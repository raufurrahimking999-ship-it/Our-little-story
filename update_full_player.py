import re

with open('src/components/MusicPlayerCard.tsx', 'r') as f:
    code = f.read()

# 1. Main Player Card UI redesign:
# Replace the Top Header Row and the progress bar and timestamp row with:
# A) Clean Song title + Library trigger button
# B) Progress Slider + Time Indicators (with Shuffle, Repeat, Volume)
# C) Center Control Row with: [Previous track icon], [Play/Pause icon], [Next track icon], [Favourite heart icon]

old_main_ui_pattern = re.compile(
    r'\{\/\* Top Header Row: Title & Controls \*\/\}[\s\S]*?\{\/\* Error notification \*\/\}',
    re.MULTILINE
)

new_main_ui = """{/* Top Header: Song Title & Library button */}
        <div className="flex items-center justify-between gap-3 relative z-10">
          <div className="flex flex-col min-w-0 flex-1">
            <button
              onClick={handleOpenLibrary}
              className="text-xs sm:text-sm font-medium text-slate-100 truncate tracking-wide text-left hover:text-indigo-200 transition-colors"
              title="Open Song List"
            >
              {songName}
            </button>
            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
              <span className="text-indigo-200/50">{songs.length} songs</span>
              {isLoading && <span className="text-indigo-300 animate-pulse">Loading...</span>}
            </div>
          </div>

          {/* Dedicated Library Trigger Button (Icon only) */}
          <button
            onClick={handleOpenLibrary}
            className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] flex items-center justify-center text-indigo-300/80 hover:text-indigo-200 active:scale-95 transition-all shadow-sm"
            title="Open Song List"
            aria-label="Open Song List"
          >
            <ListMusic className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar & Timestamps */}
        <div className="mt-3 space-y-1 relative z-10">
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
            className="relative w-full h-4 flex items-center select-none cursor-pointer group touch-none"
          >
            <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden relative pointer-events-none">
              <div
                ref={progressFillRef}
                className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-indigo-300 to-violet-400 will-change-[width]"
                style={{ width: '0%' }}
              />
            </div>
            <div
              ref={progressKnobRef}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-slate-100 shadow-[0_0_8px_rgba(167,139,250,0.85)] border border-indigo-200 pointer-events-none transition-transform group-hover:scale-125 group-active:scale-125 will-change-[left]"
              style={{ left: '0%' }}
              aria-hidden="true"
            />
          </div>

          {/* Timestamps & Secondary Controls (Icon only) */}
          <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono tabular-nums px-0.5 select-none">
            <span ref={currentTimeSpanRef}>00:00</span>

            <div className="flex items-center gap-3">
              <button
                onClick={toggleShuffle}
                className={`p-1 rounded-full transition-colors active:scale-95 ${
                  isShuffle ? 'text-indigo-300 drop-shadow-[0_0_6px_rgba(129,140,248,0.7)]' : 'text-slate-500 hover:text-slate-300'
                }`}
                title={isShuffle ? 'Shuffle: On' : 'Shuffle: Off'}
                aria-label="Toggle Shuffle"
              >
                <Shuffle className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleCycleRepeat}
                className={`p-1 rounded-full transition-colors active:scale-95 ${
                  repeatMode !== 'off' ? 'text-indigo-300 drop-shadow-[0_0_6px_rgba(129,140,248,0.7)]' : 'text-slate-500 hover:text-slate-300'
                }`}
                title={`Repeat: ${repeatMode}`}
                aria-label="Cycle Repeat mode"
              >
                {repeatMode === 'one' ? <Repeat1 className="w-3.5 h-3.5 text-rose-300" /> : <Repeat className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={toggleMute}
                className="p-1 text-slate-500 hover:text-slate-300 transition-colors active:scale-95"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
            </div>

            <span>{formatAudioTime(validDuration)}</span>
          </div>
        </div>

        {/* 
          =========================================================================
          ICON-ONLY PLAYBACK CONTROLS
          - Perfectly centered, evenly spaced, horizontally aligned
          - Previous track icon
          - Play/Pause icon (prominent liquid-glass circular glow)
          - Next track icon
          - Favourite heart icon (filled when active, outline when inactive)
          - No text labels anywhere
          =========================================================================
        */}
        <div className="mt-4 pt-1 flex items-center justify-center gap-7 sm:gap-9 relative z-10 select-none">
          {/* Previous Track Icon */}
          <button
            onClick={handlePlayPrevious}
            className="w-10 h-10 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] active:scale-90 transition-all duration-200"
            title="Previous Track"
            aria-label="Previous Track"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          {/* Primary Play / Pause Prominent Button */}
          <button
            onClick={togglePlay}
            disabled={isLoading}
            className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-indigo-500/35 via-violet-500/30 to-rose-500/25 hover:from-indigo-500/45 hover:to-rose-500/35 border border-indigo-300/35 flex items-center justify-center text-white shadow-[0_0_20px_rgba(129,140,248,0.35)] active:scale-95 transition-all duration-200"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isLoading ? (
              <Loader2 className="w-6 h-6 animate-spin text-white" />
            ) : isPlaying ? (
              <Pause className="w-6 h-6 fill-current text-slate-100" />
            ) : (
              <Play className="w-6 h-6 fill-current text-slate-100 ml-0.5" />
            )}
          </button>

          {/* Next Track Icon */}
          <button
            onClick={handlePlayNext}
            className="w-10 h-10 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] active:scale-90 transition-all duration-200"
            title="Next Track"
            aria-label="Next Track"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>

          {/* Favourite Heart Icon */}
          <button
            onClick={(e) => {
              if (currentSong) {
                toggleFavorite(currentSong.id, e);
              }
            }}
            className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-all duration-200 ${
              isCurrentFav 
                ? 'text-rose-400 hover:text-rose-300 drop-shadow-[0_0_10px_rgba(244,63,94,0.55)]' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
            }`}
            title={isCurrentFav ? 'Remove from Favourites' : 'Add to Favourites'}
            aria-label={isCurrentFav ? 'Remove from Favourites' : 'Add to Favourites'}
          >
            <Heart className={`w-5 h-5 transition-transform ${isCurrentFav ? 'fill-current scale-110' : ''}`} />
          </button>
        </div>

        {/* Error notification */}"""

match = old_main_ui_pattern.search(code)
if not match:
    print("Could not match old_main_ui_pattern, trying alternative replacement")
    exit(1)

code = old_main_ui_pattern.sub(new_main_ui, code, count=1)

# 2. In Song List items: replace "{isFav ? 'Favorite' : 'Fav'}" with icon-only heart
old_song_fav = """                            {/* Favorite toggle option */}
                            <button
                              onClick={(e) => toggleFavorite(song.id, e)}
                              className={`px-2 py-1 text-xs rounded-lg transition-colors hover:bg-white/5 font-medium ${
                                isFav ? 'text-rose-400 font-bold' : 'text-slate-500 hover:text-slate-300'
                              }`}
                              title="Favorite"
                            >
                              {isFav ? 'Favorite' : 'Fav'}
                            </button>"""

new_song_fav = """                            {/* Favorite toggle option (Icon-only heart) */}
                            <button
                              onClick={(e) => toggleFavorite(song.id, e)}
                              className={`p-2 rounded-full transition-all active:scale-90 ${
                                isFav ? 'text-rose-400 hover:text-rose-300 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                              }`}
                              title={isFav ? 'Remove from Favourites' : 'Add to Favourites'}
                              aria-label={isFav ? 'Remove from Favourites' : 'Add to Favourites'}
                            >
                              <Heart className={`w-4 h-4 ${isFav ? 'fill-current scale-110' : ''}`} />
                            </button>"""

if old_song_fav in code:
    code = code.replace(old_song_fav, new_song_fav, 1)
else:
    print("Warning: old_song_fav not matched exactly, checking with regex")

# 3. In the Full-screen Library Bottom Deck:
# Replace the text controls with pure Icon-only controls:
# Previous track, Play/Pause (slightly larger), Next track, Favourite heart icon
old_deck_pattern = re.compile(
    r'\{\/\* Right Side: Media Controls Panel \*\/\}[\s\S]*?\{\/\* Repeat Button \*\/\}[\s\S]*?<\/button>\s*<\/div>',
    re.MULTILINE
)

new_deck_controls = """{/* Right Side: Media Controls Panel (Icon-only) */}
              <div className="flex items-center gap-3 sm:gap-4 shrink-0 select-none">
                {/* Previous Track Icon */}
                <button
                  onClick={handlePlayPrevious}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] active:scale-90 transition-all"
                  title="Previous Track"
                  aria-label="Previous Track"
                >
                  <SkipBack className="w-4 h-4 fill-current" />
                </button>

                {/* Primary Play / Pause Prominent Button */}
                <button
                  onClick={togglePlay}
                  disabled={isLoading}
                  className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500/40 via-violet-500/35 to-rose-500/30 hover:from-indigo-500/50 hover:to-rose-500/40 border border-indigo-300/40 flex items-center justify-center text-white shadow-[0_0_15px_rgba(129,140,248,0.35)] active:scale-95 transition-all"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-white" />
                  ) : isPlaying ? (
                    <Pause className="w-5 h-5 fill-current text-white" />
                  ) : (
                    <Play className="w-5 h-5 fill-current text-white ml-0.5" />
                  )}
                </button>

                {/* Next Track Icon */}
                <button
                  onClick={handlePlayNext}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] active:scale-90 transition-all"
                  title="Next Track"
                  aria-label="Next Track"
                >
                  <SkipForward className="w-4 h-4 fill-current" />
                </button>

                {/* Favourite Heart Icon */}
                <button
                  onClick={(e) => {
                    if (currentSong) {
                      toggleFavorite(currentSong.id, e);
                    }
                  }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-all ${
                    isCurrentFav 
                      ? 'text-rose-400 hover:text-rose-300 drop-shadow-[0_0_8px_rgba(244,63,94,0.55)]' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
                  }`}
                  title={isCurrentFav ? 'Remove from Favourites' : 'Add to Favourites'}
                  aria-label={isCurrentFav ? 'Remove from Favourites' : 'Add to Favourites'}
                >
                  <Heart className={`w-4 h-4 ${isCurrentFav ? 'fill-current scale-110' : ''}`} />
                </button>
              </div>"""

match_deck = old_deck_pattern.search(code)
if match_deck:
    code = old_deck_pattern.sub(new_deck_controls, code, count=1)
else:
    print("Warning: old_deck_pattern not matched")

with open('src/components/MusicPlayerCard.tsx', 'w') as f:
    f.write(code)

print("MusicPlayerCard redesign complete!")
