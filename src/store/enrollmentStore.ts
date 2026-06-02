import { create } from 'zustand';

interface EnrollmentState {
  isEnrolling: boolean;
  currentStep: number;
  userName: string;
  progress: number;
  error: string | null;
  isComplete: boolean;
  startEnrollment: () => void;
  setStep: (step: number) => void;
  setProgress: (progress: number) => void;
  setUserName: (name: string) => void;
  complete: () => void;
  setError: (error: string) => void;
  reset: () => void;
}

export const useEnrollmentStore = create<EnrollmentState>((set) => ({
  isEnrolling: false,
  currentStep: 1,
  userName: '',
  progress: 0,
  error: null,
  isComplete: false,
  startEnrollment: () => set({
    isEnrolling: true,
    currentStep: 1,
    progress: 0,
    error: null,
    isComplete: false,
  }),
  setStep: (step) => set({ currentStep: step }),
  setProgress: (progress) => set({ progress }),
  setUserName: (userName) => set({ userName }),
  complete: () => set({ isEnrolling: false, isComplete: true, progress: 100 }),
  setError: (error) => set({ error }),
  reset: () => set({
    isEnrolling: false,
    currentStep: 1,
    userName: '',
    progress: 0,
    error: null,
    isComplete: false,
  }),
}));
