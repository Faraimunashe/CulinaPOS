import type { SQLiteDatabase } from 'expo-sqlite';

export async function migrate007SaleDeleteAdmins(
  db: SQLiteDatabase
): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sale_delete_admins (
      user_id INTEGER PRIMARY KEY NOT NULL,
      granted_by_user_id INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (granted_by_user_id) REFERENCES users(id)
    );
  `);
}
