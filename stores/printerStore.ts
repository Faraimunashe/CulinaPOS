import { create } from 'zustand';
import * as printService from '@/services/printService';
import * as printerSettingsService from '@/services/printerSettingsService';

interface PrinterState {
  isConnected: boolean;
  deviceName: string | null;
  deviceAddress: string | null;
  autoPrint: boolean;
  paperWidth: 58 | 80;
  offerSecondKitchenCopy: boolean;
  nativeAvailable: boolean;
  setConnected: (
    connected: boolean,
    info?: { deviceName?: string | null; deviceAddress?: string | null }
  ) => void;
  hydrate: () => Promise<void>;
  connectDevice: (device: {
    name: string;
    address: string;
    deviceType: 'bt' | 'ble' | 'dual' | 'unknown';
  }) => Promise<void>;
  disconnectDevice: () => Promise<void>;
}

export const usePrinterStore = create<PrinterState>((set, get) => ({
  isConnected: false,
  deviceName: null,
  deviceAddress: null,
  autoPrint: true,
  paperWidth: 80,
  offerSecondKitchenCopy: true,
  nativeAvailable: true,
  setConnected: (connected, info) =>
    set({
      isConnected: connected,
      deviceName: info?.deviceName ?? get().deviceName,
      deviceAddress: info?.deviceAddress ?? get().deviceAddress,
    }),

  hydrate: async () => {
    try {
      const settings = await printerSettingsService.getPrinterSettings();
      set({
        deviceName: settings.device_name,
        deviceAddress: settings.device_address,
        autoPrint: settings.auto_print === 1,
        paperWidth: settings.paper_width,
        offerSecondKitchenCopy: settings.offer_second_kitchen_copy === 1,
      });
      const restored = await printService.restorePrinterConnection();
      set({
        isConnected: restored.connected,
        deviceName: restored.deviceName ?? settings.device_name,
        deviceAddress: restored.address ?? settings.device_address,
        nativeAvailable: true,
      });

      if (restored.connected || settings.device_address) {
        void printService.subscribeConnectionChanges(({ address, connected }) => {
          const current = get().deviceAddress;
          if (!current || address === current) {
            set({ isConnected: connected });
          }
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      set({
        isConnected: false,
        nativeAvailable: !message.includes('unavailable'),
      });
    }
  },

  connectDevice: async (device) => {
    const address = await printService.connectPrinter(device);
    set({
      isConnected: true,
      deviceName: device.name || 'Printer',
      deviceAddress: address,
    });
  },

  disconnectDevice: async () => {
    const address = get().deviceAddress;
    await printService.disconnectPrinter(address);
    set({ isConnected: false });
  },
}));
