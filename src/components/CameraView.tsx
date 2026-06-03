import React, { useRef, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';
import { Colors } from '../theme';

interface CameraViewProps {
  mode: 'enroll' | 'auth';
  cameraPosition?: 'front' | 'back';
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
  cameraPosition = 'front',
  onFaceDetected,
  onLivenessResult,
  onEmbeddingExtracted,
  isActive,
  style
}, ref) => {
  const cameraRef = useRef<Camera>(null);
  const device = useCameraDevice(cameraPosition);
  const { hasPermission, requestPermission } = useCameraPermission();
  const photoOutput = usePhotoOutput();
  const [isReady, setIsReady] = useState(false);

  React.useImperativeHandle(ref, () => ({
    takePhoto: async () => {
      try {
        if (!photoOutput) {
          console.warn('[CameraView] photoOutput is null');
          return null;
        }
        if (!isReady) {
          console.warn('[CameraView] Camera not ready yet');
          return null;
        }
        const result = await photoOutput.capturePhotoToFile({
          flashMode: 'off',
          enableShutterSound: false,
        }, {});
        return result.filePath;
      } catch (err: any) {
        // Log but don't crash — frame loop will retry
        console.warn('[CameraView] takePhoto error:', err?.message || err);
        return null;
      }
    }
  }), [photoOutput, isReady]);

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
        onStarted={() => {
          console.log('[CameraView] Camera started');
          setIsReady(true);
        }}
        onStopped={() => {
          console.log('[CameraView] Camera stopped');
          setIsReady(false);
        }}
        onError={(error) => {
          console.error('[CameraView] Camera error:', error);
        }}
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
