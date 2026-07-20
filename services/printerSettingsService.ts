import { getDatabase } from '@/database';
import { toIsoNow } from '@/utils/format';

export interface PrinterSettings {
  id: number;
  device_name: string | null;
  device_address: string | null;
  paper_width: 58 | 80;
  auto_print: number;
  updated_at: string;
}

export async function getPrinterSettings(): Promise<PrinterSettings> {
  const db = await getDatabase();
  let row = await db.getFirstAsync<PrinterSettings>(
    'SELECT * FROM printer_settings LIMIT 1'
  );
  if (!row) {
    const now = toIsoNow();
    await db.runAsync(
      `INSERT INTO printer_settings (device_name, device_address, paper_width, auto_print, updated_at)
       VALUES (NULL, NULL, 80, 1, ?)`,
      now
    );
    row = await db.getFirstAsync<PrinterSettings>(
      'SELECT * FROM printer_settings LIMIT 1'
    );
  }
  if (!row) throw new Error('Could not load printer settings');
  return {
    ...row,
    paper_width: row.paper_width === 58 ? 58 : 80,
  };
}

export async function savePrinterDevice(input: {
  deviceName: string | null;
  deviceAddress: string | null;
}): Promise<PrinterSettings> {
  const db = await getDatabase();
  const existing = await getPrinterSettings();
  const now = toIsoNow();
  await db.runAsync(
    `UPDATE printer_settings
     SET device_name = ?, device_address = ?, updated_at = ?
     WHERE id = ?`,
    input.deviceName,
    input.deviceAddress,
    now,
    existing.id
  );
  return getPrinterSettings();
}

export async function savePrinterOptions(input: {
  paperWidth: 58 | 80;
  autoPrint: boolean;
}): Promise<PrinterSettings> {
  const db = await getDatabase();
  const existing = await getPrinterSettings();
  const now = toIsoNow();
  await db.runAsync(
    `UPDATE printer_settings
     SET paper_width = ?, auto_print = ?, updated_at = ?
     WHERE id = ?`,
    input.paperWidth,
    input.autoPrint ? 1 : 0,
    now,
    existing.id
  );
  return getPrinterSettings();
}
