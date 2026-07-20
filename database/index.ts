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

/** Close the shared connection so the file can be replaced (backup restore). */
export async function closeDatabase(): Promise<string | null> {
  let path: string | null = database?.databasePath ?? null;

  if (initPromise && !database) {
    const db = await initPromise;
    path = db.databasePath;
    await db.closeAsync();
  } else if (database) {
    await database.closeAsync();
  }

  database = null;
  initPromise = null;
  return path;
}

export async function reopenDatabase(): Promise<SQLite.SQLiteDatabase> {
  await closeDatabase();
  return getDatabase();
}
