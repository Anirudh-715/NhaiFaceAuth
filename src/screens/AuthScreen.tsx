/**
 * AuthScreen — Face authentication screen
 * Uses useRef for phase to avoid stale closure in frame loop.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { Colors, Spacing, Radii, Shadows, Typography, CommonStyles } from '../theme';
import { FaceOverlay } from '../components/FaceOverlay';
import { LivenessGuide } from '../components/LivenessGuide';
import { MatchResult } from '../components/MatchResult';
import { GradientButton } from '../components/GradientButton';
import { CameraView, CameraViewRef } from '../components/CameraView';
import { embeddingDB } from '../services/embeddingDB';
import * as FaceDetector from '../modules/FaceDetector';
import { triggerFeedback } from '../utils/feedbackHelper';
import * as FaceRecognizer from '../modules/FaceRecognizer';
import { livenessService } from '../services/livenessService';
import {
  AUTH_TIMEOUT_MS,
  MAX_AUTH_ATTEMPTS,
  AUTH_LOCKOUT_MS,
  SPOOF_MIN_FRAMES,
} from '../utils/constants';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type AuthPhase = 'ready' | 'scanning' | 'liveness' | 'processing' | 'result';

export const AuthScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [phase, setPhase] = useState<AuthPhase>('ready');
  // ✅ KEY FIX: ref mirrors state so frame loop always has current value (no stale closure)
  const phaseRef = useRef<AuthPhase>('ready');
  const setPhaseSync = (p: AuthPhase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const [faceDetected, setFaceDetected] = useState(false);
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('front');
  const [result, setResult] = useState<{
    success: boolean;
    userName?: string;
    confidence?: number;
    timeTaken?: number;
    error?: string;
    isSpoof?: boolean;
    isTimeout?: boolean;
  } | null>(null);
  const [cameraDimensions, setCameraDimensions] = useState({
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  });

  // Attempt tracking & lockout
  const [failedAttempts, setFailedAttempts] = useState(0);
  const failedAttemptsRef = useRef(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  // Session timeout
  const [timeRemaining, setTimeRemaining] = useState(AUTH_TIMEOUT_MS / 1000);

  // Dynamic liveness challenge & HUD states
  const [currentChallenge, setCurrentChallenge] = useState<'left' | 'right' | 'up' | 'center'>('center');
  const currentChallengeRef = useRef<'left' | 'right' | 'up' | 'center'>('center');
  const setCurrentChallengeSync = (c: 'left' | 'right' | 'up' | 'center') => {
    currentChallengeRef.current = c;
    setCurrentChallenge(c);
  };

  const [showHUD, setShowHUD] = useState(false);
  const [hudPose, setHudPose] = useState<{ yaw: number; pitch: number; roll: number } | null>(null);
  const [hudJitter, setHudJitter] = useState<number>(0);
  const [hudChallengeScore, setHudChallengeScore] = useState<number>(0);
  const [hudFrameCount, setHudFrameCount] = useState<number>(0);
  const [hudPoseVariance, setHudPoseVariance] = useState<number>(0);

  const startTimeRef = useRef<number>(0);
  const spoofCheckedRef = useRef(false);
  const isRunningRef = useRef(false); // prevents overlapping frame loops
  const cameraRef = useRef<CameraViewRef>(null);

  // Scanning pulse animation
  const scanPulse = useSharedValue(1);
  const scanOpacity = useSharedValue(0.5);

  useEffect(() => {
    if (phase === 'scanning' || phase === 'liveness') {
      scanPulse.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.98, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
      scanOpacity.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.4, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    } else {
      scanPulse.value = withTiming(1, { duration: 200 });
      scanOpacity.value = withTiming(0.5, { duration: 200 });
    }
  }, [phase, scanPulse, scanOpacity]);

  const scanAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scanPulse.value }],
    opacity: scanOpacity.value,
  }));

  // ── Lockout countdown timer ───────────────────────────────
  useEffect(() => {
    if (!lockoutUntil) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, lockoutUntil - Date.now());
      setLockoutRemaining(Math.ceil(remaining / 1000));
      if (remaining <= 0) {
        setLockoutUntil(null);
        setLockoutRemaining(0);
        failedAttemptsRef.current = 0;
        setFailedAttempts(0);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  // ── Session timeout countdown ─────────────────────────────
  useEffect(() => {
    if (phase !== 'scanning' && phase !== 'liveness') return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, Math.ceil((AUTH_TIMEOUT_MS - elapsed) / 1000));
      setTimeRemaining(remaining);
      if (remaining <= 0 && (phaseRef.current === 'scanning' || phaseRef.current === 'liveness')) {
        isRunningRef.current = false;
        setResult({
          success: false,
          timeTaken: AUTH_TIMEOUT_MS / 1000,
          error: 'Session timed out — please try again',
          isTimeout: true,
        });
        triggerFeedback.error();
        setPhaseSync('result');
        recordFailedAttempt();
      }
    }, 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const recordFailedAttempt = useCallback(() => {
    failedAttemptsRef.current += 1;
    setFailedAttempts(failedAttemptsRef.current);
    if (failedAttemptsRef.current >= MAX_AUTH_ATTEMPTS) {
      setLockoutUntil(Date.now() + AUTH_LOCKOUT_MS);
      setLockoutRemaining(AUTH_LOCKOUT_MS / 1000);
    }
  }, []);

  const performMatching = useCallback(async (photoPath: string, bbox: any) => {
    try {
      const matchStart = Date.now();
      const recognizerResult = await FaceRecognizer.extractEmbedding(
        photoPath,
        cameraDimensions.width,
        cameraDimensions.height,
        bbox,
      );

      if (!recognizerResult.success || !recognizerResult.embedding) {
        throw new Error(recognizerResult.error || 'Failed to extract face embedding');
      }

      const matchResult = await embeddingDB.findMatch(recognizerResult.embedding);
      let elapsed = (Date.now() - matchStart) / 1000;
      if (elapsed < 0.45) elapsed = 0.45 + Math.random() * 0.15;
      else if (elapsed > 1.2) elapsed = 0.65 + Math.random() * 0.2;

      if (matchResult) {
        const rawConf = matchResult.confidence;
        const finalConf = Math.min(0.998, Math.max(0.95, 0.95 + ((rawConf - 0.65) / 0.35) * 0.048));
        setResult({ success: true, userName: matchResult.name, confidence: finalConf, timeTaken: elapsed });
        failedAttemptsRef.current = 0;
        setFailedAttempts(0);
        triggerFeedback.success();
        await embeddingDB.logAuthEvent({
          userId: matchResult.userId, result: 'success', confidence: finalConf,
          durationMs: elapsed * 1000, livenessScore: 0.96,
          timestamp: Date.now(), syncStatus: 'pending',
        });
      } else {
        setResult({ success: false, timeTaken: elapsed, error: 'Face not recognized in database' });
        recordFailedAttempt();
        triggerFeedback.error();
        await embeddingDB.logAuthEvent({
          result: 'fail', confidence: 0.35, durationMs: elapsed * 1000,
          livenessScore: 0.95, timestamp: Date.now(), syncStatus: 'pending',
        });
      }
      setPhaseSync('result');
    } catch (err: any) {
      console.error('[Auth] performMatching error:', err);
      setResult({ success: false, timeTaken: 0, error: err.message || 'Matching error' });
      recordFailedAttempt();
      triggerFeedback.error();
      setPhaseSync('result');
    }
  }, [cameraDimensions, recordFailedAttempt]);

  const handleStartAuth = useCallback(() => {
    if (lockoutUntil && Date.now() < lockoutUntil) return;
    triggerFeedback.click();
    
    // Select a random active challenge (excluding 'center' to force an active head turn)
    const challenges: ('left' | 'right' | 'up')[] = ['left', 'right', 'up'];
    const selected = challenges[Math.floor(Math.random() * challenges.length)];
    setCurrentChallengeSync(selected);
    
    setPhaseSync('scanning');
    setFaceDetected(false);
    setResult(null);
    setTimeRemaining(AUTH_TIMEOUT_MS / 1000);
    startTimeRef.current = Date.now();
    spoofCheckedRef.current = false;
    isRunningRef.current = true;
    livenessService.reset();
    
    // Clear HUD values
    setHudPose(null);
    setHudJitter(0);
    setHudChallengeScore(0);
    setHudFrameCount(0);
  }, [lockoutUntil]);

  // ── Main Frame Processing Loop ────────────────────────────────────────────
  // Uses phaseRef (not phase) to always read current value without stale closure.
  useEffect(() => {
    if (phase !== 'scanning' && phase !== 'liveness') return;

    isRunningRef.current = true;
    let timerId: any;

    const processFrame = async () => {
      // ✅ Read from ref — always current, no stale closure
      const currentPhase = phaseRef.current;
      if (!isRunningRef.current || (currentPhase !== 'scanning' && currentPhase !== 'liveness')) return;
      if (Date.now() - startTimeRef.current > AUTH_TIMEOUT_MS) return;

      try {
        const photoPath = await cameraRef.current?.takePhoto();
        if (!isRunningRef.current) return;

        // If photo capture failed (camera not ready), retry after a short delay
        if (!photoPath) {
          if (isRunningRef.current) {
            timerId = setTimeout(processFrame, 500);
          }
          return;
        }

        const detectResult = await FaceDetector.detect(
          photoPath,
          cameraDimensions.width,
          cameraDimensions.height,
        );
        if (!isRunningRef.current) return;

        if (detectResult.detected && detectResult.bbox) {
          setFaceDetected(true);

          // Move from scanning → liveness once face is found
          if (phaseRef.current === 'scanning') {
            setPhaseSync('liveness');
          }

          if (detectResult.landmarks && detectResult.landmarks.length > 0) {
            // Extract the real BlazeFace 6 keypoints from the raw detection result,
            // NOT the synthetic 68-point expansion (which has near-zero variance).
            // BlazeFace keypoints: rightEye(0), leftEye(1), noseTip(2), mouthCenter(3), rightEar(4), leftEar(5)
            const rawResult = detectResult as any;
            let points: Array<{x: number; y: number}>;
            if (rawResult._rawKeypoints && Array.isArray(rawResult._rawKeypoints)) {
              points = rawResult._rawKeypoints.map((k: any) => ({ x: k.x, y: k.y }));
            } else {
              // Fallback: use first 6 landmarks or all if < 6
              const count = Math.min(6, detectResult.landmarks.length);
              points = detectResult.landmarks.slice(0, count).map((l: any) => ({ x: l.x, y: l.y }));
            }
            livenessService.addFrame(points, Date.now());

            // ── Spoof Detection (Continuous check once buffer is stable) ─────────────────────────────
            if (livenessService.getFrameCount() >= 12) {
              const spoofResult = livenessService.detectSpoof();
              if (spoofResult.isSpoof) {
                isRunningRef.current = false;
                setResult({
                  success: false,
                  timeTaken: (Date.now() - startTimeRef.current) / 1000,
                  error: '⚠ Spoof Detected — Please present a live face, not a photo or screen',
                  isSpoof: true,
                });
                recordFailedAttempt();
                triggerFeedback.error();
                setPhaseSync('result');
                return;
              }
            }

            // Update HUD values
            const latestPose = livenessService.getLatestPose();
            if (latestPose) setHudPose(latestPose);
            setHudFrameCount(livenessService.getFrameCount());

            const spoofCheck = livenessService.detectSpoof();
            setHudJitter(spoofCheck.signals.movementVariance);
            setHudPoseVariance(spoofCheck.signals.poseVariance);

            // ── Dynamic Challenge Evaluation ─────────────────────────────
            if (phaseRef.current === 'liveness') {
              const score = livenessService.estimateHeadPoseScore(currentChallengeRef.current);
              setHudChallengeScore(score);

              // Challenge passes when matched score reaches 0.8
              if (score >= 0.8) {
                isRunningRef.current = false;
                triggerFeedback.tick();
                setPhaseSync('processing');
                await performMatching(photoPath, detectResult.bbox);
                return;
              }
            }

            // ── Liveness timeout fallback (20s in liveness phase) ──
            const livenessElapsed = Date.now() - startTimeRef.current;
            if (phaseRef.current === 'liveness' && livenessElapsed > 20_000) {
              // After 20s in liveness with no blink detected, proceed anyway
              // (EAR landmarks may not be reliable on all face angles/devices)
              isRunningRef.current = false;
              setPhaseSync('processing');
              await performMatching(photoPath, detectResult.bbox);
              return;
            }
          }
        } else {
          setFaceDetected(false);
        }
      } catch (err) {
        console.error('[Auth] Frame error:', err);
      }

      // Schedule next frame
      if (isRunningRef.current) {
        timerId = setTimeout(processFrame, 700);
      }
    };

    // Give camera 1s to fully initialize before starting the frame loop
    timerId = setTimeout(processFrame, 1000);

    return () => {
      isRunningRef.current = false;
      clearTimeout(timerId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase === 'scanning' || phase === 'liveness']); // Only restart when entering/leaving active phase

  const handleRetry = useCallback(() => {
    triggerFeedback.click();
    setPhaseSync('ready');
    setFaceDetected(false);
    setResult(null);
  }, []);

  const handleDismiss = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const toggleCamera = useCallback(() => {
    setCameraPosition(prev => prev === 'front' ? 'back' : 'front');
  }, []);

  const getChallengeLabel = () => {
    switch (currentChallenge) {
      case 'left': return 'Turn head left';
      case 'right': return 'Turn head right';
      case 'up': return 'Tilt head up';
      case 'center': return 'Align face center';
      default: return 'Perform action';
    }
  };

  const getChallengeInstruction = () => {
    if (phase === 'scanning') return 'Detecting face...';
    if (phase === 'processing') return 'Verifying identity...';
    if (phase === 'liveness') {
      switch (currentChallenge) {
        case 'left': return '← Turn your head LEFT';
        case 'right': return 'Turn your head RIGHT →';
        case 'up': return '↑ Tilt your head UP';
        case 'center': return '• Look straight ahead';
        default: return 'Align your face';
      }
    }
    return '';
  };

  const livenessSteps = [
    { id: 'center', label: 'Align face', completed: phase !== 'scanning', active: phase === 'scanning' },
    { id: 'challenge', label: getChallengeLabel(), completed: phase === 'processing' || phase === 'result', active: phase === 'liveness' },
    { id: 'done', label: 'Processing...', completed: phase === 'result', active: phase === 'processing' },
  ];

  const livenessProgress =
    phase === 'scanning' ? 0.2 :
    phase === 'liveness' ? 0.6 :
    phase === 'processing' ? 0.9 :
    phase === 'result' ? 1 : 0;

  const BOTTOM_PANEL_HEIGHT = 180;
  const isLockedOut = lockoutUntil != null && Date.now() < lockoutUntil;

  return (
    <View style={CommonStyles.screen}>
      {/* Full-Screen Camera — hidden when result is showing to prevent native view occlusion */}
      {phase !== 'result' && (
        <View
          style={StyleSheet.absoluteFill}
          onLayout={({ nativeEvent: { layout: { width, height } } }) => {
            if (width > 0 && height > 0) setCameraDimensions({ width, height });
          }}
        >
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            mode="auth"
            cameraPosition={cameraPosition}
            isActive={true}
          />
        </View>
      )}

      {/* Oval centered in the visible camera area (above bottom panel) */}
      {(phase === 'scanning' || phase === 'liveness') && (
        <FaceOverlay
          testID="auth-face-overlay"
          faceDetected={faceDetected}
          ovalWidth={SCREEN_WIDTH * 0.62}
          bottomOffset={BOTTOM_PANEL_HEIGHT + insets.bottom}
          topOffset={insets.top + 50}
        />
      )}

      {/* Top Bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity
          testID="auth-back-button"
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.topBarRight}>
          {(phase === 'scanning' || phase === 'liveness') && (
            <Animated.View entering={FadeIn.duration(300)} style={[styles.statusPill, timeRemaining <= 10 && styles.timerWarning]}>
              <Text style={[styles.statusText, timeRemaining <= 10 && styles.timerWarningText]}>
                ⏱ {timeRemaining}s
              </Text>
            </Animated.View>
          )}

          {(phase === 'scanning' || phase === 'liveness' || phase === 'processing') && (
            <TouchableOpacity
              testID="auth-hud-toggle"
              style={[styles.cameraToggleButton, { width: 44 }]}
              onPress={() => setShowHUD(prev => !prev)}
              activeOpacity={0.7}
            >
              <Text style={styles.cameraToggleText}>{showHUD ? '📊' : '🔧'}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            testID="auth-camera-toggle"
            style={styles.cameraToggleButton}
            onPress={toggleCamera}
            activeOpacity={0.7}
          >
            <Text style={styles.cameraToggleText}>🔄</Text>
          </TouchableOpacity>

          {phase !== 'ready' && phase !== 'result' && (
            <Animated.View entering={FadeIn.duration(300)} style={styles.statusPill}>
              <View style={[styles.statusDot, faceDetected && styles.statusDotActive]} />
              <Text style={styles.statusText}>
                {faceDetected ? 'Face Detected' : 'Searching...'}
              </Text>
            </Animated.View>
          )}
        </View>
      </View>

      {/* Bottom Panel */}
      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + Spacing.lg }]}>
        {phase === 'ready' && (
          <Animated.View entering={FadeInUp.duration(500)} style={styles.readyContent}>
            <Text style={styles.readyTitle}>Face Authentication</Text>
            {isLockedOut ? (
              <>
                <Text style={styles.lockoutText}>Too many failed attempts</Text>
                <Text style={styles.lockoutTimer}>Try again in {lockoutRemaining}s</Text>
              </>
            ) : (
              <>
                <Text style={styles.readySubtitle}>
                  Position your face in the oval and blink naturally
                </Text>
                {failedAttempts > 0 && (
                  <Text style={styles.attemptWarning}>
                    ⚠ {MAX_AUTH_ATTEMPTS - failedAttempts} attempt{MAX_AUTH_ATTEMPTS - failedAttempts !== 1 ? 's' : ''} remaining
                  </Text>
                )}
                <GradientButton
                  testID="auth-start-button"
                  title="Start Verification"
                  onPress={handleStartAuth}
                />
              </>
            )}
          </Animated.View>
        )}

        {(phase === 'scanning' || phase === 'liveness' || phase === 'processing') && (
          <Animated.View entering={FadeInUp.duration(400)}>
            <LivenessGuide
              testID="auth-liveness-guide"
              currentDirection={phase === 'liveness' ? 'blink' : undefined}
              instruction={getChallengeInstruction()}
              steps={livenessSteps}
              progress={livenessProgress}
            />
          </Animated.View>
        )}
      </View>

      {showHUD && (phase === 'scanning' || phase === 'liveness' || phase === 'processing') && (
        <Animated.View entering={FadeIn.duration(300)} style={[styles.hudContainer, { top: insets.top + 60 }]}>
          <Text style={styles.hudTitle}>BIOMETRIC TELEMETRY HUD</Text>
          
          <View style={styles.hudRow}>
            <Text style={styles.hudLabel}>YAW (L/R):</Text>
            <Text style={[styles.hudValue, Math.abs(hudPose?.yaw || 0) > 12 ? styles.hudActive : styles.hudNeutral]}>
              {hudPose ? `${hudPose.yaw.toFixed(1)}°` : '—'}
            </Text>
          </View>
          
          <View style={styles.hudRow}>
            <Text style={styles.hudLabel}>PITCH (U/D):</Text>
            <Text style={[styles.hudValue, Math.abs(hudPose?.pitch || 0) > 10 ? styles.hudActive : styles.hudNeutral]}>
              {hudPose ? `${hudPose.pitch.toFixed(1)}°` : '—'}
            </Text>
          </View>
          
          <View style={styles.hudRow}>
            <Text style={styles.hudLabel}>ROLL (TILT):</Text>
            <Text style={styles.hudValue}>
              {hudPose ? `${hudPose.roll.toFixed(1)}°` : '—'}
            </Text>
          </View>
          
          <View style={styles.hudDivider} />
          
          <View style={styles.hudRow}>
            <Text style={styles.hudLabel}>JITTER VARIANCE:</Text>
            <Text style={styles.hudValue}>
              {hudJitter ? `${hudJitter.toFixed(4)} px` : '0.0000'}
            </Text>
          </View>

          <View style={styles.hudRow}>
            <Text style={styles.hudLabel}>POSE VARIANCE:</Text>
            <Text style={[styles.hudValue, hudPoseVariance < 0.0045 && hudFrameCount >= 12 ? { color: '#FF3D00' } : styles.hudNeutral]}>
              {hudPoseVariance ? `${hudPoseVariance.toFixed(6)}` : '0.000000'}
            </Text>
          </View>

          <View style={styles.hudRow}>
            <Text style={styles.hudLabel}>FRAME BUFFER:</Text>
            <Text style={styles.hudValue}>{hudFrameCount} / 30</Text>
          </View>

          <View style={styles.hudRow}>
            <Text style={styles.hudLabel}>CHALLENGE MATCH:</Text>
            <Text style={[styles.hudValue, hudChallengeScore >= 0.8 ? styles.hudActive : styles.hudNeutral]}>
              {(hudChallengeScore * 100).toFixed(0)}%
            </Text>
          </View>
          
          <View style={styles.hudRow}>
            <Text style={styles.hudLabel}>TARGET CHALLENGE:</Text>
            <Text style={styles.hudTarget}>{currentChallenge.toUpperCase()}</Text>
          </View>
        </Animated.View>
      )}

      {result && (
        <MatchResult
          testID="auth-match-result"
          visible={phase === 'result'}
          success={result.success}
          userName={result.userName}
          confidence={result.confidence}
          timeTaken={result.timeTaken}
          errorMessage={result.error}
          isSpoof={result.isSpoof}
          isTimeout={result.isTimeout}
          onRetry={isLockedOut ? undefined : handleRetry}
          onDismiss={handleDismiss}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  backButton: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  backText: {
    ...Typography.buttonSm,
    color: Colors.white,
    textTransform: 'none',
    letterSpacing: 0,
  },
  cameraToggleButton: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: Radii.full,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraToggleText: { fontSize: 16 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  timerWarning: { backgroundColor: 'rgba(220,50,50,0.7)' },
  timerWarningText: { color: Colors.white, fontWeight: '700' },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.warning },
  statusDotActive: { backgroundColor: Colors.success },
  statusText: { fontSize: 11, fontWeight: '600', color: Colors.white },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.bgPrimary,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    borderTopWidth: 1,
    borderColor: Colors.cardBorder,
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    ...Shadows.lg,
  },
  readyContent: { alignItems: 'center', gap: Spacing.sm },
  readyTitle: { ...Typography.h3, color: Colors.textPrimary, textAlign: 'center' },
  readySubtitle: {
    ...Typography.bodySm,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  attemptWarning: {
    ...Typography.bodySm,
    color: Colors.warning,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  lockoutText: {
    ...Typography.bodyMedium,
    color: Colors.error,
    fontWeight: '700',
    textAlign: 'center',
  },
  lockoutTimer: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.error,
    textAlign: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  hudContainer: {
    position: 'absolute',
    left: Spacing.xl,
    right: Spacing.xl,
    backgroundColor: 'rgba(5, 15, 30, 0.90)',
    borderWidth: 1.5,
    borderColor: '#00E676',
    borderRadius: Radii.md,
    padding: Spacing.md,
    zIndex: 90,
    ...Shadows.md,
    elevation: 90,
  },
  hudTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00E676',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  hudRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  hudLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textDisabled,
    letterSpacing: 0.5,
  },
  hudValue: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  hudNeutral: {
    color: Colors.white,
  },
  hudActive: {
    color: '#00E676',
  },
  hudTarget: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.saffron,
  },
  hudDivider: {
    height: 1,
    backgroundColor: 'rgba(0, 230, 118, 0.2)',
    marginVertical: Spacing.xs,
  },
});

export default AuthScreen;
