import React, { useEffect } from 'react';
import { permissionService } from '../services/permissionService';
import { localMusicService } from '../services/localMusicService';
import { notificationService } from '../services/notificationService';

interface StartupPermissionModalProps {
  onComplete: () => void;
}

export const StartupPermissionModal: React.FC<StartupPermissionModalProps> = ({ onComplete }) => {
  useEffect(() => {
    const runStartupPermissions = async () => {
      try {
        const state = await permissionService.checkPermissions();
        if (state.needsSetup) {
          // Trigger sequential native runtime permission flow programmatically in the background
          await permissionService.requestAllPermissions();
          await localMusicService.requestPermissionAndScan();
          await notificationService.init();
          permissionService.markSetupCompleted();
        }
      } catch (err) {
        console.error('Error in startup permissions:', err);
      } finally {
        onComplete();
      }
    };
    runStartupPermissions();
  }, [onComplete]);

  return null;
};
