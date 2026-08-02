import { getDatabase } from '@/database';
import { writeAuditLog } from '@/services/auditService';
import { getRecipeForProduct } from '@/services/recipeService';
import { toIsoNow } from '@/utils/format';
import type {
  CartLine,
  CheckoutInput,
  ListOrdersFilters,
  Order,
  PosProduct,
  Product,
  SalesTotalByCurrency,
} from '@/types';
import { buildConvertedPrices } from '@/services/currencyService';
import { listProducts } from '@/services/productService';

export function localOrderDate(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

interface StockAvailability {
  maxQuantity: number;
  limitingStockName: string | null;
}

/** How many units can be sold and which stock item is the limiting factor. */
export async function getStockAvailability(
  product: Pick<
    Product,
    | 'id'
    | 'tracking_type'
    | 'inventory_item_id'
    | 'inventory_item_name'
    | 'inventory_quantity'
  >
): Promise<StockAvailability> {
  if (product.tracking_type === 'DIRECT') {
    if (product.inventory_item_id == null) {
      return { maxQuantity: 0, limitingStockName: product.inventory_item_name ?? null };
    }
    const qty = product.inventory_quantity ?? 0;
    return {
      maxQuantity: Math.max(0, Math.floor(qty)),
      limitingStockName: product.inventory_item_name ?? null,
    };
  }

  const recipe = await getRecipeForProduct(product.id);
  if (!recipe || recipe.items.length === 0) {
    return { maxQuantity: 0, limitingStockName: null };
  }

  let max = Number.POSITIVE_INFINITY;
  let limitingStockName: string | null = null;
  for (const item of recipe.items) {
    const onHand = item.inventory_quantity ?? 0;
    const perUnit = item.quantity;
    if (perUnit <= 0) {
      return {
        maxQuantity: 0,
        limitingStockName: item.inventory_name ?? null,
      };
    }
    const itemMax = Math.floor(onHand / perUnit);
    if (itemMax < max) {
      max = itemMax;
      limitingStockName = item.inventory_name ?? null;
    }
  }
  return {
    maxQuantity: Number.isFinite(max) ? Math.max(0, max) : 0,
    limitingStockName,
  };
}

/** How many units of this product can be sold with current stock. */
export async function getMaxSellableQuantity(
  product: Pick<
    Product,
    | 'id'
    | 'tracking_type'
    | 'inventory_item_id'
    | 'inventory_item_name'
    | 'inventory_quantity'
  >
): Promise<number> {
  return (await getStockAvailability(product)).maxQuantity;
}

export async function listPosProducts(options?: {
  search?: string;
  categoryId?: number | null;
}): Promise<PosProduct[]> {
  const products = await listProducts({
    activeOnly: true,
    search: options?.search,
    categoryId: options?.categoryId,
  });

  return Promise.all(
    products.map(async (product) => {
      const availability = await getStockAvailability(product);
      const max_quantity = availability.maxQuantity;
      return {
        ...product,
        max_quantity,
        limiting_stock_name: availability.limitingStockName,
        in_stock: max_quantity > 0,
      };
    })
  );
}

async function nextDailyOrderNumber(orderDate: string): Promise<number> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ last_number: number }>(
    'SELECT last_number FROM daily_order_counter WHERE date = ?',
    orderDate
  );

  if (!existing) {
    await db.runAsync(
      'INSERT INTO daily_order_counter (date, last_number) VALUES (?, 1)',
      orderDate
    );
    return 1;
  }

  const next = existing.last_number + 1;
  await db.runAsync(
    'UPDATE daily_order_counter SET last_number = ? WHERE date = ?',
    next,
    orderDate
  );
  return next;
}

