/**
 * LivenessGuide — Liveness challenge instructions
 * Navy/saffron color scheme for government theme
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  FadeIn,
  FadeInUp,
  SlideInRight,
} from 'react-native-reanimated';
import { Colors, Radii, Spacing, Typography } from '../theme';

export type ChallengeDirection = 'left' | 'right' | 'up' | 'down' | 'blink' | 'smile';

interface LivenessStep {
  id: string;
  label: string;
  completed: boolean;
  active: boolean;
}

interface LivenessGuideProps {
  currentDirection?: ChallengeDirection;
  instruction: string;
  steps: LivenessStep[];
  progress: number;
  testID?: string;
}

const directionArrows: Record<ChallengeDirection, string> = {
  left: '←',
  right: '→',
  up: '↑',
  down: '↓',
  blink: '◉',
  smile: '☺',
};

const StepItem: React.FC<{ step: LivenessStep; index: number }> = ({ step, index }) => {
  const checkScale = useSharedValue(step.completed ? 1 : 0);

  useEffect(() => {
    if (step.completed) {
      checkScale.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.back(2)) });
    }
  }, [step.completed, checkScale]);

  const checkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 100).duration(300)}
      style={[styles.stepRow, step.active && styles.stepRowActive]}
    >
      <View
        style={[
          styles.stepCircle,
          step.completed && styles.stepCircleCompleted,
          step.active && styles.stepCircleActive,
        ]}
      >
        {step.completed ? (
          <Animated.Text style={[styles.checkmark, checkAnimatedStyle]}>✓</Animated.Text>
        ) : (
          <Text style={[styles.stepNumber, step.active && styles.stepNumberActive]}>
            {index + 1}
          </Text>
        )}
      </View>
      <Text
        style={[
          styles.stepLabel,
          step.completed && styles.stepLabelCompleted,
          step.active && styles.stepLabelActive,
        ]}
      >
        {step.label}
      </Text>
    </Animated.View>
  );
};

export const LivenessGuide: React.FC<LivenessGuideProps> = ({
  currentDirection,
  instruction,
  steps,
  progress,
  testID,
}) => {
  const arrowTranslate = useSharedValue(0);

  useEffect(() => {
    if (currentDirection && currentDirection !== 'blink' && currentDirection !== 'smile') {
      const distance = currentDirection === 'left' || currentDirection === 'up' ? -12 : 12;
      arrowTranslate.value = withRepeat(
        withSequence(
          withTiming(distance, { duration: 500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 500, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    } else {
      arrowTranslate.value = withTiming(0, { duration: 200 });
    }
  }, [currentDirection, arrowTranslate]);

  const arrowAnimatedStyle = useAnimatedStyle(() => {
    if (!currentDirection || currentDirection === 'blink' || currentDirection === 'smile') {
      return {};
    }
    const isHorizontal = currentDirection === 'left' || currentDirection === 'right';
    return {
      transform: isHorizontal
        ? [{ translateX: arrowTranslate.value }]
        : [{ translateY: arrowTranslate.value }],
    };
  });

  return (
    <View testID={testID} style={styles.container}>
      {currentDirection && (
        <Animated.View entering={FadeIn.duration(300)} style={styles.arrowContainer}>
          <Animated.Text style={[styles.arrowText, arrowAnimatedStyle]}>
            {directionArrows[currentDirection]}
          </Animated.Text>
        </Animated.View>
      )}

      <Animated.Text entering={SlideInRight.duration(300)} key={instruction} style={styles.instruction}>
        {instruction}
      </Animated.Text>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.stepsContainer}>
        {steps.map((step, index) => (
          <StepItem key={step.id} step={step} index={index} />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  arrowContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.navyLight,
    borderWidth: 1,
    borderColor: Colors.navy + '30',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  arrowText: {
    fontSize: 30,
    color: Colors.navy,
  },
  instruction: {
    ...Typography.h3,
    textAlign: 'center',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: Colors.cardBorder,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.saffron,
    borderRadius: 2,
  },
  stepsContainer: {
    width: '100%',
    gap: Spacing.xs,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.sm,
  },
  stepRowActive: {
    backgroundColor: Colors.saffronLight,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  stepCircleCompleted: {
    borderColor: Colors.success,
    backgroundColor: Colors.success,
  },
  stepCircleActive: {
    borderColor: Colors.navy,
    backgroundColor: Colors.navyLight,
  },
  stepNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
  },
  stepNumberActive: {
    color: Colors.navy,
  },
  checkmark: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textTertiary,
  },
  stepLabelCompleted: {
    color: Colors.success,
  },
  stepLabelActive: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },
});

export default LivenessGuide;
