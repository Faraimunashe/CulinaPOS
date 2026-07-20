import type { SQLiteDatabase } from 'expo-sqlite';
import { migrate001InitialSchema } from './migrations/001_initial_schema';
import { migrate002CurrencyRates } from './migrations/002_currency_rates';
import { migrate003DirectStockLink } from './migrations/003_direct_stock_link';
import { migrate004PackStock } from './migrations/004_pack_stock';
import { migrate005UnitsRename } from './migrations/005_units_rename';

interface Migration {
  version: number;
  name: string;
  up: (db: SQLiteDatabase) => Promise<void>;
}

const migrations: Migration[] = [
  {
    version: 1,
    name: '001_initial_schema',
    up: migrate001InitialSchema,
  },
  {
    version: 2,
    name: '002_currency_rates',
    up: migrate002CurrencyRates,
  },
  {
    version: 3,
    name: '003_direct_stock_link',
    up: migrate003DirectStockLink,
  },
  {
    version: 4,
    name: '004_pack_stock',
    up: migrate004PackStock,
  },
  {
    version: 5,
    name: '005_units_rename',
    up: migrate005UnitsRename,
  },
];

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = await db.getAllAsync<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version ASC'
  );
  const appliedVersions = new Set(applied.map((row) => row.version));

  for (const migration of migrations) {
    if (appliedVersions.has(migration.version)) {
      continue;
    }

    // Must be set BEFORE a transaction — SQLite ignores this pragma inside one.
    await db.execAsync('PRAGMA foreign_keys = OFF;');
    try {
      await db.withTransactionAsync(async () => {
        await migration.up(db);
        await db.runAsync(
          'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
          migration.version,
          new Date().toISOString()
        );
      });
    } finally {
      await db.execAsync('PRAGMA foreign_keys = ON;');
    }
  }
}
