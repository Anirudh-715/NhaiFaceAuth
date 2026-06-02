/**
 * @module LivenessChecker
 * @description TypeScript interface for the native liveness-checking module.
 *
 * Provides low-level liveness signals that feed into the higher-level
 * LivenessService fusion engine:
 *   - Binary liveness classification (MiniFASNet)
 *   - LBP (Local Binary Pattern) texture entropy computation
 *   - Raw signal extraction from frame data
 *
 * A mock implementation is included for development without native bridges.
 */

import { NativeModules } from 'react-native';
import type { BBox } from './FaceDetector';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/** Individual liveness signals extracted from a frame. */
export interface LivenessSignals {
  /** LBP texture entropy (higher = more real-looking texture) */
  lbpEntropy: number;
  /** Moiré pattern score — detects screen display artifacts (0–1, lower = more moiré) */
  moireScore: number;
  /** Estimated depth variance from defocus analysis */
  depthVariance: number;
  /** Specular highlight ratio — screens have uniform highlights */
  specularRatio: number;
  /** Color-space analysis score — printed photos have limited gamut */
  colorScore: number;
}

/** Result of a full liveness check on a single frame. */
export interface LivenessResult {
  /** Whether the frame is classified as live (true) or spoof (false) */
  isLive: boolean;
  /** Overall liveness confidence (0–1) */
  confidence: number;
  /** Breakdown of individual signals */
  signals: LivenessSignals;
  /** Inference time in milliseconds */
  inferenceTimeMs: number;
}

/** Native module bridge interface. */
interface ILivenessCheckerNative {
  initialize(modelPath: string): Promise<boolean>;
  check(
    frameData: string,
    width: number,
    height: number,
    bbox: BBox,
  ): Promise<LivenessResult>;
  computeLBP(
    frameData: string,
    width: number,
    height: number,
    bbox: BBox,
  ): Promise<number>;
  release(): Promise<void>;
}

// ─────────────────────────────────────────────────────────────
// Mock Implementation
// ─────────────────────────────────────────────────────────────

/**
 * Mock liveness checker for development.
 * Returns plausible "live" signals with small random variation.
 */
class MockLivenessChecker implements ILivenessCheckerNative {
  private _initialized = false;

  async initialize(_modelPath: string): Promise<boolean> {
    this._initialized = true;
    console.log('[LivenessChecker] Mock initialised');
    return true;
  }

  async check(
    _frameData: string,
    _width: number,
    _height: number,
    _bbox: BBox,
  ): Promise<LivenessResult> {
    if (!this._initialized) {
      throw new Error('LivenessChecker not initialised. Call initialize() first.');
    }

    const signals: LivenessSignals = {
      lbpEntropy: 6.2 + (Math.random() - 0.5) * 0.8,
      moireScore: 0.85 + (Math.random() - 0.5) * 0.1,
      depthVariance: 0.7 + (Math.random() - 0.5) * 0.2,
      specularRatio: 0.3 + (Math.random() - 0.5) * 0.1,
      colorScore: 0.8 + (Math.random() - 0.5) * 0.15,
    };

    return {
      isLive: true,
      confidence: 0.88 + (Math.random() - 0.5) * 0.1,
      signals,
      inferenceTimeMs: 25,
    };
  }

  async computeLBP(
    _frameData: string,
    _width: number,
    _height: number,
    _bbox: BBox,
  ): Promise<number> {
    if (!this._initialized) {
      throw new Error('LivenessChecker not initialised. Call initialize() first.');
    }

    // Return a plausible LBP entropy for a real face
    return 6.0 + (Math.random() - 0.5) * 1.0;
  }

  async release(): Promise<void> {
    this._initialized = false;
    console.log('[LivenessChecker] Mock released');
  }
}

// ─────────────────────────────────────────────────────────────
// Module Resolution
// ─────────────────────────────────────────────────────────────

function resolveLivenessChecker(): ILivenessCheckerNative {
  try {
    const native = NativeModules.LivenessChecker as ILivenessCheckerNative | undefined;
    if (native && typeof native.check === 'function') {
      console.log('[LivenessChecker] Using native module');
      return native;
    }
  } catch {
    // Expected during development
  }
  console.warn('[LivenessChecker] Native module unavailable — using MOCK');
  return new MockLivenessChecker();
}

const checker = resolveLivenessChecker();

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Initialise the liveness model.
 *
 * @param modelPath - Path to the MiniFASNet TFLite model
 * @returns `true` on success
 */
export async function initialize(modelPath?: string): Promise<boolean> {
  return checker.initialize(modelPath ?? 'models/minifasnet.tflite');
}

/**
 * Run a full liveness check on a single frame.
 *
 * @param frameData - Base-64 encoded frame
 * @param width - Frame width in pixels
 * @param height - Frame height in pixels
 * @param bbox - Face bounding box
 * @returns Liveness result with individual signal breakdown
 */
export async function check(
  frameData: string,
  width: number,
  height: number,
  bbox: BBox,
): Promise<LivenessResult> {
  return checker.check(frameData, width, height, bbox);
}

/**
 * Compute LBP (Local Binary Pattern) texture entropy for the face region.
 *
 * LBP entropy measures the micro-texture complexity of the face crop.
 * Real faces exhibit higher entropy (> 5.5) than printed photos or
 * screen displays (< 4.5).
 *
 * @param frameData - Base-64 encoded frame
 * @param width - Frame width in pixels
 * @param height - Frame height in pixels
 * @param bbox - Face bounding box
 * @returns LBP entropy value (typically 3.0–8.0)
 */
export async function computeLBP(
  frameData: string,
  width: number,
  height: number,
  bbox: BBox,
): Promise<number> {
  return checker.computeLBP(frameData, width, height, bbox);
}

/**
 * Release model resources.
 */
export async function release(): Promise<void> {
  return checker.release();
}

export type { ILivenessCheckerNative };
