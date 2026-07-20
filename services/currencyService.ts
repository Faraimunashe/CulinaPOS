import { getDatabase } from '@/database';
import { writeAuditLog } from '@/services/auditService';
import { SETTINGS_KEYS } from '@/utils/constants';
import type { ConvertedPrice, Currency, CurrencyInput } from '@/types';

function normalizeCurrencyName(name: string): string {
  return name.trim();
}

function normalizeCurrencySymbol(symbol: string): string {
  return symbol.trim();
}

function validateCurrencyInput(
  input: CurrencyInput,
  options?: { requireRate?: boolean }
): { name: string; symbol: string; rate: number; enabled: boolean } {
  const name = normalizeCurrencyName(input.name);
  const symbol = normalizeCurrencySymbol(input.symbol);
  if (!name) throw new Error('Currency name is required');
  if (!symbol) throw new Error('Currency symbol is required');
  if (name.length > 16) throw new Error('Currency name is too long');
  if (symbol.length > 8) throw new Error('Currency symbol is too long');

  const requireRate = options?.requireRate ?? true;
  const rate = input.rate_to_primary;
  if (requireRate && (!Number.isFinite(rate) || rate <= 0)) {
    throw new Error('Rate must be a number greater than zero');
  }

  return {
    name,
    symbol,
    rate: Number.isFinite(rate) && rate > 0 ? rate : 1,
    enabled: input.enabled,
  };
}

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

export async function getCurrencyById(id: number): Promise<Currency | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Currency>(
    'SELECT * FROM currencies WHERE id = ?',
    id
  );
}

export async function createCurrency(
  input: CurrencyInput,
  actorId: number
): Promise<Currency> {
  const { name, symbol, rate, enabled } = validateCurrencyInput(input);

  const db = await getDatabase();
  const duplicate = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM currencies WHERE LOWER(name) = LOWER(?)',
    name
  );
  if (duplicate) {
    throw new Error('A currency with this name already exists');
  }

  const result = await db.runAsync(
    `INSERT INTO currencies (name, symbol, enabled, rate_to_primary)
     VALUES (?, ?, ?, ?)`,
    name,
    symbol,
    enabled ? 1 : 0,
    rate
  );

  const id = Number(result.lastInsertRowId);
  await writeAuditLog({
    userId: actorId,
    action: 'CURRENCY_CREATE',
    entityType: 'currency',
    entityId: id,
    details: { name, symbol, rate, enabled },
  });

  const created = await getCurrencyById(id);
  if (!created) throw new Error('Failed to create currency');
  return created;
}

export async function updateCurrency(
  id: number,
  input: CurrencyInput,
  actorId: number
): Promise<Currency> {
  const primaryId = await getPrimaryCurrencyId();
  const isPrimary = id === primaryId;
  const { name, symbol, rate, enabled } = validateCurrencyInput(input, {
    requireRate: !isPrimary,
  });

  if (isPrimary && !enabled) {
    throw new Error('Cannot disable the primary currency');
  }

  const db = await getDatabase();
  const current = await getCurrencyById(id);
  if (!current) throw new Error('Currency not found');

  const duplicate = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM currencies WHERE LOWER(name) = LOWER(?) AND id != ?',
    name,
    id
  );
  if (duplicate) {
    throw new Error('A currency with this name already exists');
  }

  await db.runAsync(
    `UPDATE currencies
     SET name = ?, symbol = ?, enabled = ?, rate_to_primary = ?
     WHERE id = ?`,
    name,
    symbol,
    enabled ? 1 : 0,
    isPrimary ? 1 : rate,
    id
  );

  await writeAuditLog({
    userId: actorId,
    action: 'CURRENCY_UPDATE',
    entityType: 'currency',
    entityId: id,
    details: {
      name,
      symbol,
      rate: isPrimary ? 1 : rate,
      enabled,
    },
  });

  const updated = await getCurrencyById(id);
  if (!updated) throw new Error('Currency not found after update');
  return updated;
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
