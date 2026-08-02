import type { SQLiteDatabase } from 'expo-sqlite';

export async function migrate006KitchenCopyOption(
  db: SQLiteDatabase
): Promise<void> {
  const cols = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(printer_settings)'
  );
  const hasColumn = cols.some((c) => c.name === 'offer_second_kitchen_copy');
  if (!hasColumn) {
    await db.execAsync(
      `ALTER TABLE printer_settings
       ADD COLUMN offer_second_kitchen_copy INTEGER NOT NULL DEFAULT 1`
    );
  }
}
