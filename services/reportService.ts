import { getDatabase } from '@/database';
import { localOrderDate } from '@/services/orderService';
import { isLowStock } from '@/services/inventoryService';
import type { InventoryItem } from '@/types';

export interface SalesSummary {
  order_count: number;
  item_count: number;
  total: number;
}

export interface DailySalesRow {
  order_date: string;
  order_count: number;
  total: number;
}

export interface ProductSalesRow {
  product_id: number;
  product_name: string;
  quantity: number;
  total: number;
}

export interface CashierSalesRow {
  cashier_id: number;
  cashier_name: string;
  order_count: number;
  total: number;
}

export interface PaymentSalesRow {
  payment_method_id: number | null;
  payment_method_name: string;
  order_count: number;
  total: number;
}

export interface CurrencyTotalRow {
  currency_id: number | null;
  currency_name: string;
  currency_symbol: string;
  order_count: number;
  total: number;
}

export interface CashierCurrencyTotalRow {
  cashier_id: number;
  cashier_name: string;
  currency_id: number | null;
  currency_name: string;
  currency_symbol: string;
  order_count: number;
  total: number;
}

export interface PaymentCurrencyTotalRow {
  payment_method_id: number | null;
  payment_method_name: string;
  currency_id: number | null;
  currency_name: string;
  currency_symbol: string;
  order_count: number;
  total: number;
}

export interface CashierPaymentCurrencyTotalRow {
  cashier_id: number;
  cashier_name: string;
  payment_method_id: number | null;
  payment_method_name: string;
  currency_id: number | null;
  currency_name: string;
  currency_symbol: string;
  order_count: number;
  total: number;
}

export interface DailyCloseSummary {
  order_date: string;
  date_from: string;
  date_to: string;
  order_count: number;
  by_cashier: CashierCurrencyTotalRow[];
  by_cashier_payment: CashierPaymentCurrencyTotalRow[];
  by_payment: PaymentCurrencyTotalRow[];
  by_currency: CurrencyTotalRow[];
}

