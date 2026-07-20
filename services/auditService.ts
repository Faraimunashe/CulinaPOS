import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from '@/database';
import { toIsoNow } from '@/utils/format';

export async function writeAuditLog(params: {
  userId?: number | null;
  action: string;
  entityType?: string;
  entityId?: number | null;
  details?: Record<string, unknown> | null;
  db?: SQLiteDatabase;
}): Promise<void> {
  const db = params.db ?? (await getDatabase());
  await db.runAsync(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    params.userId ?? null,
    params.action,
    params.entityType ?? null,
    params.entityId ?? null,
    params.details ? JSON.stringify(params.details) : null,
    toIsoNow()
  );
}
