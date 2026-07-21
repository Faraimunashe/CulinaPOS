import { getDatabase } from '@/database';
import { toIsoNow } from '@/utils/format';
import {
  LICENSE_PREFIX,
  LICENSE_STORAGE_KEY,
  SETTINGS_KEYS,
} from '@/utils/constants';
import {
  getSecureItem,
  setSecureItem,
} from '@/utils/secureStorage';

export interface LicenseStatus {
  activated: boolean;
  activatedAt: string | null;
  keyUsed: string | null;
}

/** Local calendar date as YYYY-MM-DD (same style as order dates). */
export function localLicenseDate(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function expectedKeyForDate(date = new Date()): string {
  return `${LICENSE_PREFIX}${localLicenseDate(date)}`;
}

function normalizeKey(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '');
}

export function validateLicenseKey(input: string, date = new Date()): boolean {
  const expected = normalizeKey(expectedKeyForDate(date));
  const actual = normalizeKey(input);
  if (expected.length !== actual.length) return false;

  // Constant-time-ish compare for equal-length strings
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  }
  return mismatch === 0;
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

export async function isActivated(): Promise<boolean> {
  const stored = await getSecureItem(LICENSE_STORAGE_KEY);
  if (stored === '1') return true;

  // Fallback: settings row (e.g. after SecureStore edge cases)
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    SETTINGS_KEYS.licenseActivatedAt
  );
  if (row?.value) {
    await setSecureItem(LICENSE_STORAGE_KEY, '1');
    return true;
  }
  return false;
}

export async function getLicenseStatus(): Promise<LicenseStatus> {
  const activated = await isActivated();
  if (!activated) {
    return { activated: false, activatedAt: null, keyUsed: null };
  }

  const db = await getDatabase();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM settings WHERE key IN (?, ?)`,
    SETTINGS_KEYS.licenseActivatedAt,
    SETTINGS_KEYS.licenseKeyUsed
  );
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    activated: true,
    activatedAt: map.get(SETTINGS_KEYS.licenseActivatedAt) ?? null,
    keyUsed: map.get(SETTINGS_KEYS.licenseKeyUsed) ?? null,
  };
}

export async function activate(key: string): Promise<LicenseStatus> {
  if (!validateLicenseKey(key)) {
    throw new Error(
      'Invalid activation key. Check the key for today and try again.'
    );
  }

  const now = toIsoNow();
  const normalized = normalizeKey(key);

  await setSecureItem(LICENSE_STORAGE_KEY, '1');
  await upsertSetting(SETTINGS_KEYS.licenseActivatedAt, now);
  await upsertSetting(SETTINGS_KEYS.licenseKeyUsed, normalized);

  return {
    activated: true,
    activatedAt: now,
    keyUsed: normalized,
  };
}
