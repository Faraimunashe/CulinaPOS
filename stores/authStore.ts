import { create } from 'zustand';
import type { SafeUser } from '@/types';
import * as authService from '@/services/authService';

interface AuthState {
  user: SafeUser | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isHydrated: false,
  isLoading: false,
  error: null,

  hydrate: async () => {
    try {
      const user = await authService.restoreSession();
      set({
        user,
        isAuthenticated: !!user,
        isHydrated: true,
        error: null,
      });
    } catch {
      set({
        user: null,
        isAuthenticated: false,
        isHydrated: true,
        error: null,
      });
    }
  },

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const user = await authService.login(username, password);
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Login failed. Please try again.';
      set({ isLoading: false, error: message });
      throw error;
    }
  },

  logout: async () => {
    const userId = get().user?.id;
    await authService.logout(userId);
    set({
      user: null,
      isAuthenticated: false,
      error: null,
    });
  },

  clearError: () => set({ error: null }),
}));
