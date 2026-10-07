/**
 * Premium Native Android & Web Daily Anniversary Notification Service
 * for "Our Little Story"
 * 
 * Design & Philosophy:
 * - Minimal, elegant, personal, and deeply romantic
 * - Soft midnight-blue, icy-blue, and lavender styling elements
 * - Smart Random Shuffle Queue preventing repeats across 50 unique romantic messages
 * - Native Capacitor LocalNotifications scheduling for background/closed/locked Android states
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications, ScheduleOptions, Channel } from '@capacitor/local-notifications';
import { RELATIONSHIP_CONFIG } from '../config';

const STORAGE_KEYS = {
  NOTIFICATION_PERMISSION_REQUESTED: 'rls_notification_perm_requested',
  LAST_SCHEDULED_TIMESTAMP: 'rls_last_scheduled_timestamp',
};

// -------------------------------------------------------------------------
// 1. Premium Romantic Titles & 50 Unique English Romantic Messages
// -------------------------------------------------------------------------
export const ROMANTIC_TITLES = [
  "A Little Love Note ♡",
  "Hey, My Heartbeat 💙",
  "Just for You",
  "Forever & Always",
  "A Little Piece of My Heart"
];

export const ROMANTIC_MESSAGES_POOL = [
  "I love you, my heartbeat. You make my little world beautiful. ♡",
  "No matter how busy life gets, my heart always finds its way back to you. 💙",
  "You are my favorite person, my safest place, and my sweetest feeling.",
  "If I could choose again, I would still choose you. Every single time. ♡",
  "You are the story I never want to reach the final chapter of.",
  "Somewhere between a thousand thoughts, my heart always chooses you.",
  "You make ordinary days feel like the most beautiful memories.",
  "A little reminder: someone loves you more than words can explain. 💙",
  "You are not just in my heart. You are the reason it feels like home.",
  "Every beat of my heart has a little piece of you in it. ♡",
  "My favorite place in this world is wherever I get to be with you.",
  "I still get that little smile whenever I think about you.",
  "You are my today, my tomorrow, and my favorite forever.",
  "If love had a sound, it would be my heart whispering your name.",
  "I want a thousand ordinary mornings and a lifetime of them with you.",
  "You are the sweetest notification my heart could ever receive. ♡",
  "Even on the hardest days, the thought of you makes things softer.",
  "I never knew forever could feel so beautiful until I imagined it with you.",
  "You are my favorite thought before I sleep and after I wake up.",
  "No distance can make you any less important to my heart. 💙",
  "Our little story is my favorite story, and I never want it to end.",
  "I would find you in every lifetime, in every world, in every version of me.",
  "You make my heart feel things that words could never fully explain.",
  "One day, we will look back at these little moments and smile together.",
  "I don't need a perfect life. I just want a beautiful life with you.",
  "You are the calm in my chaos and the light in my quietest moments.",
  "Every love song feels a little more meaningful because of you.",
  "If I had one wish today, it would be one more moment beside you.",
  "You are the person I want to tell every little thing about my day.",
  "I hope you never forget how deeply, genuinely, and endlessly you are loved.",
  "My heart has a favorite name, and it will always be yours. ♡",
  "Even silence feels romantic when I imagine sitting beside you.",
  "You turned my little world into a place full of beautiful possibilities.",
  "I want to grow older with you and fall in love with you all over again.",
  "No special occasion is needed. You are my reason to celebrate love every day.",
  "You are the unexpected blessing I would choose a million times.",
  "Whenever Hawayein plays, I wish you were right here beside me. 🎶",
  "Like my favorite song, you never get old in my heart.",
  "My favorite memories are the ones that have you somewhere in them.",
  "I wish I could turn every thought of you into a little hug.",
  "You are my favorite chapter, my sweetest plot twist, and my forever person.",
  "If my heart could send you a message, it would simply say: I miss you.",
  "I love the little things about you that you might not even notice.",
  "The world is huge, but somehow my heart found its home in you.",
  "You make forever sound less like a promise and more like a dream come true.",
  "Another day, another reason to be grateful that you are part of my life.",
  "I hope this little notification makes you smile the way you make me smile.",
  "My heart still chooses you in the quiet moments when nobody is watching.",
  "I love you, my heartbeat. Today, tomorrow, and in every chapter of our story. ♡",
  "If our story could last forever, I would still ask for one more day with you."
];

// -------------------------------------------------------------------------
// 2. Smart Random Shuffle System Helper functions
// -------------------------------------------------------------------------
interface ShuffleState {
  shuffledIndexes: number[];
  currentIndex: number;
}

const SHUFFLE_STORAGE_KEY = 'rls_notifications_shuffle_state_v4';

function shuffleArray(arr: any[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function getOrInitializeShuffleState(): ShuffleState {
  try {
    const raw = localStorage.getItem(SHUFFLE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        Array.isArray(parsed.shuffledIndexes) &&
        parsed.shuffledIndexes.length === 50 &&
        typeof parsed.currentIndex === 'number'
      ) {
        return parsed as ShuffleState;
      }
    }
  } catch {}

  const indexes = Array.from({ length: 50 }, (_, i) => i);
  shuffleArray(indexes);

  const state: ShuffleState = {
    shuffledIndexes: indexes,
    currentIndex: 0,
  };
  saveShuffleState(state);
  return state;
}

function saveShuffleState(state: ShuffleState) {
  try {
    localStorage.setItem(SHUFFLE_STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

class NotificationService {
  private isInitialized = false;

  public async init(): Promise<void> {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    try {
      if (Capacitor.isNativePlatform()) {
        await this.initNativeAndroidNotifications();
      } else {
        await this.initWebNotifications();
      }
    } catch (err) {
      console.warn('Failed to initialize notifications:', err);
    }
  }

  /**
   * Native Android Notification Setup & Channel Registration
   */
  private async initNativeAndroidNotifications(): Promise<void> {
    try {
      // Create versioned channel ID to enforce the new aesthetic parameters
      const channel: Channel = {
        id: 'daily_anniversary_channel_v5',
        name: 'Our Little Story ♡',
        description: 'Premium daily romantic milestones for Our Little Story',
        importance: 4, // High importance for status bar & lockscreen display
        visibility: 1, // Public on lockscreen
        vibration: true,
        lights: true,
        lightColor: '#a78bfa', // Soft romantic violet-lavender accent glow
      };

      await LocalNotifications.createChannel(channel);

      const permStatus = await LocalNotifications.checkPermissions();
      const hasPrompted = localStorage.getItem(STORAGE_KEYS.NOTIFICATION_PERMISSION_REQUESTED) === 'true';

      if (permStatus.display === 'granted') {
        await this.scheduleUpcomingDailyAnniversaries();
      } else if (!hasPrompted) {
        localStorage.setItem(STORAGE_KEYS.NOTIFICATION_PERMISSION_REQUESTED, 'true');
        const req = await LocalNotifications.requestPermissions();
        if (req.display === 'granted') {
          await this.scheduleUpcomingDailyAnniversaries();
        }
      }

      LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction) => {
        console.log('Romantic notification opened:', notificationAction.notification.id);
      });
    } catch (e) {
      console.warn('Native notification setup error:', e);
    }
  }

  /**
   * Schedule next 30 days of daily milestone notifications with the unique shuffle queue
   */
  public async scheduleUpcomingDailyAnniversaries(): Promise<void> {
    try {
      const now = Date.now();
      const startMs = RELATIONSHIP_CONFIG.startTimestamp;
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;

      const elapsedMs = Math.max(0, now - startMs);
      const currentCompletedDays = Math.floor(elapsedMs / ONE_DAY_MS);

      const pending = await LocalNotifications.getPending();
      const pendingIds = new Set(pending.notifications.map((n) => n.id));

      const notificationsToSchedule = [];

      // Clone current shuffle state to sequence through in-memory
      const tempState = { ...getOrInitializeShuffleState() };

      const getNextMessageTemp = (): string => {
        const msgIdx = tempState.shuffledIndexes[tempState.currentIndex];
        const message = ROMANTIC_MESSAGES_POOL[msgIdx];
        
        tempState.currentIndex += 1;
        if (tempState.currentIndex >= 50) {
          const lastMsg = tempState.shuffledIndexes[49];
          const nextCycle = Array.from({ length: 50 }, (_, i) => i);
          let attempts = 0;
          do {
            shuffleArray(nextCycle);
            attempts++;
          } while (nextCycle[0] === lastMsg && attempts < 100);
          tempState.shuffledIndexes = nextCycle;
          tempState.currentIndex = 0;
        }
        return message;
      };

      for (let offset = 1; offset <= 30; offset++) {
        const targetDayCount = currentCompletedDays + offset;
        const targetTimestamp = startMs + targetDayCount * ONE_DAY_MS;
        const notifId = 10000 + (targetDayCount % 90000);

        if (targetTimestamp > now && !pendingIds.has(notifId)) {
          const title = ROMANTIC_TITLES[targetDayCount % ROMANTIC_TITLES.length];
          const body = getNextMessageTemp();

          notificationsToSchedule.push({
            id: notifId,
            title,
            body,
            schedule: {
              at: new Date(targetTimestamp),
              allowWhileIdle: true,
            },
            channelId: 'daily_anniversary_channel_v5',
            smallIcon: 'ic_stat_heart',
            largeIcon: 'icon', // Beautiful Launcher Icon as a Large Badge
            iconColor: '#e11d48', // Vibrant romantic ruby/rose heart accent color
            autoCancel: true,
            extra: {
              dayCount: targetDayCount,
              milestoneTime: targetTimestamp,
            },
          });
        }
      }

      if (notificationsToSchedule.length > 0) {
        const scheduleOptions: ScheduleOptions = {
          notifications: notificationsToSchedule,
        };
        await LocalNotifications.schedule(scheduleOptions);
        
        // Persist the advanced shuffle state
        saveShuffleState(tempState);
        localStorage.setItem(STORAGE_KEYS.LAST_SCHEDULED_TIMESTAMP, String(now));
      }
    } catch (err) {
      console.warn('Could not schedule anniversary notifications:', err);
    }
  }

  /**
   * Web browser notification fallback
   */
  private async initWebNotifications(): Promise<void> {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    try {
      const hasPrompted = localStorage.getItem(STORAGE_KEYS.NOTIFICATION_PERMISSION_REQUESTED) === 'true';

      if (Notification.permission === 'granted') {
        this.checkAndSendWebDailyNotification();
      } else if (Notification.permission === 'default' && !hasPrompted) {
        localStorage.setItem(STORAGE_KEYS.NOTIFICATION_PERMISSION_REQUESTED, 'true');
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          this.checkAndSendWebDailyNotification();
        }
      }
    } catch (e) {
      console.warn('Web notification setup error:', e);
    }
  }

  private checkAndSendWebDailyNotification() {
    if (Notification.permission !== 'granted') return;

    const now = Date.now();
    const startMs = RELATIONSHIP_CONFIG.startTimestamp;
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const currentCompletedDays = Math.floor(Math.max(0, now - startMs) / ONE_DAY_MS);
    const lastNotifiedDayKey = 'rls_last_web_notified_day';
    const lastNotifiedDay = parseInt(localStorage.getItem(lastNotifiedDayKey) || '0', 10);

    if (currentCompletedDays > lastNotifiedDay && currentCompletedDays > 0) {
      localStorage.setItem(lastNotifiedDayKey, String(currentCompletedDays));
      
      const title = ROMANTIC_TITLES[currentCompletedDays % ROMANTIC_TITLES.length];
      
      const state = getOrInitializeShuffleState();
      const msgIdx = state.shuffledIndexes[state.currentIndex];
      const body = ROMANTIC_MESSAGES_POOL[msgIdx];

      state.currentIndex += 1;
      if (state.currentIndex >= 50) {
        const lastMsg = state.shuffledIndexes[49];
        const nextCycle = Array.from({ length: 50 }, (_, i) => i);
        let attempts = 0;
        do {
          shuffleArray(nextCycle);
          attempts++;
        } while (nextCycle[0] === lastMsg && attempts < 100);
        state.shuffledIndexes = nextCycle;
        state.currentIndex = 0;
      }
      saveShuffleState(state);

      try {
        new Notification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/favicon.png',
          tag: `anniversary-day-${currentCompletedDays}`,
        });
      } catch {}
    }
  }
}

export const notificationService = new NotificationService();
