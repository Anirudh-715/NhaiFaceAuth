package com.nhai.faceauth

import android.view.View
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ReactShadowNode
import com.facebook.react.uimanager.ViewManager
import com.nhai.faceauth.crypto.CryptoModule
import com.nhai.faceauth.ml.FaceDetectorModule
import com.nhai.faceauth.ml.FaceRecognizerModule
import com.nhai.faceauth.ml.LivenessModule

/**
 * NhaiFaceAuthPackage — React Native package that registers all native modules
 * for the NHAI FaceAuth application.
 *
 * Registered modules:
 * - FaceDetector: BlazeFace TFLite face detection (bounding boxes + 6 keypoints)
 * - FaceRecognizer: MobileFaceNet TFLite face embedding extraction (128-d vectors)
 * - LivenessChecker: LBP texture analysis + optical flow for anti-spoofing
 * - CryptoModule: AES-256-GCM encryption, SHA-256, Keystore, security checks
 *
 * This package is added to the ReactNativeHost's package list in MainApplication.kt.
 */
class NhaiFaceAuthPackage : ReactPackage {

    /**
     * Create and return all native modules for this package.
     *
     * Each module is instantiated with the ReactApplicationContext, which provides
     * access to the Android application context, React bridge, and JS thread.
     */
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(
            FaceDetectorModule(reactContext),
            FaceRecognizerModule(reactContext),
            LivenessModule(reactContext),
            CryptoModule(reactContext)
        )
    }

    /**
     * No custom view managers are needed for this package.
     * All modules are headless native modules (no UI components).
     */
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<View, ReactShadowNode<*>>> {
        return emptyList()
    }
}
