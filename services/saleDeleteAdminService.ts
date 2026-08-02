import { getDatabase } from '@/database';
import { writeAuditLog } from '@/services/auditService';
import { toIsoNow } from '@/utils/format';
import type { SafeUser } from '@/types';

export interface SaleDeleteAdminRow {
  user_id: number;
  full_name: string;
  username: string;
  status: string;
  granted_by_user_id: number | null;
  granted_by_name: string | null;
  created_at: string;
}

async function assertActiveAdmin(userId: number): Promise<void> {
  const db = await getDatabase();
  const user = await db.getFirstAsync<{ role: string; status: string }>(
    'SELECT role, status FROM users WHERE id = ?',
    userId
  );
  if (!user) throw new Error('User not found');
  if (user.role !== 'ADMIN') throw new Error('Only admins can hold this privilege');
  if (user.status !== 'ACTIVE') throw new Error('User is disabled');
}

export async function canDeleteSales(userId: number): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ user_id: number }>(
    'SELECT user_id FROM sale_delete_admins WHERE user_id = ?',
    userId
  );
  return !!row;
}

export async function isSaleDeleteAdminsEmpty(): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) as n FROM sale_delete_admins'
  );
  return (row?.n ?? 0) === 0;
}

export async function canManageSaleDeleteAdmins(
  actorUserId: number
): Promise<boolean> {
  const empty = await isSaleDeleteAdminsEmpty();
  if (empty) {
    try {
      await assertActiveAdmin(actorUserId);
      return true;
    } catch {
      return false;
    }
  }
  return canDeleteSales(actorUserId);
}

export async function listSaleDeleteAdmins(): Promise<SaleDeleteAdminRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<SaleDeleteAdminRow>(
    `SELECT s.user_id,
            u.full_name,
            u.username,
            u.status,
            s.granted_by_user_id,
            g.full_name as granted_by_name,
            s.created_at
     FROM sale_delete_admins s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN users g ON g.id = s.granted_by_user_id
     ORDER BY u.full_name COLLATE NOCASE ASC`
  );
}

export async function listEligibleAdmins(): Promise<SafeUser[]> {
  const db = await getDatabase();
  return db.getAllAsync<SafeUser>(
    `SELECT id, full_name, username, role, status, created_at, updated_at
     FROM users
     WHERE role = 'ADMIN'
       AND status = 'ACTIVE'
       AND id NOT IN (SELECT user_id FROM sale_delete_admins)
     ORDER BY full_name COLLATE NOCASE ASC`
  );
}

export async function grantSaleDeleteAdmin(
  targetUserId: number,
  actorUserId: number
): Promise<void> {
  const empty = await isSaleDeleteAdminsEmpty();

  if (empty) {
    await assertActiveAdmin(actorUserId);
    if (targetUserId !== actorUserId) {
      throw new Error(
        'When no delete admins exist yet, you can only grant yourself'
      );
    }
  } else {
    if (!(await canDeleteSales(actorUserId))) {
      throw new Error('Only sale-delete admins can grant this privilege');
    }
    await assertActiveAdmin(targetUserId);
  }

  if (await canDeleteSales(targetUserId)) {
    throw new Error('This admin already has delete access');
  }

  const db = await getDatabase();
  const now = toIsoNow();
  await db.runAsync(
    `INSERT INTO sale_delete_admins (user_id, granted_by_user_id, created_at)
     VALUES (?, ?, ?)`,
    targetUserId,
    empty ? null : actorUserId,
    now
  );

  await writeAuditLog({
    userId: actorUserId,
    action: 'SALE_DELETE_ADMIN_GRANT',
    entityType: 'user',
    entityId: targetUserId,
    details: { self_grant: empty },
  });
}

export async function revokeSaleDeleteAdmin(
  targetUserId: number,
  actorUserId: number
): Promise<void> {
  if (!(await canDeleteSales(actorUserId))) {
    throw new Error('Only sale-delete admins can revoke this privilege');
  }

  const db = await getDatabase();
  const countRow = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) as n FROM sale_delete_admins'
  );
  if ((countRow?.n ?? 0) <= 1) {
    throw new Error('Cannot remove the last sale-delete admin');
  }

  const existing = await db.getFirstAsync<{ user_id: number }>(
    'SELECT user_id FROM sale_delete_admins WHERE user_id = ?',
    targetUserId
  );
  if (!existing) {
    throw new Error('This admin does not have delete access');
  }

  await db.runAsync(
    'DELETE FROM sale_delete_admins WHERE user_id = ?',
    targetUserId
  );

  await writeAuditLog({
    userId: actorUserId,
    action: 'SALE_DELETE_ADMIN_REVOKE',
    entityType: 'user',
    entityId: targetUserId,
  });
}
