import React, { useState, useEffect, useRef, useCallback } from 'react';
import { VaultItem, vaultService } from '../services/vaultService';

interface VaultPhotoViewerProps {
  items: VaultItem[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onRenameItem?: (item: VaultItem) => void;
  onDeleteItem?: (item: VaultItem) => void;
}

export const VaultPhotoViewer: React.FC<VaultPhotoViewerProps> = ({
  items,
  initialIndex,
  isOpen,
  onClose,
  onRenameItem,
  onDeleteItem,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex);
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [controlsVisible, setControlsVisible] = useState<boolean>(true);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const [isSwiping, setIsSwiping] = useState<boolean>(false);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [loadingMedia, setLoadingMedia] = useState<boolean>(false);

  // References for gesture handling
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Gesture tracking refs
  const touchStateRef = useRef<{
    mode: 'none' | 'pan' | 'pinch' | 'swipe';
    startX: number;
    startY: number;
    initialDistance: number;
    initialScale: number;
    initialPosX: number;
    initialPosY: number;
    lastTapTime: number;
    lastTapX: number;
    lastTapY: number;
  }>({
    mode: 'none',
    startX: 0,
    startY: 0,
    initialDistance: 0,
    initialScale: 1,
    initialPosX: 0,
    initialPosY: 0,
    lastTapTime: 0,
    lastTapX: 0,
    lastTapY: 0,
  });

  const MIN_SCALE = 1;
  const MAX_SCALE = 4.5;
  const DOUBLE_TAP_SCALE = 2.5;

  // Sync index when initialIndex changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      resetZoom();
      showControlsTemporarily();
    }
  }, [isOpen, initialIndex]);

  // Reset zoom & pan when navigating between media items
  const resetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setSwipeOffset(0);
    setIsSwiping(false);
  }, []);

  // Auto-hide controls after inactivity
  const showControlsTemporarily = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      // Keep visible if zoomed in? No, let user tap to toggle
      setControlsVisible(false);
    }, 3800);
  }, []);

  const toggleControls = useCallback(() => {
    setControlsVisible((prev) => !prev);
  }, []);

  // Pre-load and cache current, next, and previous decrypted media
  useEffect(() => {
    if (!isOpen || items.length === 0) return;

    const indicesToLoad = [currentIndex, currentIndex - 1, currentIndex + 1].filter(
      (idx) => idx >= 0 && idx < items.length
    );

    let isMounted = true;
    indicesToLoad.forEach((idx) => {
      const item = items[idx];
      if (!item) return;

      if (item.dataUrl && !item.dataUrl.startsWith('data:image/svg')) {
        setMediaUrls((prev) => (prev[item.id] ? prev : { ...prev, [item.id]: item.dataUrl! }));
      } else {
        if (idx === currentIndex) setLoadingMedia(true);
        vaultService.ensureDecryptedDataUrl(item).then((url) => {
          if (isMounted && url) {
            setMediaUrls((prev) => ({ ...prev, [item.id]: url }));
            if (idx === currentIndex) setLoadingMedia(false);
          }
        });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, currentIndex, items]);

  const currentItem = items[currentIndex];

  // Helper to clamp pan positions so the image doesn't get lost off-screen
  const clampPosition = useCallback(
    (newX: number, newY: number, currentScale: number) => {
      if (currentScale <= 1) return { x: 0, y: 0 };
      const container = containerRef.current;
      if (!container) return { x: newX, y: newY };

      const cWidth = container.clientWidth;
      const cHeight = container.clientHeight;

      // Allow panning proportional to extra zoomed space
      const maxDeltaX = Math.max(0, ((currentScale - 1) * cWidth) / 2);
      const maxDeltaY = Math.max(0, ((currentScale - 1) * cHeight) / 2);

      const clampedX = Math.max(-maxDeltaX, Math.min(maxDeltaX, newX));
      const clampedY = Math.max(-maxDeltaY, Math.min(maxDeltaY, newY));

      return { x: clampedX, y: clampedY };
    },
    []
  );

  // Navigate next / prev
  const goToNext = useCallback(() => {
    if (currentIndex < items.length - 1) {
      resetZoom();
      setCurrentIndex((prev) => prev + 1);
      showControlsTemporarily();
    }
  }, [currentIndex, items.length, resetZoom, showControlsTemporarily]);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      resetZoom();
      setCurrentIndex((prev) => prev - 1);
      showControlsTemporarily();
    }
  }, [currentIndex, resetZoom, showControlsTemporarily]);

  // Double-tap zoom handler
  const handleDoubleTap = useCallback(
    (clientX: number, clientY: number) => {
      if (scale > 1.05) {
        // Return to fit view
        resetZoom();
      } else {
        // Zoom in centered towards the tap location
        const container = containerRef.current;
        if (!container) {
          setScale(DOUBLE_TAP_SCALE);
          return;
        }
        const rect = container.getBoundingClientRect();
        const offsetX = clientX - (rect.left + rect.width / 2);
        const offsetY = clientY - (rect.top + rect.height / 2);

        const targetScale = DOUBLE_TAP_SCALE;
        const targetX = -offsetX * (targetScale - 1);
        const targetY = -offsetY * (targetScale - 1);

        const clamped = clampPosition(targetX, targetY, targetScale);
        setScale(targetScale);
        setPosition(clamped);
      }
      showControlsTemporarily();
    },
    [scale, resetZoom, clampPosition, showControlsTemporarily]
  );

  // Helper distance between two touches
  const getTouchDistance = (t1: React.Touch, t2: React.Touch) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Touch event handlers for mobile gestures (pinch, double-tap, pan, swipe)
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touches = e.touches;
    const state = touchStateRef.current;

    if (touches.length === 2) {
      // Start Pinch
      state.mode = 'pinch';
      state.initialDistance = getTouchDistance(touches[0], touches[1]);
      state.initialScale = scale;
      state.initialPosX = position.x;
      state.initialPosY = position.y;
    } else if (touches.length === 1) {
      const now = Date.now();
      const touch = touches[0];
      const timeDiff = now - state.lastTapTime;
      const distFromLastTap = Math.hypot(touch.clientX - state.lastTapX, touch.clientY - state.lastTapY);

      if (timeDiff < 320 && distFromLastTap < 40 && currentItem?.type !== 'video') {
        // Double tap recognized!
        handleDoubleTap(touch.clientX, touch.clientY);
        state.lastTapTime = 0;
        state.mode = 'none';
        return;
      }

      state.lastTapTime = now;
      state.lastTapX = touch.clientX;
      state.lastTapY = touch.clientY;

      state.startX = touch.clientX;
      state.startY = touch.clientY;
      state.initialPosX = position.x;
      state.initialPosY = position.y;

      if (scale > 1.05) {
        state.mode = 'pan';
      } else {
        state.mode = 'swipe';
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const touches = e.touches;
    const state = touchStateRef.current;

    if (state.mode === 'pinch' && touches.length === 2) {
      e.preventDefault();
      const currentDistance = getTouchDistance(touches[0], touches[1]);
      if (state.initialDistance > 0) {
        const factor = currentDistance / state.initialDistance;
        let nextScale = state.initialScale * factor;
        nextScale = Math.max(0.85, Math.min(MAX_SCALE + 0.5, nextScale));
        setScale(nextScale);
      }
    } else if (state.mode === 'pan' && touches.length === 1) {
      e.preventDefault();
      const touch = touches[0];
      const deltaX = touch.clientX - state.startX;
      const deltaY = touch.clientY - state.startY;

      const nextX = state.initialPosX + deltaX;
      const nextY = state.initialPosY + deltaY;
      const clamped = clampPosition(nextX, nextY, scale);
      setPosition(clamped);
    } else if (state.mode === 'swipe' && touches.length === 1) {
      const touch = touches[0];
      const deltaX = touch.clientX - state.startX;
      const deltaY = touch.clientY - state.startY;

      // Only horizontal swipe if deltaX is predominantly horizontal
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
        e.preventDefault();
        setIsSwiping(true);
        // Add resistance at edges
        if ((currentIndex === 0 && deltaX > 0) || (currentIndex === items.length - 1 && deltaX < 0)) {
          setSwipeOffset(deltaX * 0.35);
        } else {
          setSwipeOffset(deltaX);
        }
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const state = touchStateRef.current;

    if (state.mode === 'pinch') {
      if (scale < MIN_SCALE) {
        resetZoom();
      } else if (scale > MAX_SCALE) {
        setScale(MAX_SCALE);
        setPosition(clampPosition(position.x, position.y, MAX_SCALE));
      } else {
        setPosition(clampPosition(position.x, position.y, scale));
      }
      state.mode = 'none';
    } else if (state.mode === 'swipe') {
      const threshold = 65; // Minimum px to trigger image swipe
      if (swipeOffset < -threshold && currentIndex < items.length - 1) {
        goToNext();
      } else if (swipeOffset > threshold && currentIndex > 0) {
        goToPrev();
      } else {
        setSwipeOffset(0);
        setIsSwiping(false);
      }
      state.mode = 'none';
    } else if (state.mode === 'pan') {
      setPosition(clampPosition(position.x, position.y, scale));
      state.mode = 'none';
    }
  };

  // Keyboard navigation for desktop testing
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (scale > 1.05) resetZoom();
        else onClose();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      } else if (e.key === 'ArrowLeft') {
        goToPrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, scale, resetZoom, onClose, goToNext, goToPrev]);

  if (!isOpen || !currentItem) return null;

  const currentMediaUrl = mediaUrls[currentItem.id] || currentItem.dataUrl || currentItem.thumbnailUrl || '';
  const isVideo = currentItem.type === 'video';

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[85] bg-black/95 select-none overflow-hidden touch-none flex flex-col justify-between"
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
      }}
      onClick={(e) => {
        // If clicking backdrop area, toggle controls or close if at edge
        if (e.target === containerRef.current) {
          toggleControls();
        }
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Header Bar (Elegant, Glassmorphism, Fades with inactivity) */}
      <div
        className={`w-full z-20 px-4 py-2 flex items-center justify-between transition-opacity duration-300 pointer-events-auto ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Back Button & Counter */}
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-medium transition-all backdrop-blur-md border border-white/10 shadow-lg"
            title="Back to Vault"
          >
            Back
          </button>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-white/90 truncate max-w-[180px] sm:max-w-xs">
              {currentItem.name}
            </span>
            <span className="text-[11px] font-mono text-indigo-300/80">
              {currentIndex + 1} of {items.length}
            </span>
          </div>
        </div>

        {/* Action Controls (Rename, Zoom indicator, Delete) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {scale > 1.05 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                resetZoom();
              }}
              className="px-2.5 py-1.5 rounded-xl bg-indigo-600/60 hover:bg-indigo-600 active:scale-95 text-indigo-100 text-xs font-medium flex items-center gap-1 transition-all border border-indigo-400/30"
              title="Reset Zoom"
            >
              <span>Reset</span>
              <span className="text-[10px] opacity-80">{Math.round(scale * 100)}%</span>
            </button>
          )}

          {!isVideo && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (scale > 1.05) resetZoom();
                else {
                  setScale(2.5);
                  showControlsTemporarily();
                }
              }}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-medium transition-all backdrop-blur-md border border-white/10"
              title={scale > 1.05 ? 'Zoom Out' : 'Zoom In'}
            >
              {scale > 1.05 ? 'Fit' : 'Zoom'}
            </button>
          )}

          {onRenameItem && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRenameItem(currentItem);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-medium transition-all backdrop-blur-md border border-white/10"
              title="Rename Media"
            >
              Rename
            </button>
          )}

          {onDeleteItem && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteItem(currentItem);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 active:scale-95 text-rose-300 text-xs font-medium transition-all backdrop-blur-md border border-rose-500/30"
              title="Delete Media"
            >
              Delete
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-medium transition-all backdrop-blur-md border border-white/10"
            title="Close Viewer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Main Interactive Media Area */}
      <div
        className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden"
        onClick={toggleControls}
      >
        {loadingMedia && !currentMediaUrl && (
          <div className="absolute z-10 flex flex-col items-center gap-2 p-4 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 animate-pulse">
            <span className="text-xs text-indigo-200">Decrypting...</span>
          </div>
        )}

        {/* Media with Gestures applied */}
        <div
          className="relative max-w-full max-h-full flex items-center justify-center transition-transform"
          style={{
            transform: `translate3d(${position.x + swipeOffset}px, ${position.y}px, 0) scale(${scale})`,
            transition: isSwiping || touchStateRef.current.mode === 'pinch' || touchStateRef.current.mode === 'pan' ? 'none' : 'transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)',
            transformOrigin: 'center center',
          }}
        >
          {isVideo ? (
            <video
              src={currentMediaUrl}
              controls
              autoPlay
              playsInline
              className="max-h-[85vh] max-w-[95vw] rounded-2xl shadow-2xl border border-white/10 object-contain pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              ref={imageRef}
              src={currentMediaUrl}
              alt={currentItem.name}
              draggable={false}
              className="max-h-[85vh] max-w-[95vw] rounded-2xl shadow-2xl object-contain select-none pointer-events-none"
            />
          )}
        </div>

        {/* Previous Button (Visible on desktop or when controls are toggled) */}
        {currentIndex > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goToPrev();
            }}
            className={`absolute left-3 sm:left-6 z-20 px-3 py-2 rounded-xl bg-slate-950/70 hover:bg-slate-900 active:scale-90 text-white text-xs font-medium border border-white/15 shadow-2xl backdrop-blur-md transition-opacity duration-300 ${
              controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            title="Previous Photo"
          >
            Prev
          </button>
        )}

        {/* Next Button (Visible on desktop or when controls are toggled) */}
        {currentIndex < items.length - 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            className={`absolute right-3 sm:right-6 z-20 px-3 py-2 rounded-xl bg-slate-950/70 hover:bg-slate-900 active:scale-90 text-white text-xs font-medium border border-white/15 shadow-2xl backdrop-blur-md transition-opacity duration-300 ${
              controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            title="Next Photo"
          >
            Next
          </button>
        )}
      </div>

      {/* Bottom Information & Thumbnails Bar */}
      <div
        className={`w-full z-20 px-4 py-2 flex items-center justify-between text-xs text-slate-300 transition-opacity duration-300 ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <span className="text-[11px] text-slate-400 font-mono">
          {new Date(currentItem.dateAdded).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
        <div className="flex items-center gap-1.5 text-[10px] text-indigo-300/80 bg-white/5 px-2.5 py-1 rounded-full border border-white/10 backdrop-blur-md">
          <span>Double-tap or pinch to zoom</span>
        </div>
      </div>
    </div>
  );
};
