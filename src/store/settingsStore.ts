import { create } from 'zustand';
import { embeddingDB } from '../services/embeddingDB';

interface SettingsState {
  hapticEnabled: boolean;
  soundEnabled: boolean;
  isInitialized: boolean;
  setHapticEnabled: (enabled: boolean) => Promise<void>;
  setSoundEnabled: (enabled: boolean) => Promise<void>;
  initialize: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  hapticEnabled: true,
  soundEnabled: true,
  isInitialized: false,
  setHapticEnabled: async (enabled) => {
    set({ hapticEnabled: enabled });
    await embeddingDB.setSetting('hapticEnabled', enabled ? 'true' : 'false');
  },
  setSoundEnabled: async (enabled) => {
    set({ soundEnabled: enabled });
    await embeddingDB.setSetting('soundEnabled', enabled ? 'true' : 'false');
  },
  initialize: async () => {
    try {
      const haptic = await embeddingDB.getSetting('hapticEnabled', 'true');
      const sound = await embeddingDB.getSetting('soundEnabled', 'true');
      set({
        hapticEnabled: haptic === 'true',
        soundEnabled: sound === 'true',
        isInitialized: true,
      });
      console.log('[SettingsStore] Settings loaded from DB:', { haptic, sound });
    } catch (err) {
      console.error('[SettingsStore] Initialization failed:', err);
    }
  },
}));
