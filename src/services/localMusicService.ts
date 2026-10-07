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

export const WEB_PREVIEW_SONG: SongItem = {
  id: 'preview-our-song',
  title: RELATIONSHIP_CONFIG.songName || 'Our Special Song',
  artist: RELATIONSHIP_CONFIG.coupleSignature,
  album: 'Our Little Story',
  duration: 291,
  url: DEFAULT_LOCAL_AUDIO_PATH,
  isBuiltIn: true,
};

class LocalMusicService {
  private songs: SongItem[] = [];
  private subscribers = new Set<(songs: SongItem[]) => void>();
  private isScanning = false;

  constructor() {
    if (!Capacitor.isNativePlatform()) {
      // In browser preview, supply web preview song
      this.songs = [WEB_PREVIEW_SONG];
    } else {
      // On native Android, starts empty until scanned from device
      this.songs = [];
    }
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
          // Device songs only, zero hardcoded demo songs
          this.songs = scannedSongs;
          
          if (scannedSongs.length > 0) {
            // Register full playlist with native MediaSession / ExoPlayer engine
            try {
              await NativeAudio.setPlaylist({
                songs: scannedSongs,
                startIndex: 0,
                startPositionSeconds: 0,
                playImmediately: false,
              });
            } catch (e) {
              console.warn('Error syncing playlist to native engine:', e);
            }
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

    if (!Capacitor.isNativePlatform() && this.songs.length === 0) {
      this.songs = [WEB_PREVIEW_SONG];
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
