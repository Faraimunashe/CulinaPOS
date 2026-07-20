import type { SQLiteDatabase } from 'expo-sqlite';

export async function migrate001InitialSchema(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NOT NULL UNIQUE,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      full_name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('ADMIN', 'CASHIER')),
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NOT NULL,
      category_id INTEGER,
      description TEXT,
      tracking_type TEXT NOT NULL CHECK (tracking_type IN ('RECIPE', 'DIRECT')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NOT NULL UNIQUE,
      unit TEXT NOT NULL CHECK (unit IN ('kg', 'grams', 'litres', 'ml', 'units')),
      quantity REAL NOT NULL DEFAULT 0,
      minimum_quantity REAL NOT NULL DEFAULT 0,
      cost REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      product_id INTEGER NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS recipe_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      recipe_id INTEGER NOT NULL,
      inventory_item_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
      FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
    );

    CREATE TABLE IF NOT EXISTS currencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NOT NULL UNIQUE,
      symbol TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS product_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      product_id INTEGER NOT NULL,
      currency_id INTEGER NOT NULL,
      price REAL NOT NULL,
      UNIQUE (product_id, currency_id),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (currency_id) REFERENCES currencies(id)
    );

    CREATE TABLE IF NOT EXISTS payment_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NOT NULL UNIQUE,
      enabled INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS daily_order_counter (
      date TEXT PRIMARY KEY NOT NULL,
      last_number INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      order_number INTEGER NOT NULL,
      order_date TEXT NOT NULL,
      cashier_id INTEGER NOT NULL,
      payment_method_id INTEGER,
      currency_id INTEGER,
      subtotal REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'COMPLETED',
      created_at TEXT NOT NULL,
      FOREIGN KEY (cashier_id) REFERENCES users(id),
      FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id),
      FOREIGN KEY (currency_id) REFERENCES currencies(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      line_total REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      inventory_item_id INTEGER NOT NULL,
      movement_type TEXT NOT NULL CHECK (movement_type IN ('PURCHASE', 'SALE', 'ADJUSTMENT')),
      quantity_before REAL NOT NULL,
      quantity_change REAL NOT NULL,
      quantity_after REAL NOT NULL,
      reason TEXT,
      user_id INTEGER,
      order_id INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS printer_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      device_name TEXT,
      device_address TEXT,
      paper_width INTEGER NOT NULL DEFAULT 80,
      auto_print INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      user_id INTEGER,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      details TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
}