async function deductInventoryForLine(
  line: CartLine,
  userId: number,
  orderId: number
): Promise<void> {
  const db = await getDatabase();
  const now = toIsoNow();

  if (line.tracking_type === 'DIRECT') {
    const product = await db.getFirstAsync<{
      inventory_item_id: number | null;
    }>('SELECT inventory_item_id FROM products WHERE id = ?', line.product_id);

    if (!product?.inventory_item_id) {
      throw new Error(`${line.product_name} has no linked stock`);
    }

    const item = await db.getFirstAsync<{ id: number; quantity: number; name: string }>(
      'SELECT id, quantity, name FROM inventory_items WHERE id = ?',
      product.inventory_item_id
    );
    if (!item) throw new Error(`Stock record missing for ${line.product_name}`);

    if (item.quantity < line.quantity) {
      throw new Error(`Insufficient stock for ${line.product_name}`);
    }

    const before = item.quantity;
    const after = before - line.quantity;
    await db.runAsync(
      'UPDATE inventory_items SET quantity = ?, updated_at = ? WHERE id = ?',
      after,
      now,
      item.id
    );
    await db.runAsync(
      `INSERT INTO stock_movements
        (inventory_item_id, movement_type, quantity_before, quantity_change,
         quantity_after, reason, user_id, order_id, created_at)
       VALUES (?, 'SALE', ?, ?, ?, ?, ?, ?, ?)`,
      item.id,
      before,
      -line.quantity,
      after,
      `Sale · ${line.product_name}`,
      userId,
      orderId,
      now
    );
    return;
  }

  const recipe = await getRecipeForProduct(line.product_id);
  if (!recipe || recipe.items.length === 0) {
    throw new Error(`${line.product_name} has no recipe`);
  }

  for (const ingredient of recipe.items) {
    const need = ingredient.quantity * line.quantity;
    const item = await db.getFirstAsync<{
      id: number;
      quantity: number;
      name: string;
    }>(
      'SELECT id, quantity, name FROM inventory_items WHERE id = ?',
      ingredient.inventory_item_id
    );
    if (!item) {
      throw new Error(`Ingredient missing for ${line.product_name}`);
    }
    if (item.quantity < need) {
      throw new Error(
        `Insufficient ${item.name} for ${line.product_name}`
      );
    }

    const before = item.quantity;
    const after = before - need;
    await db.runAsync(
      'UPDATE inventory_items SET quantity = ?, updated_at = ? WHERE id = ?',
      after,
      now,
      item.id
    );
    await db.runAsync(
      `INSERT INTO stock_movements
        (inventory_item_id, movement_type, quantity_before, quantity_change,
         quantity_after, reason, user_id, order_id, created_at)
       VALUES (?, 'SALE', ?, ?, ?, ?, ?, ?, ?)`,
      item.id,
      before,
      -need,
      after,
      `Sale · ${line.product_name} × ${line.quantity}`,
      userId,
      orderId,
      now
    );
  }
}

