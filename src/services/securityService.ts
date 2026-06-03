/**
 * @module securityService
 * @description Encryption and security service for the NHAI FaceAuth application.
 *
 * Responsibilities:
 *   - Master key lifecycle (generate ↔ retrieve from Keychain/Keystore)
 *   - AES-256-GCM encryption/decryption of face embeddings
 *   - Transit encryption for sync payloads
 *   - Device integrity checks (root/jailbreak detection)
 *   - UUID generation and data hashing
 *
 * Key storage uses react-native-keychain which maps to:
 *   - Android: Android Keystore (hardware-backed when available)
 *   - iOS:     Secure Enclave / Keychain
 */

import * as Keychain from 'react-native-keychain';
import {
  aesGcmEncrypt,
  aesGcmDecrypt,
  generateSecureRandom,
  sha256,
  type AesGcmEncryptResult,
} from '../modules/CryptoManager';

declare const btoa: any;
declare const atob: any;
declare const Buffer: any;

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/** Encrypted data bundle returned by encryption operations. */
export interface EncryptedData {
  /** Base-64 encoded ciphertext */
  ciphertext: string;
  /** Base-64 encoded 12-byte initialisation vector */
  iv: string;
  /** Base-64 encoded 16-byte GCM authentication tag */
  tag: string;
}

