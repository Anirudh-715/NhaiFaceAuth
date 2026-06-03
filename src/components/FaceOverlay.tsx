/**
 * FaceOverlay — Camera overlay component
 * Clean navy blue oval guide · pulse animation · properly centered in visible camera area
 */

import React, { useEffect } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Colors } from '../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FaceOverlayProps {
  faceDetected?: boolean;
  testID?: string;
  ovalWidth?: number;
  ovalHeight?: number;
  /** Space reserved at the bottom (bottom panel height + safe area) */
  bottomOffset?: number;
  /** Space reserved at the top (status bar + top bar height) */
  topOffset?: number;
}

export const FaceOverlay: React.FC<FaceOverlayProps> = ({
  faceDetected = false,
  testID,
  ovalWidth,
  ovalHeight,
  bottomOffset = 0,
  topOffset = 0,
}) => {
  const currentOvalWidth = ovalWidth ?? SCREEN_WIDTH * 0.6;
  const currentOvalHeight = ovalHeight ?? currentOvalWidth * 1.25;

  // Calculate the center of the visible camera area
  // Available area = screen height - topOffset - bottomOffset
  const availableHeight = SCREEN_HEIGHT - topOffset - bottomOffset;
  // Center the oval in the available area
  const ovalTop = topOffset + (availableHeight - currentOvalHeight) / 2;

  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.6);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.5, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [pulseScale, pulseOpacity]);

  const ovalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const ovalBorderColor = faceDetected
    ? Colors.navy
    : 'rgba(255,255,255,0.5)';

  return (
    <View testID={testID} style={styles.container} pointerEvents="none">
      <Animated.View 
        style={[
          styles.ovalContainer, 
          { 
            width: currentOvalWidth, 
            height: currentOvalHeight,
            position: 'absolute',
            top: ovalTop,
            left: (SCREEN_WIDTH - currentOvalWidth) / 2,
          },
          ovalAnimatedStyle,
        ]}
      >
        <View
          style={[
            styles.oval,
            {
              borderColor: ovalBorderColor,
              borderWidth: faceDetected ? 3 : 2,
              borderRadius: currentOvalWidth / 2,
            },
          ]}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  ovalContainer: {
  },
  oval: {
    width: '100%',
    height: '100%',
    borderStyle: 'dashed',
  },
});

export default FaceOverlay;
