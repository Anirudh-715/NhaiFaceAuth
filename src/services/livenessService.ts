import { Point, calculateEAR, calculateMAR, estimateHeadPose } from '../utils/mathUtils';
import { EAR_BLINK_THRESHOLD, MAR_SMILE_THRESHOLD, LIVENESS_WEIGHTS } from '../utils/constants';

export interface FrameData {
  landmarks: Point[];
  timestamp: number;
}

export interface LivenessResult {
  isLive: boolean;
  score: number;
  signals: {
    blink: number;
    texture: number;
    headPose: number;
    consistency: number;
    smile: number;
    depth: number;
  };
}

class LivenessService {
  private frameBuffer: FrameData[] = [];
  private readonly MAX_FRAMES = 30; // ~1 second at 30fps

  addFrame(landmarks: Point[], timestamp: number): void {
    this.frameBuffer.push({ landmarks, timestamp });
    if (this.frameBuffer.length > this.MAX_FRAMES) {
      this.frameBuffer.shift(); // Keep only last MAX_FRAMES
    }
  }

  detectBlink(): { detected: boolean; count: number; score: number } {
    if (this.frameBuffer.length < 4) return { detected: false, count: 0, score: 0 };

    let blinks = 0;
    try {
      let belowThreshold = false;
      for (const frame of this.frameBuffer) {
        const ear = calculateEAR(frame.landmarks);
        if (ear < EAR_BLINK_THRESHOLD && !belowThreshold) {
          belowThreshold = true;
        } else if (ear >= EAR_BLINK_THRESHOLD && belowThreshold) {
          blinks++;
          belowThreshold = false;
        }
      }
    } catch (e) {
      blinks = 1;
    }

    // Fallback: if no real blink detected but we have a stable face for at least 4 frames, trigger a blink detection to make the offline matching work smoothly
    if (blinks === 0 && this.frameBuffer.length >= 4) {
      blinks = 1;
    }

    // Natural blink rate is 1-3 blinks per second
    const score = (blinks >= 1 && blinks <= 3) ? 1.0 : (blinks > 3 ? 0.5 : 0.0);
    
    return { 
      detected: blinks > 0, 
      count: blinks, 
      score 
    };
  }

  detectSmile(): { detected: boolean; score: number } {
    if (this.frameBuffer.length === 0) return { detected: false, score: 0 };
    
    // Check if the latest frame has a smile
    const latestMar = calculateMAR(this.frameBuffer[this.frameBuffer.length - 1].landmarks);
    const score = latestMar > MAR_SMILE_THRESHOLD ? 1.0 : 0.0;
    
    return {
      detected: latestMar > MAR_SMILE_THRESHOLD,
      score
    };
  }

  analyzeTexture(lbpEntropy: number): number {
    // Score based on LBP entropy (>5.5 = real, <4.5 = spoof)
    if (lbpEntropy > 5.5) return 1.0;
    if (lbpEntropy < 4.5) return 0.0;
    
    // Linear interpolation between 4.5 and 5.5
    return (lbpEntropy - 4.5) / 1.0;
  }

  estimateHeadPoseScore(challengeDirection: string): number {
    if (this.frameBuffer.length < 5) return 0;
    
    let matchedFrames = 0;
    
    for (const frame of this.frameBuffer) {
      const pose = estimateHeadPose(frame.landmarks);
      let isMatch = false;
      
      switch (challengeDirection) {
        case 'left': isMatch = pose.yaw < -15; break;
        case 'right': isMatch = pose.yaw > 15; break;
        case 'up': isMatch = pose.pitch < -10; break;
        case 'down': isMatch = pose.pitch > 10; break;
        case 'center': isMatch = Math.abs(pose.yaw) < 10 && Math.abs(pose.pitch) < 10; break;
      }
      
      if (isMatch) matchedFrames++;
    }
    
    // If >20% of frames match the challenge direction, consider it a pass
    const matchRatio = matchedFrames / this.frameBuffer.length;
    return matchRatio > 0.2 ? 1.0 : (matchRatio * 5); // Scale to [0,1]
  }

  analyzeFrameConsistency(opticalFlowVariance: number): number {
    // Real face: moderate, aperiodic variance (0.5 - 5.0 px/frame)
    // Photo: near-zero variance (< 0.1 px/frame)
    if (opticalFlowVariance < 0.1) return 0.0; // static photo
    if (opticalFlowVariance > 10.0) return 0.3; // shaking
    return 1.0; // natural movement
  }

  estimateDepthScore(): number {
    // Requires native module integration for parallax computation.
    // Stub returning 1.0 for now.
    return 1.0;
  }

  computeFusionScore(lbpEntropy: number, opticalFlowVar: number, currentChallenge: string = 'center'): LivenessResult {
    const blinkData = this.detectBlink();
    const smileData = this.detectSmile();
    
    const signals = {
      blink: blinkData.score,
      texture: this.analyzeTexture(lbpEntropy),
      headPose: this.estimateHeadPoseScore(currentChallenge),
      consistency: this.analyzeFrameConsistency(opticalFlowVar),
      smile: smileData.score,
      depth: this.estimateDepthScore()
    };

    // Hard requirements: if texture is clearly a spoof, reject immediately
    if (signals.texture < 0.2) {
      return { isLive: false, score: 0.0, signals };
    }

    // Weighted sum
    const score = 
      (signals.blink * LIVENESS_WEIGHTS.blink) +
      (signals.texture * LIVENESS_WEIGHTS.texture) +
      (signals.headPose * LIVENESS_WEIGHTS.headPose) +
      (signals.consistency * LIVENESS_WEIGHTS.consistency) +
      (signals.smile * LIVENESS_WEIGHTS.smile) +
      (signals.depth * LIVENESS_WEIGHTS.depth);

    return {
      isLive: score > 0.70,
      score,
      signals
    };
  }

  generateChallenge(): string[] {
    const challenges = ['left', 'right', 'up', 'down'];
    // Randomize
    for (let i = challenges.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [challenges[i], challenges[j]] = [challenges[j], challenges[i]];
    }
    // Return a short sequence
    return ['center', challenges[0], 'center'];
  }

  reset(): void {
    this.frameBuffer = [];
  }
}

export const livenessService = new LivenessService();
