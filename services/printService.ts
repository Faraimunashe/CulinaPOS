import { Platform, TurboModuleRegistry } from 'react-native';
import type { Device } from 'react-native-thermal-printer-driver';
import { ensureBluetoothPermissions } from '@/services/bluetoothPermissions';
import { formatMoney } from '@/utils/formatMoney';
import * as printerSettingsService from '@/services/printerSettingsService';
import * as settingsService from '@/services/settingsService';
import type { Order, OrderItem } from '@/types';

export type PrintJobStatus = 'printed' | 'skipped' | 'failed';

export interface PrintJobResult {
  status: PrintJobStatus;
  reason?: string;
}

export type PrinterDevice = Device;

function isNativeAvailable(): boolean {
  try {
    return TurboModuleRegistry.get('ThermalPrinterDriver') != null;
  } catch {
    return false;
  }
}

async function getDriver() {
  if (!isNativeAvailable()) {
    throw new Error(
      'Printer module unavailable. Use a development build (not Expo Go).'
    );
  }
  const mod = await import('react-native-thermal-printer-driver');
  return mod;
}

/** Scan returns bare MACs; connect expects bt:/ble:/lan: prefixes. */
export function toTransportAddress(device: Pick<Device, 'address' | 'deviceType'>): string {
  const raw = device.address.trim();
  if (/^(bt|ble|lan):/i.test(raw)) return raw;
  if (device.deviceType === 'ble') return `ble:${raw}`;
  if (Platform.OS === 'ios') return `ble:${raw}`;
  return `bt:${raw}`;
}

export async function scanPrinters(): Promise<{
  paired: PrinterDevice[];
  found: PrinterDevice[];
}> {
  await ensureBluetoothPermissions();
  const { default: ThermalPrinter } = await getDriver();
  return ThermalPrinter.scan();
}

export async function stopPrinterScan(): Promise<void> {
  try {
    const { default: ThermalPrinter } = await getDriver();
    await ThermalPrinter.stopScan();
  } catch {
    // ignore
  }
}

export async function connectPrinter(
  device: Pick<Device, 'name' | 'address' | 'deviceType'>
): Promise<string> {
  await ensureBluetoothPermissions();
  const { default: ThermalPrinter } = await getDriver();
  const address = toTransportAddress(device);
  await ThermalPrinter.connect(address, { timeout: 12000 });
  await printerSettingsService.savePrinterDevice({
    deviceName: device.name || 'Printer',
    deviceAddress: address,
  });
  return address;
}

export async function disconnectPrinter(address?: string | null): Promise<void> {
  try {
    const { default: ThermalPrinter } = await getDriver();
    if (address) await ThermalPrinter.disconnect(address);
    else await ThermalPrinter.disconnect();
  } catch {
    // ignore disconnect errors
  }
}

export async function isPrinterConnected(address: string): Promise<boolean> {
  try {
    const { default: ThermalPrinter } = await getDriver();
    return ThermalPrinter.isConnected(address);
  } catch {
    return false;
  }
}

export async function subscribeConnectionChanges(
  callback: (event: { address: string; connected: boolean }) => void
): Promise<{ remove: () => void } | null> {
  if (!isNativeAvailable()) return null;
  try {
    const { default: ThermalPrinter } = await getDriver();
    return ThermalPrinter.onConnectionChanged(callback);
  } catch {
    return null;
  }
}

/**
 * Try reconnecting to the saved printer. Never throws.
 * Returns connected address or null.
 */
export async function restorePrinterConnection(): Promise<{
  connected: boolean;
  address: string | null;
  deviceName: string | null;
}> {
  try {
    const settings = await printerSettingsService.getPrinterSettings();
    if (!settings.device_address) {
      return { connected: false, address: null, deviceName: null };
    }
    if (!isNativeAvailable()) {
      return {
        connected: false,
        address: settings.device_address,
        deviceName: settings.device_name,
      };
    }
    const { default: ThermalPrinter } = await getDriver();
    const already = await ThermalPrinter.isConnected(settings.device_address);
    if (!already) {
      await ThermalPrinter.connect(settings.device_address, { timeout: 10000 });
    }
    return {
      connected: true,
      address: settings.device_address,
      deviceName: settings.device_name,
    };
  } catch {
    const settings = await printerSettingsService.getPrinterSettings().catch(() => null);
    return {
      connected: false,
      address: settings?.device_address ?? null,
      deviceName: settings?.device_name ?? null,
    };
  }
}

function padLine(left: string, right: string, width: number): string {
  const gap = Math.max(1, width - left.length - right.length);
  return `${left}${' '.repeat(gap)}${right}`;
}

function money(amount: number, symbol: string): string {
  return formatMoney(amount, symbol);
}

