import React, { useRef, useState, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';
import { Colors } from '../theme';

interface CameraViewProps {
  mode: 'enroll' | 'auth';
  onFaceDetected?: (face: any) => void;
  onLivenessResult?: (result: any) => void;
  onEmbeddingExtracted?: (embedding: number[]) => void;
  isActive: boolean;
  style?: any;
}

export interface CameraViewRef {
  takePhoto: () => Promise<string | null>;
}

export const CameraView = React.forwardRef<CameraViewRef, CameraViewProps>(({
  mode,
  onFaceDetected,
  onLivenessResult,
  onEmbeddingExtracted,
  isActive,
  style
}, ref) => {
  const cameraRef = useRef<Camera>(null);
  const frontDevice = useCameraDevice('front');
  const backDevice = useCameraDevice('back');
  const device = frontDevice ?? backDevice;
  const { hasPermission, requestPermission } = useCameraPermission();
  const photoOutput = usePhotoOutput();

  console.log('[CameraView] Render - device:', device?.id, 'hasPermission:', hasPermission, 'isActive:', isActive);

  React.useImperativeHandle(ref, () => ({
    takePhoto: async () => {
      try {
        if (photoOutput) {
          const result = await photoOutput.capturePhotoToFile({
            flashMode: 'off',
            enableShutterSound: false,
          }, {});
          console.log('[CameraView] capturePhotoToFile result:', result);
          return result.filePath;
        }
        return null;
      } catch (err) {
        console.error('[CameraView] takePhoto error:', err);
        return null;
      }
    }
  }));

  React.useEffect(() => {
    if (!hasPermission) {
      requestPermission().then((granted) => {
        console.log('[CameraView] Permission requested. Granted:', granted);
      }).catch((err) => {
        console.error('[CameraView] Error requesting permission:', err);
      });
    }
  }, [hasPermission, requestPermission]);

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Camera permission is required</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No camera device found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Camera
        ref={cameraRef}
        style={styles.camera}
        device={device}
        isActive={isActive}
        outputs={[photoOutput]}
        resizeMode="cover"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: 'black',
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  errorText: {
    color: Colors.textOnDark,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: Colors.saffron,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: Colors.textOnDark,
    fontSize: 14,
    fontWeight: 'bold',
  },
});
