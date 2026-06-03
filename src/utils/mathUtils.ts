/**
 * @module mathUtils
 * @description Mathematical utilities for the NHAI FaceAuth application.
 *
 * Provides vector operations (cosine similarity, L2 norm, Euclidean distance),
 * facial geometry calculations (EAR, MAR), and simplified head-pose estimation
 * from 68-point facial landmarks.
 *
 * Landmark indices follow the iBUG 68-point convention:
 *   - Left eye:  36–41
 *   - Right eye: 42–47
 *   - Mouth:     48–67  (inner: 60–67)
 *   - Nose tip:  30
 *   - Chin:      8
 */

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/** A 2-D point in image coordinates. */
export interface Point {
  x: number;
  y: number;
}

/** Head-pose Euler angles (degrees). */
export interface HeadPose {
  yaw: number;
  pitch: number;
  roll: number;
}

// ─────────────────────────────────────────────────────────────
// Vector Operations
// ─────────────────────────────────────────────────────────────

/**
 * Compute the cosine similarity between two equal-length vectors.
 *
 * ```
 * cos(θ) = (A · B) / (‖A‖ × ‖B‖)
 * ```
 *
 * @param a - First vector
 * @param b - Second vector (must have the same length as `a`)
 * @returns Similarity in the range [-1, 1]. Values closer to 1 indicate
 *          higher similarity. Returns 0 when either vector has zero magnitude.
 * @throws {Error} If vectors have different lengths
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Vector length mismatch: a.length=${a.length}, b.length=${b.length}`,
    );
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}

/**
 * L2-normalize a vector so that its Euclidean norm becomes 1.
 *
 * ```
 * v̂ = v / ‖v‖₂
 * ```
 *
 * @param vec - Input vector
 * @returns A new unit-length vector (or zero vector if input has zero magnitude)
 */
export function l2Normalize(vec: number[]): number[] {
  let sumSq = 0;
  for (let i = 0; i < vec.length; i++) {
    sumSq += vec[i] * vec[i];
  }

  const norm = Math.sqrt(sumSq);
  if (norm === 0) {
    return new Array(vec.length).fill(0);
  }

  return vec.map(v => v / norm);
}

/**
 * Compute the Euclidean (L2) distance between two equal-length vectors.
 *
 * ```
 * d(A, B) = √Σ(aᵢ − bᵢ)²
 * ```
 *
 * @param a - First vector
 * @param b - Second vector (must have the same length as `a`)
 * @returns Non-negative distance
 * @throws {Error} If vectors have different lengths
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Vector length mismatch: a.length=${a.length}, b.length=${b.length}`,
    );
  }

  let sumSq = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sumSq += diff * diff;
  }

  return Math.sqrt(sumSq);
}

/**
 * Euclidean distance between two 2-D points.
 *
 * @param p1 - First point
 * @param p2 - Second point
 * @returns Non-negative distance
 */
export function distance(p1: Point, p2: Point): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// ─────────────────────────────────────────────────────────────
// Eye Aspect Ratio (EAR)
// ─────────────────────────────────────────────────────────────

/**
 * Calculate the Eye Aspect Ratio (EAR) for a single eye given its
 * 6 landmark points.
 *
 * The Soukupová & Čech (2016) formula:
 * ```
 * EAR = (‖p2 − p6‖ + ‖p3 − p5‖) / (2 × ‖p1 − p4‖)
 * ```
 *
 * Where p1–p6 are the 6 landmarks of one eye ordered clockwise
 * starting from the outer corner:
 *   p1 = outer corner, p2 = upper-outer, p3 = upper-inner,
 *   p4 = inner corner, p5 = lower-inner, p6 = lower-outer.
 *
 * @param eyePoints - Array of exactly 6 eye landmark points
 * @returns EAR value; typically ~0.3 for open eyes, <0.21 during blinks
 * @throws {Error} If not exactly 6 points
 */
