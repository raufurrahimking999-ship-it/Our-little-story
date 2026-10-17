import { Capacitor, registerPlugin } from '@capacitor/core';
import { DEFAULT_LOCAL_AUDIO_PATH, RELATIONSHIP_CONFIG } from '../config';

export interface SongItem {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  url: string;
  artwork?: string;
  isBuiltIn?: boolean;
}

export const BUNDLED_HAWAYEIN_SONG: SongItem = {
  id: 'bundled-hawayein',
  title: 'Hawayein',
  artist: 'Arijit Singh & Pritam',
  album: 'Jab Harry Met Sejal',
  duration: 291,
  url: DEFAULT_LOCAL_AUDIO_PATH,
  isBuiltIn: true,
};

export const DEFAULT_BUNDLED_SONGS: SongItem[] = [
  BUNDLED_HAWAYEIN_SONG,
];

export const WEB_PREVIEW_SONG: SongItem = BUNDLED_HAWAYEIN_SONG;

class LocalMusicService {
  private songs: SongItem[] = [...DEFAULT_BUNDLED_SONGS];
  private subscribers = new Set<(songs: SongItem[]) => void>();
  private isScanning = false;

  constructor() {
    this.songs = [...DEFAULT_BUNDLED_SONGS];
    if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
      this.initNativePlaylist();
    }
  }

  private async initNativePlaylist() {
    try {
      const NativeAudio = registerPlugin<any>('NativeAudio');
      await NativeAudio.setPlaylist({
        songs: this.songs,
        startIndex: 0,
        startPositionSeconds: 0,
        playImmediately: false,
      });
    } catch {}
  }

  /**
   * Scan device storage directories for audio files using native Android MediaStore API
   */
  public async requestPermissionAndScan(): Promise<SongItem[]> {
    if (this.isScanning) return this.songs;
    this.isScanning = true;

    try {
      const isNative = Capacitor.isNativePlatform();

      if (isNative) {
        const NativeAudio = registerPlugin<any>('NativeAudio');
        const scanResult = await NativeAudio.scanDeviceAudio();

        if (scanResult && Array.isArray(scanResult.songs)) {
          const scannedSongs: SongItem[] = scanResult.songs;
          // Filter out duplicates of the bundled Hawayein track and any stale legacy entries
          const filteredDeviceSongs = scannedSongs.filter((s) => {
            const titleLower = (s.title || '').toLowerCase();
            const urlLower = (s.url || '').toLowerCase();
            const isHawayeinDup = titleLower.includes('hawayein') || urlLower.includes('hawayein.mp3');
            const isLegacyOurSong = titleLower.includes('our special song') || urlLower.includes('our_song.mp3');
            return !isHawayeinDup && !isLegacyOurSong && s.url !== BUNDLED_HAWAYEIN_SONG.url;
          });

          // Hawayein is the single bundled default song at index 0, followed by genuine device songs
          this.songs = [BUNDLED_HAWAYEIN_SONG, ...filteredDeviceSongs];
          
          // Register full playlist with native MediaSession / ExoPlayer engine
          try {
            await NativeAudio.setPlaylist({
              songs: this.songs,
              startIndex: 0,
              startPositionSeconds: 0,
              playImmediately: false,
            });
          } catch (e) {
            console.warn('Error syncing playlist to native engine:', e);
          }

          this.notify();
          return this.songs;
        }
      }
    } catch (e) {
      console.error('Error scanning native MediaStore library:', e);
    } finally {
      this.isScanning = false;
    }

    if (this.songs.length === 0) {
      this.songs = [...DEFAULT_BUNDLED_SONGS];
    }

    this.notify();
    return this.songs;
  }

  public getSongs(): SongItem[] {
    return this.songs;
  }

  public subscribe(callback: (songs: SongItem[]) => void) {
    this.subscribers.add(callback);
    callback(this.songs);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notify() {
    for (const cb of this.subscribers) {
      cb(this.songs);
    }
  }
}

export const localMusicService = new LocalMusicService();
