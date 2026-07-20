import { getDatabase } from '@/database';
import { writeAuditLog } from '@/services/auditService';
import { buildConvertedPrices } from '@/services/currencyService';
import { ensureRetailStockForProduct } from '@/services/inventoryService';
import { toIsoNow } from '@/utils/format';
import type { Product, ProductInput } from '@/types';

async function attachPrices(product: Product): Promise<Product> {
  const prices = await buildConvertedPrices(product.base_price ?? 0);
  return { ...product, prices };
}

export async function listProducts(options?: {
  activeOnly?: boolean;
  search?: string;
  categoryId?: number | null;
}): Promise<Product[]> {
  const db = await getDatabase();
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (options?.activeOnly) {
    clauses.push('p.active = 1');
  }
  if (options?.categoryId != null) {
    clauses.push('p.category_id = ?');
    params.push(options.categoryId);
  }
  if (options?.search?.trim()) {
    clauses.push(
      '(p.name LIKE ? OR IFNULL(c.name, "") LIKE ? OR IFNULL(p.description, "") LIKE ?)'
    );
    const term = `%${options.search.trim()}%`;
    params.push(term, term, term);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await db.getAllAsync<Product>(
    `SELECT p.*, c.name as category_name, i.name as inventory_item_name,
            i.quantity as inventory_quantity, i.pack_size as inventory_pack_size,
            i.unit as inventory_unit
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN inventory_items i ON i.id = p.inventory_item_id
     ${where}
     ORDER BY p.name COLLATE NOCASE ASC`,
    ...params
  );

  return Promise.all(rows.map(attachPrices));
}

export async function getProductById(id: number): Promise<Product | null> {
  const db = await getDatabase();
  const product = await db.getFirstAsync<Product>(
    `SELECT p.*, c.name as category_name, i.name as inventory_item_name,
            i.quantity as inventory_quantity, i.pack_size as inventory_pack_size,
            i.unit as inventory_unit
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN inventory_items i ON i.id = p.inventory_item_id
     WHERE p.id = ?`,
    id
  );
  if (!product) return null;
  return attachPrices(product);
}

function validateProductInput(input: ProductInput): void {
  if (!input.name.trim()) throw new Error('Product name is required');
  if (input.tracking_type !== 'RECIPE' && input.tracking_type !== 'DIRECT') {
    throw new Error('Invalid tracking type');
  }
  if (!Number.isFinite(input.base_price) || input.base_price < 0) {
    throw new Error('Price must be zero or greater');
  }
  if (input.tracking_type === 'DIRECT') {
    const pack = input.retail_stock?.pack_size ?? 1;
    if (!Number.isFinite(pack) || pack < 1) {
      throw new Error('Pack size must be at least 1');
    }
  }
}

async function resolveInventoryItemId(
  input: ProductInput,
  actorId: number,
  existingInventoryItemId?: number | null
): Promise<number | null> {
  if (input.tracking_type !== 'DIRECT') return null;

  const retail = await ensureRetailStockForProduct({
    name: input.name.trim(),
    packSize: input.retail_stock?.pack_size ?? 1,
    openingQuantity: input.retail_stock?.opening_quantity,
    minimumQuantity: input.retail_stock?.minimum_quantity ?? 0,
    existingInventoryItemId:
      existingInventoryItemId ?? input.inventory_item_id,
    actorId,
  });
  return retail.id;
}

export async function createProduct(
  input: ProductInput,
  actorId: number
): Promise<Product> {
  validateProductInput(input);

  const db = await getDatabase();
  const now = toIsoNow();
  const inventoryItemId = await resolveInventoryItemId(input, actorId);

  const result = await db.runAsync(
    `INSERT INTO products
      (name, category_id, description, tracking_type, active, base_price,
       inventory_item_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.name.trim(),
    input.category_id,
    input.description.trim() || null,
    input.tracking_type,
    input.active ? 1 : 0,
    input.base_price,
    inventoryItemId,
    now,
    now
  );

  const productId = Number(result.lastInsertRowId);

  await writeAuditLog({
    userId: actorId,
    action: 'PRODUCT_CREATE',
    entityType: 'product',
    entityId: productId,
    details: {
      name: input.name.trim(),
      tracking_type: input.tracking_type,
      base_price: input.base_price,
      inventory_item_id: inventoryItemId,
    },
  });

  const product = await getProductById(productId);
  if (!product) throw new Error('Failed to create product');
  return product;
}

export async function updateProduct(
  id: number,
  input: ProductInput,
  actorId: number
): Promise<Product> {
  validateProductInput(input);

  const current = await getProductById(id);
  if (!current) throw new Error('Product not found');

  const db = await getDatabase();
  const now = toIsoNow();
  const inventoryItemId = await resolveInventoryItemId(
    input,
    actorId,
    current.inventory_item_id
  );

  await db.runAsync(
    `UPDATE products
     SET name = ?, category_id = ?, description = ?, tracking_type = ?,
         active = ?, base_price = ?, inventory_item_id = ?, updated_at = ?
     WHERE id = ?`,
    input.name.trim(),
    input.category_id,
    input.description.trim() || null,
    input.tracking_type,
    input.active ? 1 : 0,
    input.base_price,
    inventoryItemId,
    now,
    id
  );

  if (current.tracking_type === 'RECIPE' && input.tracking_type !== 'RECIPE') {
    const recipe = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM recipes WHERE product_id = ?',
      id
    );
    if (recipe) {
      await db.runAsync('DELETE FROM recipe_items WHERE recipe_id = ?', recipe.id);
      await db.runAsync('DELETE FROM recipes WHERE id = ?', recipe.id);
    }
  }

  await writeAuditLog({
    userId: actorId,
    action: 'PRODUCT_UPDATE',
    entityType: 'product',
    entityId: id,
    details: {
      name: input.name.trim(),
      tracking_type: input.tracking_type,
      base_price: input.base_price,
      inventory_item_id: inventoryItemId,
    },
  });

  const updated = await getProductById(id);
  if (!updated) throw new Error('Product not found after update');
  return updated;
}

export async function setProductActive(
  id: number,
  active: boolean,
  actorId: number
): Promise<Product> {
  const current = await getProductById(id);
  if (!current) throw new Error('Product not found');

  const db = await getDatabase();
  const now = toIsoNow();
  await db.runAsync(
    'UPDATE products SET active = ?, updated_at = ? WHERE id = ?',
    active ? 1 : 0,
    now,
    id
  );

  await writeAuditLog({
    userId: actorId,
    action: active ? 'PRODUCT_ENABLE' : 'PRODUCT_DISABLE',
    entityType: 'product',
    entityId: id,
    details: { name: current.name },
  });

  const updated = await getProductById(id);
  if (!updated) throw new Error('Product not found after update');
  return updated;
}
