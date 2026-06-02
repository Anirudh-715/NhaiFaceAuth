package com.nhai.faceauth.ml

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.*
import java.nio.ByteBuffer
import kotlin.math.abs
import kotlin.math.ln
import kotlin.math.sqrt

/**
 * LivenessModule — React Native native module for anti-spoofing liveness detection.
 *
 * This module provides two complementary liveness analysis methods:
 *
 * 1. LBP (Local Binary Pattern) Texture Analysis:
 *    - Computes LBP descriptor over the face region
 *    - Calculates histogram entropy of the LBP pattern
 *    - Real faces have higher texture complexity (higher entropy) than printed photos
 *    - Screen replays have characteristic pixel patterns with lower entropy
 *
 * 2. Optical Flow Estimation:
 *    - Computes dense motion field between two consecutive frames
 *    - Real faces exhibit natural micro-movements (eye blinks, subtle head motion)
 *    - Printed photos and static images show no optical flow
 *    - Screen replays show uniform motion patterns
 *
 * These methods run on CPU with no ML model dependency, providing fast and
 * lightweight anti-spoofing checks that complement ML-based approaches.
 */
class LivenessModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "LivenessModule"
        private const val MODULE_NAME = "LivenessChecker"

        // LBP configuration
        private const val LBP_RADIUS = 1
        private const val LBP_NEIGHBORS = 8
        private const val LBP_HISTOGRAM_BINS = 256

        // Optical flow block matching parameters
        private const val FLOW_BLOCK_SIZE = 8
        private const val FLOW_SEARCH_RANGE = 16
    }

    override fun getName(): String = MODULE_NAME

    /**
     * Compute LBP (Local Binary Pattern) texture descriptor and histogram entropy.
     *
     * LBP works by comparing each pixel to its surrounding neighbors:
     * - For each pixel, compare to 8 neighbors in a circle of radius 1
     * - If neighbor >= center pixel, set bit to 1; otherwise 0
     * - This produces an 8-bit LBP code per pixel
     * - The histogram of these codes captures texture information
     * - Shannon entropy of the histogram measures texture complexity
     *
     * Real faces: High entropy (complex, varied texture with skin pores, hair, etc.)
     * Printed photos: Lower entropy (smoother, less varied texture due to print artifacts)
     * Screen replays: Characteristic moiré patterns, different entropy profile
     *
     * @param imageBase64 Base64-encoded grayscale or color face crop
     * @param width Image width
     * @param height Image height
     * @return Map with { lbpEntropy: Float, lbpHistogram: Array, isLikelyReal: Boolean }
     */
    @ReactMethod
    fun computeLBP(imageBase64: String, width: Int, height: Int, promise: Promise) {
        try {
            // Step 1: Decode image and convert to grayscale
            val imageBytes = Base64.decode(imageBase64, Base64.DEFAULT)
            val bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
                ?: throw IllegalArgumentException("Failed to decode image from base64")

            val grayscale = toGrayscale(bitmap)
            val imgWidth = bitmap.width
            val imgHeight = bitmap.height
            bitmap.recycle()

            // Step 2: Compute LBP image
            val lbpImage = computeLBPImage(grayscale, imgWidth, imgHeight)

            // Step 3: Compute histogram of LBP values (256 bins for 8-bit LBP)
            val histogram = IntArray(LBP_HISTOGRAM_BINS)
            for (lbpValue in lbpImage) {
                histogram[lbpValue.toInt() and 0xFF]++
            }

            // Step 4: Normalize histogram and compute Shannon entropy
            val totalPixels = lbpImage.size.toFloat()
            var entropy = 0.0f
            for (count in histogram) {
                if (count > 0) {
                    val probability = count / totalPixels
                    entropy -= probability * ln(probability.toDouble()).toFloat()
                }
            }

            // Step 5: Compute uniformity metric (ratio of uniform LBP patterns)
            // Uniform patterns have at most 2 bitwise transitions (0→1 or 1→0)
            var uniformCount = 0
            for (lbpValue in lbpImage) {
                if (isUniformPattern(lbpValue.toInt() and 0xFF)) {
                    uniformCount++
                }
            }
            val uniformRatio = uniformCount / totalPixels

            // Step 6: Build result — higher entropy + moderate uniform ratio suggests real face
            // Typical thresholds: entropy > 4.5 for real faces (empirical)
            val isLikelyReal = entropy > 4.5f && uniformRatio > 0.3f

            val result = Arguments.createMap()
            result.putDouble("lbpEntropy", entropy.toDouble())
            result.putDouble("uniformRatio", uniformRatio.toDouble())
            result.putBoolean("isLikelyReal", isLikelyReal)

            // Return top-20 histogram bins for detailed analysis in JS
            val histArray = Arguments.createArray()
            for (count in histogram) {
                histArray.pushInt(count)
            }
            result.putArray("lbpHistogram", histArray)

            Log.d(TAG, "LBP analysis: entropy=$entropy, uniformRatio=$uniformRatio, isLikelyReal=$isLikelyReal")
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "LBP computation failed", e)
            promise.reject("LBP_ERROR", "LBP computation failed: ${e.message}", e)
        }
    }

    /**
     * Compute optical flow between two consecutive frames using block matching.
     *
     * This simplified optical flow uses a block matching approach:
     * - Divide each frame into blocks of FLOW_BLOCK_SIZE × FLOW_BLOCK_SIZE
     * - For each block in frame1, find the best matching block in frame2
     *   within a search window of FLOW_SEARCH_RANGE pixels
     * - The displacement vector is the motion estimate for that block
     *
     * Real faces produce natural, non-uniform flow fields with small variations.
     * Static images produce near-zero flow. Screen replays produce highly uniform flow.
     *
     * @param frame1Base64 Base64-encoded first frame (earlier in time)
     * @param frame2Base64 Base64-encoded second frame (later in time)
     * @param width Frame width
     * @param height Frame height
     * @return Map with { averageMagnitude, maxMagnitude, flowVariance, hasMotion, isNaturalMotion }
     */
    @ReactMethod
    fun computeOpticalFlow(
        frame1Base64: String,
        frame2Base64: String,
        width: Int,
        height: Int,
        promise: Promise
    ) {
        try {
            // Step 1: Decode both frames to grayscale
            val bytes1 = Base64.decode(frame1Base64, Base64.DEFAULT)
            val bytes2 = Base64.decode(frame2Base64, Base64.DEFAULT)

            val bitmap1 = BitmapFactory.decodeByteArray(bytes1, 0, bytes1.size)
                ?: throw IllegalArgumentException("Failed to decode frame1 from base64")
            val bitmap2 = BitmapFactory.decodeByteArray(bytes2, 0, bytes2.size)
                ?: throw IllegalArgumentException("Failed to decode frame2 from base64")

            val gray1 = toGrayscale(bitmap1)
            val gray2 = toGrayscale(bitmap2)
            val imgWidth = bitmap1.width
            val imgHeight = bitmap1.height

            bitmap1.recycle()
            bitmap2.recycle()

            // Step 2: Block matching optical flow computation
            val blocksX = imgWidth / FLOW_BLOCK_SIZE
            val blocksY = imgHeight / FLOW_BLOCK_SIZE

            val flowVectors = mutableListOf<Pair<Float, Float>>()
            val magnitudes = mutableListOf<Float>()

            for (by in 0 until blocksY) {
                for (bx in 0 until blocksX) {
                    val blockX = bx * FLOW_BLOCK_SIZE
                    val blockY = by * FLOW_BLOCK_SIZE

                    // Find best matching block in frame2 via Sum of Absolute Differences (SAD)
                    val (dx, dy) = findBestMatch(
                        gray1, gray2, imgWidth, imgHeight,
                        blockX, blockY, FLOW_BLOCK_SIZE, FLOW_SEARCH_RANGE
                    )

                    flowVectors.add(Pair(dx.toFloat(), dy.toFloat()))
                    val magnitude = sqrt((dx * dx + dy * dy).toFloat())
                    magnitudes.add(magnitude)
                }
            }

            // Step 3: Compute flow statistics
            val avgMagnitude = if (magnitudes.isNotEmpty()) magnitudes.average().toFloat() else 0f
            val maxMagnitude = magnitudes.maxOrNull() ?: 0f

            // Flow variance: measures how varied the motion is across the frame
            // Natural head motion produces moderate variance; static = 0; uniform motion = low
            val meanDx = flowVectors.map { it.first }.average().toFloat()
            val meanDy = flowVectors.map { it.second }.average().toFloat()
            var variance = 0f
            for ((dx, dy) in flowVectors) {
                variance += (dx - meanDx) * (dx - meanDx) + (dy - meanDy) * (dy - meanDy)
            }
            variance /= flowVectors.size.toFloat().coerceAtLeast(1f)

            // Step 4: Motion classification
            // hasMotion: any significant movement detected
            val hasMotion = avgMagnitude > 0.5f
            // isNaturalMotion: non-zero motion with moderate variance (not perfectly uniform)
            val isNaturalMotion = hasMotion && variance > 0.5f && variance < 50f

            val result = Arguments.createMap()
            result.putDouble("averageMagnitude", avgMagnitude.toDouble())
            result.putDouble("maxMagnitude", maxMagnitude.toDouble())
            result.putDouble("flowVariance", variance.toDouble())
            result.putBoolean("hasMotion", hasMotion)
            result.putBoolean("isNaturalMotion", isNaturalMotion)
            result.putInt("blocksAnalyzed", flowVectors.size)

            Log.d(TAG, "Optical flow: avgMag=$avgMagnitude, maxMag=$maxMagnitude, " +
                "variance=$variance, hasMotion=$hasMotion, isNaturalMotion=$isNaturalMotion")
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Optical flow computation failed", e)
            promise.reject("FLOW_ERROR", "Optical flow failed: ${e.message}", e)
        }
    }

    // ======================== Private Helpers ========================

    /**
     * Convert a Bitmap to a grayscale byte array using luminance formula.
     * Y = 0.299*R + 0.587*G + 0.114*B (ITU-R BT.601 standard)
     */
    private fun toGrayscale(bitmap: Bitmap): ByteArray {
        val width = bitmap.width
        val height = bitmap.height
        val pixels = IntArray(width * height)
        bitmap.getPixels(pixels, 0, width, 0, 0, width, height)

        val grayscale = ByteArray(width * height)
        for (i in pixels.indices) {
            val pixel = pixels[i]
            val r = (pixel shr 16) and 0xFF
            val g = (pixel shr 8) and 0xFF
            val b = pixel and 0xFF
            // ITU-R BT.601 luminance
            grayscale[i] = (0.299f * r + 0.587f * g + 0.114f * b).toInt().toByte()
        }
        return grayscale
    }

    /**
     * Compute the LBP image from grayscale data.
     *
     * For each pixel (excluding border), compare with 8 neighbors in clockwise order:
     *   [7] [6] [5]
     *   [0]  P  [4]
     *   [1] [2] [3]
     *
     * Each comparison sets one bit: neighbor >= center → 1, else → 0
     * Result is an 8-bit value per pixel (0-255).
     */
    private fun computeLBPImage(grayscale: ByteArray, width: Int, height: Int): ByteArray {
        val lbp = ByteArray((width - 2) * (height - 2))

        for (y in 1 until height - 1) {
            for (x in 1 until width - 1) {
                val center = grayscale[y * width + x].toInt() and 0xFF
                var code = 0

                // 8-neighbor comparison in clockwise order starting from left
                if ((grayscale[(y) * width + (x - 1)].toInt() and 0xFF) >= center) code = code or (1 shl 0)
                if ((grayscale[(y + 1) * width + (x - 1)].toInt() and 0xFF) >= center) code = code or (1 shl 1)
                if ((grayscale[(y + 1) * width + (x)].toInt() and 0xFF) >= center) code = code or (1 shl 2)
                if ((grayscale[(y + 1) * width + (x + 1)].toInt() and 0xFF) >= center) code = code or (1 shl 3)
                if ((grayscale[(y) * width + (x + 1)].toInt() and 0xFF) >= center) code = code or (1 shl 4)
                if ((grayscale[(y - 1) * width + (x + 1)].toInt() and 0xFF) >= center) code = code or (1 shl 5)
                if ((grayscale[(y - 1) * width + (x)].toInt() and 0xFF) >= center) code = code or (1 shl 6)
                if ((grayscale[(y - 1) * width + (x - 1)].toInt() and 0xFF) >= center) code = code or (1 shl 7)

                lbp[(y - 1) * (width - 2) + (x - 1)] = code.toByte()
            }
        }

        return lbp
    }

    /**
     * Check if an LBP pattern is "uniform" — has at most 2 bitwise transitions.
     * Uniform patterns capture fundamental texture primitives (edges, corners, spots).
     */
    private fun isUniformPattern(pattern: Int): Boolean {
        var transitions = 0
        for (i in 0 until 7) {
            if (((pattern shr i) and 1) != ((pattern shr (i + 1)) and 1)) {
                transitions++
            }
        }
        // Also check the wrap-around transition (bit 7 → bit 0)
        if (((pattern shr 7) and 1) != (pattern and 1)) {
            transitions++
        }
        return transitions <= 2
    }

    /**
     * Block matching for optical flow: find the displacement of a block from frame1 in frame2.
     *
     * Uses Sum of Absolute Differences (SAD) as the matching cost function.
     * Searches within a window of ±searchRange pixels around the original block position.
     *
     * @return Pair of (dx, dy) displacement in pixels
     */
    private fun findBestMatch(
        frame1: ByteArray,
        frame2: ByteArray,
        imgWidth: Int,
        imgHeight: Int,
        blockX: Int,
        blockY: Int,
        blockSize: Int,
        searchRange: Int
    ): Pair<Int, Int> {
        var bestDx = 0
        var bestDy = 0
        var bestSAD = Long.MAX_VALUE

        for (dy in -searchRange..searchRange) {
            for (dx in -searchRange..searchRange) {
                val newX = blockX + dx
                val newY = blockY + dy

                // Bounds check: ensure target block is within frame
                if (newX < 0 || newX + blockSize > imgWidth ||
                    newY < 0 || newY + blockSize > imgHeight) continue

                // Compute Sum of Absolute Differences
                var sad = 0L
                for (y in 0 until blockSize) {
                    for (x in 0 until blockSize) {
                        val srcIdx = (blockY + y) * imgWidth + (blockX + x)
                        val dstIdx = (newY + y) * imgWidth + (newX + x)

                        if (srcIdx < frame1.size && dstIdx < frame2.size) {
                            val v1 = frame1[srcIdx].toInt() and 0xFF
                            val v2 = frame2[dstIdx].toInt() and 0xFF
                            sad += abs(v1 - v2)
                        }
                    }
                }

                if (sad < bestSAD) {
                    bestSAD = sad
                    bestDx = dx
                    bestDy = dy
                }
            }
        }

        return Pair(bestDx, bestDy)
    }
}
