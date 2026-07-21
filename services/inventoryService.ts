import { getDatabase } from '@/database';
import { writeAuditLog } from '@/services/auditService';
import { toIsoNow } from '@/utils/format';
import type {
  InventoryItem,
  InventoryItemInput,
  InventoryItemKind,
  StockMovement,
  StockMovementType,
} from '@/types';

export async function listInventoryItems(options?: {
  search?: string;
  lowStockOnly?: boolean;
  kind?: InventoryItemKind;
}): Promise<InventoryItem[]> {
  const db = await getDatabase();
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (options?.kind) {
    clauses.push('i.item_kind = ?');
    params.push(options.kind);
  }
  if (options?.lowStockOnly) {
    clauses.push('i.quantity <= i.minimum_quantity');
  }
  if (options?.search?.trim()) {
    clauses.push('(i.name LIKE ? OR IFNULL(p.name, "") LIKE ?)');
    const term = `%${options.search.trim()}%`;
    params.push(term, term);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db.getAllAsync<InventoryItem>(
    `SELECT i.*,
            p.id as linked_product_id,
            p.name as linked_product_name
     FROM inventory_items i
     LEFT JOIN products p
       ON p.inventory_item_id = i.id AND p.tracking_type = 'DIRECT'
     ${where}
     ORDER BY i.name COLLATE NOCASE ASC`,
    ...params
  );
}

export async function getInventoryItemById(
  id: number
): Promise<InventoryItem | null> {
  const db = await getDatabase();
  return db.getFirstAsync<InventoryItem>(
    `SELECT i.*,
            p.id as linked_product_id,
            p.name as linked_product_name
     FROM inventory_items i
     LEFT JOIN products p
       ON p.inventory_item_id = i.id AND p.tracking_type = 'DIRECT'
     WHERE i.id = ?`,
    id
  );
}

export async function createInventoryItem(
  input: InventoryItemInput,
  actorId: number
): Promise<InventoryItem> {
  const name = input.name.trim();
  if (!name) throw new Error('Item name is required');
  if (!Number.isFinite(input.quantity) || input.quantity < 0) {
    throw new Error('Quantity must be zero or greater');
  }
  if (!Number.isFinite(input.minimum_quantity) || input.minimum_quantity < 0) {
    throw new Error('Minimum quantity must be zero or greater');
  }
  if (!Number.isFinite(input.cost) || input.cost < 0) {
    throw new Error('Cost must be zero or greater');
  }
  const packSize = Math.max(1, Math.floor(input.pack_size || 1));

  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM inventory_items WHERE LOWER(name) = LOWER(?)',
    name
  );
  if (existing) throw new Error('An inventory item with this name already exists');

  const now = toIsoNow();
  const result = await db.runAsync(
    `INSERT INTO inventory_items
      (name, unit, quantity, minimum_quantity, cost, pack_size, item_kind, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    name,
    input.unit,
    input.quantity,
    input.minimum_quantity,
    input.cost,
    packSize,
    input.item_kind,
    now,
    now
  );

  const id = Number(result.lastInsertRowId);

  if (input.quantity > 0) {
    await recordStockMovement({
      inventoryItemId: id,
      movementType: 'PURCHASE',
      quantityChange: input.quantity,
      quantityBefore: 0,
      reason: 'Initial stock',
      userId: actorId,
    });
  }

  await writeAuditLog({
    userId: actorId,
    action: 'INVENTORY_CREATE',
    entityType: 'inventory_item',
    entityId: id,
    details: {
      name,
      unit: input.unit,
      quantity: input.quantity,
      pack_size: packSize,
      item_kind: input.item_kind,
    },
  });

  const item = await getInventoryItemById(id);
  if (!item) throw new Error('Failed to create inventory item');
  return item;
}

export async function ensureRetailStockForProduct(params: {
  name: string;
  packSize: number;
  openingQuantity?: number;
  minimumQuantity: number;
  existingInventoryItemId?: number | null;
  actorId: number;
}): Promise<InventoryItem> {
  const name = params.name.trim();
  const packSize = Math.max(1, Math.floor(params.packSize || 1));
  const minimum = Math.max(0, params.minimumQuantity || 0);
  const db = await getDatabase();

  if (params.existingInventoryItemId) {
    const existing = await getInventoryItemById(params.existingInventoryItemId);
    if (existing) {
      await db.runAsync(
        `UPDATE inventory_items
         SET name = ?, unit = 'units', pack_size = ?, minimum_quantity = ?,
             item_kind = 'RETAIL', updated_at = ?
         WHERE id = ?`,
        name,
        packSize,
        minimum,
        toIsoNow(),
        existing.id
      );
      const updated = await getInventoryItemById(existing.id);
      if (!updated) throw new Error('Failed to update retail stock');
      return updated;
    }
  }

  const byName = await db.getFirstAsync<InventoryItem>(
    'SELECT * FROM inventory_items WHERE LOWER(name) = LOWER(?)',
    name
  );

  if (byName) {
    await db.runAsync(
      `UPDATE inventory_items
       SET pack_size = ?, minimum_quantity = ?, item_kind = 'RETAIL',
           unit = 'units', updated_at = ?
       WHERE id = ?`,
      packSize,
      minimum,
      toIsoNow(),
      byName.id
    );
    const updated = await getInventoryItemById(byName.id);
    if (!updated) throw new Error('Failed to update retail stock');
    return updated;
  }

  return createInventoryItem(
    {
      name,
      unit: 'units',
      quantity: Math.max(0, params.openingQuantity ?? 0),
      minimum_quantity: minimum,
      cost: 0,
      pack_size: packSize,
      item_kind: 'RETAIL',
    },
    params.actorId
  );
}

export async function updateInventoryItem(
  id: number,
  input: Omit<InventoryItemInput, 'quantity'>,
  actorId: number
): Promise<InventoryItem> {
  const name = input.name.trim();
  if (!name) throw new Error('Item name is required');
  if (!Number.isFinite(input.minimum_quantity) || input.minimum_quantity < 0) {
    throw new Error('Minimum quantity must be zero or greater');
  }
  if (!Number.isFinite(input.cost) || input.cost < 0) {
    throw new Error('Cost must be zero or greater');
  }
  const packSize = Math.max(1, Math.floor(input.pack_size || 1));

  const db = await getDatabase();
  const current = await getInventoryItemById(id);
  if (!current) throw new Error('Inventory item not found');

  const duplicate = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM inventory_items WHERE LOWER(name) = LOWER(?) AND id != ?',
    name,
    id
  );
  if (duplicate) throw new Error('An inventory item with this name already exists');

  const now = toIsoNow();
  await db.runAsync(
    `UPDATE inventory_items
     SET name = ?, unit = ?, minimum_quantity = ?, cost = ?,
         pack_size = ?, item_kind = ?, updated_at = ?
     WHERE id = ?`,
    name,
    input.unit,
    input.minimum_quantity,
    input.cost,
    packSize,
    input.item_kind,
    now,
    id
  );

  await writeAuditLog({
    userId: actorId,
    action: 'INVENTORY_UPDATE',
    entityType: 'inventory_item',
    entityId: id,
    details: { name, unit: input.unit, pack_size: packSize },
  });

  const updated = await getInventoryItemById(id);
  if (!updated) throw new Error('Inventory item not found after update');
  return updated;
}

async function recordStockMovement(params: {
  inventoryItemId: number;
  movementType: StockMovementType;
  quantityBefore: number;
  quantityChange: number;
  reason: string | null;
  userId: number;
  orderId?: number | null;
}): Promise<void> {
  const db = await getDatabase();
  const quantityAfter = params.quantityBefore + params.quantityChange;
  await db.runAsync(
    `INSERT INTO stock_movements
      (inventory_item_id, movement_type, quantity_before, quantity_change,
       quantity_after, reason, user_id, order_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params.inventoryItemId,
    params.movementType,
    params.quantityBefore,
    params.quantityChange,
    quantityAfter,
    params.reason,
    params.userId,
    params.orderId ?? null,
    toIsoNow()
  );
}

export async function receiveStock(
  inventoryItemId: number,
  quantity: number,
  actorId: number,
  reason = 'Purchase'
): Promise<InventoryItem> {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('Receive quantity must be greater than zero');
  }

  const db = await getDatabase();
  const current = await getInventoryItemById(inventoryItemId);
  if (!current) throw new Error('Inventory item not found');

  const before = current.quantity;
  const after = before + quantity;
  const now = toIsoNow();

  await db.runAsync(
    'UPDATE inventory_items SET quantity = ?, updated_at = ? WHERE id = ?',
    after,
    now,
    inventoryItemId
  );

  await recordStockMovement({
    inventoryItemId,
    movementType: 'PURCHASE',
    quantityBefore: before,
    quantityChange: quantity,
    reason,
    userId: actorId,
  });

  await writeAuditLog({
    userId: actorId,
    action: 'INVENTORY_PURCHASE',
    entityType: 'inventory_item',
    entityId: inventoryItemId,
    details: { name: current.name, quantity, before, after, reason },
  });

  const updated = await getInventoryItemById(inventoryItemId);
  if (!updated) throw new Error('Inventory item not found after receive');
  return updated;
}

