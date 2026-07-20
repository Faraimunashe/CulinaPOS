import type { SQLiteDatabase } from 'expo-sqlite';
import { DEFAULT_ADMIN, SETTINGS_KEYS } from '@/utils/constants';
import { hashPassword, verifyPassword } from '@/services/passwordService';
import { toIsoNow } from '@/utils/format';

async function ensureDefaultAdmin(db: SQLiteDatabase): Promise<void> {
  const now = toIsoNow();
  const existingAdmin = await db.getFirstAsync<{
    id: number;
    password_hash: string;
    status: string;
  }>('SELECT id, password_hash, status FROM users WHERE LOWER(username) = ?', [
    DEFAULT_ADMIN.username,
  ]);

  const passwordHash = await hashPassword(DEFAULT_ADMIN.password);

  if (!existingAdmin) {
    await db.runAsync(
      `INSERT INTO users (full_name, username, password_hash, role, status, created_at, updated_at)
       VALUES (?, ?, ?, 'ADMIN', 'ACTIVE', ?, ?)`,
      DEFAULT_ADMIN.fullName,
      DEFAULT_ADMIN.username,
      passwordHash,
      now,
      now
    );
    return;
  }

  // Repair invalid default admin hash
  const credentialsValid = await verifyPassword(
    DEFAULT_ADMIN.password,
    existingAdmin.password_hash
  );

  if (!credentialsValid || !existingAdmin.password_hash.startsWith('sha256$')) {
    await db.runAsync(
      `UPDATE users
       SET password_hash = ?, status = 'ACTIVE', full_name = ?, updated_at = ?
       WHERE id = ?`,
      passwordHash,
      DEFAULT_ADMIN.fullName,
      now,
      existingAdmin.id
    );
  } else if (existingAdmin.status !== 'ACTIVE') {
    await db.runAsync(
      `UPDATE users SET status = 'ACTIVE', updated_at = ? WHERE id = ?`,
      now,
      existingAdmin.id
    );
  }
}

export async function seedDatabase(db: SQLiteDatabase): Promise<void> {
  const now = toIsoNow();

  await db.runAsync(
    `INSERT OR IGNORE INTO roles (id, name, description) VALUES
      (1, 'ADMIN', 'Full system access'),
      (2, 'CASHIER', 'POS sales access')`
  );

  await db.runAsync(
    `INSERT OR IGNORE INTO currencies (id, name, symbol, enabled, rate_to_primary) VALUES
      (1, 'USD', '$', 1, 1),
      (2, 'ZiG', 'ZiG', 1, 30),
      (3, 'ZAR', 'R', 1, 18)`
  );

  await db.runAsync(
    `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`,
    SETTINGS_KEYS.primaryCurrencyId,
    '1'
  );

  await db.runAsync(
    `INSERT OR IGNORE INTO payment_methods (id, name, enabled) VALUES
      (1, 'Cash', 1),
      (2, 'Card', 1),
      (3, 'Ecocash', 1)`
  );

  await db.runAsync(
    `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`,
    SETTINGS_KEYS.restaurantName,
    'Culina POS'
  );
  await db.runAsync(
    `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`,
    SETTINGS_KEYS.restaurantAddress,
    ''
  );
  await db.runAsync(
    `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`,
    SETTINGS_KEYS.restaurantPhone,
    ''
  );

  await ensureDefaultAdmin(db);

  const categoryCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories'
  );
  if ((categoryCount?.count ?? 0) === 0) {
    const defaults = [
      ['Meals', 1],
      ['Sides', 2],
      ['Drinks', 3],
      ['Extras', 4],
    ] as const;
    for (const [name, sortOrder] of defaults) {
      await db.runAsync(
        `INSERT INTO categories (name, sort_order, active, created_at, updated_at)
         VALUES (?, ?, 1, ?, ?)`,
        name,
        sortOrder,
        now,
        now
      );
    }
  }

  const printerRow = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM printer_settings LIMIT 1'
  );
  if (!printerRow) {
    await db.runAsync(
      `INSERT INTO printer_settings (device_name, device_address, paper_width, auto_print, updated_at)
       VALUES (NULL, NULL, 80, 1, ?)`,
      now
    );
  }
}
