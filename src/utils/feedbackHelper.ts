import { NativeModules } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useSettingsStore } from '../store/settingsStore';

const { SoundPlayer } = NativeModules;

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

export const triggerFeedback = {
  success: () => {
    const { soundEnabled, hapticEnabled } = useSettingsStore.getState();
    
    if (soundEnabled && SoundPlayer) {
      SoundPlayer.playSound('success').catch((err: any) => {
        console.error('[Feedback] Sound error:', err);
      });
    }
    if (hapticEnabled) {
      ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOptions);
    }
  },

  error: () => {
    const { soundEnabled, hapticEnabled } = useSettingsStore.getState();

    if (soundEnabled && SoundPlayer) {
      SoundPlayer.playSound('error').catch((err: any) => {
        console.error('[Feedback] Sound error:', err);
      });
    }
    if (hapticEnabled) {
      ReactNativeHapticFeedback.trigger('notificationError', hapticOptions);
    }
  },

  tick: () => {
    const { soundEnabled, hapticEnabled } = useSettingsStore.getState();

    if (soundEnabled && SoundPlayer) {
      SoundPlayer.playSound('tick').catch((err: any) => {
        console.error('[Feedback] Sound error:', err);
      });
    }
    if (hapticEnabled) {
      ReactNativeHapticFeedback.trigger('selection', hapticOptions);
    }
  },

  click: () => {
    const { soundEnabled, hapticEnabled } = useSettingsStore.getState();

    if (soundEnabled && SoundPlayer) {
      SoundPlayer.playSound('click').catch((err: any) => {
        console.error('[Feedback] Sound error:', err);
      });
    }
    if (hapticEnabled) {
      ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    }
  },
};
