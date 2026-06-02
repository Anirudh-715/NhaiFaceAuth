package com.nhai.faceauth.ml

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.*
import org.tensorflow.lite.Interpreter
import org.tensorflow.lite.gpu.CompatibilityList
import org.tensorflow.lite.nnapi.NnApiDelegate
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.MappedByteBuffer
import java.nio.channels.FileChannel
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.min

/**
 * FaceDetectorModule — React Native native module wrapping BlazeFace TFLite model.
 *
 * ML Pipeline:
 * 1. Input: Base64-encoded image frame from JS
 * 2. Decode → Bitmap → resize to 128×128
 * 3. Normalize pixels to [0, 1] range
 * 4. Run TFLite inference (NNAPI delegate preferred, CPU fallback with 4 threads)
 * 5. Post-process: decode bounding boxes + 6 facial keypoints from anchors
 * 6. Apply Non-Maximum Suppression (NMS) with IoU threshold
 * 7. Return detections as WritableArray to JavaScript
 *
 * Model: blazeface.tflite (128×128 input, outputs bounding boxes + 6 keypoints)
 * Size: ~0.1MB, INT8 quantized
 */
class FaceDetectorModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "FaceDetectorModule"
        private const val MODULE_NAME = "FaceDetector"

        // BlazeFace model input dimensions
        private const val INPUT_WIDTH = 128
        private const val INPUT_HEIGHT = 128
        private const val INPUT_CHANNELS = 3

        // Detection thresholds
        private const val CONFIDENCE_THRESHOLD = 0.75f
        private const val NMS_IOU_THRESHOLD = 0.3f

        // BlazeFace outputs 896 anchor boxes, each with 16 values:
        // [x_center, y_center, width, height, score, ...6 keypoints (x,y each) = 12, padding]
        private const val NUM_ANCHORS = 896
        private const val NUM_VALUES_PER_ANCHOR = 16
        private const val NUM_KEYPOINTS = 6
    }

    private var interpreter: Interpreter? = null
    private var nnapiDelegate: NnApiDelegate? = null
    private var isInitialized = false

    // Pre-allocated input buffer: 1 × 128 × 128 × 3 float32
    private val inputBuffer: ByteBuffer = ByteBuffer
        .allocateDirect(1 * INPUT_WIDTH * INPUT_HEIGHT * INPUT_CHANNELS * 4)
        .order(ByteOrder.nativeOrder())

    // Pre-allocated output buffers
    // Output 0: bounding box regressions [1, 896, 16]
    private val outputBoxes: Array<Array<FloatArray>> =
        Array(1) { Array(NUM_ANCHORS) { FloatArray(NUM_VALUES_PER_ANCHOR) } }

    // Output 1: classification scores [1, 896, 1]
    private val outputScores: Array<Array<FloatArray>> =
        Array(1) { Array(NUM_ANCHORS) { FloatArray(1) } }

    // Pre-computed anchors for BlazeFace (128×128 variant)
    private val anchors: List<FloatArray> by lazy { generateAnchors() }

    override fun getName(): String = MODULE_NAME

    /**
     * Initialize the BlazeFace TFLite model.
     * Attempts NNAPI delegate first for hardware acceleration, falls back to CPU with 4 threads.
     *
     * @param modelPath Path to the .tflite model file in assets (e.g., "blazeface.tflite")
     */
    @ReactMethod
    fun initialize(modelPath: String, promise: Promise) {
        try {
            if (isInitialized) {
                Log.w(TAG, "Already initialized, releasing previous instance")
                releaseResources()
            }

            val assetManager = reactApplicationContext.assets
            val modelBuffer = loadModelFile(modelPath)

            // CPU configuration: use 4 threads for parallel inference (highly stable)
            val options = Interpreter.Options()
            options.setNumThreads(4)

            interpreter = Interpreter(modelBuffer, options)
            isInitialized = true

            Log.i(TAG, "BlazeFace model initialized successfully from: $modelPath")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize BlazeFace model", e)
            promise.reject("INIT_ERROR", "Failed to initialize FaceDetector: ${e.message}", e)
        }
    }

    /**
     * Run face detection on a base64-encoded image frame.
     *
     * @param frameBase64 Base64-encoded image data (JPEG or PNG)
     * @param width Original frame width (used for coordinate scaling)
     * @param height Original frame height (used for coordinate scaling)
     * @return WritableArray of detected face objects with bounding boxes and keypoints
     */
    @ReactMethod
    fun detect(frameBase64: String, width: Int, height: Int, promise: Promise) {
        try {
            if (!isInitialized || interpreter == null) {
                promise.reject("NOT_INITIALIZED", "FaceDetector not initialized. Call initialize() first.")
                return
            }

            // Step 1: Decode image from base64 or file path
            var cleanPath: String? = null
            var bitmap = if (frameBase64.startsWith("/") || frameBase64.startsWith("file://") || frameBase64.contains("cache") || frameBase64.contains("files")) {
                cleanPath = frameBase64.replace("file://", "")
                BitmapFactory.decodeFile(cleanPath)
            } else {
                val imageBytes = Base64.decode(frameBase64, Base64.DEFAULT)
                BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
            } ?: throw IllegalArgumentException("Failed to decode image from input source")

            // Rotate based on EXIF orientation if loaded from file
            if (cleanPath != null) {
                bitmap = rotateBitmapIfRequired(bitmap, cleanPath)
            }

            val imgWidth = bitmap.width.toFloat()
            val imgHeight = bitmap.height.toFloat()

            // Step 2: Resize to model input dimensions (128×128)
            val resizedBitmap = Bitmap.createScaledBitmap(bitmap, INPUT_WIDTH, INPUT_HEIGHT, true)

            // Step 3: Fill input buffer with normalized pixel values [0, 1]
            fillInputBuffer(resizedBitmap)

            // Recycle bitmaps to free memory
            if (resizedBitmap !== bitmap) resizedBitmap.recycle()
            bitmap.recycle()

            // Step 4: Run TFLite inference
            val outputMap = HashMap<Int, Any>()
            outputMap[0] = outputBoxes
            outputMap[1] = outputScores

            interpreter!!.runForMultipleInputsOutputs(arrayOf(inputBuffer), outputMap)

            // Step 5: Post-process — decode boxes, apply NMS
            val detections = postProcess(width.toFloat(), height.toFloat(), imgWidth, imgHeight)

            // Step 6: Convert to WritableArray for React Native
            val results = Arguments.createArray()
            for (detection in detections) {
                val faceMap = Arguments.createMap()

                // Bounding box (scaled to original frame dimensions)
                faceMap.putDouble("x", detection.x.toDouble())
                faceMap.putDouble("y", detection.y.toDouble())
                faceMap.putDouble("width", detection.w.toDouble())
                faceMap.putDouble("height", detection.h.toDouble())
                faceMap.putDouble("confidence", detection.score.toDouble())

                // 6 facial keypoints: right eye, left eye, nose tip,
                // mouth center, right ear, left ear
                val keypoints = Arguments.createArray()
                val keypointLabels = arrayOf(
                    "rightEye", "leftEye", "noseTip",
                    "mouthCenter", "rightEar", "leftEar"
                )
                for (i in 0 until NUM_KEYPOINTS) {
                    val kp = Arguments.createMap()
                    kp.putString("label", keypointLabels[i])
                    kp.putDouble("x", detection.keypoints[i * 2].toDouble())
                    kp.putDouble("y", detection.keypoints[i * 2 + 1].toDouble())
                    keypoints.pushMap(kp)
                }
                faceMap.putArray("keypoints", keypoints)

                results.pushMap(faceMap)
            }

            Log.d(TAG, "Detected ${detections.size} face(s)")
            promise.resolve(results)
        } catch (e: Exception) {
            Log.e(TAG, "Detection failed", e)
            promise.reject("DETECT_ERROR", "Face detection failed: ${e.message}", e)
        }
    }

    /**
     * Release all native resources (interpreter, delegate, buffers).
     */
    @ReactMethod
    fun release(promise: Promise) {
        try {
            releaseResources()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("RELEASE_ERROR", "Failed to release FaceDetector: ${e.message}", e)
        }
    }

    // ======================== Private Helpers ========================

    /**
     * Load a TFLite model file from the app's assets folder into a MappedByteBuffer.
     * Memory-mapped loading is efficient and avoids copying the entire model into RAM.
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
     * Fill the pre-allocated input ByteBuffer with normalized pixel data from the bitmap.
     * Pixel values are normalized to [0, 1] for BlazeFace.
     */
    private fun fillInputBuffer(bitmap: Bitmap) {
        inputBuffer.rewind()
        val pixels = IntArray(INPUT_WIDTH * INPUT_HEIGHT)
        bitmap.getPixels(pixels, 0, INPUT_WIDTH, 0, 0, INPUT_WIDTH, INPUT_HEIGHT)

        for (pixel in pixels) {
            // Extract RGB channels and normalize to [0, 1]
            inputBuffer.putFloat(((pixel shr 16) and 0xFF) / 255.0f) // R
            inputBuffer.putFloat(((pixel shr 8) and 0xFF) / 255.0f)  // G
            inputBuffer.putFloat((pixel and 0xFF) / 255.0f)           // B
        }
    }

    /**
     * Post-process raw model outputs:
     * 1. Apply sigmoid to raw scores to get confidence values
     * 2. Decode bounding boxes relative to pre-computed anchors
     * 3. Extract 6 facial keypoints
     * 4. Filter by confidence threshold
     * 5. Apply NMS to remove overlapping detections
     */
    private fun postProcess(frameWidth: Float, frameHeight: Float, imgWidth: Float, imgHeight: Float): List<Detection> {
        val rawDetections = mutableListOf<Detection>()

        // Calculate aspect ratio cover scaling and offsets
        val scale = Math.max(frameWidth / imgWidth, frameHeight / imgHeight)
        val dx = (frameWidth - imgWidth * scale) / 2f
        val dy = (frameHeight - imgHeight * scale) / 2f

        for (i in 0 until NUM_ANCHORS) {
            // Apply sigmoid to convert raw logit to probability
            val score = sigmoid(outputScores[0][i][0])

            if (score < CONFIDENCE_THRESHOLD) continue

            val anchor = anchors[i]
            val box = outputBoxes[0][i]

            // Decode bounding box center/size relative to anchor
            val xCenter = box[0] / INPUT_WIDTH * anchor[2] + anchor[0]
            val yCenter = box[1] / INPUT_HEIGHT * anchor[3] + anchor[1]
            val w = box[2] / INPUT_WIDTH * anchor[2]
            val h = box[3] / INPUT_HEIGHT * anchor[3]

            // Convert center format to top-left corner format in image space
            val xImg = (xCenter - w / 2f) * imgWidth
            val yImg = (yCenter - h / 2f) * imgHeight
            val wImg = w * imgWidth
            val hImg = h * imgHeight

            // Map to layout screen coordinates using cover scale and offsets
            val x = xImg * scale + dx
            val y = yImg * scale + dy
            val scaledW = wImg * scale
            val scaledH = hImg * scale

            // Decode 6 keypoints (each has x,y) and map to screen coordinates
            val keypoints = FloatArray(NUM_KEYPOINTS * 2)
            for (k in 0 until NUM_KEYPOINTS) {
                val kpX = box[4 + k * 2] / INPUT_WIDTH * anchor[2] + anchor[0]
                val kpY = box[4 + k * 2 + 1] / INPUT_HEIGHT * anchor[3] + anchor[1]
                keypoints[k * 2] = (kpX * imgWidth) * scale + dx
                keypoints[k * 2 + 1] = (kpY * imgHeight) * scale + dy
            }

            rawDetections.add(Detection(x, y, scaledW, scaledH, score, keypoints))
        }

        // Apply Non-Maximum Suppression to remove overlapping detections
        return nms(rawDetections, NMS_IOU_THRESHOLD)
    }

    /**
     * Sigmoid activation function for converting raw logits to probabilities.
     */
    private fun sigmoid(x: Float): Float = 1.0f / (1.0f + exp(-x))

    /**
     * Non-Maximum Suppression (NMS):
     * Greedily selects high-confidence detections and removes overlapping boxes
     * with IoU above the threshold.
     */
    private fun nms(detections: List<Detection>, iouThreshold: Float): List<Detection> {
        if (detections.isEmpty()) return emptyList()

        // Sort by confidence descending
        val sorted = detections.sortedByDescending { it.score }.toMutableList()
        val selected = mutableListOf<Detection>()

        while (sorted.isNotEmpty()) {
            val best = sorted.removeAt(0)
            selected.add(best)

            sorted.removeAll { computeIoU(best, it) > iouThreshold }
        }

        return selected
    }

    /**
     * Compute Intersection over Union (IoU) between two detection bounding boxes.
     */
    private fun computeIoU(a: Detection, b: Detection): Float {
        val x1 = max(a.x, b.x)
        val y1 = max(a.y, b.y)
        val x2 = min(a.x + a.w, b.x + b.w)
        val y2 = min(a.y + a.h, b.y + b.h)

        val intersection = max(0f, x2 - x1) * max(0f, y2 - y1)
        val areaA = a.w * a.h
        val areaB = b.w * b.h
        val union = areaA + areaB - intersection

        return if (union > 0f) intersection / union else 0f
    }

    /**
     * Generate SSD-style anchors for the BlazeFace 128×128 model.
     * BlazeFace uses a specific anchor configuration with 2 anchors per grid cell
     * at strides [8, 16, 16, 16].
     *
     * Returns list of [x_center, y_center, width, height] normalized to [0, 1].
     */
    private fun generateAnchors(): List<FloatArray> {
        val anchorList = mutableListOf<FloatArray>()
        // BlazeFace 128 anchor config: feature map sizes and number of anchors per location
        val strides = intArrayOf(8, 16, 16, 16)
        val anchorsPerStride = intArrayOf(2, 6, 6, 6) // anchor counts per stride layer

        // Generate grid anchors for each stride level
        // In the standard BlazeFace, we generate 896 total anchors
        for (layerIdx in strides.indices) {
            val stride = strides[layerIdx]
            val gridSize = INPUT_WIDTH / stride
            val numAnchorsAtLayer = anchorsPerStride[layerIdx]

            for (gridY in 0 until gridSize) {
                for (gridX in 0 until gridSize) {
                    val xCenter = (gridX + 0.5f) / gridSize
                    val yCenter = (gridY + 0.5f) / gridSize

                    for (n in 0 until numAnchorsAtLayer) {
                        anchorList.add(floatArrayOf(xCenter, yCenter, 1.0f, 1.0f))
                    }
                }
            }
        }

        Log.d(TAG, "Generated ${anchorList.size} anchors for BlazeFace")
        return anchorList
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
        Log.i(TAG, "FaceDetector resources released")
    }

    /**
     * Data class representing a single face detection result.
     *
     * @param x Top-left x coordinate (scaled to original frame)
     * @param y Top-left y coordinate (scaled to original frame)
     * @param w Width of bounding box (scaled to original frame)
     * @param h Height of bounding box (scaled to original frame)
     * @param score Detection confidence [0, 1]
     * @param keypoints Array of 12 floats: [x0,y0, x1,y1, ..., x5,y5] for 6 keypoints
     */
    data class Detection(
        val x: Float,
        val y: Float,
        val w: Float,
        val h: Float,
        val score: Float,
        val keypoints: FloatArray
    )

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
