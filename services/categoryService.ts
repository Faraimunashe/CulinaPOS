import { getDatabase } from '@/database';
import { writeAuditLog } from '@/services/auditService';
import { toIsoNow } from '@/utils/format';
import type { Category, CategoryInput } from '@/types';

export async function listCategories(options?: {
  activeOnly?: boolean;
}): Promise<Category[]> {
  const db = await getDatabase();
  if (options?.activeOnly) {
    return db.getAllAsync<Category>(
      `SELECT * FROM categories
       WHERE active = 1
       ORDER BY sort_order ASC, name COLLATE NOCASE ASC`
    );
  }

  return db.getAllAsync<Category>(
    `SELECT * FROM categories
     ORDER BY sort_order ASC, name COLLATE NOCASE ASC`
  );
}

export async function getCategoryById(id: number): Promise<Category | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Category>(
    'SELECT * FROM categories WHERE id = ?',
    id
  );
}

export async function createCategory(
  input: CategoryInput,
  actorId: number
): Promise<Category> {
  const name = input.name.trim();
  if (!name) throw new Error('Category name is required');

  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM categories WHERE LOWER(name) = LOWER(?)',
    name
  );
  if (existing) throw new Error('A category with this name already exists');

  const now = toIsoNow();
  const result = await db.runAsync(
    `INSERT INTO categories (name, sort_order, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    name,
    input.sort_order,
    input.active ? 1 : 0,
    now,
    now
  );

  const category = await getCategoryById(Number(result.lastInsertRowId));
  if (!category) throw new Error('Failed to create category');

  await writeAuditLog({
    userId: actorId,
    action: 'CATEGORY_CREATE',
    entityType: 'category',
    entityId: category.id,
    details: { name: category.name },
  });

  return category;
}

export async function updateCategory(
  id: number,
  input: CategoryInput,
  actorId: number
): Promise<Category> {
  const name = input.name.trim();
  if (!name) throw new Error('Category name is required');

  const db = await getDatabase();
  const current = await getCategoryById(id);
  if (!current) throw new Error('Category not found');

  const duplicate = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND id != ?',
    name,
    id
  );
  if (duplicate) throw new Error('A category with this name already exists');

  const now = toIsoNow();
  await db.runAsync(
    `UPDATE categories
     SET name = ?, sort_order = ?, active = ?, updated_at = ?
     WHERE id = ?`,
    name,
    input.sort_order,
    input.active ? 1 : 0,
    now,
    id
  );

  await writeAuditLog({
    userId: actorId,
    action: 'CATEGORY_UPDATE',
    entityType: 'category',
    entityId: id,
    details: { name, active: input.active },
  });

  const updated = await getCategoryById(id);
  if (!updated) throw new Error('Category not found after update');
  return updated;
}

export async function setCategoryActive(
  id: number,
  active: boolean,
  actorId: number
): Promise<Category> {
  const db = await getDatabase();
  const current = await getCategoryById(id);
  if (!current) throw new Error('Category not found');

  const now = toIsoNow();
  await db.runAsync(
    'UPDATE categories SET active = ?, updated_at = ? WHERE id = ?',
    active ? 1 : 0,
    now,
    id
  );

  await writeAuditLog({
    userId: actorId,
    action: active ? 'CATEGORY_ENABLE' : 'CATEGORY_DISABLE',
    entityType: 'category',
    entityId: id,
    details: { name: current.name },
  });

  const updated = await getCategoryById(id);
  if (!updated) throw new Error('Category not found after update');
  return updated;
}
