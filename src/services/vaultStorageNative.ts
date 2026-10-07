import { registerPlugin, Capacitor } from '@capacitor/core';

export interface PickedMediaResultItem {
  name: string;
  type: 'image' | 'video' | 'file';
  mimeType: string;
  size: number;
  base64Data: string;
}

interface VaultStoragePluginInterface {
  writeEncryptedFile(options: { fileId: string; base64Data: string }): Promise<{ success: boolean; verified: boolean; filePath: string; size: number }>;
  readEncryptedFile(options: { filePath?: string; fileId?: string }): Promise<{ success: boolean; base64Data: string; size: number }>;
  deleteEncryptedFile(options: { filePath?: string; fileId?: string }): Promise<{ success: boolean; deleted: boolean }>;
  deleteEncryptedFilesBatch(options: { filePaths: string[] }): Promise<{ success: boolean }>;
  checkVaultFile(options: { filePath?: string; fileId?: string }): Promise<{ exists: boolean; size: number; filePath?: string }>;
  cleanupTemp(): Promise<{ success: boolean }>;
  pickMediaFiles(): Promise<{ items: PickedMediaResultItem[] }>;
}

const VaultStorage = registerPlugin<VaultStoragePluginInterface>('VaultStorage');

export class VaultStorageNativeService {
  public isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Writes AES-GCM encrypted bytes (.enc) directly into private internal app storage.
   */
  public async writeEncryptedFile(fileId: string, base64Data: string): Promise<{ success: boolean; filePath: string; size: number }> {
    if (this.isNative()) {
      const res = await VaultStorage.writeEncryptedFile({ fileId, base64Data });
      return {
        success: Boolean(res && res.verified),
        filePath: res.filePath,
        size: res.size,
      };
    }

    return {
      success: true,
      filePath: `idb://vault_encrypted/${fileId}.enc`,
      size: base64Data.length,
    };
  }

  /**
   * Reads AES-GCM encrypted bytes from private internal storage.
   */
  public async readEncryptedFile(fileId: string, filePath?: string): Promise<string> {
    if (this.isNative()) {
      const res = await VaultStorage.readEncryptedFile({ fileId, filePath });
      return res?.base64Data || '';
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
   * Checks if an encrypted file exists and is valid.
   */
  public async verifyFileExists(fileId: string, filePath?: string): Promise<boolean> {
    if (this.isNative()) {
      try {
        const res = await VaultStorage.checkVaultFile({ fileId, filePath });
        return Boolean(res && res.exists);
      } catch {
        return false;
      }
    }
    return true;
  }

  /**
   * Opens Android native media picker and streams selected items.
   */
  public async pickMediaFiles(): Promise<PickedMediaResultItem[]> {
    if (this.isNative()) {
      try {
        const res = await VaultStorage.pickMediaFiles();
        return res?.items || [];
      } catch (err) {
        console.warn('Native picker error:', err);
        return [];
      }
    }
    return [];
  }

  /**
   * Wipes any lingering temp files.
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
