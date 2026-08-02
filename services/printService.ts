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

/** Chars per line for Font A — 1 under nominal so picky printers never wrap. */
function charsPerLine(paperWidth: 58 | 80): number {
  return paperWidth >= 80 ? 47 : 31;
}

/**
 * Thermal printers often mishandle UTF-8 (emoji, fancy dashes, hearts).
 * Keep printable ASCII so lines stay short and readable.
 */
function toPrintableAscii(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function clip(value: string, max: number): string {
  const s = toPrintableAscii(value);
  if (s.length <= max) return s;
  if (max <= 1) return s.slice(0, max);
  return `${s.slice(0, max - 1)}.`;
}

function money(amount: number, symbol: string): string {
  const safeSymbol = toPrintableAscii(symbol) || '$';
  return formatMoney(amount, safeSymbol);
}

/** Keep amounts short enough for the Amt column. */
function moneyCompact(amount: number, symbol: string, maxWidth: number): string {
  let value = money(amount, symbol);
  if (value.length > maxWidth) {
    value = amount.toFixed(2);
  }
  return clip(value, maxWidth);
}

function formatOrderWhen(order: Order): { date: string; time: string } {
  const created = new Date(order.created_at);
  if (Number.isNaN(created.getTime())) {
    return { date: order.order_date, time: '' };
  }
  const y = created.getFullYear();
  const m = String(created.getMonth() + 1).padStart(2, '0');
  const d = String(created.getDate()).padStart(2, '0');
  const hh = String(created.getHours()).padStart(2, '0');
  const mm = String(created.getMinutes()).padStart(2, '0');
  return { date: `${y}-${m}-${d}`, time: `${hh}:${mm}` };
}

function dashedRule(width: number): string {
  return '-'.repeat(width);
}

function padLine(left: string, right: string, width: number): string {
  const r = clip(right, Math.max(1, width - 2));
  const maxLeft = Math.max(1, width - r.length - 1);
  const l = clip(left, maxLeft);
  const gap = Math.max(1, width - l.length - r.length);
  const line = `${l}${' '.repeat(gap)}${r}`;
  return line.length > width ? line.slice(0, width) : line;
}

/**
 * Fixed 3-column row that is ALWAYS exactly `width` characters.
 * Item left · Qty right · Amt right — stays on one line.
 */
function itemRow(name: string, qty: string, amt: string, width: number): string {
  const qtyW = 4;
  const amtW = 9;
  const gaps = 2;
  const nameW = Math.max(8, width - qtyW - amtW - gaps);
  const n = clip(name, nameW).padEnd(nameW, ' ');
  const q = clip(qty, qtyW).padStart(qtyW, ' ');
  const a = clip(amt, amtW).padStart(amtW, ' ');
  return `${n} ${q} ${a}`.slice(0, width);
}

function itemHeader(width: number): string {
  return itemRow('Item', 'Qty', 'Amt', width);
}

function kitchenRow(name: string, qty: string, width: number): string {
  const qtyW = 4;
  const nameW = Math.max(8, width - qtyW - 1);
  const n = clip(name, nameW).padEnd(nameW, ' ');
  const q = clip(qty, qtyW).padStart(qtyW, ' ');
  return `${n} ${q}`.slice(0, width);
}

async function buildCustomerNodes(order: Order, paperWidth: 58 | 80) {
  const mod = await getDriver();
  const { text, feed, cut } = mod;
  const restaurant = await settingsService.getRestaurantSettings();
  const symbol = order.currency_symbol ?? '$';
  const items = order.items ?? [];
  const { date, time } = formatOrderWhen(order);
  const width = charsPerLine(paperWidth);
  // Double-width text fits roughly half as many characters
  const wideWidth = Math.floor(width / 2);

  const nodes = [
    text(clip(restaurant.restaurantName || 'Culina POS', wideWidth), {
      align: 'center',
      bold: true,
      size: 2,
    }),
  ];

  if (restaurant.restaurantAddress) {
    nodes.push(
      text(clip(restaurant.restaurantAddress, width), {
        align: 'center',
      })
    );
  }
  if (restaurant.restaurantPhone) {
    nodes.push(
      text(clip(restaurant.restaurantPhone, width), {
        align: 'center',
      })
    );
  }

  nodes.push(text(dashedRule(width)));
  nodes.push(text(`Order #${order.order_number}`, { bold: true }));
  nodes.push(text(`${date}${time ? ` ${time}` : ''}`));
  if (order.cashier_name) {
    nodes.push(text(clip(`Cashier: ${order.cashier_name}`, width)));
  }
  nodes.push(text(dashedRule(width)));
  // Same fixed columns as every item row (avoid bold — can shift spacing)
  nodes.push(text(itemHeader(width)));
  nodes.push(text(dashedRule(width)));

  if (items.length === 0) {
    nodes.push(text('(no items)'));
  } else {
    for (const item of items) {
      const name = toPrintableAscii(item.product_name) || 'Item';
      const qty = String(item.quantity);
      const amt = moneyCompact(item.line_total, symbol, 9);
      nodes.push(text(itemRow(name, qty, amt, width)));
    }
  }

  nodes.push(text(dashedRule(width)));
  nodes.push(
    text(
      padLine('TOTAL', moneyCompact(order.total, symbol, wideWidth - 6), wideWidth),
      {
        bold: true,
        size: 2,
      }
    )
  );
  if (order.payment_method_name) {
    nodes.push(text(clip(`Payment: ${order.payment_method_name}`, width)));
  }
  nodes.push(text(' '));
  nodes.push(text('Thank you', { align: 'center', bold: true }));
  nodes.push(text('Made with love by', { align: 'center' }));
  nodes.push(text('https://faraimunashe.live', { align: 'center' }));
  nodes.push(feed(1));
  nodes.push(cut());

  return nodes as never[];
}

async function buildKitchenNodes(order: Order, paperWidth: 58 | 80) {
  const mod = await getDriver();
  const { text, feed, cut } = mod;
  const items = (order.items ?? []) as OrderItem[];
  const { date, time } = formatOrderWhen(order);
  const width = charsPerLine(paperWidth);
  const wideWidth = Math.floor(width / 2);

  const nodes = [
    text('RESTAURANT COPY', { align: 'center', bold: true, size: 2 }),
    text(clip(`Order #${order.order_number}`, wideWidth), {
      align: 'center',
      bold: true,
      size: 2,
    }),
    text(dashedRule(width)),
    text(`${date}${time ? ` ${time}` : ''}`),
  ];
  if (order.cashier_name) {
    nodes.push(text(clip(`Cashier: ${order.cashier_name}`, width)));
  }
  nodes.push(text(dashedRule(width)));
  nodes.push(text(kitchenRow('Item', 'Qty', width)));
  nodes.push(text(dashedRule(width)));

  if (items.length === 0) {
    nodes.push(text('(no items)'));
  } else {
    for (const item of items) {
      const name = toPrintableAscii(item.product_name) || 'Item';
      nodes.push(text(kitchenRow(name, String(item.quantity), width)));
    }
  }

  const symbol = order.currency_symbol ?? '$';
  nodes.push(text(dashedRule(width)));
  nodes.push(
    text(
      padLine(
        'TOTAL',
        moneyCompact(order.total, symbol, wideWidth - 6),
        wideWidth
      ),
      {
        bold: true,
        size: 2,
      }
    )
  );
  if (order.payment_method_name) {
    nodes.push(text(clip(`Payment: ${order.payment_method_name}`, width)));
  }
  nodes.push(feed(1));
  nodes.push(cut());
  return nodes as never[];
}

type PrintCopy = 'customer' | 'restaurant';

async function resolveOrderForPrint(order: Order): Promise<Order> {
  const { getOrderById } = await import('@/services/orderService');
  const fullOrder = (await getOrderById(order.id)) ?? order;
  if (!fullOrder.items?.length && order.items?.length) {
    fullOrder.items = order.items;
  }
  return fullOrder;
}

/**
 * Prefer an existing link; if the driver's connection probe fails, reconnect.
 * Many ESC/POS stacks report "not connected" after idle even though print still works
 * after a quick reconnect.
 */
async function ensurePrinterSession(address: string): Promise<void> {
  await ensureBluetoothPermissions();
  const { default: ThermalPrinter } = await getDriver();

  let linked = false;
  try {
    linked = await ThermalPrinter.isConnected(address);
  } catch {
    linked = false;
  }

  if (linked) return;

  await ThermalPrinter.connect(address, { timeout: 12000 });
}

async function printCopy(
  order: Order,
  copy: PrintCopy,
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

    try {
      await ensurePrinterSession(address);
    } catch (err) {
      return {
        status: 'skipped',
        reason:
          err instanceof Error
            ? `Printer not connected: ${err.message}`
            : 'Printer not connected',
      };
    }

    const paperWidth = settings.paper_width === 58 ? 58 : 80;
    const printOpts = {
      paperWidthMm: paperWidth as 58 | 80,
      keepAlive: true,
      timeout: 20000,
      codePage: 'cp437' as const,
    };

    const fullOrder = await resolveOrderForPrint(order);
    const nodes =
      copy === 'customer'
        ? await buildCustomerNodes(fullOrder, paperWidth)
        : await buildKitchenNodes(fullOrder, paperWidth);

    const send = async () =>
      ThermalPrinter.print(address, nodes, printOpts);

    let result = await send();
    if (!result.success) {
      // One reconnect + retry — covers drop after customer copy / idle timeout
      try {
        await ThermalPrinter.connect(address, { timeout: 12000 });
        result = await send();
      } catch (err) {
        return {
          status: 'failed',
          reason:
            result.error?.message ??
            (err instanceof Error ? err.message : 'Print failed'),
        };
      }
    }

    if (!result.success) {
      return {
        status: 'failed',
        reason:
          result.error?.message ??
          (copy === 'customer'
            ? 'Customer receipt failed'
            : 'Restaurant copy failed'),
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

/** Prints the customer receipt only. */
export async function printCustomerReceipt(
  order: Order,
  options?: { force?: boolean }
): Promise<PrintJobResult> {
  return printCopy(order, 'customer', options);
}

/** Prints the restaurant (kitchen) copy only. */
export async function printRestaurantCopy(
  order: Order,
  options?: { force?: boolean }
): Promise<PrintJobResult> {
  return printCopy(order, 'restaurant', options);
}

/**
 * Prints the customer receipt. Restaurant copy is handled by the UI prompt.
 * Kept for callers that only need the customer path.
 */
export async function printOrderReceipts(
  order: Order,
  options?: { force?: boolean }
): Promise<PrintJobResult> {
  return printCustomerReceipt(order, options);
}

async function buildDailySummaryNodes(
  summary: import('@/services/reportService').DailyCloseSummary,
  paperWidth: 58 | 80
) {
  const mod = await getDriver();
  const { text, feed, cut } = mod;
  const restaurant = await settingsService.getRestaurantSettings();
  const width = charsPerLine(paperWidth);
  const wideWidth = Math.floor(width / 2);

  const nodes = [
    text(clip(restaurant.restaurantName || 'Culina POS', wideWidth), {
      align: 'center',
      bold: true,
      size: 2,
    }),
    text('SALES SUMMARY', { align: 'center', bold: true, size: 2 }),
    text(
      summary.date_from === summary.date_to
        ? summary.date_from
        : `${summary.date_from} - ${summary.date_to}`,
      { align: 'center' }
    ),
    text(dashedRule(width)),
    text(`Orders: ${summary.order_count}`, { bold: true }),
    text(dashedRule(width)),
  ];

  nodes.push(text('BY CASHIER', { bold: true }));
  if (summary.by_cashier.length === 0) {
    nodes.push(text('(none)'));
  } else {
    let lastCashier = '';
    for (const row of summary.by_cashier) {
      if (row.cashier_name !== lastCashier) {
        nodes.push(text(clip(row.cashier_name, width), { bold: true }));
        lastCashier = row.cashier_name;
      }
      nodes.push(
        text(
          padLine(
            `  ${row.currency_symbol} x${row.order_count}`,
            moneyCompact(row.total, row.currency_symbol, 10),
            width
          )
        )
      );
    }
  }

  nodes.push(text(dashedRule(width)));
  nodes.push(text('BY PAYMENT', { bold: true }));
  if (summary.by_payment.length === 0) {
    nodes.push(text('(none)'));
  } else {
    let lastPay = '';
    for (const row of summary.by_payment) {
      if (row.payment_method_name !== lastPay) {
        nodes.push(text(clip(row.payment_method_name, width), { bold: true }));
        lastPay = row.payment_method_name;
      }
      nodes.push(
        text(
          padLine(
            `  ${row.currency_symbol} x${row.order_count}`,
            moneyCompact(row.total, row.currency_symbol, 10),
            width
          )
        )
      );
    }
  }

  nodes.push(text(dashedRule(width)));
  nodes.push(text('BY CURRENCY', { bold: true }));
  if (summary.by_currency.length === 0) {
    nodes.push(text('(none)'));
  } else {
    for (const row of summary.by_currency) {
      nodes.push(
        text(
          padLine(
            `${clip(row.currency_name, 12)} x${row.order_count}`,
            moneyCompact(row.total, row.currency_symbol, 10),
            width
          )
        )
      );
    }
  }

  nodes.push(text(dashedRule(width)));
  nodes.push(text('GRAND TOTAL', { bold: true, align: 'center' }));
  if (summary.by_currency.length === 0) {
    nodes.push(text('0.00', { align: 'center', bold: true, size: 2 }));
  } else {
    for (const row of summary.by_currency) {
      nodes.push(
        text(
          padLine(
            clip(row.currency_name, wideWidth - 8),
            moneyCompact(row.total, row.currency_symbol, wideWidth - 6),
            wideWidth
          ),
          { bold: true, size: 2 }
        )
      );
    }
  }
  nodes.push(text(`Orders: ${summary.order_count}`, { align: 'center' }));
  nodes.push(text(dashedRule(width)));
  nodes.push(text('Sales summary report', { align: 'center' }));
  nodes.push(feed(1));
  nodes.push(cut());

  return nodes as never[];
}

/** Prints a sales summary Z-report for a day or filtered date range. */
export async function printDailySummaryReceipt(options?: {
  orderDate?: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  cashierId?: number | null;
  currencyId?: number | null;
}): Promise<PrintJobResult> {
  try {
    if (!isNativeAvailable()) {
      return { status: 'skipped', reason: 'Printer module unavailable' };
    }

    const settings = await printerSettingsService.getPrinterSettings();
    if (!settings.device_address) {
      return { status: 'skipped', reason: 'No printer configured' };
    }

    const { getDailyCloseSummary } = await import('@/services/reportService');
    const summary = await getDailyCloseSummary({
      orderDate: options?.orderDate,
      dateFrom: options?.dateFrom,
      dateTo: options?.dateTo,
      cashierId: options?.cashierId,
      currencyId: options?.currencyId,
    });

    const { default: ThermalPrinter } = await getDriver();
    const address = settings.device_address;

    try {
      await ensurePrinterSession(address);
    } catch (err) {
      return {
        status: 'skipped',
        reason:
          err instanceof Error
            ? `Printer not connected: ${err.message}`
            : 'Printer not connected',
      };
    }

    const paperWidth = settings.paper_width === 58 ? 58 : 80;
    const printOpts = {
      paperWidthMm: paperWidth as 58 | 80,
      keepAlive: true,
      timeout: 20000,
      codePage: 'cp437' as const,
    };

    const nodes = await buildDailySummaryNodes(summary, paperWidth);
    const send = async () => ThermalPrinter.print(address, nodes, printOpts);

    let result = await send();
    if (!result.success) {
      try {
        await ThermalPrinter.connect(address, { timeout: 12000 });
        result = await send();
      } catch (err) {
        return {
          status: 'failed',
          reason:
            result.error?.message ??
            (err instanceof Error ? err.message : 'Print failed'),
        };
      }
    }

    if (!result.success) {
      return {
        status: 'failed',
        reason: result.error?.message ?? 'Sales summary print failed',
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
