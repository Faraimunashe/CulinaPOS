import { getDatabase } from '@/database';
import { writeAuditLog } from '@/services/auditService';
import { SETTINGS_KEYS } from '@/utils/constants';
import type { ConvertedPrice, Currency } from '@/types';

export async function listCurrencies(options?: {
  enabledOnly?: boolean;
}): Promise<Currency[]> {
  const db = await getDatabase();
  if (options?.enabledOnly) {
    return db.getAllAsync<Currency>(
      'SELECT * FROM currencies WHERE enabled = 1 ORDER BY id ASC'
    );
  }
  return db.getAllAsync<Currency>(
    'SELECT * FROM currencies ORDER BY id ASC'
  );
}

export async function getPrimaryCurrencyId(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    SETTINGS_KEYS.primaryCurrencyId
  );
  const id = Number(row?.value ?? 1);
  return Number.isFinite(id) ? id : 1;
}

export async function getPrimaryCurrency(): Promise<Currency> {
  const db = await getDatabase();
  const primaryId = await getPrimaryCurrencyId();
  const currency = await db.getFirstAsync<Currency>(
    'SELECT * FROM currencies WHERE id = ?',
    primaryId
  );
  if (currency) return currency;

  const fallback = await db.getFirstAsync<Currency>(
    'SELECT * FROM currencies ORDER BY id ASC LIMIT 1'
  );
  if (!fallback) {
    throw new Error('No currencies configured');
  }
  return fallback;
}

export function convertFromPrimary(
  basePrice: number,
  rateToPrimary: number
): number {
  const rate = Number.isFinite(rateToPrimary) ? rateToPrimary : 1;
  return Math.round(basePrice * rate * 100) / 100;
}

export async function buildConvertedPrices(
  basePrice: number,
  options?: { enabledOnly?: boolean }
): Promise<ConvertedPrice[]> {
  const [currencies, primaryId] = await Promise.all([
    listCurrencies({ enabledOnly: options?.enabledOnly ?? true }),
    getPrimaryCurrencyId(),
  ]);

  return currencies.map((currency) => ({
    currency_id: currency.id,
    currency_name: currency.name,
    currency_symbol: currency.symbol,
    rate_to_primary: currency.rate_to_primary,
    price: convertFromPrimary(basePrice, currency.rate_to_primary),
    is_primary: currency.id === primaryId,
  }));
}

export async function setPrimaryCurrency(
  currencyId: number,
  actorId: number
): Promise<void> {
  const db = await getDatabase();
  const currency = await db.getFirstAsync<Currency>(
    'SELECT * FROM currencies WHERE id = ?',
    currencyId
  );
  if (!currency) throw new Error('Currency not found');
  if (currency.enabled !== 1) {
    throw new Error('Enable the currency before making it primary');
  }

  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    SETTINGS_KEYS.primaryCurrencyId,
    String(currencyId)
  );
  await db.runAsync(
    'UPDATE currencies SET rate_to_primary = 1 WHERE id = ?',
    currencyId
  );

  await writeAuditLog({
    userId: actorId,
    action: 'CURRENCY_SET_PRIMARY',
    entityType: 'currency',
    entityId: currencyId,
    details: { name: currency.name },
  });
}

export async function updateCurrencyRate(
  currencyId: number,
  rate: number,
  actorId: number
): Promise<void> {
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('Rate must be a number greater than zero');
  }

  const primaryId = await getPrimaryCurrencyId();
  if (currencyId === primaryId) {
    throw new Error('Primary currency rate is always 1');
  }

  const db = await getDatabase();
  const currency = await db.getFirstAsync<Currency>(
    'SELECT * FROM currencies WHERE id = ?',
    currencyId
  );
  if (!currency) throw new Error('Currency not found');

  await db.runAsync(
    'UPDATE currencies SET rate_to_primary = ? WHERE id = ?',
    rate,
    currencyId
  );

  await writeAuditLog({
    userId: actorId,
    action: 'CURRENCY_UPDATE_RATE',
    entityType: 'currency',
    entityId: currencyId,
    details: { name: currency.name, rate },
  });
}

export async function setCurrencyEnabled(
  currencyId: number,
  enabled: boolean,
  actorId: number
): Promise<void> {
  const primaryId = await getPrimaryCurrencyId();
  if (!enabled && currencyId === primaryId) {
    throw new Error('Cannot disable the primary currency');
  }

  const db = await getDatabase();
  const currency = await db.getFirstAsync<Currency>(
    'SELECT * FROM currencies WHERE id = ?',
    currencyId
  );
  if (!currency) throw new Error('Currency not found');

  await db.runAsync(
    'UPDATE currencies SET enabled = ? WHERE id = ?',
    enabled ? 1 : 0,
    currencyId
  );

  await writeAuditLog({
    userId: actorId,
    action: enabled ? 'CURRENCY_ENABLE' : 'CURRENCY_DISABLE',
    entityType: 'currency',
    entityId: currencyId,
    details: { name: currency.name },
    db,
  });
}
