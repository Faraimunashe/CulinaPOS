import { getDatabase } from '@/database';
import { SESSION_KEY } from '@/utils/constants';
import { toIsoNow } from '@/utils/format';
import {
  deleteSecureItem,
  getSecureItem,
  setSecureItem,
} from '@/utils/secureStorage';
import { verifyPassword, hashPassword } from '@/services/passwordService';
import type { SafeUser, User } from '@/types';

function toSafeUser(user: User): SafeUser {
  const { password_hash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

export async function login(
  username: string,
  password: string
): Promise<SafeUser> {
  const db = await getDatabase();
  const trimmedUsername = username.trim().toLowerCase();

  const user = await db.getFirstAsync<User>(
    'SELECT * FROM users WHERE LOWER(username) = ?',
    trimmedUsername
  );

  if (!user) {
    throw new Error('Invalid username or password');
  }

  if (user.status === 'DISABLED') {
    throw new Error('This account has been disabled. Contact an administrator.');
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    throw new Error('Invalid username or password');
  }

  await setSecureItem(SESSION_KEY, String(user.id));

  await db.runAsync(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, created_at)
     VALUES (?, 'LOGIN', 'user', ?, ?, ?)`,
    user.id,
    user.id,
    JSON.stringify({ username: user.username }),
    toIsoNow()
  );

  return toSafeUser(user);
}

export async function logout(userId?: number | null): Promise<void> {
  await deleteSecureItem(SESSION_KEY);

  if (userId) {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, created_at)
       VALUES (?, 'LOGOUT', 'user', ?, NULL, ?)`,
      userId,
      userId,
      toIsoNow()
    );
  }
}

export async function restoreSession(): Promise<SafeUser | null> {
  const storedId = await getSecureItem(SESSION_KEY);
  if (!storedId) {
    return null;
  }

  const userId = Number(storedId);
  if (!Number.isFinite(userId)) {
    await deleteSecureItem(SESSION_KEY);
    return null;
  }

  const db = await getDatabase();
  const user = await db.getFirstAsync<User>(
    'SELECT * FROM users WHERE id = ?',
    userId
  );

  if (!user || user.status === 'DISABLED') {
    await deleteSecureItem(SESSION_KEY);
    return null;
  }

  return toSafeUser(user);
}

export async function changePassword(
  userId: number,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  if (newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters');
  }

  const db = await getDatabase();
  const user = await db.getFirstAsync<User>(
    'SELECT * FROM users WHERE id = ?',
    userId
  );

  if (!user) {
    throw new Error('User not found');
  }

  const valid = await verifyPassword(currentPassword, user.password_hash);
  if (!valid) {
    throw new Error('Current password is incorrect');
  }

  const passwordHash = await hashPassword(newPassword);
  const now = toIsoNow();

  await db.runAsync(
    'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
    passwordHash,
    now,
    userId
  );

  await db.runAsync(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, created_at)
     VALUES (?, 'CHANGE_PASSWORD', 'user', ?, NULL, ?)`,
    userId,
    userId,
    now
  );
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    key
  );
  return row?.value ?? null;
}