function formatOrderWhen(order: Order): { date: string; time: string } {
  const created = new Date(order.created_at);
  if (Number.isNaN(created.getTime())) {
    return { date: order.order_date, time: '' };
  }
  return {
    date: created.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
    time: created.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

async function buildCustomerNodes(order: Order, paperWidth: 58 | 80) {
  const mod = await getDriver();
  const { text, line, feed, cut, columns } = mod;
  const restaurant = await settingsService.getRestaurantSettings();
  const symbol = order.currency_symbol ?? '$';
  const items = order.items ?? [];
  const { date, time } = formatOrderWhen(order);
  const cols = paperWidth === 58 ? { name: 18, qty: 4, price: 10 } : { name: 28, qty: 6, price: 14 };

  const nodes = [
    text(restaurant.restaurantName || 'Culina POS', {
      align: 'center',
      bold: true,
      size: 2,
    }),
  ];

  if (restaurant.restaurantAddress) {
    nodes.push(
      text(restaurant.restaurantAddress, { align: 'center', size: 1 })
    );
  }
  if (restaurant.restaurantPhone) {
    nodes.push(text(restaurant.restaurantPhone, { align: 'center', size: 1 }));
  }

  nodes.push(line({ style: 'dashed' }));
  nodes.push(text(`Order #${order.order_number}`, { bold: true }));
  nodes.push(text(`${date}${time ? `  ${time}` : ''}`));
  if (order.cashier_name) {
    nodes.push(text(`Cashier: ${order.cashier_name}`));
  }
  nodes.push(line({ style: 'dashed' }));

  nodes.push(
    columns([
      { content: 'Item', width: cols.name, align: 'left' },
      { content: 'Qty', width: cols.qty, align: 'right' },
      { content: 'Amt', width: cols.price, align: 'right' },
    ])
  );

  for (const item of items) {
    nodes.push(
      columns([
        {
          content: truncate(item.product_name, cols.name),
          width: cols.name,
          align: 'left',
        },
        {
          content: String(item.quantity),
          width: cols.qty,
          align: 'right',
        },
        {
          content: money(item.line_total, symbol),
          width: cols.price,
          align: 'right',
        },
      ])
    );
  }

  nodes.push(line({ style: 'dashed' }));
  nodes.push(
    text(padLine('TOTAL', money(order.total, symbol), paperWidth === 58 ? 32 : 48), {
      bold: true,
      size: 2,
    })
  );
  if (order.payment_method_name) {
    nodes.push(text(`Payment: ${order.payment_method_name}`));
  }
  nodes.push(feed(1));
  nodes.push(text('Thank you', { align: 'center', bold: true }));
  nodes.push(text('Crafted with love by Fariwe', { align: 'center', size: 1 }));
  nodes.push(feed(2));
  nodes.push(cut());

  return nodes as never[];
}

async function buildKitchenNodes(order: Order, paperWidth: 58 | 80) {
  const mod = await getDriver();
  const { text, line, feed, cut, columns } = mod;
  const items = order.items ?? [];
  const { date, time } = formatOrderWhen(order);
  const cols = paperWidth === 58 ? { name: 24, qty: 8 } : { name: 38, qty: 10 };

  const nodes = [
    text('RESTAURANT COPY', { align: 'center', bold: true, size: 2 }),
    text(`Order #${order.order_number}`, { align: 'center', bold: true, size: 2 }),
    line({ style: 'dashed' }),
    text(`${date}${time ? `  ${time}` : ''}`),
  ];
  if (order.cashier_name) {
    nodes.push(text(`Cashier: ${order.cashier_name}`));
  }
  nodes.push(line({ style: 'dashed' }));
  nodes.push(
    columns([
      { content: 'Item', width: cols.name, align: 'left' },
      { content: 'Qty', width: cols.qty, align: 'right' },
    ])
  );

  for (const item of items as OrderItem[]) {
    nodes.push(
      columns([
        {
          content: truncate(item.product_name, cols.name),
          width: cols.name,
          align: 'left',
        },
        {
          content: String(item.quantity),
          width: cols.qty,
          align: 'right',
        },
      ])
    );
  }

  nodes.push(line({ style: 'dashed' }));
  nodes.push(feed(2));
  nodes.push(cut());
  return nodes as never[];
}

function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(1, max - 1))}…`;
}

/**
 * Prints customer + restaurant receipts when a printer is connected.
 * Never throws — sale flow must continue if printing fails or is offline.
 */
export async function printOrderReceipts(
  order: Order,
  options?: { force?: boolean }
): Promise<PrintJobResult> {
  try {
    const settings = await printerSettingsService.getPrinterSettings();
    if (!options?.force && settings.auto_print !== 1) {
      return { status: 'skipped', reason: 'Auto-print is off' };
    }
    if (!settings.device_address) {
      return { status: 'skipped', reason: 'No printer configured' };
    }
    if (!isNativeAvailable()) {
      return { status: 'skipped', reason: 'Printer module unavailable' };
    }

    const { default: ThermalPrinter } = await getDriver();
    const address = settings.device_address;
    const connected = await ThermalPrinter.isConnected(address);
    if (!connected) {
      return { status: 'skipped', reason: 'Printer not connected' };
    }

    const paperWidth = settings.paper_width === 58 ? 58 : 80;
    const printOpts = {
      paperWidthMm: paperWidth as 58 | 80,
      keepAlive: true,
      timeout: 20000,
    };

    const customer = await buildCustomerNodes(order, paperWidth);
    const kitchen = await buildKitchenNodes(order, paperWidth);

    const customerResult = await ThermalPrinter.print(address, customer, printOpts);
    if (!customerResult.success) {
      return {
        status: 'failed',
        reason: customerResult.error?.message ?? 'Customer receipt failed',
      };
    }

    const kitchenResult = await ThermalPrinter.print(address, kitchen, printOpts);
    if (!kitchenResult.success) {
      return {
        status: 'failed',
        reason: kitchenResult.error?.message ?? 'Kitchen receipt failed',
      };
    }

    return { status: 'printed' };
  } catch (err) {
    return {
      status: 'failed',
      reason: err instanceof Error ? err.message : 'Print failed',
    };
  }
}
