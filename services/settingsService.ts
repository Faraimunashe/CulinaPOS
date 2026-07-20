import { getDatabase } from '@/database';
import { writeAuditLog } from '@/services/auditService';
import { APP_NAME, SETTINGS_KEYS } from '@/utils/constants';
import type { PaymentMethod } from '@/types';
import * as paymentMethodService from '@/services/paymentMethodService';

export interface RestaurantSettings {
  restaurantName: string;
  restaurantAddress: string;
  restaurantPhone: string;
}

async function upsertSetting(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    value
  );
}

export async function getRestaurantSettings(): Promise<RestaurantSettings> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM settings WHERE key IN (?, ?, ?)`,
    SETTINGS_KEYS.restaurantName,
    SETTINGS_KEYS.restaurantAddress,
    SETTINGS_KEYS.restaurantPhone
  );
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    restaurantName: map.get(SETTINGS_KEYS.restaurantName)?.trim() || APP_NAME,
    restaurantAddress: map.get(SETTINGS_KEYS.restaurantAddress)?.trim() || '',
    restaurantPhone: map.get(SETTINGS_KEYS.restaurantPhone)?.trim() || '',
  };
}

export async function saveRestaurantSettings(
  input: RestaurantSettings,
  actorId: number
): Promise<RestaurantSettings> {
  const restaurantName = input.restaurantName.trim() || APP_NAME;
  const restaurantAddress = input.restaurantAddress.trim();
  const restaurantPhone = input.restaurantPhone.trim();

  await upsertSetting(SETTINGS_KEYS.restaurantName, restaurantName);
  await upsertSetting(SETTINGS_KEYS.restaurantAddress, restaurantAddress);
  await upsertSetting(SETTINGS_KEYS.restaurantPhone, restaurantPhone);

  await writeAuditLog({
    userId: actorId,
    action: 'SETTINGS_UPDATE',
    entityType: 'settings',
    details: { restaurantName, restaurantAddress, restaurantPhone },
  });

  return { restaurantName, restaurantAddress, restaurantPhone };
}

export async function listPaymentMethodSettings(): Promise<PaymentMethod[]> {
  return paymentMethodService.listPaymentMethods();
}

export async function setPaymentMethodEnabled(
  id: number,
  enabled: boolean,
  actorId: number
): Promise<void> {
  const method = await paymentMethodService.getPaymentMethodById(id);
  if (!method) throw new Error('Payment method not found');

  if (!enabled) {
    const enabledMethods = await paymentMethodService.listPaymentMethods({
      enabledOnly: true,
    });
    if (enabledMethods.length <= 1 && method.enabled === 1) {
      throw new Error('Keep at least one payment method enabled');
    }
  }

  await paymentMethodService.setPaymentMethodEnabled(id, enabled);
  await writeAuditLog({
    userId: actorId,
    action: enabled ? 'PAYMENT_METHOD_ENABLE' : 'PAYMENT_METHOD_DISABLE',
    entityType: 'payment_method',
    entityId: id,
    details: { name: method.name },
  });
}
