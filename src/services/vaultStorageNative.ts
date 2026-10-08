import { registerPlugin, Capacitor } from '@capacitor/core';

export interface PickedMediaResultItem {
  id: string;
  name: string;
  type: 'image' | 'video' | 'file';
  mimeType: string;
  size: number;
  encryptedPath: string;
  dateAdded: number;
  thumbnailUrl?: string;
  base64Data?: string;
}

interface VaultStoragePluginInterface {
  setSessionKey(options: { keyBase64: string }): Promise<{ success: boolean }>;
  clearSessionKey(): Promise<{ success: boolean }>;
  checkMediaPermissions(): Promise<{ granted: boolean }>;
  requestMediaPermissions(): Promise<{ granted: boolean }>;
  pickMediaFiles(): Promise<{ cancelled?: boolean; count?: number; items: PickedMediaResultItem[] }>;
  readDecryptedMedia(options: { fileId?: string; filePath?: string }): Promise<{ success: boolean; isStream?: boolean; base64Data?: string; streamUrl?: string; size: number }>;
  writeEncryptedFile(options: { fileId: string; base64Data: string }): Promise<{ success: boolean; verified: boolean; filePath: string; size: number }>;
  deleteEncryptedFile(options: { filePath?: string; fileId?: string }): Promise<{ success: boolean; deleted: boolean }>;
  deleteEncryptedFilesBatch(options: { filePaths: string[] }): Promise<{ success: boolean }>;
  saveManifest(options: { manifest: string }): Promise<{ success: boolean }>;
  loadManifest(): Promise<{ exists: boolean; manifest: string }>;
  cleanupTemp(): Promise<{ success: boolean }>;
}

const VaultStorage = registerPlugin<VaultStoragePluginInterface>('VaultStorage');

export class VaultStorageNativeService {
  public isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  public async setSessionKey(keyBase64: string): Promise<boolean> {
    if (this.isNative()) {
      try {
        const res = await VaultStorage.setSessionKey({ keyBase64 });
        return Boolean(res && res.success);
      } catch (e) {
        console.warn('VaultStorage setSessionKey error:', e);
        return false;
      }
    }
    return true;
  }

  public async clearSessionKey(): Promise<boolean> {
    if (this.isNative()) {
      try {
        await VaultStorage.clearSessionKey();
      } catch {}
    }
    return true;
  }

  public async checkMediaPermissions(): Promise<boolean> {
    if (this.isNative()) {
      try {
        const res = await VaultStorage.checkMediaPermissions();
        return Boolean(res && res.granted);
      } catch {
        return false;
      }
    }
    return true;
  }

  public async requestMediaPermissions(): Promise<boolean> {
    if (this.isNative()) {
      try {
        const res = await VaultStorage.requestMediaPermissions();
        return Boolean(res && res.granted);
      } catch {
        return false;
      }
    }
    return true;
  }

  /**
   * Opens Android native system media picker and streams encrypted files to app-private storage.
   */
  public async pickMediaFiles(): Promise<{ cancelled: boolean; items: PickedMediaResultItem[] }> {
    if (this.isNative()) {
      try {
        const res = await VaultStorage.pickMediaFiles();
        return {
          cancelled: Boolean(res && res.cancelled),
          items: (res && res.items) || [],
        };
      } catch (err) {
        console.warn('Native picker error:', err);
        return { cancelled: false, items: [] };
      }
    }
    return { cancelled: false, items: [] };
  }

  /**
   * Reads and decrypts a media file for secure in-memory viewing.
   */
  public async readDecryptedMedia(fileId: string, filePath?: string): Promise<{ success: boolean; isStream?: boolean; base64Data?: string; streamUrl?: string; size: number }> {
    if (this.isNative()) {
      try {
        const res = await VaultStorage.readDecryptedMedia({ fileId, filePath });
        return {
          success: Boolean(res && res.success),
          isStream: Boolean(res && res.isStream),
          base64Data: res?.base64Data,
          streamUrl: res?.streamUrl,
          size: res?.size || 0,
        };
      } catch (err) {
        console.warn('Failed to read decrypted media:', err);
        return { success: false, size: 0 };
      }
    }
    return { success: false, size: 0 };
  }

  /**
   * Writes AES-GCM encrypted bytes (.enc) into private internal app storage.
   */
  public async writeEncryptedFile(fileId: string, base64Data: string): Promise<{ success: boolean; filePath: string; size: number }> {
    if (this.isNative()) {
      try {
        const res = await VaultStorage.writeEncryptedFile({ fileId, base64Data });
        return {
          success: Boolean(res && res.verified),
          filePath: res.filePath,
          size: res.size,
        };
      } catch (err) {
        console.warn('writeEncryptedFile error:', err);
        return { success: false, filePath: '', size: 0 };
      }
    }
    return {
      success: true,
      filePath: `idb://vault_encrypted/${fileId}.enc`,
      size: base64Data.length,
    };
  }

  /**
   * Reads raw encrypted bytes (.enc) from private internal app storage.
   */
  public async readEncryptedFile(fileId: string, filePath?: string): Promise<string> {
    if (this.isNative()) {
      try {
        const res = await VaultStorage.readDecryptedMedia({ fileId, filePath });
        return res?.base64Data || '';
      } catch {
        return '';
      }
    }
    return '';
  }

  /**
   * Deletes an encrypted file from private storage.
   */
  public async deleteEncryptedFile(fileId: string, filePath?: string): Promise<boolean> {
    if (this.isNative()) {
      try {
        const res = await VaultStorage.deleteEncryptedFile({ fileId, filePath });
        return Boolean(res && res.success);
      } catch {
        return false;
      }
    }
    return true;
  }

  /**
   * Batch deletes encrypted files from private storage.
   */
  public async deleteEncryptedFilesBatch(filePaths: string[]): Promise<boolean> {
    if (!filePaths || filePaths.length === 0) return true;
    if (this.isNative()) {
      try {
        const res = await VaultStorage.deleteEncryptedFilesBatch({ filePaths });
        return Boolean(res && res.success);
      } catch {
        return false;
      }
    }
    return true;
  }

  /**
   * Backs up items manifest directly to internal Android storage.
   */
  public async saveManifest(manifestJson: string): Promise<boolean> {
    if (this.isNative()) {
      try {
        const res = await VaultStorage.saveManifest({ manifest: manifestJson });
        return Boolean(res && res.success);
      } catch {
        return false;
      }
    }
    return true;
  }

  /**
   * Loads secondary manifest from internal Android storage.
   */
  public async loadManifest(): Promise<{ exists: boolean; manifest: string }> {
    if (this.isNative()) {
      try {
        const res = await VaultStorage.loadManifest();
        return {
          exists: Boolean(res && res.exists),
          manifest: res?.manifest || '[]',
        };
      } catch {
        return { exists: false, manifest: '[]' };
      }
    }
    return { exists: false, manifest: '[]' };
  }

  /**
   * Wipes temporary decrypted streaming files.
   */
  public async cleanupTemp(): Promise<void> {
    if (this.isNative()) {
      try {
        await VaultStorage.cleanupTemp();
      } catch {}
    }
  }
}

export const vaultStorageNative = new VaultStorageNativeService();