export async function receivePacks(
  inventoryItemId: number,
  packCount: number,
  actorId: number,
  packSizeOverride?: number
): Promise<InventoryItem> {
  if (!Number.isFinite(packCount) || packCount <= 0) {
    throw new Error('Number of packs must be greater than zero');
  }

  const current = await getInventoryItemById(inventoryItemId);
  if (!current) throw new Error('Inventory item not found');

  const packSize = Math.max(
    1,
    Math.floor(packSizeOverride || current.pack_size || 1)
  );
  const units = packCount * packSize;
  const reason =
    packSize === 1
      ? `Purchase · ${packCount} ${current.unit}`
      : `Purchase · ${packCount} × ${packSize}-pack (${units} ${current.unit})`;

  return receiveStock(inventoryItemId, units, actorId, reason);
}

export async function adjustStock(
  inventoryItemId: number,
  newQuantity: number,
  reason: string,
  actorId: number
): Promise<InventoryItem> {
  if (!Number.isFinite(newQuantity) || newQuantity < 0) {
    throw new Error('New quantity must be zero or greater');
  }
  if (!reason.trim()) throw new Error('Adjustment reason is required');

  const current = await getInventoryItemById(inventoryItemId);
  if (!current) throw new Error('Inventory item not found');

  const before = current.quantity;
  const change = newQuantity - before;
  if (change === 0) {
    throw new Error('New quantity is the same as current quantity');
  }

  const db = await getDatabase();
  const now = toIsoNow();
  await db.runAsync(
    'UPDATE inventory_items SET quantity = ?, updated_at = ? WHERE id = ?',
    newQuantity,
    now,
    inventoryItemId
  );

  await recordStockMovement({
    inventoryItemId,
    movementType: 'ADJUSTMENT',
    quantityBefore: before,
    quantityChange: change,
    reason: reason.trim(),
    userId: actorId,
  });

  await writeAuditLog({
    userId: actorId,
    action: 'INVENTORY_ADJUSTMENT',
    entityType: 'inventory_item',
    entityId: inventoryItemId,
    details: {
      name: current.name,
      before,
      after: newQuantity,
      reason: reason.trim(),
    },
  });

  const updated = await getInventoryItemById(inventoryItemId);
  if (!updated) throw new Error('Inventory item not found after adjustment');
  return updated;
}

