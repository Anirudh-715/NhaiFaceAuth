import { create } from 'zustand';

interface SyncState {
  isOnline: boolean | null; // null = checking/unknown
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: number | null;
  syncError: string | null;
  setOnline: (isOnline: boolean | null) => void;
  setSyncing: (isSyncing: boolean) => void;
  setPendingCount: (count: number) => void;
  setLastSyncTime: (time: number) => void;
  setError: (error: string | null) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  isOnline: null, // Start as null (unknown) until NetInfo reports
  isSyncing: false,
  pendingCount: 0,
  lastSyncTime: null,
  syncError: null,
  setOnline: (isOnline) => set({ isOnline }),
  setSyncing: (isSyncing) => set({ isSyncing }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  setLastSyncTime: (lastSyncTime) => set({ lastSyncTime }),
  setError: (syncError) => set({ syncError }),
}));
