/**
 * Stable Singleton Audio Player Service for "Our Little Story"
 * 
 * Offline-first Native Media Engine:
 * - Direct native MediaStore device audio playback via AndroidX Media3 ExoPlayer & MediaSessionService
 * - Native lock screen controls and background media notification with custom app heart icon
 * - Audio focus management (interruptions, calls, headphones becoming noisy)
 * - Restores state on app reopening, remembers last selected song and position
 * - Full Shuffle & Repeat (Off, One, All) integration
 * - Smooth seekbar and timestamp updates
 * - Web audio fallback for browser preview
 */

import { Capacitor, registerPlugin } from '@capacitor/core';
import { RELATIONSHIP_CONFIG, DEFAULT_LOCAL_AUDIO_PATH } from '../config';

export type RepeatMode = 'off' | 'all' | 'one';

export interface AudioPlayerState {
  isPlaying: boolean;
  duration: number;
  isLoading: boolean;
  hasError: boolean;
  isMuted: boolean;
  isLooping: boolean;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  songUrl: string;
  songName: string;
  isCustom: boolean;
}

// -------------------------------------------------------------------------
// Capacitor Native Audio Plugin Bridge
// -------------------------------------------------------------------------
interface NativeAudioPlugin {
  setPlaylist(options: {
    songs: any[];
    startIndex?: number;
    startPositionSeconds?: number;
    playImmediately?: boolean;
  }): Promise<{ success: boolean }>;
  playSong(options: {
    url?: string;
    title?: string;
    artist?: string;
    album?: string;
    duration?: number;
    index?: number;
    songs?: any[];
  }): Promise<{ success: boolean }>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seek(options: { seconds: number }): Promise<void>;
  skipNext(): Promise<any>;
  skipPrevious(): Promise<any>;
  setRepeatMode(options: { mode: string }): Promise<void>;
  setShuffle(options: { shuffle: boolean }): Promise<void>;
  setVolume(options: { volume: number }): Promise<void>;
  getState(): Promise<{
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    currentIndex: number;
    url: string;
    title: string;
    artist: string;
    album: string;
    isShuffle: boolean;
    repeatMode: string;
    isEnded: boolean;
  }>;
  stopPlayback(): Promise<void>;
}

const NativeAudio = registerPlugin<NativeAudioPlugin>('NativeAudio');

class AudioPlayerService {
  private audioElement: HTMLAudioElement | null = null;

  private isPlaying = false;
  private duration = 0;
  private lastKnownTime = 0;
  private isLoading = false;
  private hasError = false;
  private isMuted = false;
  private repeatMode: RepeatMode = 'all';
  private isShuffle = false;

  private songUrl = '';
  private songName = '';
  private isCustom = false;

  private onEndedCallback: (() => void) | null = null;
  private onNextCallback: (() => void) | null = null;
  private onPrevCallback: (() => void) | null = null;

  private subscribers = new Set<(state: AudioPlayerState) => void>();
  private nativePollInterval: any = null;

  constructor() {
    this.loadSavedSong();
    if (typeof window !== 'undefined') {
      this.initMediaSession();

      if (Capacitor.isNativePlatform()) {
        this.startNativePolling();
        this.syncNativeState();
      }
    }
  }

