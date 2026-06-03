/**
 * EnrollScreen — Face enrollment flow
 * Light theme · navy/saffron accents · camera · step indicators
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  ScrollView,
  Modal,
  TouchableOpacity,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeIn,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { Colors, Spacing, Radii, Shadows, Typography, CommonStyles } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { FaceOverlay } from '../components/FaceOverlay';
import { CameraView } from '../components/CameraView';
import { embeddingDB } from '../services/embeddingDB';
import * as FaceDetector from '../modules/FaceDetector';
import * as FaceRecognizer from '../modules/FaceRecognizer';
import { CameraViewRef } from '../components/CameraView';
import { triggerFeedback } from '../utils/feedbackHelper';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAMERA_HEIGHT = SCREEN_WIDTH * 1.4;

type EnrollStep = 1 | 2 | 3;

const stepLabels: Record<EnrollStep, string> = {
  1: 'Position Face',
  2: 'Blink',
  3: 'Complete',
};

export const EnrollScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [name, setName] = useState('');
  const [currentStep, setCurrentStep] = useState<EnrollStep>(1);
  const [progress, setProgress] = useState(0);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [resultModal, setResultModal] = useState<'success' | 'failure' | null>(null);
  const [cameraDimensions, setCameraDimensions] = useState({
    width: SCREEN_WIDTH,
    height: CAMERA_HEIGHT,
  });

  const cameraRef = useRef<CameraViewRef>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleInputFocus = useCallback(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 150);
  }, []);

  const handleStartEnrollment = useCallback(async () => {
    if (!name.trim()) return;
    triggerFeedback.click();
    setIsEnrolling(true);
    setCurrentStep(1);
    setProgress(0);


    try {
      const photoPath = await cameraRef.current?.takePhoto();
      if (!photoPath) {
        throw new Error('Failed to capture photo from camera');
      }

      setProgress(0.33);
      setCurrentStep(2);
      triggerFeedback.tick();

      const detectResult = await FaceDetector.detect(photoPath, cameraDimensions.width, cameraDimensions.height);
      if (!detectResult.detected || !detectResult.bbox) {
        throw new Error('No face detected. Please ensure your face is fully visible.');
      }



      setProgress(0.66);
      triggerFeedback.tick();

      const recognizerResult = await FaceRecognizer.extractEmbedding(
        photoPath,
        cameraDimensions.width,
        cameraDimensions.height,
        detectResult.bbox
      );

      if (!recognizerResult.success || !recognizerResult.embedding) {
        throw new Error(recognizerResult.error || 'Failed to extract face embedding');
      }

      await embeddingDB.enrollUser(name, recognizerResult.embedding);

      setProgress(1.0);
      setCurrentStep(3);
      setIsEnrolling(false);
      triggerFeedback.success();
      setResultModal('success');
    } catch (err: any) {
      console.error('[Enroll] Enrollment error:', err);
      setIsEnrolling(false);
      triggerFeedback.error();
      setResultModal('failure');
    }
  }, [name, cameraDimensions]);

  const handleDismissResult = useCallback(() => {
    triggerFeedback.click();
    setResultModal(null);

    if (resultModal === 'success') {
      navigation.goBack();
    }
  }, [resultModal, navigation]);

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}
      >
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing['6xl'] + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── Camera Preview ─────────────── */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(500)}
          style={styles.cameraContainer}
        >
          <View 
            style={styles.cameraPlaceholder}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
              if (width > 0 && height > 0) {
                setCameraDimensions({ width, height });
              }
            }}
          >
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              mode="enroll"
              isActive={true}
            />
            <FaceOverlay 
              faceDetected={isEnrolling && currentStep >= 1} 
              ovalWidth={SCREEN_WIDTH * 0.65}
            />
          </View>
        </Animated.View>

        {/* ─── Step Indicators ────────────── */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(500)}
          style={styles.stepsRow}
        >
          {([1, 2, 3] as EnrollStep[]).map((step) => (
            <View key={step} style={styles.stepItem}>
              <View
                style={[
                  styles.stepCircle,
                  currentStep === step && styles.stepCircleActive,
                  currentStep > step && styles.stepCircleCompleted,
                ]}
              >
                {currentStep > step ? (
                  <Text style={styles.stepCheckmark}>✓</Text>
                ) : (
                  <Text
                    style={[
                      styles.stepNumber,
                      currentStep === step && styles.stepNumberActive,
                    ]}
                  >
                    {step}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  currentStep === step && styles.stepLabelActive,
                  currentStep > step && styles.stepLabelCompleted,
                ]}
              >
                {stepLabels[step]}
              </Text>
              {step < 3 && <View style={styles.stepLine} />}
            </View>
          ))}
        </Animated.View>

        {/* ─── Progress Bar ───────────────── */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(500)}
          style={styles.progressContainer}
        >
          <View style={styles.progressBar}>
            <Animated.View
              style={[styles.progressFill, { width: `${progress * 100}%` }]}
            />
          </View>
          <Text style={styles.progressText}>
            {Math.round(progress * 100)}%
          </Text>
        </Animated.View>

        {/* ─── Name Input ─────────────────── */}
        <Animated.View
          entering={FadeInDown.delay(400).duration(500)}
          style={styles.inputContainer}
        >
          <Text style={styles.inputLabel}>PERSON NAME</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              testID="enroll-name-input"
              style={styles.textInput}
              placeholder="Enter full name..."
              placeholderTextColor={Colors.textDisabled}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="done"
              editable={!isEnrolling}
              onFocus={handleInputFocus}
            />
          </View>
        </Animated.View>

        {/* ─── Start Button ───────────────── */}
        <Animated.View
          entering={FadeInUp.delay(500).duration(500)}
          style={styles.buttonContainer}
        >
          <GradientButton
            testID="enroll-start-button"
            title={isEnrolling ? 'Enrolling...' : 'Start Enrollment'}
            onPress={handleStartEnrollment}
            loading={isEnrolling}
            disabled={!name.trim() || isEnrolling}
          />
        </Animated.View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* ─── Result Modal ─────────────────── */}
      <Modal
        visible={resultModal !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <Animated.View entering={FadeIn.duration(300)} style={styles.modalBackdrop}>
          <Animated.View
            entering={ZoomIn.delay(100).duration(400).springify()}
            style={styles.modalContent}
          >
            <View
              style={[
                styles.modalIconCircle,
                resultModal === 'success'
                  ? styles.modalIconSuccess
                  : styles.modalIconFailure,
              ]}
            >
              <Text style={[
                styles.modalIcon,
                { color: resultModal === 'success' ? Colors.success : Colors.error }
              ]}>
                {resultModal === 'success' ? '✓' : '✕'}
              </Text>
            </View>
            <Text style={styles.modalTitle}>
              {resultModal === 'success'
                ? 'Enrollment Complete!'
                : 'Enrollment Failed'}
            </Text>
            <Text style={styles.modalSubtitle}>
              {resultModal === 'success'
                ? `${name} has been registered successfully.`
                : 'Could not capture face data. Please try again.'}
            </Text>
            <TouchableOpacity
              testID="enroll-result-dismiss"
              style={[
                styles.modalButton,
                { backgroundColor: resultModal === 'success' ? Colors.navy : Colors.saffron }
              ]}
              onPress={handleDismissResult}
              activeOpacity={0.7}
            >
              <Text style={styles.modalButtonText}>
                {resultModal === 'success' ? 'Done' : 'Try Again'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
  },
  // Camera
  cameraContainer: {
    marginBottom: Spacing.lg,
  },
  cameraPlaceholder: {
    width: '100%',
    height: CAMERA_HEIGHT,
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  // Steps
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: Colors.cardBorder,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  stepCircleActive: {
    borderColor: Colors.navy,
    backgroundColor: Colors.navyLight,
  },
  stepCircleCompleted: {
    borderColor: Colors.success,
    backgroundColor: Colors.success,
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textTertiary,
  },
  stepNumberActive: {
    color: Colors.navy,
  },
  stepCheckmark: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  stepLabel: {
    ...Typography.captionSm,
    textAlign: 'center',
    color: Colors.textTertiary,
  },
  stepLabelActive: {
    color: Colors.navy,
  },
  stepLabelCompleted: {
    color: Colors.success,
  },
  stepLine: {
    position: 'absolute',
    top: 14,
    left: '60%',
    right: '-40%',
    height: 2,
    backgroundColor: Colors.divider,
  },
  // Progress
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  progressBar: {
    flex: 1,
    height: 5,
    backgroundColor: Colors.cardBorder,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.saffron,
    borderRadius: 3,
  },
  progressText: {
    ...Typography.caption,
    color: Colors.saffron,
    width: 36,
    textAlign: 'right',
  },
  // Input
  inputContainer: {
    marginBottom: Spacing.xl,
  },
  inputLabel: {
    ...Typography.label,
    color: Colors.navy,
    marginBottom: Spacing.xs,
    marginLeft: Spacing.xs,
  },
  inputWrapper: {
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1.5,
    borderColor: Colors.navy,
    borderRadius: Radii.md,
    overflow: 'hidden',
  },
  textInput: {
    height: 46,
    paddingHorizontal: Spacing.lg,
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  // Button
  buttonContainer: {
    marginTop: Spacing.xs,
  },
  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing['3xl'],
  },
  modalContent: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing['2xl'],
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    ...Shadows.lg,
  },
  modalIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 2,
  },
  modalIconSuccess: {
    backgroundColor: Colors.successLight,
    borderColor: Colors.success,
  },
  modalIconFailure: {
    backgroundColor: Colors.errorLight,
    borderColor: Colors.error,
  },
  modalIcon: {
    fontSize: 28,
    fontWeight: '300',
  },
  modalTitle: {
    ...Typography.h3,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  modalSubtitle: {
    ...Typography.bodySm,
    textAlign: 'center',
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
  },
  modalButton: {
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Spacing.md,
  },
  modalButtonText: {
    ...Typography.buttonSm,
    color: Colors.white,
  },
});

export default EnrollScreen;
