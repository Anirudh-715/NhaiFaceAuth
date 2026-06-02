/**
 * @module FaceRecognizer
 * @description TypeScript interface for the native face recognition module.
 *
 * Wraps the MobileFaceNet TFLite model to extract 128-dimensional face
 * embeddings from aligned face crops. Embeddings can then be compared
 * using cosine similarity for identity matching.
 *
 * A mock implementation is provided for development without native bridges.
 */

import { NativeModules } from 'react-native';
import { EMBEDDING_DIM, MOBILEFACENET_INPUT_SIZE } from '../utils/constants';
import type { BBox } from './FaceDetector';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/** Result of a face embedding extraction. */
export interface EmbeddingResult {
  /** 128-dimensional L2-normalised face embedding */
  embedding: number[];
  /** Time taken for inference in milliseconds */
  inferenceTimeMs: number;
  /** Whether the embedding was successfully extracted */
  success: boolean;
  /** Error message if extraction failed */
  error?: string;
}

/** Native module bridge interface. */
interface IFaceRecognizerNative {
  initialize(modelPath: string): Promise<boolean>;
  extractEmbedding(
    frameData: string,
    width: number,
    height: number,
    bbox: BBox,
  ): Promise<EmbeddingResult>;
  release(): Promise<void>;
}

// ─────────────────────────────────────────────────────────────
// Mock Implementation
// ─────────────────────────────────────────────────────────────

/**
 * Mock face recogniser that returns deterministic embeddings.
 *
 * The mock produces embeddings seeded from the bounding-box centre
 * so that the same face position yields the same embedding — useful
 * for testing the matching pipeline.
 */
class MockFaceRecognizer implements IFaceRecognizerNative {
  private _initialized = false;

  async initialize(_modelPath: string, _inputSize: number): Promise<boolean> {
    this._initialized = true;
    console.log('[FaceRecognizer] Mock initialised');
    return true;
  }

  async extractEmbedding(
    _frameData: string,
    _width: number,
    _height: number,
    bbox: BBox,
  ): Promise<EmbeddingResult> {
    if (!this._initialized) {
      throw new Error('FaceRecognizer not initialised. Call initialize() first.');
    }

    // Generate a deterministic embedding seeded from bbox centre
    const seed = Math.round(bbox.x + bbox.y * 1000);
    const embedding = this.generateSeededEmbedding(seed, EMBEDDING_DIM);

    return {
      embedding,
      inferenceTimeMs: 18,
      success: true,
    };
  }

  async release(): Promise<void> {
    this._initialized = false;
    console.log('[FaceRecognizer] Mock released');
  }

  /**
   * Generate a pseudo-random unit-length embedding from a seed.
   * Uses a simple LCG for reproducibility.
   */
  private generateSeededEmbedding(seed: number, dim: number): number[] {
    let s = seed;
    const raw: number[] = [];

    for (let i = 0; i < dim; i++) {
      // Linear congruential generator
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      raw.push((s / 0xffffffff) * 2 - 1); // map to [-1, 1]
    }

    // L2-normalise
    let norm = 0;
    for (const v of raw) {
      norm += v * v;
    }
    norm = Math.sqrt(norm);

    if (norm === 0) {
      return new Array(dim).fill(1 / Math.sqrt(dim));
    }

    return raw.map(v => v / norm);
  }
}

// ─────────────────────────────────────────────────────────────
// Module Resolution
// ─────────────────────────────────────────────────────────────

function resolveFaceRecognizer(): IFaceRecognizerNative {
  try {
    const native = NativeModules.FaceRecognizer as IFaceRecognizerNative | undefined;
    if (native && typeof native.extractEmbedding === 'function') {
      console.log('[FaceRecognizer] Using native module');
      return native;
    }
  } catch {
    // Expected during development
  }
  console.warn('[FaceRecognizer] Native module unavailable — using MOCK');
  return new MockFaceRecognizer();
}

const recognizer = resolveFaceRecognizer();

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Initialise the face recognition model.
 * Must be called once before `extractEmbedding()`.
 *
 * @param modelPath - Path to the MobileFaceNet TFLite model
 * @param inputSize - Square input dimension (default: 112)
 * @returns `true` on success
 */
export async function initialize(
  modelPath?: string,
): Promise<boolean> {
  const path = modelPath ?? 'models/mobilefacenet.tflite';
  return recognizer.initialize(path);
}

/**
 * Extract a face embedding from a camera frame.
 *
 * The native module handles cropping, alignment, and resizing
 * based on the provided bounding box.
 *
 * @param frameData - Base-64 encoded frame data
 * @param width - Frame width in pixels
 * @param height - Frame height in pixels
 * @param bbox - Face bounding box from the detector
 * @returns 128-dimensional L2-normalised embedding
 */
export async function extractEmbedding(
  frameData: string,
  width: number,
  height: number,
  bbox: BBox,
): Promise<EmbeddingResult> {
  try {
    const result = await recognizer.extractEmbedding(frameData, width, height, bbox);
    if (Array.isArray(result)) {
      return {
        embedding: result,
        inferenceTimeMs: 15,
        success: true,
      };
    }
    return result;
  } catch (err: any) {
    return {
      embedding: [],
      inferenceTimeMs: 0,
      success: false,
      error: err?.message || 'Failed to extract face embedding',
    };
  }
}

/**
 * Release model resources.
 */
export async function release(): Promise<void> {
  return recognizer.release();
}

export type { IFaceRecognizerNative };
