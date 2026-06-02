import { create } from 'zustand';

interface AuthState {
  isAuthenticating: boolean;
  lastResult: 'success' | 'fail' | null;
  matchedUser: string | null;
  confidence: number;
  duration: number;
  livenessScore: number;
  error: string | null;
  startAuth: () => void;
  setResult: (
    result: 'success' | 'fail',
    matchedUser?: string,
    confidence?: number,
    duration?: number,
    livenessScore?: number,
    error?: string
  ) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticating: false,
  lastResult: null,
  matchedUser: null,
  confidence: 0,
  duration: 0,
  livenessScore: 0,
  error: null,
  startAuth: () => set({ 
    isAuthenticating: true, 
    lastResult: null, 
    matchedUser: null, 
    confidence: 0, 
    duration: 0, 
    livenessScore: 0, 
    error: null 
  }),
  setResult: (result, matchedUser = null, confidence = 0, duration = 0, livenessScore = 0, error = null) => set({
    isAuthenticating: false,
    lastResult: result,
    matchedUser,
    confidence,
    duration,
    livenessScore,
    error,
  }),
  reset: () => set({
    isAuthenticating: false,
    lastResult: null,
    matchedUser: null,
    confidence: 0,
    duration: 0,
    livenessScore: 0,
    error: null,
  }),
}));
