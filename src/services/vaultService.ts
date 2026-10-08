import { vaultCrypto, bufferToBase64, base64ToBuffer } from './vaultCrypto';
import { vaultStorageNative, PickedMediaResultItem } from './vaultStorageNative';

export interface VaultFolder {
  id: string;
  name: string;
  createdAt: number;
}

export interface VaultItem {
  id: string;
  folderId?: string; // undefined or 'root' means All/Root
  type: 'image' | 'video' | 'file';
  mimeType?: string;
  name: string;
  dateAdded: number;
  size: number;
  encryptedPath?: string; // e.g. /data/user/0/.../files/vault_encrypted/<id>.enc
  encryptedBlobBase64?: string; // For web fallback / backup
  dataUrl?: string; // In-memory decrypted Blob URL (ephemeral, not persisted)
}

// Storage Keys
const VAULT_META_KEY = 'rls_vault_secure_envelope_v4';
const VAULT_FOLDERS_KEY = 'rls_vault_secure_folders_v4';

// IndexedDB Storage for Metadata and Web Ciphertexts
const DB_NAME = 'rls_vault_db_secure_v4';
const DB_VERSION = 1;
const STORE_NAME = 'vault_encrypted_items';

function openVaultDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGetAllItems(): Promise<VaultItem[]> {
  try {
    const db = await openVaultDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

async function idbSaveItem(item: VaultItem): Promise<boolean> {
  try {
    const db = await openVaultDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      // Strip ephemeral memory dataUrl before saving to disk
      const { dataUrl, ...toSave } = item;
      const req = store.put(toSave);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

async function idbDeleteItem(id: string): Promise<boolean> {
  try {
    const db = await openVaultDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

async function idbDeleteItemsBatch(ids: string[]): Promise<boolean> {
  try {
    const db = await openVaultDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      ids.forEach(id => store.delete(id));
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

interface VaultEnvelopeMetadata {
  saltHex: string;
  wrappedMasterKeyBase64: string;
  wrappedIvHex: string;
  verifierCipherHex: string;
  verifierIvHex: string;
  recoveryQ: string;
  recoverySaltHex: string;
  recoveryWrappedMasterKeyBase64: string;
  recoveryWrappedIvHex: string;
}

class VaultService {
  private isUnlocked: boolean = false;
  private cachedItems: VaultItem[] = [];
  private blobUrlCache = new Map<string, string>();
  private subscribers = new Set<(unlocked: boolean) => void>();

  constructor() {
    // Attempt automatic session restoration if Android Activity paused/recreated
    if (typeof window !== 'undefined') {
      this.tryRestoreSession().catch(() => {});
    }
  }

  private getEnvelope(): VaultEnvelopeMetadata | null {
    try {
      const raw = localStorage.getItem(VAULT_META_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private saveEnvelope(envelope: VaultEnvelopeMetadata) {
    try {
      localStorage.setItem(VAULT_META_KEY, JSON.stringify(envelope));
    } catch {}
  }

  public async hasPassword(): Promise<boolean> {
    const env = this.getEnvelope();
    return Boolean(env && env.wrappedMasterKeyBase64);
  }

  public getRecoveryQuestion(): string | null {
    const env = this.getEnvelope();
    return env?.recoveryQ || null;
  }

  private async syncSessionKeyToNative() {
    const rawKey = vaultCrypto.getRawMasterKeyBytes();
    if (rawKey) {
      const b64 = bufferToBase64(rawKey);
      if (vaultStorageNative.isNative()) {
        await vaultStorageNative.setSessionKey(b64);
      }
      try {
        sessionStorage.setItem('vault_session_unlocked', 'true');
        sessionStorage.setItem('vault_session_key', b64);
      } catch {}
    }
  }

  public async tryRestoreSession(): Promise<boolean> {
    if (this.isUnlocked) return true;
    try {
      const isSession = sessionStorage.getItem('vault_session_unlocked') === 'true';
      const keyBase64 = sessionStorage.getItem('vault_session_key');
      if (isSession && keyBase64) {
        const rawKey = base64ToBuffer(keyBase64);
        const restored = await vaultCrypto.restoreSessionMasterKey(rawKey);
        if (restored) {
          this.isUnlocked = true;
          if (vaultStorageNative.isNative()) {
            await vaultStorageNative.setSessionKey(keyBase64);
          }
          await this.loadItemsFromStore();
          this.notify();
          return true;
        }
      }
    } catch {}
    return false;
  }

  public async createPassword(password: string, recoveryQ: string, recoveryA: string): Promise<boolean> {
    try {
      const setup = await vaultCrypto.setupNewVault(password, recoveryA);
      const envelope: VaultEnvelopeMetadata = {
        ...setup,
        recoveryQ: recoveryQ.trim(),
      };
      this.saveEnvelope(envelope);
      this.isUnlocked = true;
      await this.syncSessionKeyToNative();
      await this.loadItemsFromStore();
      this.notify();
      return true;
    } catch (e) {
      console.error('Failed to create password:', e);
      return false;
    }
  }

  public async verifyPassword(password: string): Promise<boolean> {
    const env = this.getEnvelope();
    if (!env) return false;

    try {
      const success = await vaultCrypto.unlockVaultWithPassword(
        password,
        env.saltHex,
        env.wrappedMasterKeyBase64,
        env.wrappedIvHex,
        env.verifierCipherHex,
        env.verifierIvHex
      );

      if (success) {
        this.isUnlocked = true;
        await this.syncSessionKeyToNative();
        await this.loadItemsFromStore();
        this.notify();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  public async verifyRecovery(recoveryA: string): Promise<boolean> {
    const env = this.getEnvelope();
    if (!env) return false;

    try {
      const success = await vaultCrypto.unlockWithRecovery(
        recoveryA,
        env.recoverySaltHex,
        env.recoveryWrappedMasterKeyBase64,
        env.recoveryWrappedIvHex
      );
      return success;
    } catch {
      return false;
    }
  }

  public async resetPasswordWithRecovery(recoveryA: string, newPass: string): Promise<boolean> {
    const env = this.getEnvelope();
    if (!env) return false;

    try {
      const verified = await this.verifyRecovery(recoveryA);
      if (!verified) return false;

      const newWrapped = await vaultCrypto.changePassword(newPass);
      if (!newWrapped) return false;

      const updatedEnv: VaultEnvelopeMetadata = {
        ...env,
        ...newWrapped,
      };
      this.saveEnvelope(updatedEnv);
      this.isUnlocked = true;
      await this.syncSessionKeyToNative();
      await this.loadItemsFromStore();
      this.notify();
      return true;
    } catch {
      return false;
    }
  }

  public async changePassword(oldPass: string, newPass: string): Promise<boolean> {
    const valid = await this.verifyPassword(oldPass);
    if (!valid) return false;

    const env = this.getEnvelope();
    if (!env) return false;

    try {
      const newWrapped = await vaultCrypto.changePassword(newPass);
      if (!newWrapped) return false;

      const updatedEnv: VaultEnvelopeMetadata = {
        ...env,
        ...newWrapped,
      };
      this.saveEnvelope(updatedEnv);
      this.isUnlocked = true;
      await this.syncSessionKeyToNative();
      this.notify();
      return true;
    } catch {
      return false;
    }
  }

  public getUnlockedStatus(): boolean {
    return this.isUnlocked && vaultCrypto.isUnlocked();
  }

  public lockVault() {
    this.isUnlocked = false;
    vaultCrypto.lock();
    try {
      sessionStorage.removeItem('vault_session_unlocked');
      sessionStorage.removeItem('vault_session_key');
      sessionStorage.removeItem('vault_is_open');
    } catch {}

    // Revoke all in-memory decrypted Blob URLs to free RAM and ensure privacy
    this.blobUrlCache.forEach((url) => {
      try {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      } catch {}
    });
    this.blobUrlCache.clear();
    this.cachedItems = [];
    vaultStorageNative.clearSessionKey();
    vaultStorageNative.cleanupTemp();
    this.notify();
  }

  public subscribe(cb: (unlocked: boolean) => void) {
    this.subscribers.add(cb);
    cb(this.getUnlockedStatus());
    return () => {
      this.subscribers.delete(cb);
    };
  }

  private notify() {
    const status = this.getUnlockedStatus();
    for (const cb of this.subscribers) {
      cb(status);
    }
  }

  // -------------------------------------------------------------------------
  // FOLDERS MANAGEMENT
  // -------------------------------------------------------------------------
  public getFolders(): VaultFolder[] {
    if (!this.getUnlockedStatus()) return [];
    try {
      const raw = localStorage.getItem(VAULT_FOLDERS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(f => f && f.id && f.name);
    } catch {
      return [];
    }
  }

  public createFolder(name: string): VaultFolder | null {
    if (!this.getUnlockedStatus() || !name.trim()) return null;
    try {
      const folders = this.getFolders();
      const newFolder: VaultFolder = {
        id: 'folder-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
        name: name.trim(),
        createdAt: Date.now(),
      };
      folders.push(newFolder);
      localStorage.setItem(VAULT_FOLDERS_KEY, JSON.stringify(folders));
      return newFolder;
    } catch {
      return null;
    }
  }

  public renameFolder(folderId: string, newName: string): boolean {
    if (!this.getUnlockedStatus() || !newName.trim()) return false;
    try {
      const folders = this.getFolders();
      const folder = folders.find(f => f.id === folderId);
      if (!folder) return false;
      folder.name = newName.trim();
      localStorage.setItem(VAULT_FOLDERS_KEY, JSON.stringify(folders));
      return true;
    } catch {
      return false;
    }
  }

  public deleteFolder(folderId: string): boolean {
    if (!this.getUnlockedStatus()) return false;
    try {
      let folders = this.getFolders();
      folders = folders.filter(f => f.id !== folderId);
      localStorage.setItem(VAULT_FOLDERS_KEY, JSON.stringify(folders));

      this.cachedItems = this.cachedItems.map(item => {
        if (item.folderId === folderId) {
          const updated = { ...item, folderId: undefined };
          idbSaveItem(updated);
          return updated;
        }
        return item;
      });
      return true;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // VAULT ITEMS & ENCRYPTION PIPELINE
  // -------------------------------------------------------------------------
  private async loadItemsFromStore(): Promise<VaultItem[]> {
    if (!this.getUnlockedStatus()) {
      this.cachedItems = [];
      return [];
    }

    let items = await idbGetAllItems();

    // Check secondary native manifest for guaranteed persistence across app restart / clear cache
    if (vaultStorageNative.isNative()) {
      try {
        const nativeManifest = await vaultStorageNative.loadManifest();
        if (nativeManifest.exists && nativeManifest.manifest) {
          const parsed = JSON.parse(nativeManifest.manifest);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const idbMap = new Map(items.map(i => [i.id, i]));
            let hasNew = false;
            for (const nItem of parsed) {
              if (nItem && nItem.id && !idbMap.has(nItem.id)) {
                idbMap.set(nItem.id, nItem);
                await idbSaveItem(nItem);
                hasNew = true;
              }
            }
            if (hasNew) {
              items = Array.from(idbMap.values());
            }
          }
        }
      } catch (err) {
        console.warn('Native manifest sync error:', err);
      }
    }

    this.cachedItems = items.sort((a, b) => b.dateAdded - a.dateAdded);

    // Backup to native manifest
    if (vaultStorageNative.isNative() && this.cachedItems.length > 0) {
      try {
        const toSave = this.cachedItems.map(({ dataUrl, ...rest }) => rest);
        await vaultStorageNative.saveManifest(JSON.stringify(toSave));
      } catch {}
    }

    return this.cachedItems;
  }

  public getVaultItems(): VaultItem[] {
    if (!this.getUnlockedStatus()) return [];
    return this.cachedItems;
  }

  /**
   * Registers items that were imported and encrypted natively on Android.
   */
  public async registerNativeImportedItems(
    pickedItems: PickedMediaResultItem[],
    folderId?: string
  ): Promise<boolean> {
    if (!this.getUnlockedStatus() || !pickedItems || pickedItems.length === 0) return false;

    try {
      const newItems: VaultItem[] = [];

      for (const item of pickedItems) {
        const vaultItem: VaultItem = {
          id: item.id,
          folderId,
          type: item.type,
          mimeType: item.mimeType,
          name: item.name,
          dateAdded: item.dateAdded || Date.now(),
          size: item.size,
          encryptedPath: item.encryptedPath,
          dataUrl: item.thumbnailUrl, // Use instant thumbnail for grid display
        };

        if (item.thumbnailUrl) {
          this.blobUrlCache.set(item.id, item.thumbnailUrl);
        }

        await idbSaveItem(vaultItem);
        newItems.push(vaultItem);
      }

      this.cachedItems = [...newItems, ...this.cachedItems];

      // Backup manifest to native storage
      if (vaultStorageNative.isNative()) {
        const toSave = this.cachedItems.map(({ dataUrl, ...rest }) => rest);
        await vaultStorageNative.saveManifest(JSON.stringify(toSave));
      }

      this.notify();
      return true;
    } catch (err) {
      console.error('Failed to register native imported items:', err);
      return false;
    }
  }

  /**
   * Retrieves or generates an in-memory decrypted Blob URL or stream URL for full-screen viewing/playback.
   */
  public async ensureDecryptedDataUrl(item: VaultItem): Promise<string> {
    if (this.blobUrlCache.has(item.id)) {
      const cached = this.blobUrlCache.get(item.id)!;
      item.dataUrl = cached;
      return cached;
    }

    try {
      if (vaultStorageNative.isNative()) {
        const decRes = await vaultStorageNative.readDecryptedMedia(item.id, item.encryptedPath);
        if (decRes.success) {
          if (decRes.isStream && decRes.streamUrl) {
            this.blobUrlCache.set(item.id, decRes.streamUrl);
            item.dataUrl = decRes.streamUrl;
            return decRes.streamUrl;
          } else if (decRes.base64Data) {
            const raw = base64ToBuffer(decRes.base64Data);
            const mime = item.mimeType || (item.type === 'video' ? 'video/mp4' : 'image/jpeg');
            const blob = new Blob([raw.buffer as ArrayBuffer], { type: mime });
            const blobUrl = URL.createObjectURL(blob);
            this.blobUrlCache.set(item.id, blobUrl);
            item.dataUrl = blobUrl;
            return blobUrl;
          }
        }
      }

      // Web Fallback:
      if (item.encryptedBlobBase64) {
        const encryptedBytes = base64ToBuffer(item.encryptedBlobBase64);
        const decryptedBytes = await vaultCrypto.decryptMediaBytes(encryptedBytes);
        const mime = item.mimeType || (item.type === 'video' ? 'video/mp4' : 'image/jpeg');
        const blob = new Blob([decryptedBytes.buffer as ArrayBuffer], { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        this.blobUrlCache.set(item.id, blobUrl);
        item.dataUrl = blobUrl;
        return blobUrl;
      }

      return item.dataUrl || '';
    } catch (e) {
      console.warn('Decryption failed for item:', item.id, e);
      return item.dataUrl || '';
    }
  }

  /**
   * Encrypts and adds a new item to the Vault (used for web fallback).
   */
  public async addVaultItem(options: {
    folderId?: string;
    type: 'image' | 'video' | 'file';
    mimeType?: string;
    name: string;
    rawBytes?: Uint8Array;
    base64Data?: string;
  }): Promise<boolean> {
    if (!this.getUnlockedStatus()) return false;

    try {
      let plainBytes: Uint8Array;
      if (options.rawBytes) {
        plainBytes = options.rawBytes;
      } else if (options.base64Data) {
        let b64 = options.base64Data;
        const comma = b64.indexOf(',');
        if (comma !== -1) {
          b64 = b64.substring(comma + 1);
        }
        plainBytes = base64ToBuffer(b64);
      } else {
        return false;
      }

      if (plainBytes.length === 0) return false;

      // 1. Encrypt with AES-256-GCM
      const encryptedBytes = await vaultCrypto.encryptMediaBytes(plainBytes);
      const base64Encrypted = bufferToBase64(encryptedBytes);

      const itemId = 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      let encryptedPath: string | undefined;

      // 2. Create in-memory decrypted Blob URL for instant rendering
      const mime = options.mimeType || (options.type === 'video' ? 'video/mp4' : 'image/jpeg');
      const blob = new Blob([plainBytes.buffer as ArrayBuffer], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      this.blobUrlCache.set(itemId, blobUrl);

      // 3. Save metadata to IndexedDB
      const newItem: VaultItem = {
        id: itemId,
        folderId: options.folderId,
        type: options.type,
        mimeType: mime,
        name: options.name,
        dateAdded: Date.now(),
        size: plainBytes.length,
        encryptedPath,
        encryptedBlobBase64: base64Encrypted,
        dataUrl: blobUrl,
      };

      await idbSaveItem(newItem);
      this.cachedItems.unshift(newItem);

      // 4. Backup to native manifest if on native
      if (vaultStorageNative.isNative()) {
        const toSave = this.cachedItems.map(({ dataUrl, ...rest }) => rest);
        await vaultStorageNative.saveManifest(JSON.stringify(toSave));
      }

      this.notify();
      return true;
    } catch (err) {
      console.error('Failed to encrypt & add vault item:', err);
      return false;
    }
  }

  public async deleteVaultItem(id: string): Promise<boolean> {
    if (!this.getUnlockedStatus()) return false;
    try {
      const item = this.cachedItems.find(i => i.id === id);
      if (item) {
        if (this.blobUrlCache.has(id)) {
          URL.revokeObjectURL(this.blobUrlCache.get(id)!);
          this.blobUrlCache.delete(id);
        }
        await vaultStorageNative.deleteEncryptedFile(item.id, item.encryptedPath);
      }
      this.cachedItems = this.cachedItems.filter(i => i.id !== id);
      await idbDeleteItem(id);
      if (vaultStorageNative.isNative()) {
        const toSave = this.cachedItems.map(({ dataUrl, ...rest }) => rest);
        await vaultStorageNative.saveManifest(JSON.stringify(toSave));
      }
      this.notify();
      return true;
    } catch {
      return false;
    }
  }

  public async deleteVaultItemsBatch(ids: string[]): Promise<boolean> {
    if (!this.getUnlockedStatus() || !Array.isArray(ids)) return false;
    try {
      const pathsToDelete: string[] = [];
      ids.forEach(id => {
        if (this.blobUrlCache.has(id)) {
          URL.revokeObjectURL(this.blobUrlCache.get(id)!);
          this.blobUrlCache.delete(id);
        }
        const item = this.cachedItems.find(i => i.id === id);
        if (item?.encryptedPath) {
          pathsToDelete.push(item.encryptedPath);
        }
      });

      if (pathsToDelete.length > 0) {
        await vaultStorageNative.deleteEncryptedFilesBatch(pathsToDelete);
      }

      this.cachedItems = this.cachedItems.filter(i => !ids.includes(i.id));
      await idbDeleteItemsBatch(ids);
      if (vaultStorageNative.isNative()) {
        const toSave = this.cachedItems.map(({ dataUrl, ...rest }) => rest);
        await vaultStorageNative.saveManifest(JSON.stringify(toSave));
      }
      this.notify();
      return true;
    } catch {
      return false;
    }
  }

  public moveItemsToFolder(ids: string[], targetFolderId?: string): boolean {
    if (!this.getUnlockedStatus() || !Array.isArray(ids)) return false;
    try {
      this.cachedItems = this.cachedItems.map(item => {
        if (ids.includes(item.id)) {
          const updated = { ...item, folderId: targetFolderId };
          idbSaveItem(updated);
          return updated;
        }
        return item;
      });
      return true;
    } catch {
      return false;
    }
  }

  public async copyItemsToFolder(ids: string[], targetFolderId?: string): Promise<boolean> {
    if (!this.getUnlockedStatus() || !Array.isArray(ids)) return false;
    try {
      const newCopies: VaultItem[] = [];
      for (const item of this.cachedItems) {
        if (ids.includes(item.id)) {
          const newId = 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          let newEncryptedPath: string | undefined;

          // Read encrypted bytes
          let encryptedBase64 = item.encryptedBlobBase64;
          if (vaultStorageNative.isNative()) {
            encryptedBase64 = await vaultStorageNative.readEncryptedFile(item.id, item.encryptedPath);
            if (encryptedBase64) {
              const res = await vaultStorageNative.writeEncryptedFile(newId, encryptedBase64);
              newEncryptedPath = res.filePath;
            }
          }

          const existingBlobUrl = this.blobUrlCache.get(item.id);
          if (existingBlobUrl) {
            this.blobUrlCache.set(newId, existingBlobUrl);
          }

          const copyItem: VaultItem = {
            ...item,
            id: newId,
            folderId: targetFolderId,
            dateAdded: Date.now(),
            name: item.name.includes('(Copy)') ? item.name : `${item.name} (Copy)`,
            encryptedPath: newEncryptedPath,
            encryptedBlobBase64: vaultStorageNative.isNative() ? undefined : encryptedBase64,
            dataUrl: existingBlobUrl || item.dataUrl,
          };

          newCopies.push(copyItem);
          await idbSaveItem(copyItem);
        }
      }
      this.cachedItems = [...newCopies, ...this.cachedItems];
      return true;
    } catch {
      return false;
    }
  }

  public renameVaultItem(id: string, newName: string): boolean {
    if (!this.getUnlockedStatus() || !newName.trim()) return false;
    try {
      const item = this.cachedItems.find(i => i.id === id);
      if (!item) return false;
      item.name = newName.trim();
      idbSaveItem(item);
      return true;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // BACKUP & RESTORE
  // -------------------------------------------------------------------------
  public async exportBackup(currentPass: string): Promise<string | null> {
    const valid = await this.verifyPassword(currentPass);
    if (!valid) return null;

    const env = this.getEnvelope();
    const folders = this.getFolders();
    const items = await idbGetAllItems();

    // Embed encrypted base64 payload for every item
    const backupItems: VaultItem[] = [];
    for (const item of items) {
      let b64 = item.encryptedBlobBase64;
      if (!b64 && vaultStorageNative.isNative()) {
        b64 = await vaultStorageNative.readEncryptedFile(item.id, item.encryptedPath);
      }
      backupItems.push({
        ...item,
        encryptedBlobBase64: b64,
      });
    }

    const payload = {
      version: 4,
      createdAt: Date.now(),
      envelope: env,
      folders,
      items: backupItems,
    };

    return JSON.stringify(payload);
  }

  public async restoreBackup(backupJsonString: string, currentPass: string): Promise<boolean> {
    try {
      const parsed = JSON.parse(backupJsonString);
      if (!parsed || !parsed.envelope || !Array.isArray(parsed.items)) {
        return false;
      }

      const env = parsed.envelope;
      const valid = await vaultCrypto.unlockVaultWithPassword(
        currentPass,
        env.saltHex,
        env.wrappedMasterKeyBase64,
        env.wrappedIvHex,
        env.verifierCipherHex,
        env.verifierIvHex
      );

      if (!valid) return false;

      this.saveEnvelope(env);
      if (parsed.folders && Array.isArray(parsed.folders)) {
        localStorage.setItem(VAULT_FOLDERS_KEY, JSON.stringify(parsed.folders));
      }

      // Restore items
      for (const item of parsed.items) {
        if (item && item.id && item.encryptedBlobBase64) {
          if (vaultStorageNative.isNative()) {
            const res = await vaultStorageNative.writeEncryptedFile(item.id, item.encryptedBlobBase64);
            item.encryptedPath = res.filePath;
          }
          await idbSaveItem(item);
        }
      }

      this.isUnlocked = true;
      await this.loadItemsFromStore();
      this.notify();
      return true;
    } catch {
      return false;
    }
  }
}

export const vaultService = new VaultService();
