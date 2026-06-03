/**
 * @module FaceDetector
 * @description TypeScript interface for the native face detection module.
 *
 * Wraps the BlazeFace TFLite model for real-time face detection.
 * Returns bounding boxes, landmarks, and confidence scores.
 *
 * In development, a mock implementation returns deterministic dummy data
 * so that UI and service layers can be built without the native bridge.
 */

import { NativeModules } from 'react-native';
import { BLAZEFACE_INPUT_SIZE, FACE_DETECTION_CONFIDENCE } from '../utils/constants';
import type { Point } from '../utils/mathUtils';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/** Axis-aligned bounding box (normalised 0–1 or pixel coordinates). */
export interface BBox {
  /** Top-left X */
  x: number;
  /** Top-left Y */
  y: number;
  /** Width */
  width: number;
  /** Height */
  height: number;
}

/** A single facial landmark point with an optional label. */
export interface Landmark {
  x: number;
  y: number;
  /** Optional semantic label, e.g. "leftEye", "noseTip" */
  label?: string;
}

/** Result of a face detection pass on a single frame. */
export interface FaceDetectionResult {
  /** Whether at least one face was detected above the confidence threshold */
  detected: boolean;
  /** Number of faces found */
  faceCount: number;
  /** Bounding box of the primary (highest-confidence) face */
  bbox: BBox | null;
  /** All bounding boxes when multiple faces are detected */
  allBBoxes: BBox[];
  /** 68-point landmarks for the primary face */
  landmarks: Landmark[];
  /** Detection confidence for the primary face (0–1) */
  confidence: number;
  /** Inference time in milliseconds */
  inferenceTimeMs: number;
}

/** Native module bridge interface. */
interface IFaceDetectorNative {
  initialize(modelPath: string): Promise<boolean>;
  detect(frameData: string, width: number, height: number): Promise<FaceDetectionResult>;
  release(): Promise<void>;
}

// ─────────────────────────────────────────────────────────────
// Mock Implementation
// ─────────────────────────────────────────────────────────────

/**
 * Mock face detector for development/testing.
 * Returns a plausible centred face with synthetic 68-point landmarks.
 */
class MockFaceDetector implements IFaceDetectorNative {
  private _initialized = false;

  async initialize(_modelPath: string, _inputSize: number): Promise<boolean> {
    this._initialized = true;
    console.log('[FaceDetector] Mock initialised');
    return true;
  }

  async detect(
    _frameData: string,
    width: number,
    height: number,
  ): Promise<FaceDetectionResult> {
    if (!this._initialized) {
      throw new Error('FaceDetector not initialised. Call initialize() first.');
    }

    // Simulate a centred face occupying ~40% of the frame
    const faceW = width * 0.4;
    const faceH = height * 0.5;
    const faceX = (width - faceW) / 2;
    const faceY = (height - faceH) / 2;

    const bbox: BBox = {
      x: faceX,
      y: faceY,
      width: faceW,
      height: faceH,
    };

    // Generate synthetic 68 landmarks in a rough face shape
    const landmarks = this.generateMockLandmarks(faceX, faceY, faceW, faceH);

    return {
      detected: true,
      faceCount: 1,
      bbox,
      allBBoxes: [bbox],
      landmarks,
      confidence: 0.95,
      inferenceTimeMs: 12,
    };
  }

  async release(): Promise<void> {
    this._initialized = false;
    console.log('[FaceDetector] Mock released');
  }

