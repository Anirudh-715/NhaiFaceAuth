package com.nhai.faceauth.ml

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.*
import org.tensorflow.lite.Interpreter
import org.tensorflow.lite.nnapi.NnApiDelegate
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.MappedByteBuffer
import java.nio.channels.FileChannel
import kotlin.math.sqrt

/**
 * FaceRecognizerModule — React Native native module wrapping MobileFaceNet TFLite model.
 *
 * ML Pipeline:
 * 1. Input: Base64-encoded cropped face image from JS
 * 2. Decode → Bitmap → resize to 112×112
 * 3. Normalize pixel values to [-1, 1] range (MobileFaceNet standard preprocessing)
 * 4. Run TFLite inference (NNAPI delegate preferred, CPU fallback with 4 threads)
 * 5. Extract 128-dimensional face embedding from output tensor
 * 6. L2-normalize the embedding vector
 * 7. Return normalized embedding as WritableArray to JavaScript
 *
 * Model: mobilefacenet.tflite (112×112 input, 128-d embedding output)
 * Size: ~1.0MB
 *
 * The 128-d embeddings can be compared using cosine similarity or L2 distance
 * for face verification / identification.
 */
class FaceRecognizerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "FaceRecognizerModule"
        private const val MODULE_NAME = "FaceRecognizer"

        // MobileFaceNet input dimensions
        private const val INPUT_WIDTH = 112
        private const val INPUT_HEIGHT = 112
        private const val INPUT_CHANNELS = 3

        // Output embedding dimension
        private const val EMBEDDING_DIM = 192

        // Normalization constants for [-1, 1] range
        private const val MEAN = 127.5f
        private const val STD = 128.0f
    }

    private var interpreter: Interpreter? = null
    private var nnapiDelegate: NnApiDelegate? = null
    private var isInitialized = false

    // Pre-allocated input buffer: 1 × 112 × 112 × 3 float32
    // Total bytes = 1 * 112 * 112 * 3 * 4 = 150,528 bytes
    private val inputBuffer: ByteBuffer = ByteBuffer
        .allocateDirect(1 * INPUT_WIDTH * INPUT_HEIGHT * INPUT_CHANNELS * 4)
        .order(ByteOrder.nativeOrder())

    // Pre-allocated output buffer: 1 × 128 float32
    private val outputEmbedding: Array<FloatArray> = Array(1) { FloatArray(EMBEDDING_DIM) }

    override fun getName(): String = MODULE_NAME

    /**
     * Initialize the MobileFaceNet TFLite model.
     * Tries NNAPI delegate first for hardware acceleration, falls back to CPU with 4 threads.
     *
     * @param modelPath Path to the .tflite model file in assets (e.g., "mobilefacenet.tflite")
     */
    @ReactMethod
    fun initialize(modelPath: String, promise: Promise) {
        try {
            if (isInitialized) {
                Log.w(TAG, "Already initialized, releasing previous instance")
                releaseResources()
            }

            val modelBuffer = loadModelFile(modelPath)

            // CPU configuration: use 4 threads for parallel inference (highly stable)
            val options = Interpreter.Options()
            options.setNumThreads(4)

            interpreter = Interpreter(modelBuffer, options)
            isInitialized = true

            // Log model input/output tensor shapes for debugging
            val inputTensor = interpreter!!.getInputTensor(0)
            val outputTensor = interpreter!!.getOutputTensor(0)
            Log.i(TAG, "Model initialized. Input shape: ${inputTensor.shape().contentToString()}, " +
                "Output shape: ${outputTensor.shape().contentToString()}")

            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize MobileFaceNet model", e)
            promise.reject("INIT_ERROR", "Failed to initialize FaceRecognizer: ${e.message}", e)
        }
    }

    /**
     * Extract a 128-dimensional face embedding from a cropped face image.
     *
     * The face should be pre-aligned (cropped using keypoints from FaceDetector).
     * The embedding is L2-normalized for direct cosine similarity comparison.
     *
     * @param faceBase64 Base64-encoded cropped face image
     * @param width Original crop width (for metadata, resize happens internally)
     * @param height Original crop height (for metadata, resize happens internally)
     * @return WritableArray of 128 float values representing the face embedding
     */
    @ReactMethod
    fun extractEmbedding(faceBase64: String, width: Int, height: Int, bboxMap: ReadableMap, promise: Promise) {
        try {
            if (!isInitialized || interpreter == null) {
                promise.reject("NOT_INITIALIZED", "FaceRecognizer not initialized. Call initialize() first.")
                return
            }

            // Step 1: Decode image from base64 or file path
            var cleanPath: String? = null
            var bitmap = if (faceBase64.startsWith("/") || faceBase64.startsWith("file://") || faceBase64.contains("cache") || faceBase64.contains("files")) {
                cleanPath = faceBase64.replace("file://", "")
                BitmapFactory.decodeFile(cleanPath)
            } else {
                val imageBytes = Base64.decode(faceBase64, Base64.DEFAULT)
                BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
            } ?: throw IllegalArgumentException("Failed to decode image from input source")

            // Rotate based on EXIF orientation if loaded from file
            if (cleanPath != null) {
                bitmap = rotateBitmapIfRequired(bitmap, cleanPath)
            }

            val originalWidth = bitmap.width
            val originalHeight = bitmap.height

            val imgWidth = originalWidth.toFloat()
            val imgHeight = originalHeight.toFloat()
            val frameWidth = width.toFloat()
            val frameHeight = height.toFloat()

            // Calculate cover scaling factor and offsets (same as FaceDetector cover mode)
            val scale = Math.max(frameWidth / imgWidth, frameHeight / imgHeight)
            val dx = (frameWidth - imgWidth * scale) / 2f
            val dy = (frameHeight - imgHeight * scale) / 2f

            // Read bounding box in screen space
            val screenX = bboxMap.getDouble("x").toFloat()
            val screenY = bboxMap.getDouble("y").toFloat()
            val screenW = bboxMap.getDouble("width").toFloat()
            val screenH = bboxMap.getDouble("height").toFloat()

            // Map back to original image coordinates using inverse cover scaling
            val bboxX = ((screenX - dx) / scale).toInt()
            val bboxY = ((screenY - dy) / scale).toInt()
            val bboxW = (screenW / scale).toInt()
            val bboxH = (screenH / scale).toInt()

            val x = bboxX.coerceIn(0, originalWidth - 1)
            val y = bboxY.coerceIn(0, originalHeight - 1)
            val w = bboxW.coerceAtMost(originalWidth - x).coerceAtLeast(1)
            val h = bboxH.coerceAtMost(originalHeight - y).coerceAtLeast(1)

            // Crop face bounding box
            val croppedBitmap = Bitmap.createBitmap(bitmap, x, y, w, h)

            // Step 2: Resize to 112×112 (MobileFaceNet input size)
            val resizedBitmap = Bitmap.createScaledBitmap(croppedBitmap, INPUT_WIDTH, INPUT_HEIGHT, true)

            // Step 3: Normalize pixels to [-1, 1] and fill input buffer
            fillInputBuffer(resizedBitmap)

            // Recycle bitmaps to free memory
            if (resizedBitmap !== croppedBitmap) resizedBitmap.recycle()
            if (croppedBitmap !== bitmap) croppedBitmap.recycle()
            bitmap.recycle()

            // Step 4: Run MobileFaceNet inference
            interpreter!!.run(inputBuffer, outputEmbedding)

            // Step 5: L2-normalize the embedding vector
            val embedding = outputEmbedding[0]
            l2Normalize(embedding)

            // Step 6: Convert to WritableArray for React Native bridge
            val result = Arguments.createArray()
            for (value in embedding) {
                result.pushDouble(value.toDouble())
            }

            Log.d(TAG, "Embedding extracted successfully (dim=${embedding.size})")
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Embedding extraction failed", e)
            promise.reject("EMBED_ERROR", "Embedding extraction failed: ${e.message}", e)
        }
    }

    /**
     * Release all native resources.
     */
    @ReactMethod
    fun release(promise: Promise) {
        try {
            releaseResources()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("RELEASE_ERROR", "Failed to release FaceRecognizer: ${e.message}", e)
        }
    }

    // ======================== Private Helpers ========================

    /**
     * Memory-map a TFLite model file from assets.
     */
    private fun loadModelFile(modelPath: String): MappedByteBuffer {
        val assetFileDescriptor = reactApplicationContext.assets.openFd(modelPath)
        val fileInputStream = FileInputStream(assetFileDescriptor.fileDescriptor)
        val fileChannel = fileInputStream.channel
        val startOffset = assetFileDescriptor.startOffset
        val declaredLength = assetFileDescriptor.declaredLength
        return fileChannel.map(FileChannel.MapMode.READ_ONLY, startOffset, declaredLength)
    }

    /**
     * Preprocess bitmap into input buffer with MobileFaceNet normalization.
     *
     * MobileFaceNet expects pixels normalized to [-1, 1]:
     *   normalized_pixel = (pixel_value - 127.5) / 128.0
     *
     * This maps [0, 255] → approximately [-1, 1].
     */
    private fun fillInputBuffer(bitmap: Bitmap) {
        inputBuffer.rewind()
        val pixels = IntArray(INPUT_WIDTH * INPUT_HEIGHT)
        bitmap.getPixels(pixels, 0, INPUT_WIDTH, 0, 0, INPUT_WIDTH, INPUT_HEIGHT)

        for (pixel in pixels) {
            // Extract RGB and normalize to [-1, 1]
            val r = (((pixel shr 16) and 0xFF) - MEAN) / STD
            val g = (((pixel shr 8) and 0xFF) - MEAN) / STD
            val b = ((pixel and 0xFF) - MEAN) / STD
            inputBuffer.putFloat(r)
            inputBuffer.putFloat(g)
            inputBuffer.putFloat(b)
        }
    }

    /**
     * L2-normalize a float vector in-place.
     *
     * After normalization, the vector has unit length (||v|| = 1),
     * which allows direct cosine similarity comparison via dot product.
     */
    private fun l2Normalize(embedding: FloatArray) {
        var sumOfSquares = 0f
        for (value in embedding) {
            sumOfSquares += value * value
        }
        val norm = sqrt(sumOfSquares)
        if (norm > 0f) {
            for (i in embedding.indices) {
                embedding[i] /= norm
            }
        }
    }

    /**
     * Release interpreter and delegate resources.
     */
    private fun releaseResources() {
        interpreter?.close()
        interpreter = null
        nnapiDelegate?.close()
        nnapiDelegate = null
        isInitialized = false
        Log.i(TAG, "FaceRecognizer resources released")
    }

    private fun rotateBitmapIfRequired(img: Bitmap, path: String): Bitmap {
        try {
            val exif = ExifInterface(path)
            val orientation = exif.getAttributeInt(
                ExifInterface.TAG_ORIENTATION,
                ExifInterface.ORIENTATION_NORMAL
            )
            val matrix = Matrix()
            when (orientation) {
                ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
                ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
                ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
                else -> return img
            }
            val rotated = Bitmap.createBitmap(
                img, 0, 0, img.width, img.height, matrix, true
            )
            img.recycle()
            return rotated
        } catch (e: Exception) {
            Log.e(TAG, "Failed to rotate bitmap based on EXIF: ${e.message}")
            return img
        }
    }
}