function earForEye(eyePoints: Point[]): number {
  if (eyePoints.length !== 6) {
    throw new Error(`EAR requires 6 eye points, got ${eyePoints.length}`);
  }

  const [p1, p2, p3, p4, p5, p6] = eyePoints;

  // Vertical distances
  const vertical1 = distance(p2, p6);
  const vertical2 = distance(p3, p5);

  // Horizontal distance
  const horizontal = distance(p1, p4);

  if (horizontal === 0) {
    return 0;
  }

  return (vertical1 + vertical2) / (2.0 * horizontal);
}

/**
 * Calculate the average Eye Aspect Ratio (EAR) across both eyes
 * from a full 68-point landmark set.
 *
 * Uses iBUG 68 landmark convention:
 *   - Left eye:  indices 36–41
 *   - Right eye: indices 42–47
 *
 * The returned value is the mean EAR of both eyes, which is more
 * robust to partial occlusion than using a single eye.
 *
 * @param landmarks - Full 68-point facial landmark array
 * @returns Average EAR value (both eyes)
 * @throws {Error} If landmarks array has fewer than 48 points
 */
export function calculateEAR(landmarks: Point[]): number {
  if (landmarks.length < 48) {
    // Graceful fallback for 6-point BlazeFace model
    return 0.35; 
  }

  const leftEye = landmarks.slice(36, 42); // indices 36–41
  const rightEye = landmarks.slice(42, 48); // indices 42–47

  const leftEAR = earForEye(leftEye);
  const rightEAR = earForEye(rightEye);

  return (leftEAR + rightEAR) / 2.0;
}

// ─────────────────────────────────────────────────────────────
// Mouth Aspect Ratio (MAR)
// ─────────────────────────────────────────────────────────────

/**
 * Calculate the Mouth Aspect Ratio (MAR) from inner-mouth landmarks.
 *
 * Uses the 8 inner-lip landmarks (iBUG indices 60–67) to measure
 * the vertical openness relative to horizontal width:
 *
 * ```
 * MAR = (‖p62 − p66‖ + ‖p63 − p65‖) / (2 × ‖p60 − p64‖)
 * ```
 *
 * Higher MAR → more open mouth (smile/talking).
 * Typical rest value ≈ 0.1–0.2; smile/open ≈ 0.5+.
 *
 * @param landmarks - Full 68-point facial landmark array
 * @returns MAR value
 * @throws {Error} If landmarks array has fewer than 68 points
 */
export function calculateMAR(landmarks: Point[]): number {
  if (landmarks.length < 68) {
    // Graceful fallback for 6-point BlazeFace model
    return 0.15;
  }

  // Inner mouth landmarks: 60 = left corner, 64 = right corner
  // 61 = upper-left, 62 = upper-mid, 63 = upper-right
  // 65 = lower-right, 66 = lower-mid, 67 = lower-left
  const p60 = landmarks[60];
  const p62 = landmarks[62];
  const p63 = landmarks[63];
  const p64 = landmarks[64];
  const p65 = landmarks[65];
  const p66 = landmarks[66];

  // Vertical distances
  const vertical1 = distance(p62, p66); // upper-mid ↔ lower-mid
  const vertical2 = distance(p63, p65); // upper-right ↔ lower-right

  // Horizontal distance
  const horizontal = distance(p60, p64); // left corner ↔ right corner

  if (horizontal === 0) {
    return 0;
  }

  return (vertical1 + vertical2) / (2.0 * horizontal);
}

// ─────────────────────────────────────────────────────────────
// Head Pose Estimation
// ─────────────────────────────────────────────────────────────

/**
 * Estimate head pose (yaw, pitch, roll) from 2-D facial landmarks.
 *
 * This is a simplified geometric estimation (not a full PnP solve)
 * that uses key facial anchor points to approximate Euler angles:
 *
 * **Yaw** (left-right rotation):
 *   Ratio of nose-tip distance to left/right eye centres.
 *   When the nose is closer to one eye, the head is turned.
 *
 * **Pitch** (up-down tilt):
 *   Vertical ratio of nose-tip relative to the eye-line and chin.
 *   Higher nose → looking up; lower → looking down.
 *
 * **Roll** (head tilt):
 *   Angle of the line connecting the two eye centres relative
 *   to the horizontal axis.
 *
 * @param landmarks - Full 68-point facial landmark array
 * @returns Estimated Euler angles in degrees
 * @throws {Error} If landmarks array has fewer than 68 points
 */