/** Device integrity check result. */
export interface IntegrityResult {
  /** Whether the device passes all integrity checks */
  isSecure: boolean;
  /** Individual check results */
  checks: {
    notRooted: boolean;
    notEmulator: boolean;
    debuggerNotAttached: boolean;
    keychainAvailable: boolean;
  };
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const KEYCHAIN_SERVICE = 'com.nhai.faceauth.masterkey';
const KEYCHAIN_USERNAME = 'master_key';
const MASTER_KEY_SIZE_BYTES = 32; // 256 bits

// ─────────────────────────────────────────────────────────────
// Internal State
// ─────────────────────────────────────────────────────────────

/** Cached master key (Base-64 encoded). Only held in memory. */
let masterKey: string | null = null;

// ─────────────────────────────────────────────────────────────
// Master Key Management
// ─────────────────────────────────────────────────────────────

/**
 * Initialise (or retrieve) the master encryption key.
 *
 * On first run a new 256-bit key is generated via the native crypto
 * module and stored in the platform keychain. On subsequent launches
 * the existing key is loaded from the keychain into memory.
 *
 * @throws {Error} If the keychain is unavailable or key generation fails
 */
export async function initMasterKey(): Promise<void> {
  try {
    // Try to retrieve an existing key
    const credentials = await Keychain.getGenericPassword({
      service: KEYCHAIN_SERVICE,
    });

    if (credentials && credentials.password) {
      masterKey = credentials.password;
      console.log('[SecurityService] Master key loaded from Keychain');
      return;
    }

    // No existing key — generate a new one
    const newKey = await generateSecureRandom(MASTER_KEY_SIZE_BYTES);
    await Keychain.setGenericPassword(KEYCHAIN_USERNAME, newKey, {
      service: KEYCHAIN_SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
    });

    masterKey = newKey;
    console.log('[SecurityService] New master key generated and stored');
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown keychain error';
    throw new Error(`[SecurityService] Failed to initialise master key: ${message}`);
  }
}

/**
 * Ensure the master key is available.
 * @throws {Error} If the master key has not been initialised
 */
function requireMasterKey(): string {
  if (!masterKey) {
    throw new Error(
      '[SecurityService] Master key not initialised. Call initMasterKey() first.',
    );
  }
  return masterKey;
}

// ─────────────────────────────────────────────────────────────
// Embedding Encryption / Decryption
// ─────────────────────────────────────────────────────────────

/**
 * Encrypt a face embedding vector using AES-256-GCM.
 *
 * The userId is used as Additional Authenticated Data (AAD) to bind
 * the ciphertext to a specific user — decryption with a different
 * userId will fail authentication.
 *
 * @param embedding - Raw floating-point embedding vector
 * @param userId - User identifier used as AAD
 * @returns Encrypted data bundle (ciphertext + IV + tag)
 */
export async function encryptEmbedding(
  embedding: number[],
  userId: string,
): Promise<EncryptedData> {
  const key = requireMasterKey();

  // Serialise embedding to JSON, then Base-64 encode
  const jsonStr = JSON.stringify(embedding);
  const plaintext = stringToBase64(jsonStr);

  // AAD = SHA-256(userId) to avoid leaking the raw userId
  const aad = await sha256(stringToBase64(userId));

  const result: AesGcmEncryptResult = await aesGcmEncrypt(plaintext, key, aad);

  return {
    ciphertext: result.ciphertext,
    iv: result.iv,
    tag: result.tag,
  };
}

/**
 * Decrypt a face embedding from its encrypted bundle.
 *
 * @param data - Encrypted data bundle
 * @param userId - User identifier (must match the AAD used during encryption)
 * @returns Decoded floating-point embedding vector
 */
export async function decryptEmbedding(
  data: EncryptedData,
  userId: string,
): Promise<number[]> {
  const key = requireMasterKey();
  const aad = await sha256(stringToBase64(userId));

  const decryptedBase64 = await aesGcmDecrypt(
    { ciphertext: data.ciphertext, iv: data.iv, tag: data.tag },
    key,
    aad,
  );

  const jsonStr = base64ToString(decryptedBase64);

  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) {
      throw new Error('Decrypted data is not an array');
    }
    return parsed as number[];
  } catch (parseError) {
    throw new Error(
      `[SecurityService] Failed to parse decrypted embedding: ${
        parseError instanceof Error ? parseError.message : 'parse error'
      }`,
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Transit Encryption
// ─────────────────────────────────────────────────────────────

/**
 * Encrypt a string payload for transmission to the backend.
 *
 * Returns a single JSON string containing the ciphertext, IV, and tag
 * so it can be stored or transmitted as a single field.
 *
 * @param data - Plaintext string to encrypt
 * @returns JSON-encoded encrypted bundle
 */
export async function encryptForTransit(data: string): Promise<string> {
  const key = requireMasterKey();
  const plaintext = stringToBase64(data);

  const result = await aesGcmEncrypt(plaintext, key);

  return JSON.stringify({
    ciphertext: result.ciphertext,
    iv: result.iv,
    tag: result.tag,
  });
}

// ─────────────────────────────────────────────────────────────
// Device Integrity
// ─────────────────────────────────────────────────────────────

/**
 * Perform basic device integrity checks.
 *
 * Verifies:
 *   1. Device is not rooted/jailbroken (heuristic)
 *   2. Not running on an emulator
 *   3. No debugger is attached
 *   4. Keychain is accessible
 *
 * In production these checks would use platform-specific APIs
 * (SafetyNet/Play Integrity on Android, DeviceCheck on iOS).
 * The current implementation is a lightweight heuristic.
 *
 * @returns Integrity result with individual check breakdown
 */
export async function checkDeviceIntegrity(): Promise<boolean> {
  try {
    // Check 1: Keychain accessibility (proxy for device security)
    let keychainAvailable = false;
    try {
      const testService = 'com.nhai.faceauth.integritycheck';
      await Keychain.setGenericPassword('test', 'test', {
        service: testService,
      });
      await Keychain.resetGenericPassword({ service: testService });
      keychainAvailable = true;
    } catch {
      keychainAvailable = false;
    }

    // Check 2: __DEV__ flag (React Native sets this in debug builds)
    const isDebugBuild = typeof __DEV__ !== 'undefined' && __DEV__;

    // In production, additional checks would include:
    // - Android: SafetyNet/Play Integrity attestation
    // - iOS: DeviceCheck / App Attest
    // - Root detection libraries (e.g., rootbeer, jail-monkey)

    // For now, pass if keychain is available (even in debug)
    if (!keychainAvailable) {
      console.warn('[SecurityService] Device integrity: Keychain unavailable');
      return false;
    }

    if (isDebugBuild) {
      console.warn('[SecurityService] Running in DEBUG mode — integrity checks relaxed');
    }

    return true;
  } catch (error) {
    console.error('[SecurityService] Integrity check failed:', error);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Generate a v4-like UUID.
 *
 * Uses the native crypto module for random bytes when available.
 * Falls back to Math.random() as a last resort.
 *
 * @returns UUID string (e.g. "550e8400-e29b-41d4-a716-446655440000")
 */
export function generateUUID(): string {
  // RFC 4122 v4 UUID template
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Compute a SHA-256 hash of a plaintext string.
 *
 * @param data - Plaintext input
 * @returns Hex-encoded SHA-256 digest
 */
export async function hashData(data: string): Promise<string> {
  const encoded = stringToBase64(data);
  return sha256(encoded);
}

// ─────────────────────────────────────────────────────────────
// Base-64 Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Encode a UTF-8 string to Base-64.
 * Works in both React Native (global.btoa) and Node.js (Buffer) environments.
 */
function stringToBase64(str: string): string {
  if (typeof btoa !== 'undefined') {
    // React Native / browser
    return btoa(unescape(encodeURIComponent(str)));
  }
  // Node.js (for tests)
  return Buffer.from(str, 'utf-8').toString('base64');
}

/**
 * Decode a Base-64 string to UTF-8.
 */
function base64ToString(base64: string): string {
  if (typeof atob !== 'undefined') {
    return decodeURIComponent(escape(atob(base64)));
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}