export async function listStockMovements(
  inventoryItemId: number,
  limit = 50
): Promise<StockMovement[]> {
  const db = await getDatabase();
  return db.getAllAsync<StockMovement>(
    `SELECT sm.*, i.name as item_name, u.full_name as user_name
     FROM stock_movements sm
     INNER JOIN inventory_items i ON i.id = sm.inventory_item_id
     LEFT JOIN users u ON u.id = sm.user_id
     WHERE sm.inventory_item_id = ?
     ORDER BY sm.created_at DESC, sm.id DESC
     LIMIT ?`,
    inventoryItemId,
    limit
  );
}

/** Low-stock items whose quantity was reduced by a specific completed sale. */
export async function listLowStockItemsForOrder(
  orderId: number
): Promise<InventoryItem[]> {
  const db = await getDatabase();
  return db.getAllAsync<InventoryItem>(
    `SELECT DISTINCT i.*
     FROM inventory_items i
     INNER JOIN stock_movements sm ON sm.inventory_item_id = i.id
     WHERE sm.order_id = ?
       AND sm.movement_type = 'SALE'
       AND i.quantity <= i.minimum_quantity
     ORDER BY i.quantity ASC, i.name COLLATE NOCASE ASC`,
    orderId
  );
}

export function isLowStock(item: InventoryItem): boolean {
  return item.quantity <= item.minimum_quantity;
}

export function formatStockLabel(item: InventoryItem): string {
  const unit = item.unit;
  if (item.item_kind === 'RETAIL' && item.pack_size > 1) {
    const packs = item.quantity / item.pack_size;
    const packsLabel = Number.isInteger(packs)
      ? String(packs)
      : packs.toFixed(1);
    return `${item.quantity} ${unit} · ~${packsLabel} × ${item.pack_size}-packs`;
  }
  return `${item.quantity} ${unit}`;
}
