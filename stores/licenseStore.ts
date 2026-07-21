import { create } from 'zustand';
import * as licenseService from '@/services/licenseService';
import type { LicenseStatus } from '@/services/licenseService';

interface LicenseState {
  isActivated: boolean;
  isHydrated: boolean;
  activatedAt: string | null;
  keyUsed: string | null;
  isLoading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  activate: (key: string) => Promise<void>;
  clearError: () => void;
}

export const useLicenseStore = create<LicenseState>((set) => ({
  isActivated: false,
  isHydrated: false,
  activatedAt: null,
  keyUsed: null,
  isLoading: false,
  error: null,

  hydrate: async () => {
    try {
      const status = await licenseService.getLicenseStatus();
      set({
        isActivated: status.activated,
        activatedAt: status.activatedAt,
        keyUsed: status.keyUsed,
        isHydrated: true,
        error: null,
      });
    } catch {
      set({
        isActivated: false,
        activatedAt: null,
        keyUsed: null,
        isHydrated: true,
        error: null,
      });
    }
  },

  activate: async (key) => {
    set({ isLoading: true, error: null });
    try {
      const status: LicenseStatus = await licenseService.activate(key);
      set({
        isActivated: status.activated,
        activatedAt: status.activatedAt,
        keyUsed: status.keyUsed,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Activation failed. Please try again.';
      set({ isLoading: false, error: message });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
