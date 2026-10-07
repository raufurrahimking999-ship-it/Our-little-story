/**
 * =========================================================================
 * BUNDLED OFFLINE LOCAL AUDIO CONFIGURATION
 * Default song: Hawayein — Arijit Singh (bundled inside public/audio/hawayein.mp3)
 * =========================================================================
 */
export const DEFAULT_LOCAL_AUDIO_PATH = '/audio/our_song.mp3';
export const YOUTUBE_SONG_URL = DEFAULT_LOCAL_AUDIO_PATH;

/**
 * Relationship Counter & Romantic Configuration
 * 
 * Relationship Start Date/Time:
 * 8 April 2026, 02:23 AM
 * Timezone: Asia/Dhaka (Bangladesh, UTC+6)
 */
export const RELATIONSHIP_CONFIG = {
  // ISO-8601 string with Asia/Dhaka (+06:00) offset (Internal permanent start timestamp)
  startDateISO: '2026-04-08T02:23:00+06:00',

  // Permanent timestamp in milliseconds
  startTimestamp: new Date('2026-04-08T02:23:00+06:00').getTime(),

  // Display strings (visible to user - no UTC/timezone text)
  startDateFormatted: '8 April 2026',
  startTimeFormatted: '02:23 AM',
  formattedStartDate: '8 April 2026',
  formattedStartTime: '02:23 AM',
  sinceLabel: 'Since 8 April 2026, 02:23 AM',

  // Main phrase - strictly preserved
  mainPhrase: 'I LOVE YOU, MY HEARTBEAT.',

  // Couple signature
  coupleSignature: 'Ripti ♡ Raufur',

  // Song details
  songName: 'Our Special Song — Our Little Story',
  youtubeUrl: DEFAULT_LOCAL_AUDIO_PATH,
  audioPath: DEFAULT_LOCAL_AUDIO_PATH,
  audioFallbackPath: DEFAULT_LOCAL_AUDIO_PATH,

  // Special message - strictly preserved
  specialMessage: 'Every second with you matters.',
} as const;

export interface TimeElapsed {
  totalDays: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
}

/**
 * Calculates exact elapsed time from the configured start timestamp
 * using the current device clock.
 */
export function calculateElapsed(targetTimestamp: number, currentTimestamp = Date.now()): TimeElapsed {
  const diffMs = currentTimestamp - targetTimestamp;
  const isPast = diffMs >= 0;
  const absDiff = Math.abs(diffMs);

  const totalSeconds = Math.floor(absDiff / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 24;
  const totalDays = Math.floor(totalHours / 24);

  return {
    totalDays,
    hours,
    minutes,
    seconds,
    isPast,
  };
}

export function padZero(num: number, targetLength = 2): string {
  return num.toString().padStart(targetLength, '0');
}
