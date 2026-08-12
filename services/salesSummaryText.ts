import { formatMoney } from '@/utils/formatMoney';
import type {
  DailyCloseSummary,
  ProductSalesRow,
} from '@/services/reportService';

/** Soft cap per SMS body to limit multi-part credit use. */
const SMS_MAX = 1200;

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function clampSms(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= SMS_MAX) return trimmed;
  return `${trimmed.slice(0, SMS_MAX - 1)}...`;
}

function formatDisplayDate(iso: string): string {
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d || m < 1 || m > 12) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function formatPeriod(dateFrom: string, dateTo: string): string {
  if (dateFrom === dateTo) return formatDisplayDate(dateFrom);
  return `${formatDisplayDate(dateFrom)} - ${formatDisplayDate(dateTo)}`;
}

function divider(): string {
  // ASCII only — GSM/SMS gateways often turn Unicode box lines into "?"
  return '------------';
}

function money(amount: number, symbol = '$'): string {
  return formatMoney(amount, symbol);
}

function qtyLabel(qty: number): string {
  const n = Number(qty) || 0;
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function aggregatePayments(
  rows: {
    payment_method_name: string;
    total: number;
    order_count: number;
    currency_symbol?: string;
  }[]
): { name: string; total: number; order_count: number; symbol: string }[] {
  const map = new Map<
    string,
    { name: string; total: number; order_count: number; symbol: string }
  >();
  for (const row of rows) {
    const key = row.payment_method_name || 'Unknown';
    const existing = map.get(key);
    if (existing) {
      existing.total += Number(row.total) || 0;
      existing.order_count += Number(row.order_count) || 0;
    } else {
      map.set(key, {
        name: key,
        total: Number(row.total) || 0,
        order_count: Number(row.order_count) || 0,
        symbol: row.currency_symbol || '$',
      });
    }
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

/**
 * SMS 1 — products sold: qty, name, line total.
 */
export function formatItemsSoldText(input: {
  restaurantName?: string;
  dateFrom: string;
  dateTo: string;
  products: ProductSalesRow[];
}): string {
  const title = input.restaurantName?.trim() || 'Culina POS';
  const period = formatPeriod(input.dateFrom, input.dateTo);
  const lines: string[] = [];

  lines.push(title);
  lines.push('ITEMS SOLD');
  lines.push(period);
  lines.push(divider());

  if (input.products.length === 0) {
    lines.push('No items sold in this period.');
    return clampSms(lines.join('\n'));
  }

  let totalQty = 0;
  let salesTotal = 0;

  for (const row of input.products) {
    const qty = Number(row.quantity) || 0;
    const lineTotal = Number(row.total) || 0;
    totalQty += qty;
    salesTotal += lineTotal;
    lines.push(
      `${qtyLabel(qty)} x ${row.product_name} - ${money(lineTotal)}`
    );
  }

  lines.push(divider());
  lines.push(
    `${qtyLabel(totalQty)} units / ${input.products.length} product${
      input.products.length === 1 ? '' : 's'
    }`
  );
  lines.push(`Items total - ${money(salesTotal)}`);

  return clampSms(lines.join('\n'));
}

/**
 * SMS 2 — sales summary with payment methods (single-currency, no currency labels).
 */
export function formatSalesSummaryText(
  summary: DailyCloseSummary,
  restaurantName?: string
): string {
  const title = restaurantName?.trim() || 'Culina POS';
  const period = formatPeriod(summary.date_from, summary.date_to);
  const symbol = summary.by_currency[0]?.currency_symbol || '$';
  const lines: string[] = [];

  lines.push(title);
  lines.push('SALES SUMMARY');
  lines.push(period);
  lines.push(
    `${summary.order_count} order${summary.order_count === 1 ? '' : 's'}`
  );
  lines.push(divider());

  const cashiers = [
    ...new Map(
      summary.by_cashier.map((row) => [
        row.cashier_id,
        { id: row.cashier_id, name: row.cashier_name },
      ])
    ).values(),
  ];

  if (cashiers.length === 0) {
    lines.push('No completed sales in this period.');
    return clampSms(lines.join('\n'));
  }

  for (const cashier of cashiers) {
    const currencyRows = summary.by_cashier.filter(
      (r) => r.cashier_id === cashier.id
    );
    const paymentRows = aggregatePayments(
      summary.by_cashier_payment.filter((r) => r.cashier_id === cashier.id)
    );
    const cashierTotal = currencyRows.reduce(
      (sum, row) => sum + (Number(row.total) || 0),
      0
    );

    lines.push(cashier.name.toUpperCase());

    if (paymentRows.length === 0) {
      lines.push('No payments recorded');
    } else {
      for (const pay of paymentRows) {
        lines.push(
          `${pay.name} - ${money(pay.total, pay.symbol || symbol)} (${pay.order_count})`
        );
      }
    }

    lines.push(`Cashier total - ${money(cashierTotal, symbol)}`);
    lines.push(divider());
  }

  const overallPayments = aggregatePayments(summary.by_payment);
  if (overallPayments.length > 0 && cashiers.length > 1) {
    lines.push('ALL PAYMENTS');
    for (const pay of overallPayments) {
      lines.push(
        `${pay.name} - ${money(pay.total, pay.symbol || symbol)} (${pay.order_count})`
      );
    }
    lines.push(divider());
  }

  const grandTotal = summary.by_currency.reduce(
    (sum, row) => sum + (Number(row.total) || 0),
    0
  );
  lines.push(`GRAND TOTAL - ${money(grandTotal, symbol)}`);
  lines.push('Culina POS');

  return clampSms(lines.join('\n'));
}

export function formatSalesCloseText(
  summary: DailyCloseSummary,
  restaurantName?: string
): string {
  return formatSalesSummaryText(summary, restaurantName);
}
