/**
 * Vault Cryptographic Engine
 * 
 * Uses Web Crypto API (SubtleCrypto):
 * - AES-256-GCM authenticated encryption (with 12-byte unique IV per operation)
 * - PBKDF2-SHA256 key derivation (100,000 iterations + 16-byte cryptographically secure salt)
 * - Envelope Encryption: Master Key (256-bit) wrapped with password-derived Key Encryption Key (KEK)
 * - Zero hardcoded keys or passwords
 * - Instant and safe password change without re-encrypting media files
 * - Fast in-memory encryption & decryption for photos and videos
 */

const PBKDF2_ITERATIONS = 100000;
const AUTH_VERIFIER_STRING = 'OUR_LITTLE_STORY_VAULT_AUTHENTICATION_TOKEN_V1';

// Convert ArrayBuffer to Base64
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Base64 to Uint8Array
export function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Convert hex to Uint8Array
export function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

// Convert Uint8Array to hex
export function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export class VaultCryptoEngine {
  // In-memory decrypted Master Key CryptoKey object
  private activeMasterKey: CryptoKey | null = null;
  private rawMasterKeyBytes: Uint8Array | null = null;

  /**
   * Generates a new 256-bit random Vault Master Key
   */
  public async generateMasterKey(): Promise<{ key: CryptoKey; raw: Uint8Array }> {
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const key = await crypto.subtle.importKey(
      'raw',
      raw.buffer as ArrayBuffer,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    return { key, raw };
  }

  /**
   * Derives a 256-bit AES-GCM Key Encryption Key (KEK) from a password using PBKDF2
   */
  public async deriveKekFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordBytes = encoder.encode(password);

    const baseKey = await crypto.subtle.importKey(
      'raw',
      passwordBytes.buffer as ArrayBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt.buffer as ArrayBuffer,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Initializes a brand new Vault password setup.
   * Generates a new Master Key, encrypts it with password KEK and recovery KEK.
   */
  public async setupNewVault(
    password: string,
    recoveryAnswer: string
  ): Promise<{
    saltHex: string;
    wrappedMasterKeyBase64: string;
    wrappedIvHex: string;
    verifierCipherHex: string;
    verifierIvHex: string;
    recoverySaltHex: string;
    recoveryWrappedMasterKeyBase64: string;
    recoveryWrappedIvHex: string;
  }> {
    // 1. Generate Master Key
    const { key: masterKey, raw: masterKeyBytes } = await this.generateMasterKey();
    this.activeMasterKey = masterKey;
    this.rawMasterKeyBytes = masterKeyBytes;

    // 2. Password Salt & KEK
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const kek = await this.deriveKekFromPassword(password, salt);

    // 3. Wrap (Encrypt) Master Key with Password KEK
    const wrapIv = crypto.getRandomValues(new Uint8Array(12));
    const wrappedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: wrapIv.buffer as ArrayBuffer },
      kek,
      masterKeyBytes.buffer as ArrayBuffer
    );

    // 4. Create Authentication Verifier
    const verifierIv = crypto.getRandomValues(new Uint8Array(12));
    const verifierBytes = new TextEncoder().encode(AUTH_VERIFIER_STRING);
    const verifierBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: verifierIv.buffer as ArrayBuffer },
      kek,
      verifierBytes.buffer as ArrayBuffer
    );

    // 5. Recovery Setup
    const recoverySalt = crypto.getRandomValues(new Uint8Array(16));
    const recoveryKek = await this.deriveKekFromPassword(recoveryAnswer.trim().toLowerCase(), recoverySalt);
    const recoveryWrapIv = crypto.getRandomValues(new Uint8Array(12));
    const recoveryWrappedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: recoveryWrapIv.buffer as ArrayBuffer },
      recoveryKek,
      masterKeyBytes.buffer as ArrayBuffer
    );

    return {
      saltHex: bufferToHex(salt),
      wrappedMasterKeyBase64: bufferToBase64(wrappedBuffer),
      wrappedIvHex: bufferToHex(wrapIv),
      verifierCipherHex: bufferToHex(verifierBuffer),
      verifierIvHex: bufferToHex(verifierIv),
      recoverySaltHex: bufferToHex(recoverySalt),
      recoveryWrappedMasterKeyBase64: bufferToBase64(recoveryWrappedBuffer),
      recoveryWrappedIvHex: bufferToHex(recoveryWrapIv),
    };
  }

  /**
   * Unlocks the Vault by deriving KEK and decrypting the Master Key into memory.
   */
  public async unlockVaultWithPassword(
    password: string,
    saltHex: string,
    wrappedMasterKeyBase64: string,
    wrappedIvHex: string,
    verifierCipherHex?: string,
    verifierIvHex?: string
  ): Promise<boolean> {
    try {
      const salt = hexToBuffer(saltHex);
      const wrapIv = hexToBuffer(wrappedIvHex);
      const wrappedBytes = base64ToBuffer(wrappedMasterKeyBase64);

      const kek = await this.deriveKekFromPassword(password, salt);

      // Verify token first if available
      if (verifierCipherHex && verifierIvHex) {
        try {
          const vIv = hexToBuffer(verifierIvHex);
          const vCipher = hexToBuffer(verifierCipherHex);
          const decryptedVerifier = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: vIv.buffer as ArrayBuffer },
            kek,
            vCipher.buffer as ArrayBuffer
          );
          const text = new TextDecoder().decode(decryptedVerifier);
          if (text !== AUTH_VERIFIER_STRING) {
            return false;
          }
        } catch {
          return false;
        }
      }

      // Decrypt Master Key bytes
      const decryptedMasterBytes = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: wrapIv.buffer as ArrayBuffer },
        kek,
        wrappedBytes.buffer as ArrayBuffer
      );

      const raw = new Uint8Array(decryptedMasterBytes);
      const masterKey = await crypto.subtle.importKey(
        'raw',
        raw.buffer as ArrayBuffer,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      this.activeMasterKey = masterKey;
      this.rawMasterKeyBytes = raw;
      return true;
    } catch (e) {
      console.warn('Unlock failed:', e);
      return false;
    }
  }

  /**
   * Unlocks the Vault using Recovery Answer
   */
  public async unlockWithRecovery(
    recoveryAnswer: string,
    recoverySaltHex: string,
    recoveryWrappedMasterKeyBase64: string,
    recoveryWrappedIvHex: string
  ): Promise<boolean> {
    try {
      const salt = hexToBuffer(recoverySaltHex);
      const wrapIv = hexToBuffer(recoveryWrappedIvHex);
      const wrappedBytes = base64ToBuffer(recoveryWrappedMasterKeyBase64);

      const recoveryKek = await this.deriveKekFromPassword(recoveryAnswer.trim().toLowerCase(), salt);

      const decryptedMasterBytes = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: wrapIv.buffer as ArrayBuffer },
        recoveryKek,
        wrappedBytes.buffer as ArrayBuffer
      );

      const raw = new Uint8Array(decryptedMasterBytes);
      const masterKey = await crypto.subtle.importKey(
        'raw',
        raw.buffer as ArrayBuffer,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      this.activeMasterKey = masterKey;
      this.rawMasterKeyBytes = raw;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Re-wraps the Master Key with a new password without altering any encrypted media.
   */
  public async changePassword(newPassword: string): Promise<{
    saltHex: string;
    wrappedMasterKeyBase64: string;
    wrappedIvHex: string;
    verifierCipherHex: string;
    verifierIvHex: string;
  } | null> {
    if (!this.rawMasterKeyBytes) {
      return null;
    }

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const kek = await this.deriveKekFromPassword(newPassword, salt);

    const wrapIv = crypto.getRandomValues(new Uint8Array(12));
    const wrappedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: wrapIv.buffer as ArrayBuffer },
      kek,
      this.rawMasterKeyBytes.buffer as ArrayBuffer
    );

    const verifierIv = crypto.getRandomValues(new Uint8Array(12));
    const verifierBytes = new TextEncoder().encode(AUTH_VERIFIER_STRING);
    const verifierBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: verifierIv.buffer as ArrayBuffer },
      kek,
      verifierBytes.buffer as ArrayBuffer
    );

    return {
      saltHex: bufferToHex(salt),
      wrappedMasterKeyBase64: bufferToBase64(wrappedBuffer),
      wrappedIvHex: bufferToHex(wrapIv),
      verifierCipherHex: bufferToHex(verifierBuffer),
      verifierIvHex: bufferToHex(verifierIv),
    };
  }

  /**
   * Encrypts raw media bytes using AES-256-GCM.
   * Returns: [12-byte IV] concatenated with [Ciphertext + 16-byte Auth Tag]
   */
  public async encryptMediaBytes(plainBytes: Uint8Array): Promise<Uint8Array> {
    if (!this.activeMasterKey) {
      throw new Error('Vault is locked. Cannot encrypt media.');
    }

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      this.activeMasterKey,
      plainBytes.buffer as ArrayBuffer
    );

    const encryptedBytes = new Uint8Array(encryptedBuffer);
    const combined = new Uint8Array(iv.length + encryptedBytes.length);
    combined.set(iv, 0);
    combined.set(encryptedBytes, iv.length);

    return combined;
  }

  /**
   * Decrypts media bytes [12-byte IV + Ciphertext] into plaintext bytes using AES-256-GCM.
   */
  public async decryptMediaBytes(encryptedCombinedBytes: Uint8Array): Promise<Uint8Array> {
    if (!this.activeMasterKey) {
      throw new Error('Vault is locked. Cannot decrypt media.');
    }

    if (encryptedCombinedBytes.length < 28) { // 12-byte IV + min 16-byte tag
      throw new Error('Encrypted file format corrupted or too small.');
    }

    const iv = encryptedCombinedBytes.slice(0, 12);
    const ciphertext = encryptedCombinedBytes.slice(12);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      this.activeMasterKey,
      ciphertext.buffer as ArrayBuffer
    );

    return new Uint8Array(decryptedBuffer);
  }

  /**
   * Locks the engine and securely cleans up raw master key bytes from memory.
   */
  public lock() {
    this.activeMasterKey = null;
    if (this.rawMasterKeyBytes) {
      this.rawMasterKeyBytes.fill(0);
      this.rawMasterKeyBytes = null;
    }
  }

  public isUnlocked(): boolean {
    return this.activeMasterKey !== null;
  }

  public getRawMasterKeyBytes(): Uint8Array | null {
    return this.rawMasterKeyBytes;
  }

  public async restoreSessionMasterKey(raw: Uint8Array): Promise<boolean> {
    try {
      const masterKey = await crypto.subtle.importKey(
        'raw',
        raw.buffer as ArrayBuffer,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      this.activeMasterKey = masterKey;
      this.rawMasterKeyBytes = new Uint8Array(raw);
      return true;
    } catch {
      return false;
    }
  }
}

export const vaultCrypto = new VaultCryptoEngine();