export async function processOrder(input: CheckoutInput): Promise<Order> {
  if (!input.lines.length) {
    throw new Error('Cart is empty');
  }
  for (const line of input.lines) {
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      throw new Error(`Invalid quantity for ${line.product_name}`);
    }
    if (!Number.isFinite(line.unit_price) || line.unit_price < 0) {
      throw new Error(`Invalid price for ${line.product_name}`);
    }
  }

  const db = await getDatabase();
  const orderDate = localOrderDate();
  const now = toIsoNow();
  const subtotal = input.lines.reduce(
    (sum, line) => sum + line.unit_price * line.quantity,
    0
  );
  const total = Math.round(subtotal * 100) / 100;

  // Re-validate stock before committing
  for (const line of input.lines) {
    const product = await db.getFirstAsync<Product>(
      `SELECT p.*, i.quantity as inventory_quantity
       FROM products p
       LEFT JOIN inventory_items i ON i.id = p.inventory_item_id
       WHERE p.id = ? AND p.active = 1`,
      line.product_id
    );
    if (!product) {
      throw new Error(`${line.product_name} is no longer available`);
    }
    const max = await getMaxSellableQuantity(product);
    if (line.quantity > max) {
      throw new Error(
        `Only ${max} of ${line.product_name} left in stock`
      );
    }
  }

  const payment = await db.getFirstAsync<{ id: number; enabled: number }>(
    'SELECT id, enabled FROM payment_methods WHERE id = ?',
    input.paymentMethodId
  );
  if (!payment || payment.enabled !== 1) {
    throw new Error('Selected payment method is not available');
  }

  const currency = await db.getFirstAsync<{ id: number; enabled: number }>(
    'SELECT id, enabled FROM currencies WHERE id = ?',
    input.currencyId
  );
  if (!currency || currency.enabled !== 1) {
    throw new Error('Selected currency is not available');
  }

  let orderId = 0;
  let orderNumber = 0;

  await db.withTransactionAsync(async () => {
    orderNumber = await nextDailyOrderNumber(orderDate);

    const result = await db.runAsync(
      `INSERT INTO orders
        (order_number, order_date, cashier_id, payment_method_id, currency_id,
         subtotal, total, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?)`,
      orderNumber,
      orderDate,
      input.cashierId,
      input.paymentMethodId,
      input.currencyId,
      total,
      total,
      now
    );
    orderId = Number(result.lastInsertRowId);

    for (const line of input.lines) {
      const lineTotal =
        Math.round(line.unit_price * line.quantity * 100) / 100;
      await db.runAsync(
        `INSERT INTO order_items
          (order_id, product_id, product_name, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        orderId,
        line.product_id,
        line.product_name,
        line.quantity,
        line.unit_price,
        lineTotal
      );
      await deductInventoryForLine(line, input.cashierId, orderId);
    }
  });

  await writeAuditLog({
    userId: input.cashierId,
    action: 'ORDER_COMPLETE',
    entityType: 'order',
    entityId: orderId,
    details: {
      order_number: orderNumber,
      order_date: orderDate,
      total,
      items: input.lines.length,
    },
  });

  const order = await getOrderById(orderId);
  if (!order) throw new Error('Order saved but could not be loaded');
  return order;
}

export async function getOrderById(id: number): Promise<Order | null> {
  const db = await getDatabase();
  const order = await db.getFirstAsync<Order>(
    `SELECT o.*,
            u.full_name as cashier_name,
            pm.name as payment_method_name,
            c.name as currency_name,
            c.symbol as currency_symbol
     FROM orders o
     LEFT JOIN users u ON u.id = o.cashier_id
     LEFT JOIN payment_methods pm ON pm.id = o.payment_method_id
     LEFT JOIN currencies c ON c.id = o.currency_id
     WHERE o.id = ?`,
    id
  );
  if (!order) return null;

  const items = await db.getAllAsync<NonNullable<Order['items']>[number]>(
    `SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC`,
    id
  );
  return { ...order, items };
}

export async function listOrders(
  filters: ListOrdersFilters = {}
): Promise<Order[]> {
  const db = await getDatabase();
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (filters.dateFrom) {
    clauses.push('o.order_date >= ?');
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    clauses.push('o.order_date <= ?');
    params.push(filters.dateTo);
  }
  if (filters.cashierId != null) {
    clauses.push('o.cashier_id = ?');
    params.push(filters.cashierId);
  }
  if (filters.currencyId != null) {
    clauses.push('o.currency_id = ?');
    params.push(filters.currencyId);
  }
  if (filters.status) {
    clauses.push('o.status = ?');
    params.push(filters.status);
  }

  const ref = filters.saleReference?.trim();
  if (ref) {
    const digits = ref.replace(/^#/, '').trim();
    if (digits) {
      clauses.push(
        '(CAST(o.order_number AS TEXT) = ? OR CAST(o.id AS TEXT) = ? OR CAST(o.order_number AS TEXT) LIKE ?)'
      );
      params.push(digits, digits, `%${digits}%`);
    }
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  return db.getAllAsync<Order>(
    `SELECT o.*,
            u.full_name as cashier_name,
            pm.name as payment_method_name,
            c.name as currency_name,
            c.symbol as currency_symbol,
            (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
     FROM orders o
     LEFT JOIN users u ON u.id = o.cashier_id
     LEFT JOIN payment_methods pm ON pm.id = o.payment_method_id
     LEFT JOIN currencies c ON c.id = o.currency_id
     ${where}
     ORDER BY o.order_date DESC, o.order_number DESC, o.id DESC`,
    ...params
  );
}

/** Sums COMPLETED orders in the list, grouped by currency. */
export function summarizeSalesTotals(orders: Order[]): SalesTotalByCurrency[] {
  const map = new Map<string, SalesTotalByCurrency>();
  for (const order of orders) {
    if (order.status !== 'COMPLETED') continue;
    const key = String(order.currency_id ?? 'none');
    const existing = map.get(key);
    if (existing) {
      existing.total =
        Math.round((existing.total + order.total) * 100) / 100;
      existing.order_count += 1;
    } else {
      map.set(key, {
        currency_id: order.currency_id,
        currency_name: order.currency_name ?? 'Unknown',
        currency_symbol: order.currency_symbol ?? '$',
        total: order.total,
        order_count: 1,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.currency_name.localeCompare(b.currency_name)
  );
}

/**
 * Restocks inventory from the original SALE movements and marks the order REVERSED.
 * Admin-only at the UI layer; this function does not check role.
 */
export async function reverseOrder(
  orderId: number,
  adminUserId: number
): Promise<Order> {
  const db = await getDatabase();
  const existing = await getOrderById(orderId);
  if (!existing) throw new Error('Sale not found');
  if (existing.status === 'REVERSED') {
    throw new Error('This sale has already been reversed');
  }
  if (existing.status !== 'COMPLETED') {
    throw new Error('Only completed sales can be reversed');
  }

  const now = toIsoNow();

  await db.withTransactionAsync(async () => {
    const movements = await db.getAllAsync<{
      inventory_item_id: number;
      quantity_change: number;
      reason: string | null;
    }>(
      `SELECT inventory_item_id, quantity_change, reason
       FROM stock_movements
       WHERE order_id = ? AND movement_type = 'SALE'
       ORDER BY id ASC`,
      orderId
    );

    for (const movement of movements) {
      const restoreQty = -movement.quantity_change;
      if (restoreQty === 0) continue;

      const item = await db.getFirstAsync<{ id: number; quantity: number }>(
        'SELECT id, quantity FROM inventory_items WHERE id = ?',
        movement.inventory_item_id
      );
      if (!item) {
        throw new Error('Inventory item missing while reversing sale');
      }

      const before = item.quantity;
      const after = before + restoreQty;
      await db.runAsync(
        'UPDATE inventory_items SET quantity = ?, updated_at = ? WHERE id = ?',
        after,
        now,
        item.id
      );
      await db.runAsync(
        `INSERT INTO stock_movements
          (inventory_item_id, movement_type, quantity_before, quantity_change,
           quantity_after, reason, user_id, order_id, created_at)
         VALUES (?, 'ADJUSTMENT', ?, ?, ?, ?, ?, ?, ?)`,
        item.id,
        before,
        restoreQty,
        after,
        `Sale reversed · Order #${existing.order_number}`,
        adminUserId,
        orderId,
        now
      );
    }

    await db.runAsync(
      `UPDATE orders SET status = 'REVERSED' WHERE id = ?`,
      orderId
    );
  });

  await writeAuditLog({
    userId: adminUserId,
    action: 'ORDER_REVERSE',
    entityType: 'order',
    entityId: orderId,
    details: {
      order_number: existing.order_number,
      order_date: existing.order_date,
      total: existing.total,
    },
  });

  const order = await getOrderById(orderId);
  if (!order) throw new Error('Sale reversed but could not be loaded');
  return order;
}

