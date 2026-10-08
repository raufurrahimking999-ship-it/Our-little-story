import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export interface PermissionState {
  audio: 'granted' | 'denied' | 'prompt';
  notifications: 'granted' | 'denied' | 'prompt';
  allGranted: boolean;
  needsSetup: boolean;
  isNative: boolean;
}

interface PermissionBridgePlugin {
  checkAudioPermission(): Promise<{ status: 'granted' | 'denied' | 'prompt' }>;
  requestAudioPermission(): Promise<{ granted: boolean }>;
  openAppSettings(): Promise<{ success: boolean }>;
}

const PermissionBridge = registerPlugin<PermissionBridgePlugin>('PermissionBridge');

const STORAGE_KEY = 'our_story_permissions_granted';

class PermissionService {
  /**
   * Check all current permission statuses
   */
  public async checkPermissions(): Promise<PermissionState> {
    const isNative = Capacitor.isNativePlatform();

    if (!isNative) {
      // Web environment behavior
      let notifStatus: 'granted' | 'denied' | 'prompt' = 'prompt';
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') notifStatus = 'granted';
        else if (Notification.permission === 'denied') notifStatus = 'denied';
      }

      const hasDoneWebSetup = localStorage.getItem(STORAGE_KEY) === 'true';
      const audioStatus: 'granted' | 'denied' | 'prompt' = hasDoneWebSetup ? 'granted' : 'prompt';

      const allGranted = notifStatus === 'granted' || hasDoneWebSetup;
      const needsSetup = !hasDoneWebSetup && notifStatus !== 'granted';

      return {
        audio: audioStatus,
        notifications: notifStatus,
        allGranted,
        needsSetup,
        isNative: false,
      };
    }

    // Native Android / iOS environment
    let audioStatus: 'granted' | 'denied' | 'prompt' = 'prompt';
    let notifStatus: 'granted' | 'denied' | 'prompt' = 'prompt';

    try {
      // 1. Check Filesystem / Storage permission via PermissionBridge
      const bridgeRes = await PermissionBridge.checkAudioPermission();
      if (bridgeRes && bridgeRes.status) {
        audioStatus = bridgeRes.status;
        if (audioStatus === 'granted') {
          localStorage.setItem('rls_audio_perm_granted', 'true');
        } else {
          localStorage.removeItem('rls_audio_perm_granted');
        }
      }
    } catch (e) {
      console.warn('Error checking audio permission via bridge:', e);
      if (localStorage.getItem('rls_audio_perm_granted') === 'true') {
        audioStatus = 'granted';
      }
    }

    try {
      // 2. Check Local Notifications permission
      const notifCheck = await LocalNotifications.checkPermissions();
      if (notifCheck.display === 'granted') {
        notifStatus = 'granted';
      } else if (notifCheck.display === 'denied') {
        notifStatus = 'denied';
      }
    } catch {
      if (localStorage.getItem('rls_notif_perm_granted') === 'true') {
        notifStatus = 'granted';
      }
    }

    const allGranted = audioStatus === 'granted' && notifStatus === 'granted';
    const hasPassedBefore = localStorage.getItem(STORAGE_KEY) === 'true';

    // Needs setup if either key permission is not granted and user hasn't explicitly skipped
    const needsSetup = !allGranted && (!hasPassedBefore || audioStatus === 'prompt' || notifStatus === 'prompt');

    return {
      audio: audioStatus,
      notifications: notifStatus,
      allGranted,
      needsSetup,
      isNative: true,
    };
  }

  /**
   * Sequential native permission request flow
   * Triggers native dialogs sequentially without overlapping
   */
  public async requestAllPermissions(): Promise<PermissionState> {
    const isNative = Capacitor.isNativePlatform();

    if (!isNative) {
      // Web notification request
      if (typeof window !== 'undefined' && 'Notification' in window) {
        try {
          await Notification.requestPermission();
        } catch {}
      }
      localStorage.setItem(STORAGE_KEY, 'true');
      return this.checkPermissions();
    }

    // Native Android Flow
    // Step 1: Request Local Notifications Permission
    try {
      const notifRes = await LocalNotifications.requestPermissions();
      if (notifRes.display === 'granted') {
        localStorage.setItem('rls_notif_perm_granted', 'true');
      }
    } catch (e) {
      console.warn('Error requesting notification permissions:', e);
    }

    // Step 2: Request Audio Permission via PermissionBridge
    try {
      const bridgeRes = await PermissionBridge.requestAudioPermission();
      if (bridgeRes.granted) {
        localStorage.setItem('rls_audio_perm_granted', 'true');
      }
    } catch (e) {
      console.warn('Error requesting audio permissions via bridge:', e);
    }

    localStorage.setItem(STORAGE_KEY, 'true');
    return this.checkPermissions();
  }

  /**
   * Request only Audio permission
   */
  public async requestAudioPermission(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      localStorage.setItem('rls_audio_perm_granted', 'true');
      return true;
    }

    try {
      const res = await PermissionBridge.requestAudioPermission();
      const granted = Boolean(res && res.granted);
      if (granted) {
        localStorage.setItem('rls_audio_perm_granted', 'true');
      } else {
        localStorage.removeItem('rls_audio_perm_granted');
      }
      return granted;
    } catch {
      return false;
    }
  }

  /**
   * Request only Notification permission
   */
  public async requestNotificationPermission(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        const res = await Notification.requestPermission();
        return res === 'granted';
      }
      return false;
    }

    try {
      const res = await LocalNotifications.requestPermissions();
      const granted = res.display === 'granted';
      if (granted) localStorage.setItem('rls_notif_perm_granted', 'true');
      return granted;
    } catch {
      return false;
    }
  }

  /**
   * Open Android App Info settings screen dynamically
   */
  public async openAppSettings(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      const res = await PermissionBridge.openAppSettings();
      return !!res.success;
    } catch (e) {
      console.error('Failed to open app settings via bridge:', e);
      return false;
    }
  }

  /**
   * Set flag that user dismissed setup screen
   */
  public markSetupCompleted() {
    localStorage.setItem(STORAGE_KEY, 'true');
  }
}

export const permissionService = new PermissionService();
