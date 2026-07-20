import * as SQLite from 'expo-sqlite';
import { DATABASE_NAME } from '@/utils/constants';
import { runMigrations } from './migrate';
import { seedDatabase } from './seed';

let database: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (database) {
    return database;
  }

  if (!initPromise) {
    initPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await db.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      await runMigrations(db);
      await seedDatabase(db);
      database = db;
      return db;
    })();
  }

  return initPromise;
}

export async function initializeDatabase(): Promise<void> {
  await getDatabase();
}