/**
 * Permanently deletes a sale. Restores stock if still COMPLETED.
 * Only sale-delete admins may call this.
 */
export async function deleteOrder(
  orderId: number,
  adminUserId: number
): Promise<{ order_number: number }> {
  const { canDeleteSales } = await import(
    '@/services/saleDeleteAdminService'
  );
  if (!(await canDeleteSales(adminUserId))) {
    throw new Error('You do not have permission to delete sales');
  }

  const db = await getDatabase();
  const existing = await getOrderById(orderId);
  if (!existing) throw new Error('Sale not found');

  const now = toIsoNow();
  const snapshot = {
    order_number: existing.order_number,
    order_date: existing.order_date,
    total: existing.total,
    status: existing.status,
  };

  await db.withTransactionAsync(async () => {
    if (existing.status === 'COMPLETED') {
      const movements = await db.getAllAsync<{
        inventory_item_id: number;
        quantity_change: number;
      }>(
        `SELECT inventory_item_id, quantity_change
         FROM stock_movements
         WHERE order_id = ? AND movement_type = 'SALE'
         ORDER BY id ASC`,
        orderId
      );

      for (const movement of movements) {
        const restoreQty = -movement.quantity_change;
        if (restoreQty === 0) continue;

        const item = await db.getFirstAsync<{ id: number; quantity: number }>(
          'SELECT id, quantity FROM inventory_items WHERE id = ?',
          movement.inventory_item_id
        );
        if (!item) {
          throw new Error('Inventory item missing while deleting sale');
        }

        const before = item.quantity;
        const after = before + restoreQty;
        await db.runAsync(
          'UPDATE inventory_items SET quantity = ?, updated_at = ? WHERE id = ?',
          after,
          now,
          item.id
        );
        // Restore qty without linking order_id — order row will be removed
        await db.runAsync(
          `INSERT INTO stock_movements
            (inventory_item_id, movement_type, quantity_before, quantity_change,
             quantity_after, reason, user_id, order_id, created_at)
           VALUES (?, 'ADJUSTMENT', ?, ?, ?, ?, ?, NULL, ?)`,
          item.id,
          before,
          restoreQty,
          after,
          `Sale deleted · Order #${existing.order_number}`,
          adminUserId,
          now
        );
      }
    }

    await db.runAsync(
      'DELETE FROM stock_movements WHERE order_id = ?',
      orderId
    );
    await db.runAsync('DELETE FROM orders WHERE id = ?', orderId);
  });

  await writeAuditLog({
    userId: adminUserId,
    action: 'ORDER_DELETE',
    entityType: 'order',
    entityId: orderId,
    details: snapshot,
  });

  return { order_number: snapshot.order_number };
}

export async function reprintOrder(orderId: number): Promise<string> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error('Sale not found');

  const { printReceiptsWithPrompt } = await import('@/services/receiptPrintFlow');
  const { usePrinterStore } = await import('@/stores/printerStore');

  // Soft check only — print path reconnects if needed
  const printer = usePrinterStore.getState();
  if (!printer.deviceAddress && !printer.isConnected) {
    throw new Error('No printer configured. Open Printer settings to connect.');
  }

  const summary = await printReceiptsWithPrompt(order, { force: true });
  if (summary.customer.status === 'skipped') {
    throw new Error(summary.customer.reason ?? 'Printing skipped');
  }
  if (summary.customer.status === 'failed') {
    throw new Error(summary.customer.reason ?? 'Print failed');
  }
  return summary.message;
}

export async function priceForCurrency(
  basePrice: number,
  currencyId: number
): Promise<number> {
  const prices = await buildConvertedPrices(basePrice, { enabledOnly: false });
  const match = prices.find((p) => p.currency_id === currencyId);
  if (match) return match.price;
  return Math.round(basePrice * 100) / 100;
}
