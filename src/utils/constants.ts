/**
 * @module constants
 * @description Central configuration constants for the NHAI FaceAuth application.
 * All thresholds, model paths, sync config, and magic numbers are defined here
 * to avoid scattering values across the codebase.
 */

// ─────────────────────────────────────────────────────────────
// Model Paths (relative to the bundled assets directory)
// ─────────────────────────────────────────────────────────────

/** BlazeFace – lightweight face detection model */
export const MODEL_BLAZEFACE = 'models/blazeface.tflite';

/** MobileFaceNet – face embedding/recognition model */
export const MODEL_MOBILEFACENET = 'models/mobilefacenet.tflite';

/** 68-point facial landmark model */
export const MODEL_LANDMARK = 'models/landmark_68.tflite';

/** MiniFASNet – anti-spoofing / liveness model */
export const MODEL_MINIFASNET = 'models/minifasnet.tflite';

// ─────────────────────────────────────────────────────────────
// Model Input Sizes (pixels, square)
// ─────────────────────────────────────────────────────────────

/** BlazeFace expects 128×128 RGB input */
export const BLAZEFACE_INPUT_SIZE = 128;

/** MobileFaceNet expects 112×112 RGB input */
export const MOBILEFACENET_INPUT_SIZE = 112;

// ─────────────────────────────────────────────────────────────
// Embedding Configuration
// ─────────────────────────────────────────────────────────────

/** Dimensionality of the face embedding vector produced by MobileFaceNet */
export const EMBEDDING_DIM = 192;

// ─────────────────────────────────────────────────────────────
// Detection & Matching Thresholds
// ─────────────────────────────────────────────────────────────

/** Minimum confidence for BlazeFace to consider a detection valid */
export const FACE_DETECTION_CONFIDENCE = 0.75;

/**
 * Cosine-similarity threshold for a positive face match.
 * Values above this indicate the same person.
 */
export const FACE_MATCH_THRESHOLD = 0.65;

/**
 * Minimum aggregate liveness score to accept an authentication attempt.
 * The fusion engine must produce a score ≥ this value.
 */
export const LIVENESS_THRESHOLD = 0.70;

// ─────────────────────────────────────────────────────────────
// EAR / MAR Thresholds (facial action unit detection)
// ─────────────────────────────────────────────────────────────

/**
 * Eye Aspect Ratio threshold for blink detection.
 * When the EAR drops below this value a blink is registered.
 * Based on Soukupová & Čech (2016).
 */
export const EAR_BLINK_THRESHOLD = 0.21;

/**
 * Mouth Aspect Ratio threshold for smile detection.
 * Values above this indicate a smile/open-mouth transition.
 */
export const MAR_SMILE_THRESHOLD = 0.50;

// ─────────────────────────────────────────────────────────────
// Liveness Fusion Weights
// ─────────────────────────────────────────────────────────────

/**
 * Weighted contribution of each liveness signal to the final fusion score.
 * Weights must sum to 1.0.
 */
export const LIVENESS_WEIGHTS = {
  blink: 0.25,
  texture: 0.20,
  headPose: 0.20,
  consistency: 0.15,
  smile: 0.10,
  depth: 0.10,
} as const;

// ─────────────────────────────────────────────────────────────
// Liveness Engine Configuration
// ─────────────────────────────────────────────────────────────

/** Maximum number of frames retained in the liveness frame buffer */
export const LIVENESS_FRAME_BUFFER_SIZE = 30;

/** Minimum LBP entropy to consider a texture "real" (vs. printed/screen) */
export const LBP_ENTROPY_REAL_MIN = 5.5;

/** LBP entropy below this is almost certainly a spoof */
export const LBP_ENTROPY_SPOOF_MAX = 4.5;

/** Natural blink rate range (blinks per second) */
export const NATURAL_BLINK_RATE_MIN = 1;
export const NATURAL_BLINK_RATE_MAX = 3;

/** Minimum consecutive low-EAR frames to confirm a blink */
export const BLINK_CONSEC_FRAMES = 2;

/** Head-pose yaw/pitch tolerance for challenge matching (degrees) */
export const HEAD_POSE_TOLERANCE_DEG = 15;

// ─────────────────────────────────────────────────────────────
// Sync Engine Configuration
// ─────────────────────────────────────────────────────────────

/** Number of events to upload in a single batch */
export const SYNC_BATCH_SIZE = 50;

/** Maximum number of retry attempts before an event is marked failed */
export const MAX_RETRY_COUNT = 5;

/** Background sync interval in minutes */
export const SYNC_INTERVAL_MINUTES = 15;

/** Base delay (ms) for exponential backoff on sync failures */
export const SYNC_BACKOFF_BASE_MS = 1000;

// ─────────────────────────────────────────────────────────────
// Database Configuration
// ─────────────────────────────────────────────────────────────

/** SQLCipher database file name */
export const DB_NAME = 'nhai_faceauth.db';

/** Schema version – bump on migrations */
export const DB_VERSION = 1;

// ─────────────────────────────────────────────────────────────
// API Configuration
// ─────────────────────────────────────────────────────────────

/** AWS API Gateway endpoint for auth-event sync */
export const API_ENDPOINT = 'https://api.nhai-faceauth.example.com/v1';

/** Request timeout in milliseconds */
export const API_TIMEOUT_MS = 30_000;

// ─────────────────────────────────────────────────────────────
// Enrollment Configuration
// ─────────────────────────────────────────────────────────────

/** Number of face captures required during enrollment */
export const ENROLLMENT_CAPTURE_COUNT = 3;

/** Total enrollment steps shown to the user */
export const ENROLLMENT_TOTAL_STEPS = 3;
