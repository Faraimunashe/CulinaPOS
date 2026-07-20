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
