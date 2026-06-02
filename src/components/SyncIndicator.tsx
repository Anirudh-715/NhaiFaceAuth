/**
 * SyncIndicator — Pill-shaped sync status badge
 * Reads real network state from Zustand store
 * Green: Online · Amber: Syncing/Checking · Red: Offline
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Colors, Radii, Spacing } from '../theme';
import { useSyncStore } from '../store/syncStore';

interface SyncIndicatorProps {
  testID?: string;
}

export const SyncIndicator: React.FC<SyncIndicatorProps> = ({ testID }) => {
  const { isOnline, isSyncing, pendingCount } = useSyncStore();

  const dotScale = useSharedValue(1);
  const dotOpacity = useSharedValue(1);

  // Derive display state
  const isChecking = isOnline === null;
  const showPulse = isSyncing || isChecking;

  useEffect(() => {
    if (showPulse) {
      dotScale.value = withRepeat(
        withSequence(
          withTiming(1.4, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
      dotOpacity.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    } else {
      dotScale.value = withTiming(1, { duration: 200 });
      dotOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [showPulse, dotScale, dotOpacity]);

  const animatedDotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale.value }],
    opacity: dotOpacity.value,
  }));

  // Determine color and label
  let dotColor: string;
  let label: string;

  if (isChecking) {
    dotColor = Colors.warning;
    label = 'Checking...';
  } else if (!isOnline) {
    dotColor = Colors.error;
    label = pendingCount > 0 ? `Offline • ${pendingCount} queued` : 'Offline';
  } else if (isSyncing) {
    dotColor = Colors.warning;
    label = pendingCount > 0 ? `Syncing • ${pendingCount} pending` : 'Syncing...';
  } else {
    dotColor = Colors.success;
    label = 'Online • Synced';
  }

  return (
    <View testID={testID} style={[styles.pill, { borderColor: dotColor + '40' }]}>
      <Animated.View
        style={[
          styles.dot,
          { backgroundColor: dotColor },
          animatedDotStyle,
        ]}
      />
      <Text style={[styles.label, { color: dotColor }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

export default SyncIndicator;
