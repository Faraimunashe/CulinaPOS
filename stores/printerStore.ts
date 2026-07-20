import { create } from 'zustand';

interface PrinterState {
  isConnected: boolean;
  deviceName: string | null;
  setConnected: (connected: boolean, deviceName?: string | null) => void;
}

export const usePrinterStore = create<PrinterState>((set) => ({
  isConnected: false,
  deviceName: null,
  setConnected: (connected, deviceName = null) =>
    set({ isConnected: connected, deviceName }),
}));
