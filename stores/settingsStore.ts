import { create } from 'zustand';
import { APP_NAME, SETTINGS_KEYS } from '@/utils/constants';
import { getSetting } from '@/services/authService';

interface SettingsState {
  restaurantName: string;
  isLoaded: boolean;
  loadSettings: () => Promise<void>;
  setRestaurantName: (name: string) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  restaurantName: APP_NAME,
  isLoaded: false,

  loadSettings: async () => {
    const name = await getSetting(SETTINGS_KEYS.restaurantName);
    set({
      restaurantName: name?.trim() || APP_NAME,
      isLoaded: true,
    });
  },

  setRestaurantName: (name) => set({ restaurantName: name }),
}));
