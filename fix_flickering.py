import re

# 1. Update src/index.css
with open('src/index.css', 'r') as f:
    css = f.read()

# We need to make .glass-panel rock solid on Android WebView:
# Replace .glass-panel definition
old_glass_panel = """.glass-panel {
  background: rgba(14, 20, 44, 0.65);
  -webkit-backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(165, 180, 252, 0.12);
  box-shadow: 
    0 8px 32px -4px rgba(2, 6, 20, 0.35),
    0 0 16px -2px rgba(129, 140, 248, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.14);
}"""

new_glass_panel = """.glass-panel {
  background: rgba(14, 20, 44, 0.82);
  -webkit-backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(165, 180, 252, 0.12);
  box-shadow: 
    0 8px 32px -4px rgba(2, 6, 20, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.14);
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  -webkit-transform: translateZ(0);
  transform: translateZ(0);
}"""

if old_glass_panel in css:
    css = css.replace(old_glass_panel, new_glass_panel, 1)
    print("Updated .glass-panel in index.css")
else:
    print("Warning: old_glass_panel not found exactly in index.css")

with open('src/index.css', 'w') as f:
    f.write(css)

# 2. Update src/components/MusicPlayerCard.tsx
with open('src/components/MusicPlayerCard.tsx', 'r') as f:
    card_code = f.read()

# Replace the animated gradient overlay and the transform: left manipulation:
# A) Replace the animated gradient overlay:
old_glow_overlay = """        {/* Balanced, uniform ambient glow across the entire card surface */}
        <div
          className={`absolute inset-0 rounded-3xl bg-gradient-to-b from-indigo-500/10 via-indigo-500/5 to-violet-500/10 transition-opacity duration-700 pointer-events-none ${
            isPlaying ? 'opacity-100' : 'opacity-0'
          }`}
        />"""

new_glow_overlay = """        {/* Stable subtle ambient background (static, contained, zero-repaint) */}
        <div
          className="absolute inset-0 rounded-3xl bg-indigo-950/20 pointer-events-none"
          aria-hidden="true"
        />"""

if old_glow_overlay in card_code:
    card_code = card_code.replace(old_glow_overlay, new_glow_overlay, 1)
    print("Replaced flickering gradient overlay in MusicPlayerCard.tsx")
else:
    print("Warning: old_glow_overlay not found in MusicPlayerCard.tsx")

# B) Progress fill and knob update logic:
# Let's inspect updateProgressDOM in MusicPlayerCard.tsx
old_update_dom = """  const updateProgressDOM = (currentSec: number, totalDur: number) => {
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
  };"""

new_update_dom = """  const updateProgressDOM = (currentSec: number, totalDur: number) => {
    const validDur = totalDur > 0 ? totalDur : 180.0;
    const clampedSec = Math.max(0, Math.min(currentSec, validDur));
    const percent = Math.min(100, Math.max(0, (clampedSec / validDur) * 100));

    // Update Main Card DOM elements if visible using GPU transform
    if (progressFillRef.current) progressFillRef.current.style.transform = `scaleX(${percent / 100})`;
    if (progressKnobRef.current) progressKnobRef.current.style.left = `${percent}%`;
    if (currentTimeSpanRef.current) currentTimeSpanRef.current.textContent = formatAudioTime(clampedSec);

    // Update Full-Screen Library Deck DOM elements if visible
    if (libProgressFillRef.current) libProgressFillRef.current.style.transform = `scaleX(${percent / 100})`;
    if (libProgressKnobRef.current) libProgressKnobRef.current.style.left = `${percent}%`;
    if (libCurrentTimeSpanRef.current) libCurrentTimeSpanRef.current.textContent = formatAudioTime(clampedSec);
  };"""

if old_update_dom in card_code:
    card_code = card_code.replace(old_update_dom, new_update_dom, 1)
    print("Replaced updateProgressDOM with scaleX transform")

# C) Also update progressFillRef in JSX to have origin-left and w-full instead of style width 0%:
old_progress_fill_jsx = """              <div
                ref={progressFillRef}
                className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-indigo-300 to-violet-400 will-change-[width]"
                style={{ width: '0%' }}
              />"""

new_progress_fill_jsx = """              <div
                ref={progressFillRef}
                className="h-full w-full rounded-full bg-gradient-to-r from-indigo-400 via-indigo-300 to-violet-400 origin-left will-change-transform"
                style={{ transform: 'scaleX(0)' }}
              />"""

if old_progress_fill_jsx in card_code:
    card_code = card_code.replace(old_progress_fill_jsx, new_progress_fill_jsx, 1)
    print("Replaced main card progress fill JSX")

old_lib_progress_fill = """                  <div
                    ref={libProgressFillRef}
                    className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-indigo-300 to-violet-400 will-change-[width]"
                    style={{ width: '0%' }}
                  />"""

new_lib_progress_fill = """                  <div
                    ref={libProgressFillRef}
                    className="h-full w-full rounded-full bg-gradient-to-r from-indigo-400 via-indigo-300 to-violet-400 origin-left will-change-transform"
                    style={{ transform: 'scaleX(0)' }}
                  />"""

if old_lib_progress_fill in card_code:
    card_code = card_code.replace(old_lib_progress_fill, new_lib_progress_fill, 1)
    print("Replaced portal library progress fill JSX")

with open('src/components/MusicPlayerCard.tsx', 'w') as f:
    f.write(card_code)

print("MusicPlayerCard.tsx updated successfully!")