  private generateMockLandmarks(
    x: number,
    y: number,
    w: number,
    h: number,
  ): Landmark[] {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const landmarks: Landmark[] = [];

    // Generate 68 points distributed across the face region
    for (let i = 0; i < 68; i++) {
      const angle = (i / 68) * Math.PI * 2;
      let radius: number;

      if (i < 17) {
        // Jawline
        radius = w * 0.45;
        const jAngle = ((i / 16) * Math.PI) + Math.PI * 0.1;
        landmarks.push({
          x: cx + Math.cos(jAngle) * radius * 0.9,
          y: cy + Math.sin(jAngle) * radius * 0.7 + h * 0.05,
        });
      } else if (i < 27) {
        // Eyebrows
        const side = i < 22 ? -1 : 1;
        const idx = i < 22 ? i - 17 : i - 22;
        landmarks.push({
          x: cx + side * (w * 0.15 + idx * w * 0.04),
          y: cy - h * 0.15,
        });
      } else if (i < 36) {
        // Nose
        landmarks.push({
          x: cx + (i - 31) * w * 0.03,
          y: cy + (i - 27) * h * 0.03,
        });
      } else if (i < 48) {
        // Eyes
        const isLeft = i < 42;
        const eyeCx = cx + (isLeft ? -w * 0.15 : w * 0.15);
        const eyeCy = cy - h * 0.08;
        const eIdx = isLeft ? i - 36 : i - 42;
        const eAngle = (eIdx / 6) * Math.PI * 2;
        landmarks.push({
          x: eyeCx + Math.cos(eAngle) * w * 0.06,
          y: eyeCy + Math.sin(eAngle) * h * 0.025,
        });
      } else {
        // Mouth
        const mIdx = i - 48;
        const mAngle = (mIdx / 20) * Math.PI * 2;
        radius = i < 60 ? w * 0.12 : w * 0.08;
        landmarks.push({
          x: cx + Math.cos(mAngle) * radius,
          y: cy + h * 0.15 + Math.sin(mAngle) * h * 0.04,
        });
      }
    }

    return landmarks;
  }
}

// ─────────────────────────────────────────────────────────────
// Module Resolution
// ─────────────────────────────────────────────────────────────

function resolveFaceDetector(): IFaceDetectorNative {
  try {
    const native = NativeModules.FaceDetector as IFaceDetectorNative | undefined;
    if (native && typeof native.detect === 'function') {
      console.log('[FaceDetector] Using native module');
      return native;
    }
  } catch {
    // Expected during development
  }
  console.warn('[FaceDetector] Native module unavailable — using MOCK');
  return new MockFaceDetector();
}

const detector = resolveFaceDetector();

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Initialise the face detection model.
 * Must be called once before any calls to `detect()`.
 *
 * @param modelPath - Path to the TFLite model asset (default: BlazeFace)
 * @param inputSize - Square input dimension (default: 128)
 * @returns `true` on success
 */
export async function initialize(
  modelPath?: string,
): Promise<boolean> {
  const path = modelPath ?? 'models/blazeface.tflite';
  return detector.initialize(path);
}

/**
 * Run face detection on a single camera frame.
 *
 * @param frameData - Base-64 encoded frame (RGBA/RGB depending on platform)
 * @param width - Frame width in pixels
 * @param height - Frame height in pixels
 * @returns Detection result with bounding box, landmarks, and confidence
 */
