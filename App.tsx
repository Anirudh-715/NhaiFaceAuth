import 'react-native-gesture-handler';
import React, { useEffect, Component } from 'react';
import { StatusBar, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { theme } from './src/theme';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { embeddingDB } from './src/services/embeddingDB';
import { syncEngine } from './src/services/syncEngine';
import { initialize as initFaceDetector } from './src/modules/FaceDetector';
import { initialize as initFaceRecognizer } from './src/modules/FaceRecognizer';
import { initMasterKey } from './src/services/securityService';
import { useSettingsStore } from './src/store/settingsStore';

// ─── Global Error Boundary ────────────────────────────────────────────────────
interface ErrorBoundaryState { hasError: boolean; error: string | null; }
class ErrorBoundary extends Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary] Caught:', error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={eb.container}>
          <Text style={eb.title}>Something went wrong</Text>
          <Text style={eb.msg}>{this.state.error}</Text>
          <TouchableOpacity style={eb.btn} onPress={() => this.setState({ hasError: false, error: null })}>
            <Text style={eb.btnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}
const eb = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 24 },
  title: { fontSize: 20, fontWeight: '700', color: '#D32F2F', marginBottom: 12 },
  msg: { fontSize: 14, color: '#444', textAlign: 'center', marginBottom: 24 },
  btn: { backgroundColor: '#003580', borderRadius: 8, paddingHorizontal: 32, paddingVertical: 12 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

// ─── App Root ─────────────────────────────────────────────────────────────────
function App(): React.JSX.Element {
  useEffect(() => {
    const initServices = async () => {
      try {
        await initMasterKey();
        await embeddingDB.initDatabase();
        await useSettingsStore.getState().initialize();
        await syncEngine.initialize();
        await initFaceDetector();
        await initFaceRecognizer();
        console.log('[App] All services initialized.');
      } catch (error) {
        console.error('[App] Failed to initialize services:', error);
      }
    };
    initServices();
  }, []);

  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}

export default App;
