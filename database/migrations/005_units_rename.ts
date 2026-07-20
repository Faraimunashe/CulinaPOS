import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Renames inventory unit "pieces" → "units".
 * Must run with foreign_keys OFF (handled by migrate.ts).
 */
export async function migrate005UnitsRename(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('DROP TABLE IF EXISTS inventory_items_new;');

  const cols = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(inventory_items)`
  );
  const names = new Set(cols.map((c) => c.name));
  const hasPack = names.has('pack_size');
  const hasKind = names.has('item_kind');

  await db.execAsync(`
    CREATE TABLE inventory_items_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NOT NULL UNIQUE,
      unit TEXT NOT NULL CHECK (unit IN ('kg', 'grams', 'litres', 'ml', 'units')),
      quantity REAL NOT NULL DEFAULT 0,
      minimum_quantity REAL NOT NULL DEFAULT 0,
      cost REAL NOT NULL DEFAULT 0,
      pack_size INTEGER NOT NULL DEFAULT 1,
      item_kind TEXT NOT NULL DEFAULT 'INGREDIENT',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await db.execAsync(`
    INSERT INTO inventory_items_new (
      id, name, unit, quantity, minimum_quantity, cost,
      pack_size, item_kind, created_at, updated_at
    )
    SELECT
      id,
      name,
      CASE WHEN unit = 'pieces' THEN 'units' ELSE unit END,
      quantity,
      minimum_quantity,
      cost,
      ${hasPack ? 'pack_size' : '1'},
      ${hasKind ? 'item_kind' : "'INGREDIENT'"},
      created_at,
      updated_at
    FROM inventory_items;
  `);

  await db.execAsync(`
    DROP TABLE inventory_items;
    ALTER TABLE inventory_items_new RENAME TO inventory_items;
  `);
}