  private loadSavedSong() {
    try {
      const saved = localStorage.getItem('our_story_last_song');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.title) {
          this.songUrl = parsed.url || '';
          this.songName = parsed.title;
          this.duration = parsed.duration > 0 ? parsed.duration : 0;
          this.lastKnownTime = parsed.position > 0 ? parsed.position : 0;
          this.isCustom = true;
          return;
        }
      }
    } catch {}

    if (!Capacitor.isNativePlatform()) {
      this.songUrl = DEFAULT_LOCAL_AUDIO_PATH;
      this.songName = RELATIONSHIP_CONFIG.songName || 'Our Special Song';
      this.duration = 291.0;
    } else {
      this.songUrl = '';
      this.songName = 'Select a song to play';
      this.duration = 0;
    }
  }

  private saveLastPlayedSong(data: {
    url: string;
    title: string;
    artist: string;
    duration: number;
    index: number;
    position?: number;
  }) {
    try {
      localStorage.setItem('our_story_last_song', JSON.stringify(data));
    } catch {}
  }

  public setTrackCallbacks(callbacks: {
    onEnded?: () => void;
    onNext?: () => void;
    onPrev?: () => void;
  }) {
    if (callbacks.onEnded) this.onEndedCallback = callbacks.onEnded;
    if (callbacks.onNext) this.onNextCallback = callbacks.onNext;
    if (callbacks.onPrev) this.onPrevCallback = callbacks.onPrev;
  }

  private startNativePolling() {
    if (this.nativePollInterval) return;
    this.nativePollInterval = setInterval(async () => {
      await this.syncNativeState();
    }, 400);
  }

  private applyNativeState(state: any) {
    if (!state) return;
    this.isPlaying = Boolean(state.isPlaying);
    this.isLoading = false;

    if (state.duration > 0) {
      this.duration = state.duration;
    }
    if (state.currentTime >= 0) {
      this.lastKnownTime = state.currentTime;
    }

    if (state.url && state.url !== this.songUrl && state.title) {
      this.songUrl = state.url;
      this.songName = state.title;
      this.isCustom = true;

      this.saveLastPlayedSong({
        url: this.songUrl,
        title: this.songName,
        artist: state.artist || 'Device Audio',
        duration: this.duration,
        index: state.currentIndex ?? -1,
        position: this.lastKnownTime,
      });
    }

    if (state.repeatMode && ['off', 'one', 'all'].includes(state.repeatMode)) {
      this.repeatMode = state.repeatMode as RepeatMode;
    }
    if (typeof state.isShuffle === 'boolean') {
      this.isShuffle = state.isShuffle;
    }

    this.notify();
  }

  private async syncNativeState() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const state = await NativeAudio.getState();
      this.applyNativeState(state);
    } catch (e) {
      // Ignore transient errors
    }
  }

  public init() {
    if (typeof window === 'undefined') return;

    if (Capacitor.isNativePlatform()) {
      this.syncNativeState();
      return;
    }

    if (this.songUrl) {
      this.initHTMLAudio(this.songUrl);
    }
  }

  // -------------------------------------------------------------------------
  // Web Fallback Audio (for Browser Preview)
  // -------------------------------------------------------------------------
  private initHTMLAudio(src: string) {
    if (!this.audioElement) {
      this.audioElement = new Audio();
      this.audioElement.preload = 'auto';
      this.audioElement.volume = this.isMuted ? 0 : 1.0;
      this.audioElement.setAttribute('playsinline', '');

      this.audioElement.addEventListener('durationchange', () => {
        if (Number.isFinite(this.audioElement?.duration) && (this.audioElement?.duration ?? 0) > 0) {
          this.duration = this.audioElement!.duration;
          this.notify();
        }
      });

      this.audioElement.addEventListener('play', () => {
        this.isPlaying = true;
        this.isLoading = false;
        this.updateMediaSessionState('playing');
        this.notify();
      });

      this.audioElement.addEventListener('pause', () => {
        this.isPlaying = false;
        if (Number.isFinite(this.audioElement?.currentTime)) {
          this.lastKnownTime = this.audioElement!.currentTime;
        }
        this.updateMediaSessionState('paused');
        this.notify();
      });

      this.audioElement.addEventListener('ended', () => {
        if (this.repeatMode === 'one') {
          this.audioElement!.currentTime = 0;
          this.audioElement!.play().catch(() => {});
        } else if (this.onEndedCallback) {
          this.onEndedCallback();
        } else if (this.repeatMode === 'all') {
          this.audioElement!.currentTime = 0;
          this.audioElement!.play().catch(() => {});
        } else {
          this.isPlaying = false;
          this.lastKnownTime = 0;
          this.updateMediaSessionState('paused');
          this.notify();
        }
      });

      this.audioElement.addEventListener('error', () => {
        this.isLoading = false;
        this.hasError = true;
        this.notify();
      });
    }

    const resolvedSrc = src.startsWith('http') || src.startsWith('blob:') || src.startsWith('data:')
      ? src
      : src.startsWith('/') ? src : `/${src}`;

    if (!this.audioElement.src || !this.audioElement.src.endsWith(resolvedSrc)) {
      this.audioElement.src = resolvedSrc;
      this.audioElement.load();
    }
  }

  private initMediaSession() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.setActionHandler('play', () => this.play());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) this.seek(details.seekTime);
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => this.skipPrevious());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.skipNext());
    } catch {}
  }

  private updateMediaSessionMetadata() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: this.songName,
        artist: RELATIONSHIP_CONFIG.coupleSignature,
        album: 'Our Little Story',
        artwork: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      });
    } catch {}
  }

  private updateMediaSessionState(state: 'playing' | 'paused') {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = state;
    } catch {}
  }

  // -------------------------------------------------------------------------
  // Public Control API
  // -------------------------------------------------------------------------
  public getCurrentTime(): number {
    if (Capacitor.isNativePlatform()) {
      return this.lastKnownTime;
    }
    if (this.audioElement && Number.isFinite(this.audioElement.currentTime)) {
      this.lastKnownTime = this.audioElement.currentTime;
      return this.audioElement.currentTime;
    }
    return this.lastKnownTime;
  }

  public async play(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        await NativeAudio.resume();
        this.isPlaying = true;
        this.hasError = false;
        this.notify();
      } catch (err) {
        console.warn('Native play failed:', err);
      }
      return;
    }

    if (this.audioElement) {
      try {
        await this.audioElement.play();
        this.isPlaying = true;
        this.hasError = false;
        this.updateMediaSessionState('playing');
        this.notify();
      } catch {}
    }
  }

  public pause(): void {
    if (Capacitor.isNativePlatform()) {
      NativeAudio.pause();
      this.isPlaying = false;
      this.notify();
      return;
    }

    if (this.audioElement) {
      this.audioElement.pause();
      this.isPlaying = false;
      this.updateMediaSessionState('paused');
      this.notify();
    }
  }

  public togglePlay(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public seek(targetSeconds: number): void {
    const validDur = this.duration > 0 ? this.duration : 180.0;
    const safeTarget = Math.max(0, Math.min(targetSeconds, Math.max(0, validDur - 0.1)));
    this.lastKnownTime = safeTarget;

    if (Capacitor.isNativePlatform()) {
      NativeAudio.seek({ seconds: safeTarget });
      this.notify();
      return;
    }

    if (this.audioElement && Number.isFinite(safeTarget)) {
      try {
        this.audioElement.currentTime = safeTarget;
      } catch {}
    }
    this.notify();
  }

  public async skipNext(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        const state = await NativeAudio.skipNext();
        if (state) this.applyNativeState(state);
      } catch {
        if (this.onNextCallback) this.onNextCallback();
      }
      return;
    }

    if (this.onNextCallback) this.onNextCallback();
  }

  public async skipPrevious(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        const state = await NativeAudio.skipPrevious();
        if (state) this.applyNativeState(state);
      } catch {
        if (this.onPrevCallback) this.onPrevCallback();
      }
      return;
    }

    if (this.onPrevCallback) this.onPrevCallback();
  }

  public toggleMute(): void {
    this.isMuted = !this.isMuted;
    if (Capacitor.isNativePlatform()) {
      NativeAudio.setVolume({ volume: this.isMuted ? 0 : 1.0 });
    } else if (this.audioElement) {
      this.audioElement.volume = this.isMuted ? 0 : 1.0;
    }
    this.notify();
  }

  public cycleRepeatMode(): RepeatMode {
    if (this.repeatMode === 'off') this.repeatMode = 'all';
    else if (this.repeatMode === 'all') this.repeatMode = 'one';
    else this.repeatMode = 'off';

    if (Capacitor.isNativePlatform()) {
      NativeAudio.setRepeatMode({ mode: this.repeatMode });
    }
    this.notify();
    return this.repeatMode;
  }

  public setShuffle(shuffle: boolean): void {
    this.isShuffle = shuffle;
    if (Capacitor.isNativePlatform()) {
      NativeAudio.setShuffle({ shuffle });
    }
    this.notify();
  }

  public toggleShuffle(): boolean {
    const next = !this.isShuffle;
    this.setShuffle(next);
    return next;
  }

  public toggleLoop(): void {
    this.cycleRepeatMode();
  }

  public async setSong(
    url: string,
    name?: string,
    artist?: string,
    album?: string,
    duration?: number,
    index?: number,
    songsList?: any[]
  ): Promise<void> {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    this.lastKnownTime = 0;
    if (duration && duration > 0) {
      this.duration = duration;
    }

    const detectedName = name?.trim() || 'Device Audio';
    this.songUrl = trimmedUrl;
    this.songName = detectedName;
    this.isCustom = true;
    this.hasError = false;

    this.saveLastPlayedSong({
      url: trimmedUrl,
      title: this.songName,
      artist: artist || 'Device Audio',
      duration: this.duration,
      index: index ?? -1,
      position: 0,
    });

    if (Capacitor.isNativePlatform()) {
      try {
        await NativeAudio.playSong({
          url: trimmedUrl,
          title: this.songName,
          artist: artist || 'Device Audio',
          album: album || 'Local Music',
          duration: this.duration,
          index: index ?? -1,
          songs: songsList,
        });
        this.isPlaying = true;
        this.isLoading = false;
        this.notify();
      } catch (e) {
        console.error('Error playing song natively:', e);
        this.hasError = true;
        this.notify();
      }
      return;
    }

    // Web Fallback
    this.updateMediaSessionMetadata();
    this.initHTMLAudio(this.songUrl);
    this.notify();
    this.play();
  }

  public resetToDefault(): void {
    this.pause();
    this.lastKnownTime = 0;
    this.loadSavedSong();
    this.notify();
  }

  public getState(): AudioPlayerState {
    return {
      isPlaying: this.isPlaying,
      duration: this.duration,
      isLoading: this.isLoading,
      hasError: this.hasError,
      isMuted: this.isMuted,
      isLooping: this.repeatMode !== 'off',
      repeatMode: this.repeatMode,
      isShuffle: this.isShuffle,
      songUrl: this.songUrl,
      songName: this.songName,
      isCustom: this.isCustom,
    };
  }

  public subscribe(listener: (state: AudioPlayerState) => void): () => void {
    this.subscribers.add(listener);
    listener(this.getState());
    return () => {
      this.subscribers.delete(listener);
    };
  }

  private notify() {
    const state = this.getState();
    this.subscribers.forEach((fn) => fn(state));
  }
}

export const audioPlayer = new AudioPlayerService();
