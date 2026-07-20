import type { SQLiteDatabase } from 'expo-sqlite';

export async function migrate002CurrencyRates(db: SQLiteDatabase): Promise<void> {
  const currencyCols = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(currencies)`
  );
  const hasRate = currencyCols.some((col) => col.name === 'rate_to_primary');
  if (!hasRate) {
    await db.execAsync(
      `ALTER TABLE currencies ADD COLUMN rate_to_primary REAL NOT NULL DEFAULT 1`
    );
  }

  const productCols = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(products)`
  );
  const hasBasePrice = productCols.some((col) => col.name === 'base_price');
  if (!hasBasePrice) {
    await db.execAsync(
      `ALTER TABLE products ADD COLUMN base_price REAL NOT NULL DEFAULT 0`
    );
  }

  await db.runAsync(
    `INSERT OR IGNORE INTO settings (key, value) VALUES ('primary_currency_id', '1')`
  );

  await db.runAsync(
    `UPDATE currencies SET rate_to_primary = 1 WHERE name = 'USD'`
  );
  await db.runAsync(
    `UPDATE currencies SET rate_to_primary = 30 WHERE name = 'ZiG' AND rate_to_primary = 1`
  );
  await db.runAsync(
    `UPDATE currencies SET rate_to_primary = 18 WHERE name = 'ZAR' AND rate_to_primary = 1`
  );

  const primarySetting = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM settings WHERE key = 'primary_currency_id'`
  );
  const primaryId = Number(primarySetting?.value ?? 1);

  const products = await db.getAllAsync<{ id: number; base_price: number }>(
    `SELECT id, base_price FROM products`
  );

  for (const product of products) {
    if (product.base_price > 0) continue;

    const primaryPrice = await db.getFirstAsync<{ price: number }>(
      `SELECT price FROM product_prices
       WHERE product_id = ? AND currency_id = ?`,
      product.id,
      primaryId
    );

    const anyPrice =
      primaryPrice ??
      (await db.getFirstAsync<{ price: number }>(
        `SELECT price FROM product_prices WHERE product_id = ? ORDER BY id ASC LIMIT 1`,
        product.id
      ));

    if (anyPrice) {
      await db.runAsync(
        `UPDATE products SET base_price = ? WHERE id = ?`,
        anyPrice.price,
        product.id
      );
    }
  }
}