export function estimateHeadPose(landmarks: Point[]): HeadPose {
  if (landmarks.length < 6) {
    throw new Error(
      `Need at least 6 landmarks for head pose, got ${landmarks.length}`,
    );
  }

  // ─── 6-Point BlazeFace Estimator ───────────────────────────────
  if (landmarks.length === 6) {
    const rightEye = landmarks[0];
    const leftEye = landmarks[1];
    const nose = landmarks[2];
    const mouth = landmarks[3];
    const rightEar = landmarks[4];
    const leftEar = landmarks[5];

    // Midpoint between eyes
    const eyeMidX = (rightEye.x + leftEye.x) / 2;
    const eyeMidY = (rightEye.y + leftEye.y) / 2;

    // Horizontal eye distance (scale reference)
    const eyeDist = Math.sqrt((rightEye.x - leftEye.x) ** 2 + (rightEye.y - leftEye.y) ** 2);
    if (eyeDist === 0) {
      return { yaw: 0, pitch: 0, roll: 0 };
    }

    // 1. Yaw (Left-Right rotation)
    // Distance from nose to left ear vs right ear
    const distNoseToLeftEar = Math.sqrt((nose.x - leftEar.x) ** 2 + (nose.y - leftEar.y) ** 2);
    const distNoseToRightEar = Math.sqrt((nose.x - rightEar.x) ** 2 + (nose.y - rightEar.y) ** 2);
    
    // Normalized ratio difference: if head is turned left, nose is closer to right ear (mirrored or not)
    // Scale factor of 120 gives a yaw range of ~ -60 to +60 degrees
    const yawRatio = (distNoseToLeftEar - distNoseToRightEar) / (distNoseToLeftEar + distNoseToRightEar);
    const yaw = yawRatio * 120;

    // 2. Pitch (Up-Down rotation)
    // Vertical distance from eye line to nose, normalized by vertical distance from nose to mouth
    const eyeToNoseY = nose.y - eyeMidY;
    const noseToMouthY = mouth.y - nose.y;
    
    // Reference ratio is normally around 0.8
    const pitchRatio = noseToMouthY > 0 ? (eyeToNoseY / noseToMouthY) : 1.0;
    const expectedPitchRatio = 0.85;
    // Lower ratio means nose is closer to eyes (looking up)
    // Scale factor of 120 translates it to degrees
    const pitch = (pitchRatio - expectedPitchRatio) * -120;

    // 3. Roll (Head tilt)
    const deltaY = leftEye.y - rightEye.y;
    const deltaX = leftEye.x - rightEye.x;
    const roll = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

    return {
      yaw: clamp(yaw, -90, 90),
      pitch: clamp(pitch, -90, 90),
      roll: clamp(roll, -90, 90),
    };
  }

  // ─── 68-Point iBUG Estimator ──────────────────────────────────
  const noseTip = landmarks[30];
  const chin = landmarks[8];
  const leftEyeCenter = midpoint(landmarks[36], landmarks[39]);
  const rightEyeCenter = midpoint(landmarks[42], landmarks[45]);
  const eyeCenter = midpoint(leftEyeCenter, rightEyeCenter);

  const interOcularDist = distance(leftEyeCenter, rightEyeCenter);
  if (interOcularDist === 0) {
    return { yaw: 0, pitch: 0, roll: 0 };
  }

  const noseOffsetX = noseTip.x - eyeCenter.x;
  const yaw = (noseOffsetX / interOcularDist) * 45;

  const faceHeight = distance(eyeCenter, chin);
  if (faceHeight === 0) {
    return { yaw, pitch: 0, roll: 0 };
  }

  const noseOffsetY = noseTip.y - eyeCenter.y;
  const expectedRatio = 0.45;
  const actualRatio = noseOffsetY / faceHeight;
  const pitch = (actualRatio - expectedRatio) * 120;

  const deltaY = rightEyeCenter.y - leftEyeCenter.y;
  const deltaX = rightEyeCenter.x - leftEyeCenter.x;
  const roll = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

  return {
    yaw: clamp(yaw, -90, 90),
    pitch: clamp(pitch, -90, 90),
    roll: clamp(roll, -90, 90),
  };
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Compute the midpoint of two 2-D points.
 *
 * @param a - First point
 * @param b - Second point
 * @returns Midpoint
 */
export function midpoint(a: Point, b: Point): Point {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

/**
 * Clamp a number to a given range.
 *
 * @param value - Input value
 * @param min - Minimum bound
 * @param max - Maximum bound
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Compute a simple 2-D affine transform matrix (3×3, row-major)
 * that maps three source points to three destination points.
 *
 * Used for face alignment before feeding crops to the recognition model.
 *
 * @param src - Three source points [topLeft, topRight, bottomLeft]
 * @param dst - Three destination points
 * @returns 6-element array [a, b, tx, c, d, ty] of the affine matrix
 * @throws {Error} If not exactly 3 points in each array
 */
export function computeAffineTransform(
  src: [Point, Point, Point],
  dst: [Point, Point, Point],
): number[] {
  if (src.length !== 3 || dst.length !== 3) {
    throw new Error('Affine transform requires exactly 3 source and 3 destination points');
  }

  // Solve the 2×3 affine system:
  //   [ x'₁ ]   [ a  b  tx ] [ x₁ ]
  //   [ y'₁ ] = [ c  d  ty ] [ y₁ ]
  //   [  1  ]                 [  1 ]
  //
  // Rearranged into Ax = b form and solved via Cramer's rule.

  const [s0, s1, s2] = src;
  const [d0, d1, d2] = dst;

  const det =
    s0.x * (s1.y - s2.y) - s1.x * (s0.y - s2.y) + s2.x * (s0.y - s1.y);

  if (Math.abs(det) < 1e-10) {
    throw new Error('Source points are collinear; affine transform is undefined');
  }

  const invDet = 1.0 / det;

  // Solve for [a, b, tx]
  const a =
    (d0.x * (s1.y - s2.y) - d1.x * (s0.y - s2.y) + d2.x * (s0.y - s1.y)) *
    invDet;
  const b =
    (s0.x * (d1.x - d2.x) - s1.x * (d0.x - d2.x) + s2.x * (d0.x - d1.x)) *
    invDet;
  const tx =
    (s0.x * (s1.y * d2.x - s2.y * d1.x) -
      s1.x * (s0.y * d2.x - s2.y * d0.x) +
      s2.x * (s0.y * d1.x - s1.y * d0.x)) *
    invDet;

  // Solve for [c, d, ty]
  const c =
    (d0.y * (s1.y - s2.y) - d1.y * (s0.y - s2.y) + d2.y * (s0.y - s1.y)) *
    invDet;
  const d =
    (s0.x * (d1.y - d2.y) - s1.x * (d0.y - d2.y) + s2.x * (d0.y - d1.y)) *
    invDet;
  const ty =
    (s0.x * (s1.y * d2.y - s2.y * d1.y) -
      s1.x * (s0.y * d2.y - s2.y * d0.y) +
      s2.x * (s0.y * d1.y - s1.y * d0.y)) *
    invDet;

  return [a, b, tx, c, d, ty];
}

/**
 * Apply a 2-D affine transform to a point.
 *
 * @param transform - 6-element affine matrix [a, b, tx, c, d, ty]
 * @param point - Input point
 * @returns Transformed point
 */
export function applyAffineTransform(
  transform: number[],
  point: Point,
): Point {
  if (transform.length !== 6) {
    throw new Error('Affine transform must have exactly 6 elements');
  }

  const [a, b, tx, c, d, ty] = transform;
  return {
    x: a * point.x + b * point.y + tx,
    y: c * point.x + d * point.y + ty,
  };
}