function monthPrefix(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export async function getTodaySalesSummary(): Promise<SalesSummary> {
  const db = await getDatabase();
  const today = localOrderDate();
  const orders = await db.getFirstAsync<{
    order_count: number;
    total: number | null;
  }>(
    `SELECT COUNT(*) as order_count, COALESCE(SUM(total), 0) as total
     FROM orders
     WHERE order_date = ? AND status = 'COMPLETED'`,
    today
  );
  const items = await db.getFirstAsync<{ item_count: number | null }>(
    `SELECT COALESCE(SUM(oi.quantity), 0) as item_count
     FROM order_items oi
     INNER JOIN orders o ON o.id = oi.order_id
     WHERE o.order_date = ? AND o.status = 'COMPLETED'`,
    today
  );
  return {
    order_count: orders?.order_count ?? 0,
    item_count: Number(items?.item_count ?? 0),
    total: Number(orders?.total ?? 0),
  };
}

export async function getDailySales(options?: {
  days?: number;
}): Promise<DailySalesRow[]> {
  const db = await getDatabase();
  const days = options?.days ?? 30;
  return db.getAllAsync<DailySalesRow>(
    `SELECT order_date,
            COUNT(*) as order_count,
            COALESCE(SUM(total), 0) as total
     FROM orders
     WHERE status = 'COMPLETED'
       AND order_date >= date('now', ?)
     GROUP BY order_date
     ORDER BY order_date DESC`,
    `-${days} days`
  );
}

export async function getMonthlySalesSummary(): Promise<SalesSummary> {
  const db = await getDatabase();
  const prefix = monthPrefix();
  const orders = await db.getFirstAsync<{
    order_count: number;
    total: number | null;
  }>(
    `SELECT COUNT(*) as order_count, COALESCE(SUM(total), 0) as total
     FROM orders
     WHERE status = 'COMPLETED' AND order_date LIKE ?`,
    `${prefix}%`
  );
  const items = await db.getFirstAsync<{ item_count: number | null }>(
    `SELECT COALESCE(SUM(oi.quantity), 0) as item_count
     FROM order_items oi
     INNER JOIN orders o ON o.id = oi.order_id
     WHERE o.status = 'COMPLETED' AND o.order_date LIKE ?`,
    `${prefix}%`
  );
  return {
    order_count: orders?.order_count ?? 0,
    item_count: Number(items?.item_count ?? 0),
    total: Number(orders?.total ?? 0),
  };
}

export async function getSalesByProduct(options?: {
  days?: number;
}): Promise<ProductSalesRow[]> {
  const db = await getDatabase();
  const days = options?.days ?? 30;
  return db.getAllAsync<ProductSalesRow>(
    `SELECT oi.product_id,
            oi.product_name,
            COALESCE(SUM(oi.quantity), 0) as quantity,
            COALESCE(SUM(oi.line_total), 0) as total
     FROM order_items oi
     INNER JOIN orders o ON o.id = oi.order_id
     WHERE o.status = 'COMPLETED'
       AND o.order_date >= date('now', ?)
     GROUP BY oi.product_id, oi.product_name
     ORDER BY quantity DESC, oi.product_name COLLATE NOCASE ASC`,
    `-${days} days`
  );
}

/** Products sold in a date range (same filters as daily close / SMS). */
export async function getProductSalesForRange(options?: {
  dateFrom?: string | null;
  dateTo?: string | null;
  cashierId?: number | null;
  currencyId?: number | null;
}): Promise<ProductSalesRow[]> {
  const db = await getDatabase();
  const today = localOrderDate();
  const dateFrom = options?.dateFrom?.trim() || today;
  const dateTo = options?.dateTo?.trim() || today;

  const clauses = [
    'o.status = ?',
    'o.order_date >= ?',
    'o.order_date <= ?',
  ];
  const params: (string | number)[] = ['COMPLETED', dateFrom, dateTo];

  if (options?.cashierId != null) {
    clauses.push('o.cashier_id = ?');
    params.push(options.cashierId);
  }
  if (options?.currencyId != null) {
    clauses.push('o.currency_id = ?');
    params.push(options.currencyId);
  }

  return db.getAllAsync<ProductSalesRow>(
    `SELECT oi.product_id,
            oi.product_name,
            COALESCE(SUM(oi.quantity), 0) as quantity,
            COALESCE(SUM(oi.line_total), 0) as total
     FROM order_items oi
     INNER JOIN orders o ON o.id = oi.order_id
     WHERE ${clauses.join(' AND ')}
     GROUP BY oi.product_id, oi.product_name
     ORDER BY quantity DESC, oi.product_name COLLATE NOCASE ASC`,
    ...params
  );
}

export async function getSalesByCashier(options?: {
  days?: number;
}): Promise<CashierSalesRow[]> {
  const db = await getDatabase();
  const days = options?.days ?? 30;
  return db.getAllAsync<CashierSalesRow>(
    `SELECT o.cashier_id,
            u.full_name as cashier_name,
            COUNT(*) as order_count,
            COALESCE(SUM(o.total), 0) as total
     FROM orders o
     INNER JOIN users u ON u.id = o.cashier_id
     WHERE o.status = 'COMPLETED'
       AND o.order_date >= date('now', ?)
     GROUP BY o.cashier_id, u.full_name
     ORDER BY total DESC`,
    `-${days} days`
  );
}

export async function getSalesByPaymentMethod(options?: {
  days?: number;
}): Promise<PaymentSalesRow[]> {
  const db = await getDatabase();
  const days = options?.days ?? 30;
  return db.getAllAsync<PaymentSalesRow>(
    `SELECT o.payment_method_id,
            COALESCE(pm.name, 'Unknown') as payment_method_name,
            COUNT(*) as order_count,
            COALESCE(SUM(o.total), 0) as total
     FROM orders o
     LEFT JOIN payment_methods pm ON pm.id = o.payment_method_id
     WHERE o.status = 'COMPLETED'
       AND o.order_date >= date('now', ?)
     GROUP BY o.payment_method_id, pm.name
     ORDER BY total DESC`,
    `-${days} days`
  );
}

/** Sales close/summary report for a day or date range (defaults to today). */
export async function getDailyCloseSummary(options?: {
  /** Single day (legacy). Ignored if dateFrom/dateTo are set. */
  orderDate?: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  cashierId?: number | null;
  currencyId?: number | null;
}): Promise<DailyCloseSummary> {
  const db = await getDatabase();
  const today = localOrderDate();
  const dateFrom =
    options?.dateFrom?.trim() ||
    options?.orderDate?.trim() ||
    today;
  const dateTo =
    options?.dateTo?.trim() ||
    options?.orderDate?.trim() ||
    today;

  const clauses = [
    'o.status = ?',
    'o.order_date >= ?',
    'o.order_date <= ?',
  ];
  const params: (string | number)[] = ['COMPLETED', dateFrom, dateTo];

  if (options?.cashierId != null) {
    clauses.push('o.cashier_id = ?');
    params.push(options.cashierId);
  }
  if (options?.currencyId != null) {
    clauses.push('o.currency_id = ?');
    params.push(options.currencyId);
  }

  const where = `WHERE ${clauses.join(' AND ')}`;

  const orderCountRow = await db.getFirstAsync<{ order_count: number }>(
    `SELECT COUNT(*) as order_count FROM orders o ${where}`,
    ...params
  );

  const by_cashier = await db.getAllAsync<CashierCurrencyTotalRow>(
    `SELECT o.cashier_id,
            COALESCE(u.full_name, 'Unknown') as cashier_name,
            o.currency_id,
            COALESCE(c.name, 'Unknown') as currency_name,
            COALESCE(c.symbol, '$') as currency_symbol,
            COUNT(*) as order_count,
            COALESCE(SUM(o.total), 0) as total
     FROM orders o
     LEFT JOIN users u ON u.id = o.cashier_id
     LEFT JOIN currencies c ON c.id = o.currency_id
     ${where}
     GROUP BY o.cashier_id, u.full_name, o.currency_id, c.name, c.symbol
     ORDER BY u.full_name COLLATE NOCASE ASC, c.name COLLATE NOCASE ASC`,
    ...params
  );

  const by_cashier_payment =
    await db.getAllAsync<CashierPaymentCurrencyTotalRow>(
      `SELECT o.cashier_id,
              COALESCE(u.full_name, 'Unknown') as cashier_name,
              o.payment_method_id,
              COALESCE(pm.name, 'Unknown') as payment_method_name,
              o.currency_id,
              COALESCE(c.name, 'Unknown') as currency_name,
              COALESCE(c.symbol, '$') as currency_symbol,
              COUNT(*) as order_count,
              COALESCE(SUM(o.total), 0) as total
       FROM orders o
       LEFT JOIN users u ON u.id = o.cashier_id
       LEFT JOIN payment_methods pm ON pm.id = o.payment_method_id
       LEFT JOIN currencies c ON c.id = o.currency_id
       ${where}
       GROUP BY o.cashier_id, u.full_name,
                o.payment_method_id, pm.name,
                o.currency_id, c.name, c.symbol
       ORDER BY u.full_name COLLATE NOCASE ASC,
                pm.name COLLATE NOCASE ASC,
                c.name COLLATE NOCASE ASC`,
      ...params
    );

  const by_payment = await db.getAllAsync<PaymentCurrencyTotalRow>(
    `SELECT o.payment_method_id,
            COALESCE(pm.name, 'Unknown') as payment_method_name,
            o.currency_id,
            COALESCE(c.name, 'Unknown') as currency_name,
            COALESCE(c.symbol, '$') as currency_symbol,
            COUNT(*) as order_count,
            COALESCE(SUM(o.total), 0) as total
     FROM orders o
     LEFT JOIN payment_methods pm ON pm.id = o.payment_method_id
     LEFT JOIN currencies c ON c.id = o.currency_id
     ${where}
     GROUP BY o.payment_method_id, pm.name, o.currency_id, c.name, c.symbol
     ORDER BY pm.name COLLATE NOCASE ASC, c.name COLLATE NOCASE ASC`,
    ...params
  );

  const by_currency = await db.getAllAsync<CurrencyTotalRow>(
    `SELECT o.currency_id,
            COALESCE(c.name, 'Unknown') as currency_name,
            COALESCE(c.symbol, '$') as currency_symbol,
            COUNT(*) as order_count,
            COALESCE(SUM(o.total), 0) as total
     FROM orders o
     LEFT JOIN currencies c ON c.id = o.currency_id
     ${where}
     GROUP BY o.currency_id, c.name, c.symbol
     ORDER BY c.name COLLATE NOCASE ASC`,
    ...params
  );

  return {
    order_date: dateFrom === dateTo ? dateFrom : `${dateFrom} to ${dateTo}`,
    date_from: dateFrom,
    date_to: dateTo,
    order_count: orderCountRow?.order_count ?? 0,
    by_cashier,
    by_cashier_payment,
    by_payment,
    by_currency,
  };
}

export async function getInventoryReport(): Promise<InventoryItem[]> {
  const db = await getDatabase();
  return db.getAllAsync<InventoryItem>(
    `SELECT i.*,
            p.id as linked_product_id,
            p.name as linked_product_name
     FROM inventory_items i
     LEFT JOIN products p
       ON p.inventory_item_id = i.id AND p.tracking_type = 'DIRECT'
     ORDER BY i.item_kind ASC, i.name COLLATE NOCASE ASC`
  );
}

export async function getLowStockReport(): Promise<InventoryItem[]> {
  const items = await getInventoryReport();
  return items.filter((item) => isLowStock(item));
}