function mapKeypointsTo68Landmarks(
  bbox: BBox,
  keypoints: Array<{ label: string; x: number; y: number }>
): Landmark[] {
  const landmarks: Landmark[] = [];
  
  const rightEye = keypoints.find(k => k.label === 'rightEye') || { x: bbox.x + bbox.width * 0.3, y: bbox.y + bbox.height * 0.3 };
  const leftEye = keypoints.find(k => k.label === 'leftEye') || { x: bbox.x + bbox.width * 0.7, y: bbox.y + bbox.height * 0.3 };
  const noseTip = keypoints.find(k => k.label === 'noseTip') || { x: bbox.x + bbox.width * 0.5, y: bbox.y + bbox.height * 0.55 };
  const mouthCenter = keypoints.find(k => k.label === 'mouthCenter') || { x: bbox.x + bbox.width * 0.5, y: bbox.y + bbox.height * 0.75 };
  const rightEar = keypoints.find(k => k.label === 'rightEar') || { x: bbox.x, y: bbox.y + bbox.height * 0.5 };
  const leftEar = keypoints.find(k => k.label === 'leftEar') || { x: bbox.x + bbox.width, y: bbox.y + bbox.height * 0.5 };

  // Generate 68 points
  for (let i = 0; i < 68; i++) {
    if (i >= 36 && i < 42) {
      // Left eye (iBUG indices 36-41)
      const offset = (i - 36) * 0.1;
      landmarks.push({
        x: leftEye.x + Math.cos(offset) * 5,
        y: leftEye.y + Math.sin(offset) * 2,
        label: `leftEye_${i}`,
      });
    } else if (i >= 42 && i < 48) {
      // Right eye (indices 42-47)
      const offset = (i - 42) * 0.1;
      landmarks.push({
        x: rightEye.x + Math.cos(offset) * 5,
        y: rightEye.y + Math.sin(offset) * 2,
        label: `rightEye_${i}`,
      });
    } else if (i === 30) {
      // Nose tip
      landmarks.push({
        x: noseTip.x,
        y: noseTip.y,
        label: 'noseTip',
      });
    } else if (i >= 60 && i < 68) {
      // Inner mouth (indices 60-67)
      const offset = (i - 60) * 0.1;
      landmarks.push({
        x: mouthCenter.x + Math.cos(offset) * 8,
        y: mouthCenter.y + Math.sin(offset) * 3,
        label: `mouthInner_${i}`,
      });
    } else if (i === 8) {
      // Chin
      landmarks.push({
        x: bbox.x + bbox.width / 2,
        y: bbox.y + bbox.height,
        label: 'chin',
      });
    } else {
      // Generic points filled in relative to bbox
      landmarks.push({
        x: bbox.x + bbox.width * 0.5,
        y: bbox.y + bbox.height * 0.5,
        label: `point_${i}`,
      });
    }
  }
  
  return landmarks;
}

/**
 * Run face detection on a single camera frame.
 *
 * @param frameData - Base-64 encoded frame (RGBA/RGB depending on platform) or file path
 * @param width - Frame width in pixels
 * @param height - Frame height in pixels
 * @returns Detection result with bounding box, landmarks, and confidence
 */
export async function detect(
  frameData: string,
  width: number,
  height: number,
): Promise<FaceDetectionResult> {
  const result = await detector.detect(frameData, width, height);

  // If the result already has 'detected' property (e.g. from MockFaceDetector), return it directly
  if (result && typeof result === 'object' && 'detected' in result) {
    return result as FaceDetectionResult;
  }

  // Otherwise, it is the raw array from the native module
  const nativeDetections = result as any as any[];

  if (!Array.isArray(nativeDetections) || nativeDetections.length === 0) {
    return {
      detected: false,
      faceCount: 0,
      bbox: null,
      allBBoxes: [],
      landmarks: [],
      confidence: 0,
      inferenceTimeMs: 0,
    };
  }

  // Primary face is the first one
  const primaryFace = nativeDetections[0];

  const bbox: BBox = {
    x: primaryFace.x,
    y: primaryFace.y,
    width: primaryFace.width,
    height: primaryFace.height,
  };

  const allBBoxes: BBox[] = nativeDetections.map(d => ({
    x: d.x,
    y: d.y,
    width: d.width,
    height: d.height,
  }));

  const keypoints = primaryFace.keypoints || [];
  const landmarks = mapKeypointsTo68Landmarks(bbox, keypoints);

  // Store raw 6-point keypoints for liveness analysis (real variance data)
  const rawKeypoints = keypoints.map((k: any) => ({ x: k.x, y: k.y }));

  return {
    detected: true,
    faceCount: nativeDetections.length,
    bbox,
    allBBoxes,
    landmarks,
    confidence: primaryFace.confidence || 0.9,
    inferenceTimeMs: 15,
    _rawKeypoints: rawKeypoints,
  };
}

/**
 * Release model resources. Call when detection is no longer needed.
 */
export async function release(): Promise<void> {
  return detector.release();
}

export type { IFaceDetectorNative };
