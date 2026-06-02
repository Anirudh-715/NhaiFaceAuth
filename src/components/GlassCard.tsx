/**
 * GlassCard → SolidCard — Clean white card component
 * Solid background · light border · subtle elevation · press animation
 */

import React, { useCallback } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Colors, Radii, Spacing, Shadows, AnimConfig } from '../theme';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface GlassCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'light' | 'accent';
  noPadding?: boolean;
  testID?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  onPress,
  style,
  variant = 'default',
  noPadding = false,
  testID,
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    if (onPress) {
      scale.value = withSpring(0.97, AnimConfig.springDefault);
    }
  }, [onPress, scale]);

  const handlePressOut = useCallback(() => {
    if (onPress) {
      scale.value = withSpring(1, AnimConfig.springBouncy);
    }
  }, [onPress, scale]);

  const cardStyle = [
    styles.card,
    variant === 'light' && styles.cardLight,
    variant === 'accent' && styles.cardAccent,
    !noPadding && styles.padding,
    style,
  ];

  if (onPress) {
    return (
      <AnimatedTouchable
        testID={testID}
        activeOpacity={0.85}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[animatedStyle, cardStyle]}
      >
        {children}
      </AnimatedTouchable>
    );
  }

  return (
    <Animated.View testID={testID} style={[animatedStyle, cardStyle]}>
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: Radii.lg,
    overflow: 'hidden',
    ...Shadows.card,
  },
  cardLight: {
    backgroundColor: Colors.bgSecondary,
    borderColor: Colors.cardBorderLight,
  },
  cardAccent: {
    backgroundColor: Colors.saffronLight,
    borderColor: Colors.saffron + '30',
  },
  padding: {
    padding: Spacing.lg,
  },
});

export default GlassCard;
