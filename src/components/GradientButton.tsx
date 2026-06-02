/**
 * GradientButton — Government-styled action button
 * Saffron gradient · press animation · loading state · disabled state
 */

import React, { useCallback } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Radii, Spacing, Shadows, Gradients, Typography, AnimConfig } from '../theme';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface GradientButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'success' | 'error';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
}

export const GradientButton: React.FC<GradientButtonProps> = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  size = 'lg',
  icon,
  style,
  textStyle,
  testID,
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.96, AnimConfig.springDefault);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, AnimConfig.springBouncy);
  }, [scale]);

  const gradientColors = (() => {
    switch (variant) {
      case 'success': return Gradients.success;
      case 'error': return Gradients.error;
      default: return Gradients.primary;
    }
  })();

  const heightStyle = (() => {
    switch (size) {
      case 'sm': return styles.heightSm;
      case 'md': return styles.heightMd;
      default: return styles.heightLg;
    }
  })();

  const titleStyle = size === 'sm' ? Typography.buttonSm : Typography.button;

  const isDisabled = disabled || loading;

  return (
    <AnimatedTouchable
      testID={testID}
      activeOpacity={0.85}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      style={[animatedStyle, isDisabled && styles.disabled, style]}
    >
      <LinearGradient
        colors={[...gradientColors]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.gradient, heightStyle]}
      >
        {loading ? (
          <ActivityIndicator color={Colors.white} size="small" />
        ) : (
          <>
            {icon && <>{icon}</>}
            <Text
              style={[
                titleStyle,
                styles.title,
                icon != null && styles.titleWithIcon,
                textStyle,
              ]}
            >
              {title}
            </Text>
          </>
        )}
      </LinearGradient>
    </AnimatedTouchable>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.md,
    paddingHorizontal: Spacing['3xl'],
    ...Shadows.button,
  },
  heightSm: {
    height: 36,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.lg,
  },
  heightMd: {
    height: 42,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.xl,
  },
  heightLg: {
    height: 48,
  },
  title: {
    textAlign: 'center',
  },
  titleWithIcon: {
    marginLeft: Spacing.sm,
  },
  disabled: {
    opacity: 0.45,
  },
});

export default GradientButton;
