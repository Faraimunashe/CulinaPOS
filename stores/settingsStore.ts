import { create } from 'zustand';
import { APP_NAME } from '@/utils/constants';
import * as settingsService from '@/services/settingsService';

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
    const settings = await settingsService.getRestaurantSettings();
    set({
      restaurantName: settings.restaurantName,
      isLoaded: true,
    });
  },

  setRestaurantName: (name) => set({ restaurantName: name }),
}));
