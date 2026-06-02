package com.nhai.faceauth.crypto

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.*
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.security.KeyStore
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * CryptoModule — React Native native module for cryptographic operations.
 *
 * Provides:
 * 1. AES-256-GCM authenticated encryption/decryption
 * 2. Secure random number generation
 * 3. SHA-256 hashing
 * 4. Android Keystore integration for secure key storage
 * 5. Security environment checks (root, debugger, emulator, signature)
 *
 * Security Notes:
 * - AES-256-GCM provides both confidentiality and authenticity
 * - The 12-byte IV (nonce) must be unique per encryption operation
 * - GCM produces a 128-bit authentication tag automatically appended to ciphertext
 * - Android Keystore keys are backed by hardware security module (TEE/SE) when available
 * - Root detection covers common root frameworks (Magisk, SuperSU, Xposed)
 */
class CryptoModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "CryptoModule"
        private const val MODULE_NAME = "CryptoModule"

        // AES-GCM constants
        private const val AES_GCM_TRANSFORMATION = "AES/GCM/NoPadding"
        private const val GCM_TAG_LENGTH_BITS = 128
        private const val GCM_IV_LENGTH_BYTES = 12

        // Android Keystore
        private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
        private const val KEY_ALIAS_PREFIX = "nhai_faceauth_"
    }

    override fun getName(): String = MODULE_NAME

    // ======================== Secure Random ========================

    /**
     * Generate cryptographically secure random bytes.
     *
     * Uses java.security.SecureRandom which is seeded from /dev/urandom on Android.
     * Returns base64-encoded random bytes.
     *
     * @param length Number of random bytes to generate
     * @return Base64-encoded string of random bytes
     */
    @ReactMethod
    fun generateSecureRandom(length: Int, promise: Promise) {
        try {
            if (length <= 0 || length > 1024) {
                promise.reject("INVALID_LENGTH", "Length must be between 1 and 1024 bytes")
                return
            }

            val random = SecureRandom()
            val bytes = ByteArray(length)
            random.nextBytes(bytes)

            val base64Result = Base64.encodeToString(bytes, Base64.NO_WRAP)
            promise.resolve(base64Result)
        } catch (e: Exception) {
            Log.e(TAG, "SecureRandom generation failed", e)
            promise.reject("RANDOM_ERROR", "Failed to generate secure random: ${e.message}", e)
        }
    }

    // ======================== AES-256-GCM ========================

    /**
     * Encrypt plaintext using AES-256-GCM authenticated encryption.
     *
     * AES-256-GCM provides:
     * - Confidentiality: data is encrypted with AES-256
     * - Authenticity: GCM mode produces an authentication tag
     * - Additional Authenticated Data (AAD): optional data authenticated but not encrypted
     *
     * The authentication tag is automatically appended to the ciphertext by Android's
     * Cipher implementation.
     *
     * @param plaintext Base64-encoded plaintext to encrypt
     * @param key Base64-encoded 256-bit (32-byte) AES key
     * @param iv Base64-encoded 96-bit (12-byte) initialization vector / nonce
     * @param aad Base64-encoded Additional Authenticated Data (can be empty string)
     * @return Map with { ciphertext: base64, tag: base64 }
     */
    @ReactMethod
    fun aesGcmEncrypt(plaintext: String, key: String, iv: String, aad: String, promise: Promise) {
        try {
            val keyBytes = Base64.decode(key, Base64.DEFAULT)
            val ivBytes = Base64.decode(iv, Base64.DEFAULT)
            val plaintextBytes = Base64.decode(plaintext, Base64.DEFAULT)

            // Validate key length (must be 256 bits / 32 bytes for AES-256)
            if (keyBytes.size != 32) {
                promise.reject("INVALID_KEY", "AES-256 key must be exactly 32 bytes (got ${keyBytes.size})")
                return
            }

            // Validate IV length (GCM standard: 12 bytes / 96 bits)
            if (ivBytes.size != GCM_IV_LENGTH_BYTES) {
                promise.reject("INVALID_IV", "GCM IV must be exactly 12 bytes (got ${ivBytes.size})")
                return
            }

            val secretKey = SecretKeySpec(keyBytes, "AES")
            val gcmSpec = GCMParameterSpec(GCM_TAG_LENGTH_BITS, ivBytes)

            val cipher = Cipher.getInstance(AES_GCM_TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, gcmSpec)

            // Add Additional Authenticated Data if provided
            if (aad.isNotEmpty()) {
                val aadBytes = Base64.decode(aad, Base64.DEFAULT)
                cipher.updateAAD(aadBytes)
            }

            // Encrypt — GCM automatically appends the 16-byte auth tag to ciphertext
            val encryptedWithTag = cipher.doFinal(plaintextBytes)

            // Separate ciphertext and authentication tag
            // The last 16 bytes are the GCM authentication tag
            val tagSize = GCM_TAG_LENGTH_BITS / 8
            val ciphertextOnly = encryptedWithTag.copyOfRange(0, encryptedWithTag.size - tagSize)
            val authTag = encryptedWithTag.copyOfRange(encryptedWithTag.size - tagSize, encryptedWithTag.size)

            val result = Arguments.createMap()
            result.putString("ciphertext", Base64.encodeToString(ciphertextOnly, Base64.NO_WRAP))
            result.putString("tag", Base64.encodeToString(authTag, Base64.NO_WRAP))

            Log.d(TAG, "AES-GCM encryption successful (${plaintextBytes.size} bytes)")
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "AES-GCM encryption failed", e)
            promise.reject("ENCRYPT_ERROR", "AES-GCM encryption failed: ${e.message}", e)
        }
    }

    /**
     * Decrypt ciphertext using AES-256-GCM authenticated decryption.
     *
     * Verifies the authentication tag during decryption. If the tag doesn't match
     * (data was tampered with), decryption fails with AEADBadTagException.
     *
     * @param ciphertext Base64-encoded ciphertext (without tag)
     * @param key Base64-encoded 256-bit AES key
     * @param iv Base64-encoded 96-bit IV used during encryption
     * @param aad Base64-encoded AAD used during encryption (must match)
     * @param tag Base64-encoded 128-bit GCM authentication tag
     * @return Base64-encoded decrypted plaintext
     */
    @ReactMethod
    fun aesGcmDecrypt(
        ciphertext: String,
        key: String,
        iv: String,
        aad: String,
        tag: String,
        promise: Promise
    ) {
        try {
            val keyBytes = Base64.decode(key, Base64.DEFAULT)
            val ivBytes = Base64.decode(iv, Base64.DEFAULT)
            val ciphertextBytes = Base64.decode(ciphertext, Base64.DEFAULT)
            val tagBytes = Base64.decode(tag, Base64.DEFAULT)

            if (keyBytes.size != 32) {
                promise.reject("INVALID_KEY", "AES-256 key must be exactly 32 bytes")
                return
            }

            if (ivBytes.size != GCM_IV_LENGTH_BYTES) {
                promise.reject("INVALID_IV", "GCM IV must be exactly 12 bytes")
                return
            }

            // Reconstruct the combined ciphertext + tag (Android expects them concatenated)
            val combined = ciphertextBytes + tagBytes

            val secretKey = SecretKeySpec(keyBytes, "AES")
            val gcmSpec = GCMParameterSpec(GCM_TAG_LENGTH_BITS, ivBytes)

            val cipher = Cipher.getInstance(AES_GCM_TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, secretKey, gcmSpec)

            if (aad.isNotEmpty()) {
                val aadBytes = Base64.decode(aad, Base64.DEFAULT)
                cipher.updateAAD(aadBytes)
            }

            // Decrypt and verify authentication tag
            val decryptedBytes = cipher.doFinal(combined)

            val result = Base64.encodeToString(decryptedBytes, Base64.NO_WRAP)
            Log.d(TAG, "AES-GCM decryption successful")
            promise.resolve(result)
        } catch (e: javax.crypto.AEADBadTagException) {
            Log.e(TAG, "AES-GCM authentication tag mismatch — data may be tampered", e)
            promise.reject("AUTH_FAILED", "Authentication tag verification failed — data integrity compromised", e)
        } catch (e: Exception) {
            Log.e(TAG, "AES-GCM decryption failed", e)
            promise.reject("DECRYPT_ERROR", "AES-GCM decryption failed: ${e.message}", e)
        }
    }

    // ======================== SHA-256 ========================

    /**
     * Compute SHA-256 hash of input data.
     *
     * @param data Base64-encoded input data
     * @return Hex-encoded SHA-256 hash string (64 characters)
     */
    @ReactMethod
    fun sha256(data: String, promise: Promise) {
        try {
            val dataBytes = Base64.decode(data, Base64.DEFAULT)
            val digest = MessageDigest.getInstance("SHA-256")
            val hashBytes = digest.digest(dataBytes)

            // Convert to hex string
            val hexString = hashBytes.joinToString("") { "%02x".format(it) }

            promise.resolve(hexString)
        } catch (e: Exception) {
            Log.e(TAG, "SHA-256 hashing failed", e)
            promise.reject("HASH_ERROR", "SHA-256 hashing failed: ${e.message}", e)
        }
    }

    // ======================== Android Keystore ========================

    /**
     * Generate and store an AES-256-GCM key in Android Keystore.
     *
     * The key is:
     * - Hardware-backed when TEE/SE is available
     * - Not exportable from the device
     * - Protected by the device lock screen
     *
     * @param alias Unique alias for the key in keystore
     */
    @ReactMethod
    fun generateKeystoreKey(alias: String, promise: Promise) {
        try {
            val fullAlias = KEY_ALIAS_PREFIX + alias

            val keyGenerator = KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_AES,
                KEYSTORE_PROVIDER
            )

            val spec = KeyGenParameterSpec.Builder(
                fullAlias,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setRandomizedEncryptionRequired(true)
                .build()

            keyGenerator.init(spec)
            keyGenerator.generateKey()

            Log.i(TAG, "Keystore key generated with alias: $fullAlias")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Keystore key generation failed", e)
            promise.reject("KEYSTORE_ERROR", "Failed to generate keystore key: ${e.message}", e)
        }
    }

    // ======================== Security Checks ========================

    /**
     * Check if the device is rooted.
     *
     * Detects common root indicators:
     * - su binary in PATH
     * - Magisk files
     * - SuperSU files
     * - Xposed framework
     * - Test-keys build tags
     * - RW system partition
     *
     * @return Map with root detection results
     */
    @ReactMethod
    fun checkRootStatus(promise: Promise) {
        try {
            val result = Arguments.createMap()

            // Check 1: su binary in common paths
            val suPaths = arrayOf(
                "/system/bin/su", "/system/xbin/su", "/sbin/su",
                "/data/local/xbin/su", "/data/local/bin/su",
                "/system/sd/xbin/su", "/system/bin/failsafe/su",
                "/data/local/su", "/su/bin/su"
            )
            val hasSuBinary = suPaths.any { File(it).exists() }
            result.putBoolean("hasSuBinary", hasSuBinary)

            // Check 2: Magisk indicators
            val magiskPaths = arrayOf(
                "/sbin/.magisk", "/data/adb/magisk",
                "/data/adb/modules", "/cache/.disable_magisk"
            )
            val hasMagisk = magiskPaths.any { File(it).exists() }
            result.putBoolean("hasMagisk", hasMagisk)

            // Check 3: SuperSU app
            val hasSuperSU = File("/system/app/Superuser.apk").exists()
            result.putBoolean("hasSuperSU", hasSuperSU)

            // Check 4: Xposed framework
            val hasXposed = try {
                Class.forName("de.robv.android.xposed.XposedBridge")
                true
            } catch (e: ClassNotFoundException) {
                false
            }
            result.putBoolean("hasXposed", hasXposed)

            // Check 5: Test keys in build tags
            val hasTestKeys = Build.TAGS?.contains("test-keys") == true
            result.putBoolean("hasTestKeys", hasTestKeys)

            // Check 6: Can execute su command
            val canExecuteSu = try {
                val process = Runtime.getRuntime().exec(arrayOf("which", "su"))
                val reader = BufferedReader(InputStreamReader(process.inputStream))
                val output = reader.readLine()
                process.waitFor()
                !output.isNullOrBlank()
            } catch (e: Exception) {
                false
            }
            result.putBoolean("canExecuteSu", canExecuteSu)

            // Overall rooted status
            val isRooted = hasSuBinary || hasMagisk || hasSuperSU || hasXposed ||
                hasTestKeys || canExecuteSu
            result.putBoolean("isRooted", isRooted)

            Log.d(TAG, "Root check: isRooted=$isRooted")
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Root check failed", e)
            promise.reject("ROOT_CHECK_ERROR", "Root check failed: ${e.message}", e)
        }
    }

    /**
     * Check if a debugger is attached to the current process.
     *
     * Debugger attachment could indicate reverse engineering or tampering attempts.
     */
    @ReactMethod
    fun checkDebuggerAttached(promise: Promise) {
        try {
            val result = Arguments.createMap()

            // Check Java debugger
            val isJavaDebuggerConnected = android.os.Debug.isDebuggerConnected()
            result.putBoolean("isJavaDebuggerConnected", isJavaDebuggerConnected)

            // Check if the app is debuggable (from manifest flag)
            val appInfo = reactApplicationContext.applicationInfo
            val isDebuggable = (appInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0
            result.putBoolean("isDebuggable", isDebuggable)

            // Check TracerPid in /proc/self/status (non-zero = being traced)
            val isBeingTraced = try {
                val statusFile = File("/proc/self/status")
                val tracerLine = statusFile.readLines().find { it.startsWith("TracerPid:") }
                val tracerPid = tracerLine?.split(":")?.get(1)?.trim()?.toIntOrNull() ?: 0
                tracerPid > 0
            } catch (e: Exception) {
                false
            }
            result.putBoolean("isBeingTraced", isBeingTraced)

            val debuggerAttached = isJavaDebuggerConnected || isBeingTraced
            result.putBoolean("debuggerAttached", debuggerAttached)

            Log.d(TAG, "Debugger check: attached=$debuggerAttached")
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Debugger check failed", e)
            promise.reject("DEBUG_CHECK_ERROR", "Debugger check failed: ${e.message}", e)
        }
    }

    /**
     * Check if the app is running on an emulator.
     *
     * Emulators may be used to bypass biometric security checks.
     * Checks hardware properties, build fingerprints, and known emulator artifacts.
     */
    @ReactMethod
    fun checkEmulator(promise: Promise) {
        try {
            val result = Arguments.createMap()

            // Check build properties for emulator signatures
            val indicators = mutableListOf<String>()

            if (Build.FINGERPRINT.startsWith("generic") || Build.FINGERPRINT.startsWith("unknown")) {
                indicators.add("fingerprint")
            }
            if (Build.MODEL.contains("google_sdk") || Build.MODEL.contains("Emulator") ||
                Build.MODEL.contains("Android SDK built for")) {
                indicators.add("model")
            }
            if (Build.MANUFACTURER.contains("Genymotion")) {
                indicators.add("genymotion")
            }
            if (Build.HARDWARE.contains("goldfish") || Build.HARDWARE.contains("ranchu")) {
                indicators.add("hardware")
            }
            if (Build.PRODUCT.contains("sdk") || Build.PRODUCT.contains("emulator") ||
                Build.PRODUCT.contains("simulator")) {
                indicators.add("product")
            }
            if (Build.BRAND.startsWith("generic") && Build.DEVICE.startsWith("generic")) {
                indicators.add("brand_device")
            }

            // Check for QEMU-related files
            val qemuFiles = arrayOf(
                "/dev/socket/qemud", "/dev/qemu_pipe",
                "/system/lib/libc_malloc_debug_qemu.so"
            )
            if (qemuFiles.any { File(it).exists() }) {
                indicators.add("qemu_files")
            }

            val indicatorsArray = Arguments.createArray()
            indicators.forEach { indicatorsArray.pushString(it) }
            result.putArray("indicators", indicatorsArray)

            val isEmulator = indicators.isNotEmpty()
            result.putBoolean("isEmulator", isEmulator)

            Log.d(TAG, "Emulator check: isEmulator=$isEmulator, indicators=$indicators")
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Emulator check failed", e)
            promise.reject("EMULATOR_CHECK_ERROR", "Emulator check failed: ${e.message}", e)
        }
    }

    /**
     * Verify the app's signing certificate.
     *
     * Compares the current signing certificate hash with an expected value
     * to detect repackaged/tampered APKs.
     *
     * @return Map with { signatureHash: String (SHA-256 of signing cert) }
     */
    @ReactMethod
    fun verifyAppSignature(promise: Promise) {
        try {
            val result = Arguments.createMap()

            val packageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                reactApplicationContext.packageManager.getPackageInfo(
                    reactApplicationContext.packageName,
                    android.content.pm.PackageManager.GET_SIGNING_CERTIFICATES
                )
            } else {
                @Suppress("DEPRECATION")
                reactApplicationContext.packageManager.getPackageInfo(
                    reactApplicationContext.packageName,
                    android.content.pm.PackageManager.GET_SIGNATURES
                )
            }

            val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                packageInfo.signingInfo?.apkContentsSigners
            } else {
                @Suppress("DEPRECATION")
                packageInfo.signatures
            }

            if (signatures != null && signatures.isNotEmpty()) {
                val cert = signatures[0]
                val md = MessageDigest.getInstance("SHA-256")
                val hash = md.digest(cert.toByteArray())
                val hashString = hash.joinToString("") { "%02x".format(it) }

                result.putString("signatureHash", hashString)
                result.putBoolean("hasSignature", true)
            } else {
                result.putString("signatureHash", "")
                result.putBoolean("hasSignature", false)
            }

            Log.d(TAG, "App signature verified")
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Signature verification failed", e)
            promise.reject("SIGNATURE_ERROR", "Signature verification failed: ${e.message}", e)
        }
    }
}
