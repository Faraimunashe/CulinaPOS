import { getDatabase } from '@/database';
import { writeAuditLog } from '@/services/auditService';
import {
  deleteSecureItem,
  getSecureItem,
  setSecureItem,
} from '@/utils/secureStorage';
import { SETTINGS_KEYS } from '@/utils/constants';
import {
  SMS_API_KEY_SECURE_KEY,
  SMS_INSTALL_DEFAULTS,
} from '@/config/smsInstallDefaults';

export interface SmsSettings {
  apiUrl: string;
  sender: string;
  recipient1: string;
  recipient2: string;
  hasApiKey: boolean;
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

async function getSettingMap(keys: string[]): Promise<Map<string, string>> {
  const db = await getDatabase();
  const placeholders = keys.map(() => '?').join(', ');
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM settings WHERE key IN (${placeholders})`,
    ...keys
  );
  return new Map(rows.map((r) => [r.key, r.value]));
}

function readBundledApiKey(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const secrets = require('../config/sms.secrets') as {
      SMS_API_KEY?: string;
    };
    return secrets.SMS_API_KEY?.trim() || '';
  } catch {
    return '';
  }
}

/** E.164-ish: ensure leading + and digits only after. */
export function normalizeSmsPhone(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  return `+${digits}`;
}

export async function ensureSmsInstallDefaults(): Promise<void> {
  const map = await getSettingMap([
    SETTINGS_KEYS.smsApiUrl,
    SETTINGS_KEYS.smsSender,
    SETTINGS_KEYS.smsRecipient1,
    SETTINGS_KEYS.smsRecipient2,
  ]);

  if (!map.get(SETTINGS_KEYS.smsApiUrl)?.trim()) {
    await upsertSetting(SETTINGS_KEYS.smsApiUrl, SMS_INSTALL_DEFAULTS.apiUrl);
  }
  if (!map.get(SETTINGS_KEYS.smsSender)?.trim()) {
    await upsertSetting(SETTINGS_KEYS.smsSender, SMS_INSTALL_DEFAULTS.sender);
  }
  if (!map.get(SETTINGS_KEYS.smsRecipient1)?.trim()) {
    await upsertSetting(
      SETTINGS_KEYS.smsRecipient1,
      SMS_INSTALL_DEFAULTS.recipient1
    );
  }
  if (!map.has(SETTINGS_KEYS.smsRecipient2)) {
    await upsertSetting(
      SETTINGS_KEYS.smsRecipient2,
      SMS_INSTALL_DEFAULTS.recipient2
    );
  }

  const existing = await getSecureItem(SMS_API_KEY_SECURE_KEY);
  if (!existing?.trim()) {
    const bundled = readBundledApiKey();
    if (bundled) {
      await setSecureItem(SMS_API_KEY_SECURE_KEY, bundled);
    }
  }
}

export async function getSmsSettings(): Promise<SmsSettings> {
  await ensureSmsInstallDefaults();
  const map = await getSettingMap([
    SETTINGS_KEYS.smsApiUrl,
    SETTINGS_KEYS.smsSender,
    SETTINGS_KEYS.smsRecipient1,
    SETTINGS_KEYS.smsRecipient2,
  ]);
  const apiKey = await getSecureItem(SMS_API_KEY_SECURE_KEY);
  return {
    apiUrl:
      map.get(SETTINGS_KEYS.smsApiUrl)?.trim() || SMS_INSTALL_DEFAULTS.apiUrl,
    sender:
      map.get(SETTINGS_KEYS.smsSender)?.trim() || SMS_INSTALL_DEFAULTS.sender,
    recipient1:
      map.get(SETTINGS_KEYS.smsRecipient1)?.trim() ||
      SMS_INSTALL_DEFAULTS.recipient1,
    recipient2: map.get(SETTINGS_KEYS.smsRecipient2)?.trim() || '',
    hasApiKey: !!apiKey?.trim(),
  };
}

export async function getSmsApiKey(): Promise<string | null> {
  await ensureSmsInstallDefaults();
  const key = await getSecureItem(SMS_API_KEY_SECURE_KEY);
  const trimmed = key?.trim() || '';
  return trimmed || null;
}

export async function saveSmsSettings(
  input: {
    apiUrl: string;
    sender: string;
    recipient1: string;
    recipient2: string;
    apiKey?: string;
    clearApiKey?: boolean;
  },
  actorId: number
): Promise<SmsSettings> {
  const apiUrl = input.apiUrl.trim() || SMS_INSTALL_DEFAULTS.apiUrl;
  const sender = input.sender.trim() || SMS_INSTALL_DEFAULTS.sender;
  const recipient1 = normalizeSmsPhone(input.recipient1);
  const recipient2 = normalizeSmsPhone(input.recipient2);

  await upsertSetting(SETTINGS_KEYS.smsApiUrl, apiUrl);
  await upsertSetting(SETTINGS_KEYS.smsSender, sender);
  await upsertSetting(SETTINGS_KEYS.smsRecipient1, recipient1);
  await upsertSetting(SETTINGS_KEYS.smsRecipient2, recipient2);

  if (input.clearApiKey) {
    await deleteSecureItem(SMS_API_KEY_SECURE_KEY);
  } else if (input.apiKey != null && input.apiKey.trim()) {
    await setSecureItem(SMS_API_KEY_SECURE_KEY, input.apiKey.trim());
  }

  await writeAuditLog({
    userId: actorId,
    action: 'SMS_SETTINGS_UPDATE',
    entityType: 'settings',
    details: {
      apiUrl,
      sender,
      recipient1,
      recipient2,
      apiKeyUpdated: !!(input.apiKey?.trim() || input.clearApiKey),
    },
  });

  return getSmsSettings();
}

export function isSmsConfigured(settings: SmsSettings): boolean {
  return (
    settings.hasApiKey &&
    !!settings.apiUrl &&
    !!settings.sender &&
    (!!normalizeSmsPhone(settings.recipient1) ||
      !!normalizeSmsPhone(settings.recipient2))
  );
}
