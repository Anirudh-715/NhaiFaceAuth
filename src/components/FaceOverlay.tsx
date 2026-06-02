/**
 * FaceOverlay — Camera overlay component
 * Navy blue oval guide · saffron landmarks · corner brackets
 */

import React, { useEffect } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import { Colors, Spacing } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const OVAL_WIDTH = SCREEN_WIDTH * 0.48;
const OVAL_HEIGHT = OVAL_WIDTH * 1.25;
const BRACKET_SIZE = 22;
const BRACKET_THICKNESS = 3;

interface FaceOverlayProps {
  faceDetected?: boolean;
  landmarks?: Array<{ x: number; y: number }>;
  boundingBox?: { x: number; y: number; width: number; height: number };
  testID?: string;
  ovalWidth?: number;
  ovalHeight?: number;
  bottomOffset?: number;
}

const CornerBracket: React.FC<{
  position: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
}> = ({ position }) => {
  const isTop = position.includes('top');
  const isLeft = position.includes('Left');

  return (
    <View
      style={[
        styles.bracket,
        {
          top: -BRACKET_SIZE / 2,
          bottom: undefined,
          left: isLeft ? -BRACKET_SIZE / 2 : undefined,
          right: !isLeft ? -BRACKET_SIZE / 2 : undefined,
          borderTopWidth: isTop ? BRACKET_THICKNESS : 0,
          borderBottomWidth: !isTop ? BRACKET_THICKNESS : 0,
          borderLeftWidth: isLeft ? BRACKET_THICKNESS : 0,
          borderRightWidth: !isLeft ? BRACKET_THICKNESS : 0,
          borderTopLeftRadius: isTop && isLeft ? 8 : 0,
          borderTopRightRadius: isTop && !isLeft ? 8 : 0,
          borderBottomLeftRadius: !isTop && isLeft ? 8 : 0,
          borderBottomRightRadius: !isTop && !isLeft ? 8 : 0,
        },
      ]}
    />
  );
};

export const FaceOverlay: React.FC<FaceOverlayProps> = ({
  faceDetected = false,
  landmarks = [],
  boundingBox,
  testID,
  ovalWidth,
  ovalHeight,
  bottomOffset,
}) => {
  const currentOvalWidth = ovalWidth ?? SCREEN_WIDTH * 0.6;
  const currentOvalHeight = ovalHeight ?? currentOvalWidth * 1.25;

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
    <View testID={testID} style={[styles.container, bottomOffset ? { paddingBottom: bottomOffset } : null]} pointerEvents="none">
      <Animated.View 
        style={[
          styles.ovalContainer, 
          { width: currentOvalWidth, height: currentOvalHeight },
          ovalAnimatedStyle
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
        >
          <CornerBracket position="topLeft" />
          <CornerBracket position="topRight" />
          <CornerBracket position="bottomLeft" />
          <CornerBracket position="bottomRight" />
        </View>
      </Animated.View>

      {faceDetected && boundingBox && (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={[
            styles.boundingBox,
            {
              left: boundingBox.x,
              top: boundingBox.y,
              width: boundingBox.width,
              height: boundingBox.height,
            },
          ]}
        />
      )}

      {faceDetected &&
        landmarks.map((point, index) => (
          <Animated.View
            key={`landmark-${index}`}
            entering={FadeIn.delay(index * 30).duration(150)}
            style={[
              styles.landmarkDot,
              {
                left: point.x - 3,
                top: point.y - 3,
              },
            ]}
          />
        ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ovalContainer: {
  },
  oval: {
    width: '100%',
    height: '100%',
    borderStyle: 'dashed',
  },
  bracket: {
    position: 'absolute',
    width: BRACKET_SIZE,
    height: BRACKET_SIZE,
    borderColor: Colors.navy,
  },
  boundingBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: Colors.saffron,
    borderRadius: 8,
  },
  landmarkDot: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.saffron,
  },
});

export default FaceOverlay;
