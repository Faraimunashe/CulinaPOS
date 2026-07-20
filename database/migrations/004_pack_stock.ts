import type { SQLiteDatabase } from 'expo-sqlite';

export async function migrate004PackStock(db: SQLiteDatabase): Promise<void> {
  const cols = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(inventory_items)`
  );
  const names = new Set(cols.map((c) => c.name));

  if (!names.has('pack_size')) {
    await db.execAsync(
      `ALTER TABLE inventory_items ADD COLUMN pack_size INTEGER NOT NULL DEFAULT 1`
    );
  }
  if (!names.has('item_kind')) {
    await db.execAsync(
      `ALTER TABLE inventory_items ADD COLUMN item_kind TEXT NOT NULL DEFAULT 'INGREDIENT'`
    );
  }

  await db.runAsync(`
    UPDATE inventory_items
    SET item_kind = 'RETAIL',
        pack_size = CASE WHEN pack_size < 1 THEN 1 ELSE pack_size END
    WHERE id IN (
      SELECT inventory_item_id FROM products
      WHERE tracking_type = 'DIRECT' AND inventory_item_id IS NOT NULL
    )
  `);
}
