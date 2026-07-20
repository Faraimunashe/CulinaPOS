import { getDatabase } from '@/database';
import { hashPassword } from '@/services/passwordService';
import { writeAuditLog } from '@/services/auditService';
import { toIsoNow } from '@/utils/format';
import type {
  CreateUserInput,
  SafeUser,
  UpdateUserInput,
  User,
  UserStatus,
} from '@/types';

function toSafeUser(user: User): SafeUser {
  const { password_hash: _passwordHash, ...safe } = user;
  return safe;
}

export async function listUsers(): Promise<SafeUser[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<User>(
    `SELECT * FROM users ORDER BY
      CASE role WHEN 'ADMIN' THEN 0 ELSE 1 END,
      full_name COLLATE NOCASE ASC`
  );
  return rows.map(toSafeUser);
}

export async function getUserById(id: number): Promise<SafeUser | null> {
  const db = await getDatabase();
  const user = await db.getFirstAsync<User>(
    'SELECT * FROM users WHERE id = ?',
    id
  );
  return user ? toSafeUser(user) : null;
}

export async function createUser(
  input: CreateUserInput,
  actorId: number
): Promise<SafeUser> {
  const fullName = input.full_name.trim();
  const username = input.username.trim().toLowerCase();

  if (!fullName) throw new Error('Full name is required');
  if (!username) throw new Error('Username is required');
  if (input.password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }
  if (input.role !== 'ADMIN' && input.role !== 'CASHIER') {
    throw new Error('Invalid role');
  }

  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM users WHERE LOWER(username) = ?',
    username
  );
  if (existing) {
    throw new Error('Username is already taken');
  }

  const now = toIsoNow();
  const passwordHash = await hashPassword(input.password);
  const result = await db.runAsync(
    `INSERT INTO users (full_name, username, password_hash, role, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)`,
    fullName,
    username,
    passwordHash,
    input.role,
    now,
    now
  );

  const user = await getUserById(Number(result.lastInsertRowId));
  if (!user) throw new Error('Failed to create user');

  await writeAuditLog({
    userId: actorId,
    action: 'USER_CREATE',
    entityType: 'user',
    entityId: user.id,
    details: { username: user.username, role: user.role },
  });

  return user;
}

export async function updateUser(
  id: number,
  input: UpdateUserInput,
  actorId: number
): Promise<SafeUser> {
  const fullName = input.full_name.trim();
  const username = input.username.trim().toLowerCase();

  if (!fullName) throw new Error('Full name is required');
  if (!username) throw new Error('Username is required');

  const db = await getDatabase();
  const current = await db.getFirstAsync<User>(
    'SELECT * FROM users WHERE id = ?',
    id
  );
  if (!current) throw new Error('User not found');

  const duplicate = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM users WHERE LOWER(username) = ? AND id != ?',
    username,
    id
  );
  if (duplicate) {
    throw new Error('Username is already taken');
  }

  // Prevent removing the last active admin
  if (current.role === 'ADMIN' && input.role === 'CASHIER') {
    const adminCount = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM users
       WHERE role = 'ADMIN' AND status = 'ACTIVE' AND id != ?`,
      id
    );
    if ((adminCount?.count ?? 0) === 0) {
      throw new Error('Cannot demote the last active administrator');
    }
  }

  const now = toIsoNow();
  await db.runAsync(
    `UPDATE users
     SET full_name = ?, username = ?, role = ?, updated_at = ?
     WHERE id = ?`,
    fullName,
    username,
    input.role,
    now,
    id
  );

  await writeAuditLog({
    userId: actorId,
    action: 'USER_UPDATE',
    entityType: 'user',
    entityId: id,
    details: { username, role: input.role },
  });

  const updated = await getUserById(id);
  if (!updated) throw new Error('User not found after update');
  return updated;
}

export async function setUserStatus(
  id: number,
  status: UserStatus,
  actorId: number
): Promise<SafeUser> {
  if (id === actorId) {
    throw new Error('You cannot change your own account status');
  }

  const db = await getDatabase();
  const current = await db.getFirstAsync<User>(
    'SELECT * FROM users WHERE id = ?',
    id
  );
  if (!current) throw new Error('User not found');

  if (status === 'DISABLED' && current.role === 'ADMIN') {
    const adminCount = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM users
       WHERE role = 'ADMIN' AND status = 'ACTIVE' AND id != ?`,
      id
    );
    if ((adminCount?.count ?? 0) === 0) {
      throw new Error('Cannot disable the last active administrator');
    }
  }

  const now = toIsoNow();
  await db.runAsync(
    'UPDATE users SET status = ?, updated_at = ? WHERE id = ?',
    status,
    now,
    id
  );

  await writeAuditLog({
    userId: actorId,
    action: status === 'ACTIVE' ? 'USER_ENABLE' : 'USER_DISABLE',
    entityType: 'user',
    entityId: id,
    details: { username: current.username, status },
  });

  const updated = await getUserById(id);
  if (!updated) throw new Error('User not found after status change');
  return updated;
}

export async function resetUserPassword(
  id: number,
  newPassword: string,
  actorId: number
): Promise<void> {
  if (newPassword.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  const db = await getDatabase();
  const current = await db.getFirstAsync<User>(
    'SELECT * FROM users WHERE id = ?',
    id
  );
  if (!current) throw new Error('User not found');

  const passwordHash = await hashPassword(newPassword);
  const now = toIsoNow();
  await db.runAsync(
    'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
    passwordHash,
    now,
    id
  );

  await writeAuditLog({
    userId: actorId,
    action: 'USER_RESET_PASSWORD',
    entityType: 'user',
    entityId: id,
    details: { username: current.username },
  });
}
