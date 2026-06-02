/**
 * MatchResult — Authentication result overlay
 * Light theme modal card for government application
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeInUp,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radii, Spacing, Typography, Shadows } from '../theme';

interface MatchResultProps {
  visible: boolean;
  success: boolean;
  userName?: string;
  confidence?: number;
  timeTaken?: number;
  errorMessage?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  testID?: string;
}

export const MatchResult: React.FC<MatchResultProps> = ({
  visible,
  success,
  userName,
  confidence,
  timeTaken,
  errorMessage,
  onRetry,
  onDismiss,
  testID,
}) => {
  const insets = useSafeAreaInsets();
  const iconScale = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      iconScale.value = withSpring(1, { damping: 10, stiffness: 160, mass: 0.8 });
    } else {
      iconScale.value = 0;
    }
  }, [visible, iconScale]);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  if (!visible) return null;

  const statusColor = success ? Colors.success : Colors.error;
  const statusBg = success ? Colors.successLight : Colors.errorLight;

  return (
    <Animated.View
      testID={testID}
      entering={FadeIn.duration(300)}
      style={[
        styles.backdrop,
        {
          paddingTop: insets.top + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.lg,
        },
      ]}
    >
      <View style={styles.card}>
        {/* Icon Circle */}
        <View style={styles.iconWrapper}>
          <Animated.View
            style={[
              styles.iconCircle,
              {
                backgroundColor: statusBg,
                borderColor: statusColor,
              },
              iconAnimatedStyle,
            ]}
          >
            <Text style={[styles.iconText, { color: statusColor }]}>
              {success ? '✓' : '✕'}
            </Text>
          </Animated.View>
        </View>

        {/* Result Text */}
        <Animated.Text
          entering={FadeInUp.delay(200).duration(400)}
          style={[styles.resultTitle, { color: statusColor }]}
        >
          {success ? 'Identity Verified' : 'Verification Failed'}
        </Animated.Text>

        {/* User Name */}
        {success && userName && (
          <Animated.Text
            entering={FadeInUp.delay(300).duration(400)}
            style={styles.userName}
          >
            {userName}
          </Animated.Text>
        )}

        {/* Error Message */}
        {!success && errorMessage && (
          <Animated.Text
            entering={FadeInUp.delay(300).duration(400)}
            style={styles.errorMessage}
          >
            {errorMessage}
          </Animated.Text>
        )}

        {/* Stats Row */}
        <Animated.View
          entering={FadeInUp.delay(400).duration(400)}
          style={styles.statsRow}
        >
          {confidence != null && (
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {(confidence * 100).toFixed(1)}%
              </Text>
              <Text style={styles.statLabel}>Confidence</Text>
            </View>
          )}
          {timeTaken != null && (
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{timeTaken.toFixed(1)}s</Text>
              <Text style={styles.statLabel}>Time</Text>
            </View>
          )}
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View
          entering={FadeInUp.delay(500).duration(400)}
          style={styles.actions}
        >
          {!success && onRetry && (
            <TouchableOpacity
              testID="match-result-retry"
              style={styles.retryButton}
              onPress={onRetry}
              activeOpacity={0.7}
            >
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          )}
          {onDismiss && (
            <TouchableOpacity
              testID="match-result-dismiss"
              style={styles.dismissButton}
              onPress={onDismiss}
              activeOpacity={0.7}
            >
              <Text style={styles.dismissText}>
                {success ? 'Done' : 'Cancel'}
              </Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  card: {
    width: '85%',
    maxWidth: 320,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: Radii.xl,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    ...Shadows.lg,
  },
  iconWrapper: {
    width: 76,
    height: 76,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 30,
    fontWeight: '300',
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: Spacing.xs,
  },
  userName: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    fontWeight: '700',
    fontSize: 14,
    marginBottom: Spacing.md,
  },
  errorMessage: {
    ...Typography.bodySm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing['3xl'],
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  statLabel: {
    ...Typography.caption,
    marginTop: Spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  retryButton: {
    backgroundColor: Colors.error,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  retryText: {
    ...Typography.buttonSm,
    color: Colors.white,
    textTransform: 'none',
    letterSpacing: 0,
    fontWeight: '700',
  },
  dismissButton: {
    backgroundColor: Colors.navy,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  dismissText: {
    ...Typography.buttonSm,
    color: Colors.white,
    textTransform: 'none',
    letterSpacing: 0,
    fontWeight: '700',
  },
});

export default MatchResult;
