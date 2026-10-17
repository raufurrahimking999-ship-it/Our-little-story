with open('src/components/MusicPlayerCard.tsx', 'r') as f:
    code = f.read()

# 1. Add icons if not present
old_icons_import = "import { \n  Play, Pause, SkipBack, SkipForward, Heart, \n  Shuffle, Repeat, Repeat1, Volume2, VolumeX, ListMusic, ArrowLeft, Loader2\n} from 'lucide-react';"
new_icons_import = """import { 
  Play, Pause, SkipBack, SkipForward, Heart, 
  Shuffle, Repeat, Repeat1, Volume2, VolumeX, ListMusic, ArrowLeft, Loader2,
  ChevronDown, ChevronUp, Music, Sparkles
} from 'lucide-react';"""

if old_icons_import in code:
    code = code.replace(old_icons_import, new_icons_import, 1)

# 2. Add isListExpanded state
state_anchor = "const [searchQuery, setSearchQuery] = useState<string>('');"
state_new = """const [searchQuery, setSearchQuery] = useState<string>('');
  const [isListExpanded, setIsListExpanded] = useState<boolean>(true);"""

if state_anchor in code and "isListExpanded" not in code:
    code = code.replace(state_anchor, state_new, 1)

# 3. Enhance auto-rescan on visibility/focus/mount:
scan_anchor = """    const handleFocusOrResume = () => {
      checkDevicePermission();
    };"""

scan_enhanced = """    const handleFocusOrResume = () => {
      checkDevicePermission();
      localMusicService.requestPermissionAndScan();
    };"""

if scan_anchor in code:
    code = code.replace(scan_anchor, scan_enhanced, 1)

# 4. Inline song list inside card
target_needle = """        {/* Error notification */}
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

song_list_block = """        {/* Error notification */}
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

        {/* 
          =========================================================================
          AUDIO SONGS LIST (Default Song + All Android Device Songs)
          - Unified, compact, single-tone nocturnal romantic design
          - Default song indicated with romantic sparkle badge
          - Clean fallback for missing titles and artists
          - Real-time active indicator and tap-to-play
          - Icon-only favourite toggle per track
          =========================================================================
        */}
        <div className="mt-3.5 pt-3 border-t border-white/[0.06] relative z-10 space-y-2">
          {/* Header row for the song list */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
              <Music className="w-3.5 h-3.5 text-indigo-400" />
              <span>Audio Library</span>
              <span className="text-[10px] text-indigo-300/60 font-mono">({songs.length})</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => localMusicService.requestPermissionAndScan()}
                className="text-[10px] text-indigo-300 hover:text-indigo-200 font-medium px-2 py-0.5 rounded-full hover:bg-white/[0.04] transition-colors"
                title="Refresh and scan device audio"
              >
                Scan Device
              </button>

              <button
                onClick={() => setIsListExpanded(!isListExpanded)}
                className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors active:scale-90"
                title={isListExpanded ? "Collapse List" : "Expand List"}
                aria-label={isListExpanded ? "Collapse List" : "Expand List"}
              >
                {isListExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Collapsible / Scrollable Song List Container */}
          {isListExpanded && (
            <div className="space-y-1 max-h-56 overflow-y-auto pr-0.5 divide-y divide-white/[0.03]">
              {songs.map((song, idx) => {
                const isCurrent = song.url === songUrl || songName.includes(song.title);
                const isFav = favorites.includes(song.id);

                return (
                  <div
                    key={song.id || idx}
                    onClick={() => {
                      setSong(
                        song.url,
                        `${song.title} — ${song.artist}`,
                        song.artist,
                        song.album,
                        song.duration,
                        idx,
                        songs
                      );
                    }}
                    className={`group flex items-center justify-between p-2 sm:p-2.5 rounded-2xl cursor-pointer transition-all duration-200 ${
                      isCurrent
                        ? 'bg-gradient-to-r from-indigo-500/25 via-indigo-500/15 to-violet-500/20 border border-indigo-400/35 text-indigo-100 shadow-[0_0_12px_rgba(99,102,241,0.2)]'
                        : 'hover:bg-white/[0.04] border border-transparent text-slate-200'
                    }`}
                  >
                    {/* Left: Track Indicator & Meta */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                      {/* Play State Dot or Indicator */}
                      <div className="w-6 h-6 rounded-full bg-white/[0.04] flex items-center justify-center shrink-0">
                        {isCurrent ? (
                          isPlaying ? (
                            <div className="flex items-center gap-0.5 h-3">
                              <span className="w-0.5 h-2.5 bg-indigo-400 animate-pulse rounded-full" />
                              <span className="w-0.5 h-3.5 bg-violet-300 animate-pulse delay-75 rounded-full" />
                              <span className="w-0.5 h-2 bg-indigo-400 animate-pulse delay-150 rounded-full" />
                            </div>
                          ) : (
                            <Play className="w-2.5 h-2.5 text-indigo-300 fill-current ml-0.5" />
                          )
                        ) : (
                          <span className="text-[10px] font-mono text-slate-500 group-hover:text-slate-300">
                            {idx + 1}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`text-xs font-medium truncate tracking-wide ${isCurrent ? 'text-indigo-200 font-semibold' : 'text-slate-100'}`}>
                            {song.title}
                          </span>

                          {/* Default Song Special Indicator */}
                          {song.isBuiltIn && (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-gradient-to-r from-rose-500/20 to-pink-500/20 text-rose-300 font-semibold border border-rose-400/30 flex items-center gap-1 shrink-0 shadow-[0_0_8px_rgba(244,63,94,0.2)]">
                              <Sparkles className="w-2.5 h-2.5 text-rose-400" />
                              <span>Default</span>
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] text-slate-400 truncate mt-0.5">
                          {song.artist || 'Local Audio'}
                        </span>
                      </div>
                    </div>

                    {/* Right: Duration & Icon-only Favourite Button */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                        {song.duration > 0 ? formatAudioTime(song.duration) : '--:--'}
                      </span>

                      {/* Icon-only Favourite button */}
                      <button
                        onClick={(e) => toggleFavorite(song.id, e)}
                        className={`p-1.5 rounded-full transition-all active:scale-90 ${
                          isFav 
                            ? 'text-rose-400 hover:text-rose-300 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]' 
                            : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                        }`}
                        title={isFav ? "Remove from Favourites" : "Add to Favourites"}
                        aria-label={isFav ? "Remove from Favourites" : "Add to Favourites"}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-current scale-110' : ''}`} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>"""

if target_needle in code:
    code = code.replace(target_needle, song_list_block, 1)
    print("Song list block integrated successfully!")
else:
    print("Error: target_needle not found!")
    exit(1)

with open('src/components/MusicPlayerCard.tsx', 'w') as f:
    f.write(code)

print("Updated MusicPlayerCard.tsx successfully!")
