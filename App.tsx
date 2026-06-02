import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { theme } from './src/theme';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { embeddingDB } from './src/services/embeddingDB';
import { syncEngine } from './src/services/syncEngine';
import { initialize as initFaceDetector } from './src/modules/FaceDetector';
import { initialize as initFaceRecognizer } from './src/modules/FaceRecognizer';
import { initMasterKey } from './src/services/securityService';

function App(): React.JSX.Element {
  useEffect(() => {
    const initServices = async () => {
      try {
        console.log('[App] Initializing Security Master Key...');
        await initMasterKey();
        console.log('[App] Security Master Key initialized!');

        console.log('[App] Initializing SQLite database...');
        await embeddingDB.initDatabase();
        console.log('[App] SQLite Database initialized!');

        console.log('[App] Initializing Sync Engine...');
        await syncEngine.initialize();
        console.log('[App] Sync Engine initialized!');

        console.log('[App] Initializing FaceDetector ML Model...');
        await initFaceDetector();
        console.log('[App] FaceDetector ML Model initialized!');

        console.log('[App] Initializing FaceRecognizer ML Model...');
        await initFaceRecognizer();
        console.log('[App] FaceRecognizer ML Model initialized!');
      } catch (error) {
        console.error('[App] Failed to initialize services:', error);
      }
    };
    initServices();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.bgPrimary }}>
      <SafeAreaProvider>
        <StatusBar
          barStyle="light-content"
          backgroundColor={theme.colors.accentSecondary}
          translucent={false}
        />
          <AppNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
