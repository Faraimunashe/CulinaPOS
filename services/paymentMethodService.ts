import { getDatabase } from '@/database';
import type { PaymentMethod } from '@/types';

export async function listPaymentMethods(options?: {
  enabledOnly?: boolean;
}): Promise<PaymentMethod[]> {
  const db = await getDatabase();
  if (options?.enabledOnly) {
    return db.getAllAsync<PaymentMethod>(
      `SELECT * FROM payment_methods WHERE enabled = 1 ORDER BY id ASC`
    );
  }
  return db.getAllAsync<PaymentMethod>(
    `SELECT * FROM payment_methods ORDER BY id ASC`
  );
}

export async function getPaymentMethodById(
  id: number
): Promise<PaymentMethod | null> {
  const db = await getDatabase();
  return db.getFirstAsync<PaymentMethod>(
    'SELECT * FROM payment_methods WHERE id = ?',
    id
  );
}

export async function setPaymentMethodEnabled(
  id: number,
  enabled: boolean
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE payment_methods SET enabled = ? WHERE id = ?',
    enabled ? 1 : 0,
    id
  );
}
