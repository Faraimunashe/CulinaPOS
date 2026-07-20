import type { SQLiteDatabase } from 'expo-sqlite';

export async function migrate003DirectStockLink(db: SQLiteDatabase): Promise<void> {
  const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(products)`);
  const hasLink = cols.some((col) => col.name === 'inventory_item_id');
  if (!hasLink) {
    await db.execAsync(`
      ALTER TABLE products ADD COLUMN inventory_item_id INTEGER
        REFERENCES inventory_items(id);
    `);
  }
}
