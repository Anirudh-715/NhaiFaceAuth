package com.nhai.faceauth.sound

import android.media.AudioManager
import android.media.ToneGenerator
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class SoundPlayerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var toneGenerator: ToneGenerator? = null

    init {
        try {
            // Stream music, max volume (100)
            toneGenerator = ToneGenerator(AudioManager.STREAM_MUSIC, 100)
        } catch (e: Exception) {
            Log.e("SoundPlayerModule", "Failed to initialize ToneGenerator", e)
        }
    }

    override fun getName(): String = "SoundPlayer"

    @ReactMethod
    fun playSound(soundName: String, promise: Promise) {
        val tone = when (soundName.lowercase()) {
            "success" -> ToneGenerator.TONE_CDMA_CONFIRM
            "error", "failure" -> ToneGenerator.TONE_SUP_ERROR
            "tick", "beep" -> ToneGenerator.TONE_PROP_BEEP
            "click" -> ToneGenerator.TONE_PROP_ACK
            else -> ToneGenerator.TONE_PROP_BEEP
        }
        val duration = when (soundName.lowercase()) {
            "success" -> 350
            "error", "failure" -> 450
            "tick", "beep" -> 100
            "click" -> 50
            else -> 100
        }
        
        try {
            if (toneGenerator == null) {
                toneGenerator = ToneGenerator(AudioManager.STREAM_MUSIC, 100)
            }
            toneGenerator?.startTone(tone, duration)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e("SoundPlayerModule", "Failed to play tone $soundName", e)
            promise.reject("SOUND_ERROR", "Failed to play sound: ${e.message}", e)
        }
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        try {
            toneGenerator?.release()
            toneGenerator = null
        } catch (e: Exception) {
            Log.e("SoundPlayerModule", "Failed to release ToneGenerator", e)
        }
    }
}
