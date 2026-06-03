/**
 * @module CryptoManager
 * @description TypeScript interface for the native cryptography module.
 *
 * In production this bridges to platform-specific crypto implementations
 * (Android Keystore / iOS Secure Enclave). During development a mock
 * implementation is provided that uses deterministic stand-ins.
 */

import { NativeModules, Platform } from 'react-native';

declare const btoa: any;
declare const Buffer: any;

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/** Result of an AES-256-GCM encryption operation. */
export interface AesGcmEncryptResult {
  /** Base-64 encoded ciphertext */
  ciphertext: string;
  /** Base-64 encoded 12-byte initialisation vector */
  iv: string;
  /** Base-64 encoded 16-byte authentication tag */
  tag: string;
}

/** Input for an AES-256-GCM decryption operation. */
export interface AesGcmDecryptInput {
  /** Base-64 encoded ciphertext */
  ciphertext: string;
  /** Base-64 encoded IV used during encryption */
  iv: string;
  /** Base-64 encoded auth tag produced during encryption */
  tag: string;
}

/** Native module bridge interface. */
interface ICryptoManagerNative {
  /**
   * Generate cryptographically secure random bytes.
   * @param length - Number of bytes
   * @returns Base-64 encoded random bytes
   */
  generateSecureRandom(length: number): Promise<string>;

  /**
   * Encrypt plaintext with AES-256-GCM.
   * @param plaintext - Base-64 encoded plaintext
   * @param key - Base-64 encoded 256-bit key
   * @param aad - Optional additional authenticated data (Base-64)
   */
  aesGcmEncrypt(
    plaintext: string,
    key: string,
    aad?: string,
  ): Promise<AesGcmEncryptResult>;

  /**
   * Decrypt ciphertext with AES-256-GCM.
   * @param input - Ciphertext + IV + tag bundle
   * @param key - Base-64 encoded 256-bit key
   * @param aad - Optional additional authenticated data (Base-64)
   * @returns Base-64 encoded plaintext
   */
  aesGcmDecrypt(
    input: AesGcmDecryptInput,
    key: string,
    aad?: string,
  ): Promise<string>;

  /**
   * Compute SHA-256 hash of the input.
   * @param data - Base-64 encoded input data
   * @returns Hex-encoded SHA-256 digest
   */
  sha256(data: string): Promise<string>;
}

// ─────────────────────────────────────────────────────────────
// Mock Implementation (development only)
// ─────────────────────────────────────────────────────────────

/**
 * Mock crypto manager for development and testing.
 * **NOT SECURE** — uses simple Base-64 round-tripping instead of real crypto.
 */
class MockCryptoManager implements ICryptoManagerNative {
  async generateSecureRandom(length: number): Promise<string> {
    // Produce pseudo-random bytes and Base-64 encode
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    return this.uint8ToBase64(bytes);
  }

  async aesGcmEncrypt(
    plaintext: string,
    _key: string,
    _aad?: string,
  ): Promise<AesGcmEncryptResult> {
    // Mock: ciphertext = plaintext (no real encryption)
    const ivBytes = new Uint8Array(12);
    for (let i = 0; i < 12; i++) {
      ivBytes[i] = Math.floor(Math.random() * 256);
    }

    const tagBytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      tagBytes[i] = Math.floor(Math.random() * 256);
    }

    return {
      ciphertext: plaintext, // passthrough in mock
      iv: this.uint8ToBase64(ivBytes),
      tag: this.uint8ToBase64(tagBytes),
    };
  }

  async aesGcmDecrypt(
    input: AesGcmDecryptInput,
    _key: string,
    _aad?: string,
  ): Promise<string> {
    // Mock: return ciphertext as-is
    return input.ciphertext;
  }

  async sha256(data: string): Promise<string> {
    // Simple non-cryptographic hash for mock purposes
    let hash = 0;
    const str = data;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }

  private uint8ToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    // In React Native global.btoa is available; fallback for tests
    if (typeof btoa !== 'undefined') {
      return btoa(binary);
    }
    return Buffer.from(binary, 'binary').toString('base64');
  }
}

// ─────────────────────────────────────────────────────────────
// Module Resolution
// ─────────────────────────────────────────────────────────────

/**
 * Resolve the crypto manager — use the native module when available,
 * otherwise fall back to the mock implementation.
 */
function resolveCryptoManager(): ICryptoManagerNative {
  try {
    const native = NativeModules.CryptoManager as ICryptoManagerNative | undefined;
    if (native && typeof native.aesGcmEncrypt === 'function') {
      console.log('[CryptoManager] Using native module');
      return native;
    }
  } catch {
    // Native module not linked — expected during development
  }
  console.warn('[CryptoManager] Native module unavailable — using MOCK (not secure)');
  return new MockCryptoManager();
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

const cryptoManager = resolveCryptoManager();

/**
 * Generate cryptographically secure random bytes.
 * @param length - Number of random bytes to generate
 * @returns Base-64 encoded random bytes
 */
export async function generateSecureRandom(length: number): Promise<string> {
  return cryptoManager.generateSecureRandom(length);
}

/**
 * Encrypt data using AES-256-GCM.
 * @param plaintext - Base-64 encoded plaintext
 * @param key - Base-64 encoded 256-bit key
 * @param aad - Optional additional authenticated data
 * @returns Ciphertext, IV, and authentication tag
 */
export async function aesGcmEncrypt(
  plaintext: string,
  key: string,
  aad?: string,
): Promise<AesGcmEncryptResult> {
  return cryptoManager.aesGcmEncrypt(plaintext, key, aad);
}

/**
 * Decrypt data using AES-256-GCM.
 * @param input - Ciphertext + IV + tag bundle
 * @param key - Base-64 encoded 256-bit key
 * @param aad - Optional additional authenticated data
 * @returns Base-64 encoded plaintext
 */
export async function aesGcmDecrypt(
  input: AesGcmDecryptInput,
  key: string,
  aad?: string,
): Promise<string> {
  return cryptoManager.aesGcmDecrypt(input, key, aad);
}

/**
 * Compute SHA-256 hash.
 * @param data - Base-64 encoded input
 * @returns Hex-encoded SHA-256 digest
 */
export async function sha256(data: string): Promise<string> {
  return cryptoManager.sha256(data);
}

export type { ICryptoManagerNative };
export default cryptoManager;
